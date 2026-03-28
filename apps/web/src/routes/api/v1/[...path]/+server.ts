import { execFile } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import {
  getCpu,
  getDisk,
  getMemory,
  getNetwork,
  getPihole,
  getRss,
  getTemperature,
  getUptime,
  getWeather,
  type RssFeedConfig,
} from '@phavo/agent';
import { decrypt, encrypt, schema } from '@phavo/db';
import {
  err,
  isCredentialField,
  ok,
  PRESERVE_CREDENTIAL_VALUE,
  type WidgetSize,
} from '@phavo/types';
import { env } from '@phavo/types/env';
import type { RequestEvent } from '@sveltejs/kit';
import { hashPassword, verifyPassword } from 'better-auth/crypto';
import { asc, desc, eq, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import { cached } from '$lib/server/agent';
import { checkRateLimit, recordLoginAttempt } from '$lib/server/auth';
import { db } from '$lib/server/db';
import { activateLocalLicense } from '$lib/server/license';
import {
  type AppVariables,
  authMiddleware,
  requireSession,
  requireTier,
} from '$lib/server/middleware/auth';
import { csrfMiddleware, deriveCsrfToken } from '$lib/server/middleware/csrf';
import {
  checkIpRateLimit,
  DEFAULT_RULE,
  getClientIp,
  IMPORT_RULE,
  METRICS_RULE,
  TOTP_RULE,
} from '$lib/server/middleware/rate-limit';
import { DEV_MOCK_AUTH_ENABLED } from '$lib/server/mock-auth';
import { drainQueue, serverNotify } from '$lib/server/notifier';
import { paths } from '$lib/server/paths';
import {
  LinksWidgetConfigSchema,
  RssWidgetConfigSchema,
  registry,
} from '$lib/server/widget-registry';

const app = new Hono<{ Variables: AppVariables }>().basePath('/api/v1');

// ─── Global middleware ────────────────────────────────────────────────────────
// authMiddleware validates the session cookie on every non-public request.
// csrfMiddleware validates the X-CSRF-Token header on state-changing requests.
app.use('*', authMiddleware);
app.use('*', csrfMiddleware);

// rateLimitMiddleware: applied after auth so we have the full path.
// /auth/login has its own rate limiting in the handler (checkRateLimit).
// /health is public and not rate-limited here.
app.use('*', async (c, next) => {
  const path = c.req.path;
  // Public paths handled elsewhere — skip.
  if (path === '/api/v1/health' || path === '/api/v1/auth/login') {
    return next();
  }

  const ip = getClientIp(c.req);

  // Select the applicable rule based on route.
  let rule = DEFAULT_RULE;
  if (path === '/api/v1/auth/totp') {
    rule = TOTP_RULE;
  } else if (
    path === '/api/v1/cpu' ||
    path === '/api/v1/memory' ||
    path === '/api/v1/disk' ||
    path === '/api/v1/network' ||
    path === '/api/v1/temperature' ||
    path === '/api/v1/uptime' ||
    path === '/api/v1/weather'
  ) {
    rule = METRICS_RULE;
  } else if (path === '/api/v1/config/import') {
    rule = IMPORT_RULE;
  }

  const result = checkIpRateLimit(`${ip}:${path}`, rule);
  if (!result.allowed) {
    const retryAfterSec = Math.ceil((result.retryAfterMs ?? 60_000) / 1000);
    return c.json(err('Rate limit exceeded'), 429, {
      'Retry-After': String(retryAfterSec),
    });
  }

  return next();
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function assertNotCloudMetadata(urlString: string): void {
  const parsed = new URL(urlString);
  const hostname = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '');

  const blockedHostnames = ['169.254.169.254', 'metadata.google.internal', 'metadata.goog'];
  const blockedPatterns = [/^169\.254\./, /^fd00:ec2:/i, /^::1$/];

  if (blockedHostnames.includes(hostname)) {
    throw new Error('URL not allowed');
  }

  for (const pattern of blockedPatterns) {
    if (pattern.test(hostname)) {
      throw new Error('URL not allowed');
    }
  }

  if (parsed.username || parsed.password) {
    throw new Error('URL not allowed');
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('URL not allowed');
  }
}

function parseConfigEntries(rows: Array<{ key: string; value: string }>) {
  const entries: Record<string, string> = {};
  for (const row of rows) entries[row.key] = row.value;
  return {
    setupComplete: entries.setup_complete === 'true',
    dashboardName: entries.dashboard_name ?? 'My Dashboard',
    tabs: [],
    sessionTimeout: (entries.session_timeout as '1d' | '7d' | '30d' | 'never' | undefined) ?? '7d',
    location:
      entries.location_name && entries.location_latitude && entries.location_longitude
        ? {
            name: entries.location_name,
            latitude: Number(entries.location_latitude),
            longitude: Number(entries.location_longitude),
          }
        : undefined,
  };
}

/** Verifies an RS256-signed JWT using a base64-encoded SPKI public key.
 *  Returns false on any error (invalid signature, expired, malformed). */
async function verifyActivationJwt(jwt: string, pubKeyB64: string): Promise<boolean> {
  const parts = jwt.split('.');
  if (parts.length !== 3) return false;
  const [headerB64, payloadB64, sigB64] = parts as [string, string, string];
  try {
    const pubKeyBytes = Uint8Array.from(atob(pubKeyB64), (c) => c.charCodeAt(0));
    const sigBytes = Uint8Array.from(atob(sigB64.replace(/-/g, '+').replace(/_/g, '/')), (c) =>
      c.charCodeAt(0),
    );
    const cryptoKey = await crypto.subtle.importKey(
      'spki',
      pubKeyBytes,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['verify'],
    );
    const message = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
    const valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', cryptoKey, sigBytes, message);
    if (!valid) return false;
    const payload = JSON.parse(atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/'))) as {
      exp?: number;
    };
    if (payload.exp && payload.exp * 1000 < Date.now()) return false;
    return true;
  } catch {
    return false;
  }
}

/** Base32 alphabet for TOTP secret decoding. */
const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32Decode(input: string): Uint8Array {
  const cleaned = input.toUpperCase().replace(/=+$/, '');
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const char of cleaned) {
    const idx = BASE32.indexOf(char);
    if (idx < 0) throw new Error(`Invalid base32 character: ${char}`);
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return new Uint8Array(out);
}

/** Verifies a 6-digit TOTP code against the given base32 secret (RFC 6238).
 *  Allows ±1 30-second window to account for clock skew. */
async function verifyTotpCode(secret: string, code: string): Promise<boolean> {
  const secretBytes = base32Decode(secret);
  const key = await crypto.subtle.importKey(
    'raw',
    secretBytes.buffer as ArrayBuffer,
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign'],
  );
  const now = Math.floor(Date.now() / 1000);
  for (const drift of [-1, 0, 1]) {
    const counter = Math.floor(now / 30) + drift;
    const counterBytes = new Uint8Array(8);
    new DataView(counterBytes.buffer).setBigUint64(0, BigInt(counter));
    const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, counterBytes));
    const offset = (mac[19] ?? 0) & 0x0f;
    const otp =
      (((mac[offset] ?? 0) & 0x7f) << 24) |
      (((mac[offset + 1] ?? 0) & 0xff) << 16) |
      (((mac[offset + 2] ?? 0) & 0xff) << 8) |
      ((mac[offset + 3] ?? 0) & 0xff);
    if ((otp % 1_000_000).toString().padStart(6, '0') === code) return true;
  }
  return false;
}

function maskLicenseKey(licenseKey?: string | null): string | null {
  if (!licenseKey) return null;
  if (licenseKey.length <= 8) return licenseKey;
  return `${licenseKey.slice(0, 4)}••••${licenseKey.slice(-4)}`;
}

/** Generates a 32-byte cryptographically random session token (base64url). */
function generateSessionToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...Array.from(bytes)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function readOrCreateInstanceIdentifier(): string {
  try {
    if (existsSync(paths.instanceId)) {
      return readFileSync(paths.instanceId, 'utf-8').trim();
    }

    const instanceIdentifier = crypto.randomUUID();
    writeFileSync(paths.instanceId, instanceIdentifier);
    return instanceIdentifier;
  } catch {
    return crypto.randomUUID();
  }
}

/** Partial sessions for the TOTP 2FA flow: partialToken → pending session data. */
interface PendingSession {
  userId: string;
  tier: 'free' | 'standard' | 'local';
  authMode: 'phavo-io' | 'local';
  graceUntil: number | null;
  expiresMs: number; // absolute timestamp when this partial session expires
}
const partialSessions = new Map<string, PendingSession>();
// Prune expired partial sessions every minute.
setInterval(() => {
  const now = Date.now();
  for (const [token, s] of partialSessions) {
    if (s.expiresMs < now) partialSessions.delete(token);
  }
}, 60_000);

function appendSetCookie(response: Response, value: string): void {
  response.headers.append('Set-Cookie', value);
}

/** Sets phavo_session (HttpOnly) and phavo_csrf (readable by JS) response cookies. */
async function setSessionCookies(
  response: Response,
  token: string,
  maxAgeSeconds: number,
): Promise<void> {
  const csrfToken = await deriveCsrfToken(token);
  const secure = env.nodeEnv === 'production' ? '; Secure' : '';
  appendSetCookie(
    response,
    `phavo_session=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAgeSeconds}${secure}`,
  );
  appendSetCookie(
    response,
    `phavo_csrf=${csrfToken}; Path=/; SameSite=Lax; Max-Age=${maxAgeSeconds}${secure}`,
  );
}

function clearSessionCookies(response: Response): void {
  const secure = env.nodeEnv === 'production' ? '; Secure' : '';
  appendSetCookie(
    response,
    `phavo_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secure}`,
  );
  appendSetCookie(response, `phavo_csrf=; Path=/; SameSite=Lax; Max-Age=0${secure}`);
}

type PiholeCredentials = {
  url: string;
  token: string;
};

let piholeMissingConfigNotified = false;
let piholeFailureCount = 0;

function credentialStorageKey(instanceId: string, fieldPath: string): string {
  return `widget:${instanceId}:${fieldPath}`;
}

async function loadDecryptedCredential(key: string): Promise<string | null> {
  const rows = await db
    .select()
    .from(schema.credentials)
    .where(eq(schema.credentials.key, key))
    .limit(1);
  const row = rows[0];
  if (!row) return null;

  try {
    return await decrypt(row.valueEncrypted);
  } catch {
    return null;
  }
}

async function findConfiguredPiholeCredentials(): Promise<PiholeCredentials | null> {
  const instances = await db
    .select()
    .from(schema.widgetInstances)
    .where(eq(schema.widgetInstances.widgetId, 'pihole'))
    .orderBy(desc(schema.widgetInstances.updatedAt));

  for (const instance of instances) {
    const url = await loadDecryptedCredential(credentialStorageKey(instance.id, 'url'));
    const token = await loadDecryptedCredential(credentialStorageKey(instance.id, 'token'));

    if (url && token) {
      return { url, token };
    }
  }

  return null;
}

type RssFeedSettings = z.infer<typeof RssWidgetConfigSchema>;
type LinksConfig = z.infer<typeof LinksWidgetConfigSchema>;
type CredentialEntry = {
  path: string;
  value: string;
};

type SplitConfigResult = {
  publicConfig: unknown;
  credentials: CredentialEntry[];
  preservedCredentialPaths: string[];
};

async function parseEncryptedWidgetConfig<T>(
  encryptedConfig: string | null,
  configSchema: z.ZodType<T>,
): Promise<T | null> {
  if (!encryptedConfig) return null;

  try {
    const decryptedConfig = await decrypt(encryptedConfig);
    const parsedJson = JSON.parse(decryptedConfig) as unknown;
    const parsedConfig = configSchema.safeParse(parsedJson);
    return parsedConfig.success ? parsedConfig.data : null;
  } catch {
    return null;
  }
}

async function loadInstanceCredentialMap(instanceId: string): Promise<Map<string, string>> {
  const prefix = `widget:${instanceId}:`;
  const rows = await db.select().from(schema.credentials);
  const credentials = new Map<string, string>();

  for (const row of rows) {
    if (!row.key.startsWith(prefix)) continue;

    try {
      credentials.set(row.key.slice(prefix.length), await decrypt(row.valueEncrypted));
    } catch {
      // Ignore individual credential rows that can no longer be decrypted.
    }
  }

  return credentials;
}

function unwrapSchema(schema: z.ZodTypeAny): z.ZodTypeAny {
  let current = schema;

  while (
    current instanceof z.ZodOptional ||
    current instanceof z.ZodNullable ||
    current instanceof z.ZodDefault ||
    current instanceof z.ZodEffects
  ) {
    if (current instanceof z.ZodEffects) {
      current = current._def.schema;
      continue;
    }

    current = current._def.innerType;
  }

  return current;
}

function getArrayItemPath(path: string, item: unknown, index: number): string {
  if (item && typeof item === 'object' && 'id' in item) {
    const itemId = (item as { id?: unknown }).id;
    if (typeof itemId === 'string' && itemId.length > 0) {
      return path ? `${path}.${itemId}` : itemId;
    }
  }

  return path ? `${path}.${index}` : String(index);
}

function splitWidgetConfig(value: unknown, schema: z.ZodTypeAny, path = ''): SplitConfigResult {
  const normalizedSchema = unwrapSchema(schema);

  if (value === undefined) {
    return { publicConfig: undefined, credentials: [], preservedCredentialPaths: [] };
  }

  if (isCredentialField(normalizedSchema)) {
    if (value === PRESERVE_CREDENTIAL_VALUE) {
      return {
        publicConfig: undefined,
        credentials: [],
        preservedCredentialPaths: [path],
      };
    }

    if (value === undefined || value === null || value === '') {
      return { publicConfig: undefined, credentials: [], preservedCredentialPaths: [] };
    }

    return {
      publicConfig: undefined,
      credentials: [{ path, value: String(value) }],
      preservedCredentialPaths: [],
    };
  }

  if (
    normalizedSchema instanceof z.ZodObject &&
    value &&
    typeof value === 'object' &&
    !Array.isArray(value)
  ) {
    const shape = normalizedSchema.shape;
    const publicConfig: Record<string, unknown> = {};
    const credentials: CredentialEntry[] = [];
    const preservedCredentialPaths: string[] = [];

    for (const [key, childSchema] of Object.entries(shape)) {
      const childValue = (value as Record<string, unknown>)[key];
      const childPath = path ? `${path}.${key}` : key;
      const childResult = splitWidgetConfig(childValue, childSchema as z.ZodTypeAny, childPath);

      if (childResult.publicConfig !== undefined) {
        publicConfig[key] = childResult.publicConfig;
      }

      credentials.push(...childResult.credentials);
      preservedCredentialPaths.push(...childResult.preservedCredentialPaths);
    }

    return { publicConfig, credentials, preservedCredentialPaths };
  }

  if (normalizedSchema instanceof z.ZodArray && Array.isArray(value)) {
    const publicConfig: unknown[] = [];
    const credentials: CredentialEntry[] = [];
    const preservedCredentialPaths: string[] = [];

    for (const [index, item] of value.entries()) {
      const childPath = getArrayItemPath(path, item, index);
      const childResult = splitWidgetConfig(item, normalizedSchema.element, childPath);
      publicConfig.push(childResult.publicConfig);
      credentials.push(...childResult.credentials);
      preservedCredentialPaths.push(...childResult.preservedCredentialPaths);
    }

    return { publicConfig, credentials, preservedCredentialPaths };
  }

  return { publicConfig: value, credentials: [], preservedCredentialPaths: [] };
}

function hasPersistedConfigValue(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') return Object.keys(value as Record<string, unknown>).length > 0;
  return true;
}

async function parseWidgetPublicConfig(
  encryptedConfig: string | null,
): Promise<Record<string, unknown> | undefined> {
  if (!encryptedConfig) return undefined;

  try {
    const decrypted = await decrypt(encryptedConfig);
    const parsed = JSON.parse(decrypted) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : undefined;
  } catch {
    return undefined;
  }
}

async function hasStoredWidgetCredentials(instanceId: string): Promise<boolean> {
  const prefix = `widget:${instanceId}:`;
  const rows = await db.select().from(schema.credentials);
  return rows.some((row) => row.key.startsWith(prefix));
}

async function syncInstanceCredentials(
  instanceId: string,
  credentials: CredentialEntry[],
  preservedCredentialPaths: string[],
): Promise<void> {
  const prefix = `widget:${instanceId}:`;
  const existingRows = await db.select().from(schema.credentials);
  const desiredKeys = new Set(
    credentials.map((entry) => credentialStorageKey(instanceId, entry.path)),
  );
  const preservedKeys = new Set(
    preservedCredentialPaths.map((path) => credentialStorageKey(instanceId, path)),
  );

  for (const row of existingRows) {
    if (!row.key.startsWith(prefix) || desiredKeys.has(row.key) || preservedKeys.has(row.key))
      continue;
    await db.delete(schema.credentials).where(eq(schema.credentials.id, row.id));
  }

  for (const entry of credentials) {
    const key = credentialStorageKey(instanceId, entry.path);
    const valueEncrypted = await encrypt(entry.value);

    await db
      .insert(schema.credentials)
      .values({ key, valueEncrypted, updatedAt: Date.now() })
      .onConflictDoUpdate({
        target: schema.credentials.key,
        set: { valueEncrypted, updatedAt: Date.now() },
      });
  }
}

function buildRssFeedAuth(
  feed: RssFeedSettings['feeds'][number],
  credentials: Map<string, string>,
): RssFeedConfig['auth'] | null {
  const authType = feed.authType ?? 'none';

  if (authType === 'none') return undefined;

  if (authType === 'basic') {
    const username = credentials.get(`feeds.${feed.id}.username`);
    const password = credentials.get(`feeds.${feed.id}.password`);

    if (!username || !password) {
      return null;
    }

    return {
      type: 'basic',
      value: Buffer.from(`${username}:${password}`).toString('base64'),
    };
  }

  const token = credentials.get(`feeds.${feed.id}.token`);
  if (!token) {
    return null;
  }

  return {
    type: 'bearer',
    value: token,
  };
}

// ─── Passphrase-based AES-GCM (for config export/import with credentials) ────
// Distinct from the PHAVO_SECRET-based encrypt/decrypt — uses user passphrase
// with PBKDF2-SHA256 (100 000 iterations, random 16-byte salt) to derive the key.
// Blob layout: base64( salt[16] + iv[12] + ciphertext[n] + authTag[16] )

const _EXPORT_SALT_LEN = 16;
const _EXPORT_IV_LEN = 12;
const _EXPORT_PBKDF2_ITERS = 100_000;

async function exportEncrypt(plaintext: string, passphrase: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(_EXPORT_SALT_LEN));
  const iv = crypto.getRandomValues(new Uint8Array(_EXPORT_IV_LEN));
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  const key = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: _EXPORT_PBKDF2_ITERS, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt'],
  );
  const enc = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, tagLength: 128 },
    key,
    new TextEncoder().encode(plaintext),
  );
  const combined = new Uint8Array(salt.length + iv.length + enc.byteLength);
  combined.set(salt, 0);
  combined.set(iv, salt.length);
  combined.set(new Uint8Array(enc), salt.length + iv.length);
  return Buffer.from(combined).toString('base64');
}

async function exportDecrypt(ciphertext: string, passphrase: string): Promise<string> {
  const combined = Uint8Array.from(Buffer.from(ciphertext, 'base64'));
  const salt = combined.slice(0, _EXPORT_SALT_LEN);
  const iv = combined.slice(_EXPORT_SALT_LEN, _EXPORT_SALT_LEN + _EXPORT_IV_LEN);
  const data = combined.slice(_EXPORT_SALT_LEN + _EXPORT_IV_LEN);
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  const key = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: _EXPORT_PBKDF2_ITERS, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt'],
  );
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv, tagLength: 128 }, key, data);
  return new TextDecoder().decode(decrypted);
}

// Zod schema for the export envelope — validated on import before any DB write.
const ExportConfigSchema = z.object({
  dashboardName: z.string().optional(),
  sessionTimeout: z.enum(['1d', '7d', '30d', 'never']).optional(),
  location: z
    .object({ name: z.string(), latitude: z.number(), longitude: z.number() })
    .nullable()
    .optional(),
});

const ExportTabSchema = z.object({
  id: z.string(),
  label: z.string(),
  order: z.number().int(),
});

const ExportWidgetInstanceSchema = z.object({
  id: z.string(),
  widgetId: z.string(),
  tabId: z.string(),
  size: z.enum(['S', 'M', 'L', 'XL']),
  positionX: z.number().int(),
  positionY: z.number().int(),
  config: z.record(z.unknown()).nullable().optional(),
});

const ExportEnvelopeSchema = z.object({
  version: z.literal('1'),
  exportedAt: z.number(),
  config: ExportConfigSchema,
  tabs: z.array(ExportTabSchema),
  widgetInstances: z.array(ExportWidgetInstanceSchema),
  // base64 blob — passphrase-encrypted credential map. Present only when exported
  // with ?includeCredentials=true.
  credentials: z.string().optional(),
});

type ExportEnvelope = z.infer<typeof ExportEnvelopeSchema>;

/** Collects the current config + tabs + widgetInstances into an export payload.
 *  configEncrypted is decrypted so the file is portable across PHAVO_SECRET rotations. */
async function buildExportPayload(): Promise<Omit<ExportEnvelope, 'credentials'>> {
  const configRows = await db.query.config.findMany();
  const parsed = parseConfigEntries(configRows);

  const tabRows = await db.select().from(schema.tabs).orderBy(asc(schema.tabs.order));

  const instanceRows = await db.select().from(schema.widgetInstances);
  const widgetInstances = await Promise.all(
    instanceRows.map(async (r) => ({
      id: r.id,
      widgetId: r.widgetId,
      tabId: r.tabId,
      size: r.size as 'S' | 'M' | 'L' | 'XL',
      positionX: r.positionX,
      positionY: r.positionY,
      config: (await parseWidgetPublicConfig(r.configEncrypted)) ?? null,
    })),
  );

  return {
    version: '1',
    exportedAt: Date.now(),
    config: {
      dashboardName: parsed.dashboardName,
      sessionTimeout: parsed.sessionTimeout,
      location: parsed.location,
    },
    tabs: tabRows.map((t) => ({ id: t.id, label: t.label, order: t.order })),
    widgetInstances,
  };
}

/** Collects all credentials keyed by instanceId → fieldPath → plaintext.
 *  Only covers widget credential keys (widget:${instanceId}:${fieldPath}).
 *  Returns a map safe to serialise into the credentials export blob. */
async function collectExportCredentials(): Promise<Record<string, Record<string, string>>> {
  const rows = await db.select().from(schema.credentials);
  const out: Record<string, Record<string, string>> = {};

  for (const row of rows) {
    if (!row.key.startsWith('widget:')) continue;
    const withoutPrefix = row.key.slice('widget:'.length);
    const colonIdx = withoutPrefix.indexOf(':');
    if (colonIdx < 0) continue;
    const instanceId = withoutPrefix.slice(0, colonIdx);
    const fieldPath = withoutPrefix.slice(colonIdx + 1);
    if (!instanceId || !fieldPath) continue;
    try {
      const value = await decrypt(row.valueEncrypted);
      // biome-ignore lint/suspicious/noAssignInExpressions: intentional initialisation
      (out[instanceId] ??= {})[fieldPath] = value;
    } catch {
      // Skip rows that can no longer be decrypted.
    }
  }

  return out;
}

// ─── Zod schemas for request validation ──────────────────────────────────────

const LoginSchema = z.discriminatedUnion('authMode', [
  z.object({
    authMode: z.literal('phavo-io'),
    code: z.string().min(1),
  }),
  z.object({
    authMode: z.literal('local'),
    username: z.string().min(1),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    licenseKey: z.string().optional(),
  }),
]);

const TotpSchema = z.object({
  partialToken: z.string().min(1),
  code: z.string().length(6),
});

// ─── Public endpoints ─────────────────────────────────────────────────────────

// Health check — always public, no auth. Polled by Tauri sidecar on startup.
app.get('/health', async (c) => {
  try {
    await db.run(sql`SELECT 1`);
  } catch {
    return c.json(err('Database unreachable'), 503);
  }
  return c.json(ok({ version: PHAVO_VERSION, platform: process.env.PHAVO_ENV ?? 'docker' }));
});

// ─── Widget manifest ──────────────────────────────────────────────────────────

app.get('/widgets', requireSession(), (c) => {
  const session = c.get('session');
  if (!session) return c.json(err('Unauthorized'), 401);
  return c.json(ok(registry.getManifest(session.tier)));
});

// ─── Config ───────────────────────────────────────────────────────────────────

// Config endpoints are accessible to any authenticated session.
app.get('/config', requireSession(), async (c) => {
  try {
    const rows = await db.query.config.findMany();
    return c.json(ok(parseConfigEntries(rows)));
  } catch {
    return c.json(
      ok({
        setupComplete: false,
        dashboardName: 'My Dashboard',
        tabs: [],
        sessionTimeout: '7d',
      }),
    );
  }
});

app.post('/config', requireSession(), async (c) => {
  try {
    let rawBody: unknown;
    try {
      rawBody = await c.req.json();
    } catch {
      return c.json(err('Invalid request body'), 400);
    }

    const ConfigPostSchema = z.object({
      setupComplete: z.boolean().optional(),
      dashboardName: z.string().max(100).optional(),
      sessionTimeout: z.enum(['1d', '7d', '30d', 'never']).optional(),
      location: z
        .object({
          name: z.string().max(200),
          latitude: z.number().min(-90).max(90),
          longitude: z.number().min(-180).max(180),
        })
        .nullable()
        .optional(),
      tabs: z.array(z.any()).optional(),
    });
    const parsed = ConfigPostSchema.safeParse(rawBody);
    if (!parsed.success) return c.json(err('Invalid config'), 400);
    const body = parsed.data;

    const upserts: Array<{ key: string; value: string }> = [];
    const deletes: string[] = [];
    if (body.setupComplete !== undefined)
      upserts.push({ key: 'setup_complete', value: body.setupComplete ? 'true' : 'false' });
    if (body.dashboardName !== undefined)
      upserts.push({ key: 'dashboard_name', value: body.dashboardName.trim() || 'My Dashboard' });
    if (body.sessionTimeout) upserts.push({ key: 'session_timeout', value: body.sessionTimeout });
    if (body.location === null) {
      deletes.push('location_name', 'location_latitude', 'location_longitude');
    } else if (body.location) {
      upserts.push({ key: 'location_name', value: body.location.name });
      upserts.push({ key: 'location_latitude', value: String(body.location.latitude) });
      upserts.push({ key: 'location_longitude', value: String(body.location.longitude) });
    }

    for (const key of deletes) {
      await db.delete(schema.config).where(eq(schema.config.key, key));
    }

    for (const entry of upserts) {
      await db
        .insert(schema.config)
        .values({ key: entry.key, value: entry.value })
        .onConflictDoUpdate({
          target: schema.config.key,
          set: { value: entry.value, updatedAt: new Date() },
        });
    }

    // Auto-create a "Home" tab when setup completes for the first time
    if (body.setupComplete) {
      const existingTabs = await db.select().from(schema.tabs);
      if (existingTabs.length === 0) {
        await db.insert(schema.tabs).values({
          id: crypto.randomUUID(),
          label: 'Home',
          order: 0,
        });
      }
    }

    const rows = await db.query.config.findMany();
    return c.json(ok(parseConfigEntries(rows)));
  } catch (e) {
    console.error('[phavo] POST /config error:', e);
    return c.json(err(e instanceof Error ? e.message : 'Failed to save config'), 500);
  }
});

// ─── Config Export / Import ───────────────────────────────────────────────────

// NOTE: These endpoints return raw JSON (no ok() envelope) because the response
// IS the downloadable file itself. The import endpoint receives the raw file
// content string and validates the export envelope with Zod.

// GET /config/export — no credentials. Client downloads via blob URL.
app.get('/config/export', requireSession(), async (c) => {
  try {
    const payload = await buildExportPayload();
    const dateStr = new Date().toISOString().slice(0, 10);
    return new Response(JSON.stringify(payload, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="phavo-config-${dateStr}.phavo"`,
      },
    });
  } catch (e) {
    return c.json(err(e instanceof Error ? e.message : 'Export failed'), 500);
  }
});

// POST /config/export — with encrypted credentials (requires passphrase in body).
// Client uses POST when ?includeCredentials=true (see arch spec §import-export).
app.post('/config/export', requireSession(), async (c) => {
  try {
    let rawBody: unknown;
    try {
      rawBody = await c.req.json();
    } catch {
      return c.json(err('Invalid request body'), 400);
    }

    const bodySchema = z.object({ passphrase: z.string().min(1) });
    const bodyParsed = bodySchema.safeParse(rawBody);
    if (!bodyParsed.success) {
      return c.json(err('passphrase is required when exporting credentials'), 400);
    }

    const payload = await buildExportPayload();
    const rawCredentials = await collectExportCredentials();
    const credentialBlob = await exportEncrypt(
      JSON.stringify(rawCredentials),
      bodyParsed.data.passphrase,
    );

    const dateStr = new Date().toISOString().slice(0, 10);
    return new Response(JSON.stringify({ ...payload, credentials: credentialBlob }, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="phavo-config-${dateStr}.phavo"`,
      },
    });
  } catch (e) {
    return c.json(err(e instanceof Error ? e.message : 'Export with credentials failed'), 500);
  }
});

// POST /config/import — applies an exported config JSON.
// Body: { exportJson: string, passphrase?: string }
app.post('/config/import', requireSession(), async (c) => {
  try {
    const session = c.get('session');
    if (!session) return c.json(err('Unauthorized'), 401);

    let rawBody: unknown;
    try {
      rawBody = await c.req.json();
    } catch {
      return c.json(err('Invalid request body'), 400);
    }

    const requestSchema = z.object({
      exportJson: z.string().min(1),
      passphrase: z.string().optional(),
    });
    const requestParsed = requestSchema.safeParse(rawBody);
    if (!requestParsed.success) {
      return c.json(err('exportJson is required'), 400);
    }

    // Parse and validate the export envelope before touching the DB.
    let parsedExport: unknown;
    try {
      parsedExport = JSON.parse(requestParsed.data.exportJson);
    } catch {
      return c.json(err('Export file is not valid JSON'), 400);
    }

    const exportResult = ExportEnvelopeSchema.safeParse(parsedExport);
    if (!exportResult.success) {
      const issue = exportResult.error.issues[0];
      return c.json(
        err(`Invalid export file: ${issue?.message ?? 'unknown validation error'}`),
        400,
      );
    }

    const exportData = exportResult.data;
    const warnings: string[] = [];

    // ── Resolve which tabs will actually be imported (free tier cap = 1) ──────
    let tabsToImport = exportData.tabs;
    if (session.tier === 'free' && tabsToImport.length > 1) {
      tabsToImport = tabsToImport.slice(0, 1);
      warnings.push(`Tab count reduced to 1 (Free tier limit)`);
    }
    const keptTabIds = new Set(tabsToImport.map((t) => t.id));

    // All DB mutations inside a single transaction — atomic rollback on failure.
    const tabIdMap = new Map<string, string>();
    const widgetIdMap = new Map<string, string>();

    await db.transaction(async (tx) => {
      // ── Apply config keys (skip setupComplete — preserve current value) ───────
      const cfgUpserts: Array<{ key: string; value: string }> = [];
      if (exportData.config.dashboardName !== undefined) {
        cfgUpserts.push({
          key: 'dashboard_name',
          value: exportData.config.dashboardName.trim() || 'My Dashboard',
        });
      }
      if (exportData.config.sessionTimeout !== undefined) {
        cfgUpserts.push({ key: 'session_timeout', value: exportData.config.sessionTimeout });
      }
      if (exportData.config.location != null) {
        cfgUpserts.push({ key: 'location_name', value: exportData.config.location.name });
        cfgUpserts.push({
          key: 'location_latitude',
          value: String(exportData.config.location.latitude),
        });
        cfgUpserts.push({
          key: 'location_longitude',
          value: String(exportData.config.location.longitude),
        });
      }
      for (const entry of cfgUpserts) {
        await tx
          .insert(schema.config)
          .values({ key: entry.key, value: entry.value })
          .onConflictDoUpdate({
            target: schema.config.key,
            set: { value: entry.value, updatedAt: new Date() },
          });
      }

      // ── Replace tabs ──────────────────────────────────────────────────────────
      // Delete widget instances first (FK constraint: widgetInstances.tabId → tabs.id).
      await tx.delete(schema.widgetInstances);
      await tx.delete(schema.tabs);

      // Insert tabs with new UUIDs; build oldId → newId map.
      for (const tab of tabsToImport) {
        const newId = crypto.randomUUID();
        tabIdMap.set(tab.id, newId);
        await tx.insert(schema.tabs).values({ id: newId, label: tab.label, order: tab.order });
      }

      // Fallback: if all imported tabs were discarded (edge case), create a default Home tab.
      if (tabIdMap.size === 0) {
        const homeId = crypto.randomUUID();
        await tx.insert(schema.tabs).values({ id: homeId, label: 'Home', order: 0 });
        return; // No widgets can be imported either.
      }

      // Get the first kept tab's new ID (for reassigning widgets from dropped tabs).
      const firstNewTabId = tabIdMap.values().next().value as string;

      // ── Import widget instances ───────────────────────────────────────────────
      for (const wi of exportData.widgetInstances) {
        const resolvedOldTabId = keptTabIds.has(wi.tabId) ? wi.tabId : tabsToImport[0]?.id;
        if (!resolvedOldTabId) continue;

        const newTabId = tabIdMap.get(resolvedOldTabId) ?? firstNewTabId;
        const newInstanceId = crypto.randomUUID();
        widgetIdMap.set(wi.id, newInstanceId);

        const configEncrypted =
          wi.config && Object.keys(wi.config).length > 0
            ? await encrypt(JSON.stringify(wi.config))
            : null;

        await tx.insert(schema.widgetInstances).values({
          id: newInstanceId,
          widgetId: wi.widgetId,
          tabId: newTabId,
          size: wi.size,
          positionX: wi.positionX,
          positionY: wi.positionY,
          configEncrypted,
        });
      }

      // ── Import credentials (if blob present and passphrase provided) ──────────
      if (exportData.credentials && requestParsed.data.passphrase) {
        let decryptedCredentials: Record<string, Record<string, string>>;
        try {
          const raw = await exportDecrypt(exportData.credentials, requestParsed.data.passphrase);
          const credentialSchema = z.record(z.record(z.string()));
          const parsed = credentialSchema.safeParse(JSON.parse(raw));
          if (!parsed.success) throw new Error('Invalid credential structure');
          decryptedCredentials = parsed.data;
        } catch {
          warnings.push('Could not decrypt credentials — wrong passphrase or corrupted file');
          decryptedCredentials = {};
        }

        for (const [oldInstanceId, fields] of Object.entries(decryptedCredentials)) {
          const newInstanceId = widgetIdMap.get(oldInstanceId);
          if (!newInstanceId) continue;
          for (const [fieldPath, value] of Object.entries(fields)) {
            const key = credentialStorageKey(newInstanceId, fieldPath);
            const valueEncrypted = await encrypt(value);
            await tx
              .insert(schema.credentials)
              .values({ key, valueEncrypted, updatedAt: Date.now() })
              .onConflictDoUpdate({
                target: schema.credentials.key,
                set: { valueEncrypted, updatedAt: Date.now() },
              });
          }
        }
      } else if (exportData.credentials && !requestParsed.data.passphrase) {
        warnings.push(
          'Export contains credentials but no passphrase was provided — credentials were not imported',
        );
      }
    });

    // Early return if no tabs were imported (tabIdMap was empty inside tx).
    if (tabIdMap.size === 0) {
      return c.json(ok({ warnings }));
    }

    // ── Queue reconfiguration notifications for widgets that lack credentials ─
    for (const wi of exportData.widgetInstances) {
      const newInstanceId = widgetIdMap.get(wi.id);
      if (!newInstanceId) continue;
      const def = registry.getById(wi.widgetId);
      if (!def?.configSchema) continue;
      const hasCredentials = await hasStoredWidgetCredentials(newInstanceId);
      if (!hasCredentials) {
        // Only notify if the widget actually expects credentials.
        const hasCredentialField = JSON.stringify(def.configSchema._def).includes('"credential"');
        if (hasCredentialField) {
          serverNotify({
            type: 'widget-warning',
            title: `${def.name} needs reconfiguration`,
            body: `Widget "${def.name}" needs credentials configured after import`,
            widgetId: wi.widgetId,
            settingsTab: 'widgets',
          });
        }
      }
    }

    return c.json(ok({ warnings }));
  } catch (e) {
    return c.json(err(e instanceof Error ? e.message : 'Import failed'), 500);
  }
});

// ─── Auth ─────────────────────────────────────────────────────────────────────

/**
 * POST /api/v1/auth/login — public, rate-limited.
 * Handles phavo-io (OAuth code exchange) and local (password + optional
 * license key for first activation) authentication flows.
 */
app.post('/auth/login', async (c) => {
  // In dev mode, always succeed without real credentials.
  if (DEV_MOCK_AUTH_ENABLED) {
    const response = c.json(ok({ tier: 'free' as const }));
    await setSessionCookies(response, 'dev', 7 * 24 * 60 * 60);
    return response;
  }

  const ip = getClientIp(c.req);

  const rateCheck = checkRateLimit(ip);
  if (!rateCheck.allowed) {
    return c.json(err(`Too many login attempts. Try again in ${rateCheck.retryAfter}s`), 429);
  }

  let rawBody: unknown;
  try {
    rawBody = await c.req.json();
  } catch {
    return c.json(err('Invalid request body'), 400);
  }

  const parsed = LoginSchema.safeParse(rawBody);
  if (!parsed.success) {
    recordLoginAttempt(ip, false);
    const msg = parsed.error.issues[0]?.message ?? 'Validation failed';
    return c.json(err(msg), 400);
  }

  const body = parsed.data;
  const SESSION_MAX_AGE = 7 * 24 * 60 * 60; // 7 days in seconds

  if (body.authMode === 'phavo-io') {
    // ── phavo-io OAuth code exchange ──────────────────────────────────────────
    const phavoIoUrl = process.env.PHAVO_IO_URL ?? 'https://phavo.net';

    let accessToken: string;
    let userEmail: string;
    let userId: string;
    let tier: 'free' | 'standard';

    const PhavioTokenResponseSchema = z.object({
      access_token: z.string(),
      user: z.object({ id: z.string(), email: z.string() }),
    });
    const LicenseValidateSchema = z.object({ tier: z.enum(['free', 'standard']) });

    try {
      const tokenRes = await fetch(`${phavoIoUrl}/api/oauth/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: body.code }),
        signal: AbortSignal.timeout(10_000),
      });
      if (!tokenRes.ok) {
        recordLoginAttempt(ip, false);
        return c.json(err('Authentication failed'), 401);
      }
      const tokenData = PhavioTokenResponseSchema.parse(await tokenRes.json());
      accessToken = tokenData.access_token;
      userEmail = tokenData.user.email;
      userId = tokenData.user.id;
    } catch {
      recordLoginAttempt(ip, false);
      return c.json(err('Failed to connect to phavo.net'), 503);
    }

    // Validate/determine tier — with grace period fallback if phavo.net is unreachable.
    try {
      const licRes = await fetch(`${phavoIoUrl}/api/license/validate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        signal: AbortSignal.timeout(10_000),
      });
      if (licRes.ok) {
        const licData = LicenseValidateSchema.parse(await licRes.json());
        tier = licData.tier;
      } else {
        recordLoginAttempt(ip, false);
        return c.json(err('License validation failed'), 403);
      }
    } catch {
      // phavo.net unreachable — check if an existing session still has valid grace period.
      const existing = await db
        .select()
        .from(schema.sessions)
        .where(eq(schema.sessions.userId, userId))
        .limit(1);
      const ex = existing[0];
      if (ex && ex.graceUntil !== null && ex.graceUntil > Date.now()) {
        tier = ex.tier as 'free' | 'standard';
      } else {
        recordLoginAttempt(ip, false);
        return c.json(err('phavo.net unreachable — grace period expired'), 401);
      }
    }

    const graceUntil = Date.now() + (tier === 'free' ? 86_400_000 : 259_200_000);

    // Upsert user record.
    const existingUsers = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, userEmail));
    let dbUserId: string;
    if (existingUsers[0]) {
      dbUserId = existingUsers[0].id;
    } else {
      dbUserId = crypto.randomUUID();
      await db.insert(schema.users).values({
        id: dbUserId,
        email: userEmail,
        authMode: 'phavo-io',
      });
    }

    // Create session.
    const token = generateSessionToken();
    await db.insert(schema.sessions).values({
      id: token,
      userId: dbUserId,
      tier,
      authMode: 'phavo-io',
      validatedAt: Date.now(),
      graceUntil,
      expiresAt: Date.now() + SESSION_MAX_AGE * 1000,
    });

    recordLoginAttempt(ip, true);
    const response = c.json(ok({ tier }));
    await setSessionCookies(response, token, SESSION_MAX_AGE);
    return response;
  }

  // ── Local auth ──────────────────────────────────────────────────────────────
  // For local auth, "username" is stored in the email field (single-user setup).
  const { username, password, licenseKey } = body;

  if (licenseKey) {
    // First activation: create user + license record + session.
    const instanceIdentifier = readOrCreateInstanceIdentifier();
    const activation = await activateLocalLicense(licenseKey, instanceIdentifier);

    if (!activation.valid || !activation.activationJwt) {
      recordLoginAttempt(ip, false);
      return c.json(err(activation.error ?? 'Failed to connect to phavo.net for activation'), 503);
    }

    const activationJwt = activation.activationJwt;

    const passwordHash = await hashPassword(password);
    const newUserId = crypto.randomUUID();

    // Check if user already exists (re-activation).
    const existingLocalUsers = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.authMode, 'local'));
    let localUserId = existingLocalUsers[0]?.id;

    if (localUserId) {
      await db.update(schema.users).set({ passwordHash }).where(eq(schema.users.id, localUserId));
    } else {
      localUserId = newUserId;
      await db.insert(schema.users).values({
        id: localUserId,
        // email field used as username for local auth (schema limitation for Phase 1).
        email: username,
        passwordHash,
        authMode: 'local',
      });
    }

    await db.insert(schema.licenseActivation).values({
      licenseKey,
      tier: 'local',
      activationJwt,
      instanceIdentifier,
    });

    const localUserRows = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, localUserId));
    const localUser = localUserRows[0];

    if (localUser?.totpSecret) {
      const partialToken = generateSessionToken();
      if (partialSessions.size >= 1000) {
        return c.json(err('Too many pending sessions'), 429);
      }
      partialSessions.set(partialToken, {
        userId: localUserId,
        tier: 'local',
        authMode: 'local',
        graceUntil: null,
        expiresMs: Date.now() + 5 * 60 * 1000,
      });
      return c.json(ok({ requiresTotp: true as const, partialToken }));
    }

    const token = generateSessionToken();
    await db.insert(schema.sessions).values({
      id: token,
      userId: localUserId,
      tier: 'local',
      authMode: 'local',
      validatedAt: Date.now(),
      graceUntil: null,
      expiresAt: Date.now() + SESSION_MAX_AGE * 1000,
    });

    recordLoginAttempt(ip, true);
    const response = c.json(ok({ tier: 'local' as const }));
    await setSessionCookies(response, token, SESSION_MAX_AGE);
    return response;
  }

  // Subsequent local login (fully offline).
  const localUsers = await db.select().from(schema.users).where(eq(schema.users.authMode, 'local'));
  const user = localUsers.find((u) => u.email === username);

  if (!user || !user.passwordHash) {
    recordLoginAttempt(ip, false);
    return c.json(err('Invalid credentials'), 401);
  }

  const valid = await verifyPassword({ hash: user.passwordHash, password });
  if (!valid) {
    recordLoginAttempt(ip, false);
    return c.json(err('Invalid credentials'), 401);
  }

  // Verify the stored activation JWT to confirm license is still valid (offline check).
  const activations = await db
    .select()
    .from(schema.licenseActivation)
    .orderBy(asc(schema.licenseActivation.activatedAt));
  const latestActivation = activations[activations.length - 1];

  if (!latestActivation) {
    // No activation on record — force re-activation.
    recordLoginAttempt(ip, false);
    return c.json(err('No license activation found — please re-activate'), 403);
  }

  const pubKeyB64 = process.env.PHAVO_IO_PUBLIC_KEY ?? '';
  if (pubKeyB64) {
    const jwtValid = await verifyActivationJwt(latestActivation.activationJwt, pubKeyB64);
    if (!jwtValid) {
      recordLoginAttempt(ip, false);
      return c.json(err('License verification failed'), 403);
    }
  }
  // If PHAVO_IO_PUBLIC_KEY is not set, skip JWT verification (dev/test scenario).

  // Check if TOTP is enabled for this user.
  if (user.totpSecret) {
    const partialToken = generateSessionToken();
    if (partialSessions.size >= 1000) {
      return c.json(err('Too many pending sessions'), 429);
    }
    partialSessions.set(partialToken, {
      userId: user.id,
      tier: 'local',
      authMode: 'local',
      graceUntil: null,
      expiresMs: Date.now() + 5 * 60 * 1000,
    });
    return c.json(ok({ requiresTotp: true as const, partialToken }));
  }

  const token = generateSessionToken();
  await db.insert(schema.sessions).values({
    id: token,
    userId: user.id,
    tier: 'local',
    authMode: 'local',
    validatedAt: Date.now(),
    graceUntil: null,
    expiresAt: Date.now() + SESSION_MAX_AGE * 1000,
  });

  recordLoginAttempt(ip, true);
  const response = c.json(ok({ tier: 'local' as const }));
  await setSessionCookies(response, token, SESSION_MAX_AGE);
  return response;
});

/** POST /api/v1/auth/totp — completes 2FA flow after partial token issued by login. */
app.post('/auth/totp', async (c) => {
  let rawBody: unknown;
  try {
    rawBody = await c.req.json();
  } catch {
    return c.json(err('Invalid request body'), 400);
  }
  const parsed = TotpSchema.safeParse(rawBody);
  if (!parsed.success) return c.json(err('Invalid request'), 400);

  const { partialToken, code } = parsed.data;
  const pending = partialSessions.get(partialToken);
  if (!pending || pending.expiresMs < Date.now()) {
    partialSessions.delete(partialToken);
    return c.json(err('Partial token expired or invalid — please log in again'), 401);
  }

  // Fetch the TOTP secret from DB.
  const users = await db.select().from(schema.users).where(eq(schema.users.id, pending.userId));
  const user = users[0];
  if (!user?.totpSecret) return c.json(err('TOTP not configured'), 400);

  // Decrypt and verify the TOTP secret.
  let totpSecret: string;
  try {
    totpSecret = await decrypt(user.totpSecret);
  } catch {
    return c.json(err('Failed to read TOTP configuration'), 500);
  }

  const totpValid = await verifyTotpCode(totpSecret, code);
  if (!totpValid) return c.json(err('Invalid TOTP code'), 401);

  // TOTP verified — create a full session.
  const SESSION_MAX_AGE = 7 * 24 * 60 * 60;
  const token = generateSessionToken();
  await db.insert(schema.sessions).values({
    id: token,
    userId: pending.userId,
    tier: pending.tier,
    authMode: pending.authMode,
    validatedAt: Date.now(),
    graceUntil: pending.graceUntil,
    expiresAt: Date.now() + SESSION_MAX_AGE * 1000,
  });
  partialSessions.delete(partialToken);

  const response = c.json(ok({ tier: pending.tier }));
  await setSessionCookies(response, token, SESSION_MAX_AGE);
  return response;
});

/** POST /api/v1/auth/logout — invalidates current session and clears cookies. */
app.post('/auth/logout', requireSession(), async (c) => {
  const session = c.get('session');
  if (session && !DEV_MOCK_AUTH_ENABLED) {
    await db.delete(schema.sessions).where(eq(schema.sessions.id, session.id));
  }
  const response = c.json(ok(null));
  clearSessionCookies(response);
  return response;
});

/**
 * GET /api/v1/auth/session — returns minimal session info.
 * NOTE: tier is intentionally excluded — never sent to client (arch spec §17.5).
 */
app.get('/auth/session', requireSession(), (c) => {
  const session = c.get('session');
  if (!session) return c.json(err('Unauthorized'), 401);
  return c.json(
    ok({
      authMode: session.authMode,
      validatedAt: session.validatedAt,
      graceUntil: session.graceUntil,
    }),
  );
});

/** PATCH /api/v1/auth/password — updates password for local accounts. */
app.patch('/auth/password', requireSession(), async (c) => {
  try {
    const session = c.get('session');
    if (!session) return c.json(err('Unauthorized'), 401);
    if (session.authMode !== 'local') {
      return c.json(err('Password changes are only available for local accounts'), 403);
    }

    const body = (await c.req.json()) as { newPassword?: string };
    if (!body.newPassword || body.newPassword.length < 8) {
      return c.json(err('Password must be at least 8 characters'), 400);
    }

    const passwordHash = await hashPassword(body.newPassword);
    await db.update(schema.users).set({ passwordHash }).where(eq(schema.users.id, session.userId));

    return c.json(ok(null));
  } catch (e) {
    return c.json(err(e instanceof Error ? e.message : 'Failed to update password'), 500);
  }
});

/** POST /api/v1/auth/logout-all — deletes all sessions for the current user. */
app.post('/auth/logout-all', requireSession(), async (c) => {
  try {
    const session = c.get('session');
    if (session && !DEV_MOCK_AUTH_ENABLED) {
      await db.delete(schema.sessions).where(eq(schema.sessions.userId, session.userId));
    }
    const response = c.json(ok(null));
    clearSessionCookies(response);
    return response;
  } catch (e) {
    return c.json(err(e instanceof Error ? e.message : 'Failed to sign out all sessions'), 500);
  }
});

// System metrics — free+ (requireSession)
app.get('/cpu', requireSession(), async (c) => {
  try {
    const data = await cached('cpu', 5000, getCpu);
    return c.json(ok(data));
  } catch {
    return c.json(ok({ usage: 0, cores: [], loadAvg: [0, 0, 0], speed: 0, model: 'Unknown' }));
  }
});

app.get('/memory', requireSession(), async (c) => {
  try {
    const data = await cached('memory', 5000, getMemory);
    return c.json(ok(data));
  } catch {
    return c.json(ok({ used: 0, total: 0, free: 0, swap: { used: 0, total: 0 } }));
  }
});

app.get('/disk', requireSession(), async (c) => {
  try {
    const data = await cached('disk', 5000, getDisk);
    return c.json(ok(data));
  } catch {
    return c.json(ok([]));
  }
});

app.get('/network', requireSession(), async (c) => {
  try {
    const data = await cached('network', 5000, getNetwork);
    return c.json(ok(data));
  } catch {
    return c.json(ok({ uploadSpeed: 0, downloadSpeed: 0, totalSent: 0, totalReceived: 0 }));
  }
});

app.get('/temperature', requireSession(), async (c) => {
  try {
    const data = await cached('temperature', 10000, getTemperature);
    return c.json(ok(data));
  } catch {
    return c.json(ok({ cpuTemp: null, unit: '°C' }));
  }
});

app.get('/uptime', requireSession(), async (c) => {
  try {
    const data = await cached('uptime', 30000, getUptime);
    return c.json(ok(data));
  } catch {
    return c.json(ok({ seconds: 0, formatted: 'Unknown' }));
  }
});

// Integration widgets — weather is free+, pihole/rss/links are standard+
app.get('/weather', requireSession(), async (c) => {
  try {
    const rows = await db.query.config.findMany();
    const config = parseConfigEntries(rows);
    const requestedLatitude = Number(c.req.query('latitude'));
    const requestedLongitude = Number(c.req.query('longitude'));
    const latitude = Number.isFinite(requestedLatitude)
      ? requestedLatitude
      : (config.location?.latitude ?? 52.52);
    const longitude = Number.isFinite(requestedLongitude)
      ? requestedLongitude
      : (config.location?.longitude ?? 13.405);
    const cacheKey = `weather:${latitude}:${longitude}`;
    const data = await cached(cacheKey, 300000, () => getWeather(latitude, longitude));
    return c.json(ok(data));
  } catch {
    return c.json(err('Weather data unavailable'), 500);
  }
});

app.get('/pihole', requireTier('standard'), async (c) => {
  try {
    const credentials = await findConfiguredPiholeCredentials();

    if (!credentials) {
      if (!piholeMissingConfigNotified) {
        serverNotify({
          type: 'widget-error',
          title: 'Pi-hole not configured',
          body: 'Add your Pi-hole URL and token in Settings.',
          widgetId: 'pihole',
          settingsTab: 'widgets',
        });
        piholeMissingConfigNotified = true;
      }

      return c.json(ok(null));
    }

    piholeMissingConfigNotified = false;

    const data = await getPihole(credentials.url, credentials.token);
    piholeFailureCount = 0;
    return c.json(ok(data));
  } catch {
    piholeFailureCount += 1;

    if (piholeFailureCount >= 3) {
      serverNotify({
        type: 'widget-error',
        title: 'Pi-hole unreachable',
        body: 'Phavo could not reach your Pi-hole instance after 3 attempts.',
        widgetId: 'pihole',
        settingsTab: 'widgets',
      });
      piholeFailureCount = 0;
    }

    return c.json(ok(null));
  }
});

app.post('/pihole/test', requireTier('standard'), async (c) => {
  try {
    let rawBody: unknown;
    try {
      rawBody = await c.req.json();
    } catch {
      return c.json(err('Invalid request body'), 400);
    }

    const PiholeTestSchema = z.object({
      url: z.string().url().max(2048),
      token: z.string().min(1).max(512),
    });
    const parsed = PiholeTestSchema.safeParse(rawBody);
    if (!parsed.success) {
      return c.json(err('Valid URL and token required'), 400);
    }

    try {
      assertNotCloudMetadata(parsed.data.url);
    } catch {
      return c.json(err('URL not allowed'), 400);
    }

    const data = await getPihole(parsed.data.url, parsed.data.token);
    return c.json(ok(data));
  } catch {
    return c.json(err('Could not connect to Pi-hole'), 500);
  }
});

app.get('/rss', requireTier('standard'), async (c) => {
  try {
    const instances = await db
      .select()
      .from(schema.widgetInstances)
      .where(eq(schema.widgetInstances.widgetId, 'rss'));

    const feeds: RssFeedConfig[] = [];
    const configErrors: Array<{ feedUrl: string; error: string }> = [];

    for (const instance of instances) {
      const config = await parseEncryptedWidgetConfig(
        instance.configEncrypted,
        RssWidgetConfigSchema,
      );
      if (!config) continue;

      const credentials = await loadInstanceCredentialMap(instance.id);

      for (const feed of config.feeds) {
        const normalizedFeed = { ...feed, authType: feed.authType ?? 'none' };
        const auth = buildRssFeedAuth(normalizedFeed, credentials);
        const authType = normalizedFeed.authType;

        if (authType !== 'none' && auth === null) {
          configErrors.push({
            feedUrl: feed.url,
            error: 'Missing RSS credentials for this feed',
          });
          continue;
        }

        feeds.push(auth ? { url: feed.url, auth } : { url: feed.url });
      }
    }

    if (feeds.length === 0) {
      return c.json(ok({ items: [], errors: configErrors }));
    }

    const cacheKey = `rss:${feeds
      .map((feed) => `${feed.url}:${feed.auth?.type ?? 'none'}`)
      .sort()
      .join('|')}`;
    const data = await cached(cacheKey, 60000, () => getRss(feeds));
    return c.json(ok({ items: data.items, errors: [...configErrors, ...data.errors] }));
  } catch {
    return c.json(ok({ items: [], errors: [{ feedUrl: 'rss', error: 'RSS data unavailable' }] }));
  }
});

app.get('/links', requireTier('standard'), async (c) => {
  try {
    const instances = await db
      .select()
      .from(schema.widgetInstances)
      .where(eq(schema.widgetInstances.widgetId, 'links'));

    const groups: LinksConfig['groups'] = [];

    for (const instance of instances) {
      const config = await parseEncryptedWidgetConfig(
        instance.configEncrypted,
        LinksWidgetConfigSchema,
      );
      if (!config) continue;
      groups.push(...config.groups);
    }

    return c.json(ok({ groups }));
  } catch (e) {
    return c.json(err(e instanceof Error ? e.message : 'Links data unavailable'), 500);
  }
});

app.post('/widgets/:instanceId/config', requireSession(), async (c) => {
  try {
    const session = c.get('session');
    if (!session) return c.json(err('Unauthorized'), 401);

    const instanceId = c.req.param('instanceId');
    const instanceRows = await db
      .select()
      .from(schema.widgetInstances)
      .where(eq(schema.widgetInstances.id, instanceId))
      .limit(1);
    const instance = instanceRows[0];

    if (!instance) {
      return c.json(err('Widget instance not found'), 404);
    }

    const widget = registry.getById(instance.widgetId);
    if (!widget) {
      return c.json(err('Unknown widget'), 404);
    }

    if (widget.tier === 'standard' && session.tier === 'free') {
      return c.json(err('Upgrade required'), 403);
    }

    if (!widget.configSchema) {
      return c.json(err('This widget does not support configuration'), 400);
    }

    let rawBody: unknown;
    try {
      rawBody = await c.req.json();
    } catch {
      return c.json(err('Invalid request body'), 400);
    }

    const requestSchema = z.object({ config: z.unknown() });
    const requestBody = requestSchema.safeParse(rawBody);
    if (!requestBody.success) {
      return c.json(err('Invalid widget config payload'), 400);
    }

    const validatedConfig = widget.configSchema.safeParse(requestBody.data.config);
    if (!validatedConfig.success) {
      const issue = validatedConfig.error.issues[0];
      return c.json(err(issue?.message ?? 'Invalid widget config'), 400);
    }

    const splitConfig = splitWidgetConfig(validatedConfig.data, widget.configSchema);
    await syncInstanceCredentials(
      instanceId,
      splitConfig.credentials,
      splitConfig.preservedCredentialPaths,
    );

    const configEncrypted = hasPersistedConfigValue(splitConfig.publicConfig)
      ? await encrypt(JSON.stringify(splitConfig.publicConfig))
      : null;

    await db
      .update(schema.widgetInstances)
      .set({ configEncrypted, updatedAt: new Date() })
      .where(eq(schema.widgetInstances.id, instanceId));

    return c.json(ok({ saved: true }));
  } catch (e) {
    return c.json(err(e instanceof Error ? e.message : 'Failed to save widget config'), 500);
  }
});

app.post('/license/activate', requireSession(), async (c) => {
  try {
    const session = c.get('session');
    if (!session) return c.json(err('Unauthorized'), 401);

    let rawBody: unknown;
    try {
      rawBody = await c.req.json();
    } catch {
      return c.json(err('Invalid request body'), 400);
    }

    const requestBody = z.object({ licenseKey: z.string().min(1) }).safeParse(rawBody);
    if (!requestBody.success) {
      return c.json(err('Invalid licence key'), 400);
    }

    const instanceIdentifier = readOrCreateInstanceIdentifier();
    const activation = await activateLocalLicense(requestBody.data.licenseKey, instanceIdentifier);
    if (!activation.valid || !activation.activationJwt) {
      const status = activation.error === 'phavo.net unreachable' ? 503 : 400;
      return c.json(err(activation.error ?? 'License activation failed'), status);
    }

    const existingActivations = await db.select().from(schema.licenseActivation);
    for (const activationRow of existingActivations) {
      await db
        .delete(schema.licenseActivation)
        .where(eq(schema.licenseActivation.id, activationRow.id));
    }

    await db.insert(schema.licenseActivation).values({
      licenseKey: requestBody.data.licenseKey,
      tier: 'local',
      activationJwt: activation.activationJwt,
      instanceIdentifier,
    });

    await db.delete(schema.sessions).where(eq(schema.sessions.id, session.id));

    const token = generateSessionToken();
    const sessionMaxAge = 7 * 24 * 60 * 60;
    await db.insert(schema.sessions).values({
      id: token,
      userId: session.userId,
      tier: 'local',
      authMode: session.authMode,
      validatedAt: Date.now(),
      graceUntil: null,
      expiresAt: Date.now() + sessionMaxAge * 1000,
    });

    const response = c.json(ok({ tier: 'local' as const, reload: true }));
    await setSessionCookies(response, token, sessionMaxAge);
    return response;
  } catch (e) {
    return c.json(err(e instanceof Error ? e.message : 'Failed to activate licence'), 500);
  }
});

app.post('/license/deactivate', requireSession(), async (c) => {
  try {
    const session = c.get('session');
    if (!session) return c.json(err('Unauthorized'), 401);

    const licenseRows = await db
      .select()
      .from(schema.licenseActivation)
      .orderBy(desc(schema.licenseActivation.activatedAt))
      .limit(1);
    const licenseActivation = licenseRows[0];

    if (!licenseActivation) {
      return c.json(err('No active local licence found'), 400);
    }

    const phavoIoUrl = process.env.PHAVO_IO_URL ?? 'https://phavo.net';

    let response: Response;
    try {
      response = await fetch(`${phavoIoUrl}/api/license/deactivate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          licenseKey: licenseActivation.licenseKey,
          instanceId: licenseActivation.instanceIdentifier,
        }),
        signal: AbortSignal.timeout(15_000),
      });
    } catch {
      return c.json(err('phavo.net unreachable — internet connection required to deactivate'), 503);
    }

    if (!response.ok) {
      let errorMessage = 'Failed to deactivate licence';
      try {
        const payload = (await response.json()) as { error?: string };
        if (payload.error) errorMessage = payload.error;
      } catch {
        // Ignore malformed error bodies.
      }

      return c.json(err(errorMessage), 400);
    }

    const activationRows = await db.select().from(schema.licenseActivation);
    for (const activationRow of activationRows) {
      await db
        .delete(schema.licenseActivation)
        .where(eq(schema.licenseActivation.id, activationRow.id));
    }

    await db
      .update(schema.sessions)
      .set({ tier: 'free', graceUntil: null })
      .where(eq(schema.sessions.id, session.id));

    return c.json(ok({ tier: 'free' as const, reload: true }));
  } catch (e) {
    return c.json(err(e instanceof Error ? e.message : 'Failed to deactivate licence'), 500);
  }
});

// Update check
// Track which version we've already queued a notification for so we don't spam.
let _notifiedUpdateVersion = '';

app.get('/about', requireSession(), async (c) => {
  try {
    const session = c.get('session');
    if (!session) return c.json(err('Unauthorized'), 401);
    const licenseRows = await db.select().from(schema.licenseActivation);
    const latestLicense = licenseRows[licenseRows.length - 1];
    return c.json(
      ok({
        version: PHAVO_VERSION,
        tier: session.tier,
        licenseKeyMasked: maskLicenseKey(latestLicense?.licenseKey ?? null),
      }),
    );
  } catch {
    return c.json(ok({ version: PHAVO_VERSION, tier: 'free', licenseKeyMasked: null }));
  }
});

app.get('/update/check', requireSession(), async (c) => {
  const UPDATE_COMMAND = 'docker compose pull && docker compose up -d';
  const fallback = {
    currentVersion: PHAVO_VERSION,
    latestVersion: PHAVO_VERSION,
    updateAvailable: false,
    changelog: '',
    publishedAt: '',
    updateCommand: UPDATE_COMMAND,
  };
  try {
    const data = (await cached('update-check', 3600000, async () => {
      const res = await fetch('https://api.github.com/repos/phabioo/phavo/releases/latest', {
        headers: { 'User-Agent': 'Phavo Dashboard' },
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) return fallback;
      const release = (await res.json()) as {
        tag_name: string;
        body: string;
        published_at: string;
      };
      return {
        currentVersion: PHAVO_VERSION,
        latestVersion: release.tag_name,
        updateAvailable: release.tag_name !== `v${PHAVO_VERSION}`,
        changelog: release.body ?? '',
        publishedAt: release.published_at ?? '',
        updateCommand: UPDATE_COMMAND,
      };
    })) as {
      currentVersion: string;
      latestVersion: string;
      updateAvailable: boolean;
      changelog: string;
      publishedAt: string;
      updateCommand: string;
    };

    if (data.updateAvailable && data.latestVersion !== _notifiedUpdateVersion) {
      _notifiedUpdateVersion = data.latestVersion;
      serverNotify({
        type: 'update',
        title: `Phavo ${data.latestVersion} available`,
        body: 'Click to see changelog',
        settingsTab: 'about',
      });
    }

    return c.json(ok(data));
  } catch {
    return c.json(ok(fallback));
  }
});

app.post('/update/apply', requireSession(), async (c) => {
  try {
    const { access } = await import('node:fs/promises');
    await access('/var/run/docker.sock');
    // Fire-and-forget: the container may stop mid-request once the update starts.
    execFile('docker', ['compose', 'pull'], (pullErr) => {
      if (pullErr) {
        console.error('[phavo] docker compose pull failed:', pullErr.message);
        return;
      }

      execFile('docker', ['compose', 'up', '-d'], (upErr) => {
        if (upErr) {
          console.error('[phavo] docker compose up failed:', upErr.message);
        }
      });
    });
    return c.json(ok({ started: true }));
  } catch {
    return c.json(ok({ started: false, reason: 'Docker socket not available' }));
  }
});

// Notifications
app.get('/notifications', requireSession(), (c) => {
  return c.json(ok(drainQueue()));
});

app.post('/notifications/read', requireSession(), (c) => {
  // Client manages read state; server queue already drained on GET.
  return c.json(ok(null));
});

// ─── Tabs ──────────────────────────────────────────────────────────────
app.get('/tabs', requireSession(), async (c) => {
  try {
    const rows = await db.select().from(schema.tabs).orderBy(asc(schema.tabs.order));
    return c.json(ok(rows.map((r) => ({ id: r.id, label: r.label, order: r.order }))));
  } catch (e) {
    return c.json(err(e instanceof Error ? e.message : 'Failed to list tabs'), 500);
  }
});

app.post('/tabs', requireSession(), async (c) => {
  try {
    const session = c.get('session');
    if (!session) return c.json(err('Unauthorized'), 401);

    const body = (await c.req.json()) as { label?: string };
    if (!body.label || typeof body.label !== 'string' || !body.label.trim()) {
      return c.json(err('Label is required'), 400);
    }

    if (session.tier === 'free') {
      const existing = await db.select().from(schema.tabs);
      if (existing.length >= 1) {
        return c.json(err('Tab limit reached — upgrade to Standard'), 403);
      }
    }

    const allTabs = await db.select().from(schema.tabs);
    const nextOrder = allTabs.length > 0 ? Math.max(...allTabs.map((t) => t.order)) + 1 : 0;

    const id = crypto.randomUUID();
    await db.insert(schema.tabs).values({
      id,
      label: body.label.trim(),
      order: nextOrder,
    });

    return c.json(ok({ id, label: body.label.trim(), order: nextOrder }), 201);
  } catch (e) {
    return c.json(err(e instanceof Error ? e.message : 'Failed to create tab'), 500);
  }
});

app.patch('/tabs/:id', requireSession(), async (c) => {
  try {
    const tabId = c.req.param('id');
    const body = (await c.req.json()) as { label?: string; order?: number };

    const existing = await db.select().from(schema.tabs).where(eq(schema.tabs.id, tabId));
    if (existing.length === 0) return c.json(err('Tab not found'), 404);

    const updates: Record<string, unknown> = {};
    if (body.label !== undefined) updates.label = body.label.trim();
    if (body.order !== undefined) updates.order = body.order;

    if (Object.keys(updates).length > 0) {
      await db.update(schema.tabs).set(updates).where(eq(schema.tabs.id, tabId));
    }

    const updated = await db.select().from(schema.tabs).where(eq(schema.tabs.id, tabId));
    const tab = updated[0];
    if (!tab) return c.json(err('Tab not found after update'), 404);
    return c.json(ok({ id: tab.id, label: tab.label, order: tab.order }));
  } catch (e) {
    return c.json(err(e instanceof Error ? e.message : 'Failed to update tab'), 500);
  }
});

app.delete('/tabs/:id', requireSession(), async (c) => {
  try {
    const tabId = c.req.param('id');
    const allTabs = await db.select().from(schema.tabs).orderBy(asc(schema.tabs.order));

    if (allTabs.length <= 1) {
      return c.json(err('Cannot delete the last tab'), 400);
    }

    const firstOther = allTabs.find((t) => t.id !== tabId);
    if (!firstOther) return c.json(err('No remaining tab to reassign widgets'), 400);

    // Reassign widgets from the deleted tab to the first remaining tab
    await db
      .update(schema.widgetInstances)
      .set({ tabId: firstOther.id })
      .where(eq(schema.widgetInstances.tabId, tabId));

    await db.delete(schema.tabs).where(eq(schema.tabs.id, tabId));

    return c.json(ok(null));
  } catch (e) {
    return c.json(err(e instanceof Error ? e.message : 'Failed to delete tab'), 500);
  }
});

app.get('/tabs/:id/widgets', requireSession(), async (c) => {
  try {
    const tabId = c.req.param('id');
    const rows = await db
      .select()
      .from(schema.widgetInstances)
      .where(eq(schema.widgetInstances.tabId, tabId));

    const instances = await Promise.all(
      rows.map(async (r) => {
        const config = await parseWidgetPublicConfig(r.configEncrypted);
        const configured =
          hasPersistedConfigValue(config) || (await hasStoredWidgetCredentials(r.id));

        return {
          id: r.id,
          widgetId: r.widgetId,
          tabId: r.tabId,
          size: r.size as WidgetSize,
          position: { x: r.positionX, y: r.positionY },
          config,
          configured,
        };
      }),
    );

    return c.json(ok(instances));
  } catch (e) {
    return c.json(err(e instanceof Error ? e.message : 'Failed to list widgets'), 500);
  }
});

// ─── Widget Instances ──────────────────────────────────────────────────
app.post('/widget-instances', requireSession(), async (c) => {
  try {
    const body = (await c.req.json()) as { widgetId?: string; tabId?: string; size?: WidgetSize };
    if (!body.widgetId || !body.tabId) {
      return c.json(err('widgetId and tabId are required'), 400);
    }

    const def = registry.getById(body.widgetId);
    if (!def) return c.json(err('Unknown widget'), 400);

    const size = (body.size && def.sizes.includes(body.size) ? body.size : def.sizes[0]) ?? 'M';

    // Calculate next position: place after last widget on this tab
    const existing = await db
      .select()
      .from(schema.widgetInstances)
      .where(eq(schema.widgetInstances.tabId, body.tabId));
    const posY = existing.length;

    const id = crypto.randomUUID();
    await db.insert(schema.widgetInstances).values({
      id,
      widgetId: body.widgetId,
      tabId: body.tabId,
      size,
      positionX: 0,
      positionY: posY,
    });

    return c.json(
      ok({ id, widgetId: body.widgetId, tabId: body.tabId, size, position: { x: 0, y: posY } }),
      201,
    );
  } catch (e) {
    return c.json(err(e instanceof Error ? e.message : 'Failed to add widget'), 500);
  }
});

app.patch('/widget-instances/:id', requireSession(), async (c) => {
  try {
    const instanceId = c.req.param('id');
    const body = (await c.req.json()) as {
      size?: WidgetSize;
      positionX?: number;
      positionY?: number;
    };

    const existing = await db
      .select()
      .from(schema.widgetInstances)
      .where(eq(schema.widgetInstances.id, instanceId));
    if (existing.length === 0) return c.json(err('Widget instance not found'), 404);

    const updates: Record<string, unknown> = {};
    if (body.size !== undefined) updates.size = body.size;
    if (body.positionX !== undefined) updates.positionX = body.positionX;
    if (body.positionY !== undefined) updates.positionY = body.positionY;
    updates.updatedAt = new Date();

    if (Object.keys(updates).length > 1) {
      await db
        .update(schema.widgetInstances)
        .set(updates)
        .where(eq(schema.widgetInstances.id, instanceId));
    }

    const updated = await db
      .select()
      .from(schema.widgetInstances)
      .where(eq(schema.widgetInstances.id, instanceId));
    const inst = updated[0];
    if (!inst) return c.json(err('Widget instance not found after update'), 404);
    return c.json(
      ok({
        id: inst.id,
        widgetId: inst.widgetId,
        tabId: inst.tabId,
        size: inst.size as WidgetSize,
        position: { x: inst.positionX, y: inst.positionY },
      }),
    );
  } catch (e) {
    return c.json(err(e instanceof Error ? e.message : 'Failed to update widget instance'), 500);
  }
});

app.delete('/widget-instances/:id', requireSession(), async (c) => {
  try {
    const instanceId = c.req.param('id');
    await db.delete(schema.widgetInstances).where(eq(schema.widgetInstances.id, instanceId));
    return c.json(ok(null));
  } catch (e) {
    return c.json(err(e instanceof Error ? e.message : 'Failed to remove widget'), 500);
  }
});

// ─── AI ──────────────────────────────────────────────────────────────────────

const AiChatSchema = z.object({
  provider: z.enum(['ollama', 'openai', 'anthropic']),
  query: z.string().min(1).max(2000),
});

async function loadAiCredential(key: string): Promise<string | null> {
  const rows = await db
    .select()
    .from(schema.credentials)
    .where(eq(schema.credentials.key, key))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  try {
    return await decrypt(row.valueEncrypted);
  } catch {
    return null;
  }
}

const SEARCH_ENGINE_URLS: Record<string, { url: string; name: string }> = {
  duckduckgo: { url: 'https://duckduckgo.com/?q={query}', name: 'DuckDuckGo' },
  google: { url: 'https://www.google.com/search?q={query}', name: 'Google' },
  brave: { url: 'https://search.brave.com/search?q={query}', name: 'Brave Search' },
};

app.get('/ai/status', requireSession(), async (c) => {
  try {
    const configRows = await db
      .select({ key: schema.config.key, value: schema.config.value })
      .from(schema.config);
    const entries: Record<string, string> = {};
    for (const row of configRows) entries[row.key] = row.value;

    const engine = entries.search_engine ?? 'duckduckgo';
    const customUrl = entries.custom_search_url ?? '';
    const preset = SEARCH_ENGINE_URLS[engine];
    const duckduckgoPreset = SEARCH_ENGINE_URLS.duckduckgo;
    const searchEngineUrl =
      engine === 'custom' && customUrl
        ? customUrl
        : (preset?.url ?? duckduckgoPreset?.url ?? 'https://duckduckgo.com/?q={query}');
    const searchEngineName = engine === 'custom' ? 'Web' : (preset?.name ?? 'DuckDuckGo');

    const openaiKey = await loadAiCredential('ai:openai_key');
    const anthropicKey = await loadAiCredential('ai:anthropic_key');

    return c.json(
      ok({
        ollama: Boolean(entries.ollama_url),
        openai: Boolean(openaiKey),
        anthropic: Boolean(anthropicKey),
        searchEngineUrl,
        searchEngineName,
        // For settings page
        searchEngine: engine,
        customSearchUrl: customUrl,
        ollamaUrl: entries.ollama_url ?? '',
        ollamaModel: entries.ollama_model ?? '',
        hasOpenaiKey: Boolean(openaiKey),
        hasAnthropicKey: Boolean(anthropicKey),
      }),
    );
  } catch (e) {
    return c.json(err(e instanceof Error ? e.message : 'Failed to load AI status'), 500);
  }
});

const AiConfigSchema = z.object({
  searchEngine: z.enum(['duckduckgo', 'google', 'brave', 'custom']).optional(),
  customSearchUrl: z.string().max(500).optional(),
  ollamaUrl: z.string().max(500).optional(),
  ollamaModel: z.string().max(100).optional(),
  openaiKey: z.string().max(500).optional(),
  anthropicKey: z.string().max(500).optional(),
});

app.post('/ai/config', requireSession(), async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = AiConfigSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(err('Invalid AI configuration'), 400);
  }
  const data = parsed.data;

  try {
    // Save non-credential config to config table
    const configPairs: Array<{ key: string; value: string }> = [];
    if (data.searchEngine !== undefined)
      configPairs.push({ key: 'search_engine', value: data.searchEngine });
    if (data.customSearchUrl !== undefined)
      configPairs.push({ key: 'custom_search_url', value: data.customSearchUrl });
    if (data.ollamaUrl !== undefined)
      configPairs.push({ key: 'ollama_url', value: data.ollamaUrl });
    if (data.ollamaModel !== undefined)
      configPairs.push({ key: 'ollama_model', value: data.ollamaModel });

    for (const pair of configPairs) {
      await db
        .insert(schema.config)
        .values(pair)
        .onConflictDoUpdate({
          target: schema.config.key,
          set: { value: pair.value },
        });
    }

    // Save credential keys to credentials table
    if (data.openaiKey !== undefined) {
      if (data.openaiKey) {
        const valueEncrypted = await encrypt(data.openaiKey);
        await db
          .insert(schema.credentials)
          .values({ key: 'ai:openai_key', valueEncrypted, updatedAt: Date.now() })
          .onConflictDoUpdate({
            target: schema.credentials.key,
            set: { valueEncrypted, updatedAt: Date.now() },
          });
      } else {
        await db.delete(schema.credentials).where(eq(schema.credentials.key, 'ai:openai_key'));
      }
    }

    if (data.anthropicKey !== undefined) {
      if (data.anthropicKey) {
        const valueEncrypted = await encrypt(data.anthropicKey);
        await db
          .insert(schema.credentials)
          .values({ key: 'ai:anthropic_key', valueEncrypted, updatedAt: Date.now() })
          .onConflictDoUpdate({
            target: schema.credentials.key,
            set: { valueEncrypted, updatedAt: Date.now() },
          });
      } else {
        await db.delete(schema.credentials).where(eq(schema.credentials.key, 'ai:anthropic_key'));
      }
    }

    return c.json(ok(null));
  } catch (e) {
    return c.json(err(e instanceof Error ? e.message : 'Failed to save AI config'), 500);
  }
});

const OllamaTestSchema = z.object({
  url: z.string().min(1).max(500),
});

app.post('/ai/test-ollama', requireSession(), async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = OllamaTestSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(err('Invalid URL'), 400);
  }
  try {
    try {
      assertNotCloudMetadata(parsed.data.url);
    } catch {
      return c.json(err('Invalid Ollama URL'), 400);
    }

    let tagUrl: URL;
    try {
      tagUrl = new URL('/api/tags', parsed.data.url);
    } catch {
      return c.json(err('Invalid Ollama URL'), 400);
    }
    if (tagUrl.protocol !== 'http:' && tagUrl.protocol !== 'https:') {
      return c.json(err('URL must use http or https'), 400);
    }
    const resp = await fetch(tagUrl.toString(), {
      signal: AbortSignal.timeout(5_000),
    });
    if (!resp.ok) {
      return c.json(err(`Ollama returned ${resp.status}`), 502);
    }
    return c.json(ok(null));
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') {
      return c.json(err('Connection timed out'), 504);
    }
    return c.json(err('Failed to connect to Ollama'), 502);
  }
});

app.post('/ai/chat', requireSession(), async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = AiChatSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(err('Invalid request: provider and query are required'), 400);
  }
  const { provider, query } = parsed.data;

  try {
    if (provider === 'ollama') {
      const configRows = await db
        .select({ key: schema.config.key, value: schema.config.value })
        .from(schema.config);
      const entries: Record<string, string> = {};
      for (const row of configRows) entries[row.key] = row.value;
      const ollamaUrl = entries.ollama_url;
      if (!ollamaUrl) {
        return c.json(err('Ollama URL not configured'), 400);
      }

      try {
        assertNotCloudMetadata(ollamaUrl);
      } catch {
        return c.json(err('Invalid Ollama URL'), 400);
      }

      let parsedUrl: URL;
      try {
        parsedUrl = new URL('/api/generate', ollamaUrl);
      } catch {
        return c.json(err('Invalid Ollama URL'), 400);
      }
      if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
        return c.json(err('Ollama URL must use http or https'), 400);
      }
      const ollamaModel = entries.ollama_model ?? 'llama3.2';
      const resp = await fetch(parsedUrl.toString(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: ollamaModel, prompt: query, stream: false }),
        signal: AbortSignal.timeout(30_000),
      });
      if (!resp.ok) {
        return c.json(err(`Ollama returned ${resp.status}`), 502);
      }
      const data = await resp.json();
      const OllamaResponseSchema = z.object({ response: z.string() });
      const ollamaParsed = OllamaResponseSchema.safeParse(data);
      if (!ollamaParsed.success) {
        return c.json(err('Unexpected response from Ollama'), 502);
      }
      return c.json(ok({ text: ollamaParsed.data.response }));
    }

    if (provider === 'openai') {
      const apiKey = await loadAiCredential('ai:openai_key');
      if (!apiKey) {
        return c.json(err('OpenAI API key not configured'), 400);
      }
      const resp = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: query }],
          max_tokens: 1024,
        }),
        signal: AbortSignal.timeout(30_000),
      });
      if (!resp.ok) {
        return c.json(err(`OpenAI returned ${resp.status}`), 502);
      }
      const data = await resp.json();
      const OpenAIResponseSchema = z.object({
        choices: z.array(z.object({ message: z.object({ content: z.string() }) })).min(1),
      });
      const openaiParsed = OpenAIResponseSchema.safeParse(data);
      if (!openaiParsed.success) {
        return c.json(err('Unexpected response from OpenAI'), 502);
      }
      const firstChoice = openaiParsed.data.choices[0];
      if (!firstChoice) {
        return c.json(err('Empty response from OpenAI'), 502);
      }
      return c.json(ok({ text: firstChoice.message.content }));
    }

    if (provider === 'anthropic') {
      const apiKey = await loadAiCredential('ai:anthropic_key');
      if (!apiKey) {
        return c.json(err('Anthropic API key not configured'), 400);
      }
      const resp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1024,
          messages: [{ role: 'user', content: query }],
        }),
        signal: AbortSignal.timeout(30_000),
      });
      if (!resp.ok) {
        return c.json(err(`Anthropic returned ${resp.status}`), 502);
      }
      const data = await resp.json();
      const AnthropicResponseSchema = z.object({
        content: z.array(z.object({ type: z.string(), text: z.string() })).min(1),
      });
      const anthropicParsed = AnthropicResponseSchema.safeParse(data);
      if (!anthropicParsed.success) {
        return c.json(err('Unexpected response from Anthropic'), 502);
      }
      const textBlock = anthropicParsed.data.content.find((b) => b.type === 'text');
      return c.json(ok({ text: textBlock?.text ?? '' }));
    }

    return c.json(err('Unsupported provider'), 400);
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') {
      return c.json(err('AI provider request timed out'), 504);
    }
    return c.json(err(e instanceof Error ? e.message : 'AI request failed'), 500);
  }
});

function honoHandler(event: RequestEvent): Response | Promise<Response> {
  return app.fetch(event.request);
}

export const GET = (event: RequestEvent) => honoHandler(event);
export const POST = (event: RequestEvent) => honoHandler(event);
export const PUT = (event: RequestEvent) => honoHandler(event);
export const PATCH = (event: RequestEvent) => honoHandler(event);
export const DELETE = (event: RequestEvent) => honoHandler(event);
