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
import type { RequestEvent } from '@sveltejs/kit';
import { hashPassword, verifyPassword } from 'better-auth/crypto';
import { asc, desc, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import { cached } from '$lib/server/agent';
import { checkRateLimit, recordLoginAttempt } from '$lib/server/auth';
import { db, dbReady } from '$lib/server/db';
import { activateLocalLicense } from '$lib/server/license';
import {
  type AppVariables,
  authMiddleware,
  requireSession,
  requireTier,
} from '$lib/server/middleware/auth';
import { csrfMiddleware, deriveCsrfToken } from '$lib/server/middleware/csrf';
import { DEV_MOCK_AUTH_ENABLED } from '$lib/server/mock-auth';
import { drainQueue, serverNotify } from '$lib/server/notifier';
import { paths } from '$lib/server/paths';
import {
  LinksWidgetConfigSchema,
  RssWidgetConfigSchema,
  registry,
} from '$lib/server/widget-registry';

const app = new Hono<{ Variables: AppVariables }>().basePath('/api/v1');
const PHAVO_VERSION = process.env.PHAVO_VERSION ?? '0.0.1';

// ─── Global middleware ────────────────────────────────────────────────────────
// authMiddleware validates the session cookie on every non-public request.
// csrfMiddleware validates the X-CSRF-Token header on state-changing requests.
app.use('*', authMiddleware);
app.use('*', csrfMiddleware);

// ─── Helpers ─────────────────────────────────────────────────────────────────

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

/** Sets phavo_session (HttpOnly) and phavo_csrf (readable by JS) response cookies.
 *  Pass c.header.bind(c, 'Set-Cookie') as the first argument. */
async function setSessionCookies(
  appendCookie: (value: string) => void,
  token: string,
  maxAgeSeconds: number,
): Promise<void> {
  const csrfToken = await deriveCsrfToken(token);
  appendCookie(
    `phavo_session=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAgeSeconds}`,
  );
  appendCookie(`phavo_csrf=${csrfToken}; Path=/; SameSite=Lax; Max-Age=${maxAgeSeconds}`);
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
app.get('/health', (c) =>
  c.json(ok({ version: PHAVO_VERSION, platform: process.env.PHAVO_ENV ?? 'docker' })),
);

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
    await dbReady;
    const body = (await c.req.json()) as {
      setupComplete?: boolean;
      dashboardName?: string;
      sessionTimeout?: '1d' | '7d' | '30d' | 'never';
      location?: { name: string; latitude: number; longitude: number } | null;
    };

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

// ─── Auth ─────────────────────────────────────────────────────────────────────

/**
 * POST /api/v1/auth/login — public, rate-limited.
 * Handles phavo-io (OAuth code exchange) and local (password + optional
 * license key for first activation) authentication flows.
 */
app.post('/auth/login', async (c) => {
  // In dev mode, always succeed without real credentials.
  if (DEV_MOCK_AUTH_ENABLED) {
    return c.json(ok({ tier: 'free' as const }));
  }

  const ip =
    c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ??
    c.req.header('x-real-ip') ??
    'unknown';

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

  await dbReady;
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
    await setSessionCookies((v) => c.header('Set-Cookie', v), token, SESSION_MAX_AGE);
    return c.json(ok({ tier }));
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
    await setSessionCookies((v) => c.header('Set-Cookie', v), token, SESSION_MAX_AGE);
    return c.json(ok({ tier: 'local' as const }));
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

  // Check if TOTP is enabled for this user.
  if (user.totpSecret) {
    const partialToken = generateSessionToken();
    partialSessions.set(partialToken, {
      userId: user.id,
      tier: 'local',
      authMode: 'local',
      graceUntil: null,
      expiresMs: Date.now() + 5 * 60 * 1000,
    });
    // Delete the full session we just created — user must complete TOTP first.
    await db.delete(schema.sessions).where(eq(schema.sessions.id, token));
    return c.json(ok({ requiresTotp: true as const, partialToken }));
  }

  recordLoginAttempt(ip, true);
  await setSessionCookies((v) => c.header('Set-Cookie', v), token, SESSION_MAX_AGE);
  return c.json(ok({ tier: 'local' as const }));
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

  await setSessionCookies((v) => c.header('Set-Cookie', v), token, SESSION_MAX_AGE);
  return c.json(ok({ tier: pending.tier }));
});

/** POST /api/v1/auth/logout — invalidates current session and clears cookies. */
app.post('/auth/logout', requireSession(), async (c) => {
  const session = c.get('session');
  if (session && !DEV_MOCK_AUTH_ENABLED) {
    await db.delete(schema.sessions).where(eq(schema.sessions.id, session.id));
  }
  c.header('Set-Cookie', 'phavo_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0');
  c.header('Set-Cookie', 'phavo_csrf=; Path=/; SameSite=Lax; Max-Age=0');
  return c.json(ok(null));
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
    await dbReady;
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
    await dbReady;
    const session = c.get('session');
    if (session && !DEV_MOCK_AUTH_ENABLED) {
      await db.delete(schema.sessions).where(eq(schema.sessions.userId, session.userId));
    }
    c.header('Set-Cookie', 'phavo_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0');
    c.header('Set-Cookie', 'phavo_csrf=; Path=/; SameSite=Lax; Max-Age=0');
    return c.json(ok(null));
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
    const body = (await c.req.json()) as { url?: string; token?: string };
    if (!body.url || !body.token) {
      return c.json(err('URL and token required'), 400);
    }
    const data = await getPihole(body.url, body.token);
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
    await dbReady;
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
    await dbReady;
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

    await setSessionCookies((value) => c.header('Set-Cookie', value), token, sessionMaxAge);
    return c.json(ok({ tier: 'local' as const, reload: true }));
  } catch (e) {
    return c.json(err(e instanceof Error ? e.message : 'Failed to activate licence'), 500);
  }
});

app.post('/license/deactivate', requireSession(), async (c) => {
  try {
    await dbReady;
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
    await dbReady;
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
    const { exec } = await import('node:child_process');
    // Fire-and-forget: the container will stop mid-request
    exec('docker compose pull && docker compose up -d');
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
    await dbReady;
    const rows = await db.select().from(schema.tabs).orderBy(asc(schema.tabs.order));
    return c.json(ok(rows.map((r) => ({ id: r.id, label: r.label, order: r.order }))));
  } catch (e) {
    return c.json(err(e instanceof Error ? e.message : 'Failed to list tabs'), 500);
  }
});

app.post('/tabs', requireSession(), async (c) => {
  try {
    await dbReady;
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
    await dbReady;
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
    await dbReady;
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
    await dbReady;
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
    await dbReady;
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
    await dbReady;
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
    await dbReady;
    const instanceId = c.req.param('id');
    await db.delete(schema.widgetInstances).where(eq(schema.widgetInstances.id, instanceId));
    return c.json(ok(null));
  } catch (e) {
    return c.json(err(e instanceof Error ? e.message : 'Failed to remove widget'), 500);
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
