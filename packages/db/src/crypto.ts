// AES-256-GCM encryption via Web Crypto API (crypto.subtle), native in Bun.
// Key derived from PHAVO_SECRET (or auto-generated secret) via HKDF-SHA256.
// Secret priority:
//   1. PHAVO_SECRET env var (required for Kubernetes / multi-instance deployments)
//   2. Persisted secret in data volume (data/secret.key) — loaded on restart
//   3. Auto-generate and persist atomically on first start
//
// Ciphertext format: base64( iv[12 bytes] + authTag[16 bytes] + ciphertext[n bytes] )
// Note: SubtleCrypto.encrypt appends the authTag to the ciphertext automatically.

import { randomBytes } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path, { dirname } from 'node:path';
import { env } from '@phavo/types/env';

const ALGORITHM = 'AES-GCM';
const IV_LENGTH = 12; // bytes
const TAG_LENGTH = 128; // bits (= 16 bytes)

// Path to persisted secret — equivalent to paths.encKey in apps/web/src/lib/server/paths.ts.
// Kept in sync: path.join(env.dataDir, 'secret.key')
const ENC_KEY_PATH = path.join(env.dataDir, 'secret.key');

let cachedSecret: string | null = null;
let cachedKey: CryptoKey | null = null;

/**
 * Loads the encryption secret from the environment, the persisted key file,
 * or generates and persists a new one on first start.
 *
 * Call once at startup; subsequent calls return the cached value immediately.
 */
export async function loadOrCreateSecret(): Promise<string> {
  if (cachedSecret !== null) return cachedSecret;

  // Explicit env var always wins (Kubernetes, power users, CI).
  if (process.env.PHAVO_SECRET && process.env.PHAVO_SECRET !== 'change-me') {
    cachedSecret = process.env.PHAVO_SECRET;
    return cachedSecret;
  }

  // Try to load existing persisted secret from data volume.
  try {
    const stored = readFileSync(ENC_KEY_PATH, 'utf8').trim();
    if (stored.length >= 32) {
      cachedSecret = stored;
      return cachedSecret;
    }
  } catch {
    // File doesn't exist yet — fall through to generate.
  }

  // Generate a new 256-bit secret and persist it atomically.
  // flag 'wx' = exclusive create — prevents a race condition on concurrent first starts.
  const secret = randomBytes(32).toString('hex'); // 64-char hex string
  mkdirSync(dirname(ENC_KEY_PATH), { recursive: true });
  try {
    writeFileSync(ENC_KEY_PATH, secret, { mode: 0o600, flag: 'wx' });
  } catch {
    // Another process won the race — use their persisted value.
    const stored = readFileSync(ENC_KEY_PATH, 'utf8').trim();
    cachedSecret = stored;
    return cachedSecret;
  }

  console.log('[phavo] Encryption secret generated → stored in data volume');
  console.log('[phavo] Back up your data volume to preserve access to encrypted data.');
  cachedSecret = secret;
  return cachedSecret;
}

async function getKey(): Promise<CryptoKey> {
  if (cachedKey !== null) return cachedKey;

  const secret = await loadOrCreateSecret();

  const encoder = new TextEncoder();

  // Import the raw secret as HKDF key material.
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HKDF' },
    false,
    ['deriveKey'],
  );

  // Derive a 256-bit AES-GCM key using HKDF-SHA256.
  cachedKey = await crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      // Empty salt is acceptable when the input key material is already high-entropy.
      salt: new Uint8Array(0),
      info: encoder.encode('phavo-aes-key'),
    },
    keyMaterial,
    { name: ALGORITHM, length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );

  return cachedKey;
}

/** Encode a Uint8Array to a base64 string. Uses Buffer for performance and safety. */
function toBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64');
}

export async function encrypt(plaintext: string): Promise<string> {
  const key = await getKey();
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));

  // SubtleCrypto appends the authTag to the end of the ciphertext buffer.
  const enc = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv, tagLength: TAG_LENGTH },
    key,
    new TextEncoder().encode(plaintext),
  );

  // Layout: iv[12] + (ciphertext[n] + authTag[16])
  const combined = new Uint8Array(iv.length + enc.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(enc), iv.length);

  return toBase64(combined);
}

export async function decrypt(ciphertext: string): Promise<string> {
  const key = await getKey();

  const combined = Uint8Array.from(atob(ciphertext), (c) => c.charCodeAt(0));
  const iv = combined.slice(0, IV_LENGTH);
  // Remainder is ciphertext[n] + authTag[16], as expected by SubtleCrypto.
  const data = combined.slice(IV_LENGTH);

  const decrypted = await crypto.subtle.decrypt(
    { name: ALGORITHM, iv, tagLength: TAG_LENGTH },
    key,
    data,
  );

  return new TextDecoder().decode(decrypted);
}
