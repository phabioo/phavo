// AES-256-GCM encryption via Web Crypto API (crypto.subtle), native in Bun.
// Key derived from PHAVO_SECRET via HKDF-SHA256 with info "phavo-aes-key".
// Key is derived once and cached in module scope for the lifetime of the process.
//
// Ciphertext format: base64( iv[12 bytes] + authTag[16 bytes] + ciphertext[n bytes] )
// Note: SubtleCrypto.encrypt appends the authTag to the ciphertext automatically.

const ALGORITHM = 'AES-GCM';
const IV_LENGTH = 12; // bytes
const TAG_LENGTH = 128; // bits (= 16 bytes)

let cachedKey: CryptoKey | null = null;

async function getKey(): Promise<CryptoKey> {
  if (cachedKey !== null) return cachedKey;

  const secret = process.env.PHAVO_SECRET;
  if (!secret) {
    throw new Error('PHAVO_SECRET environment variable is not set');
  }

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
