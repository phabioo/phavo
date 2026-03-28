/**
 * Widget config and credential helpers shared across route modules.
 */

import { decrypt, encrypt, schema } from '@phavo/db';
import { isCredentialField, PRESERVE_CREDENTIAL_VALUE } from '@phavo/types';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '$lib/server/db';

export function credentialStorageKey(instanceId: string, fieldPath: string): string {
  return `widget:${instanceId}:${fieldPath}`;
}

export async function loadDecryptedCredential(key: string): Promise<string | null> {
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

export async function hasStoredWidgetCredentials(instanceId: string): Promise<boolean> {
  const prefix = `widget:${instanceId}:`;
  const rows = await db.select().from(schema.credentials);
  return rows.some((row) => row.key.startsWith(prefix));
}

export type CredentialEntry = {
  path: string;
  value: string;
};

export type SplitConfigResult = {
  publicConfig: unknown;
  credentials: CredentialEntry[];
  preservedCredentialPaths: string[];
};

export async function syncInstanceCredentials(
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

function unwrapSchema(zodSchema: z.ZodTypeAny): z.ZodTypeAny {
  let current = zodSchema;

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

export function splitWidgetConfig(
  value: unknown,
  zodSchema: z.ZodTypeAny,
  path = '',
): SplitConfigResult {
  const normalizedSchema = unwrapSchema(zodSchema);

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

export function hasPersistedConfigValue(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') return Object.keys(value as Record<string, unknown>).length > 0;
  return true;
}

export async function parseWidgetPublicConfig(
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

export async function parseEncryptedWidgetConfig<T>(
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

export async function loadInstanceCredentialMap(instanceId: string): Promise<Map<string, string>> {
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
