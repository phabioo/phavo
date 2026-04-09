/**
 * Shared auth helpers used by auth routes and license routes.
 * Extracted from the monolithic API file during the route split.
 */

import { env } from '@phavo/types/env';
import { deriveCsrfToken } from '$lib/server/middleware/csrf.js';

/** Generates a 32-byte cryptographically random session token (base64url). */
export function generateSessionToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...Array.from(bytes)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function appendSetCookie(response: Response, value: string): void {
  response.headers.append('Set-Cookie', value);
}

/** Sets phavo_session (HttpOnly) and phavo_csrf (readable by JS) response cookies. */
export async function setSessionCookies(
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
    `phavo_csrf=${csrfToken}; Path=/; SameSite=Strict; Max-Age=${maxAgeSeconds}${secure}`,
  );
}

export function clearSessionCookies(response: Response): void {
  const secure = env.nodeEnv === 'production' ? '; Secure' : '';
  appendSetCookie(
    response,
    `phavo_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secure}`,
  );
  appendSetCookie(response, `phavo_csrf=; Path=/; SameSite=Strict; Max-Age=0${secure}`);
}

/** Verifies an RS256-signed JWT using a base64-encoded SPKI public key.
 *  Returns false on any error (invalid signature, expired, malformed). */
export async function verifyActivationJwt(jwt: string, pubKeyB64: string): Promise<boolean> {
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
export async function verifyTotpCode(secret: string, code: string): Promise<boolean> {
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

/** Partial sessions for the TOTP 2FA flow: partialToken → pending session data. */
export interface PendingSession {
  userId: string;
  tier: 'stellar' | 'celestial';
  authMode: 'phavo-net' | 'local';
  graceUntil: number | null;
  expiresMs: number; // absolute timestamp when this partial session expires
}

export const partialSessions = new Map<string, PendingSession>();

// Prune expired partial sessions every minute.
setInterval(() => {
  const now = Date.now();
  for (const [token, s] of partialSessions) {
    if (s.expiresMs < now) partialSessions.delete(token);
  }
}, 60_000);
