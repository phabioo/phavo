// apps/web/src/lib/server/middleware/csrf.ts
// CSRF protection for all state-changing requests (POST, PUT, DELETE, PATCH).
//
// Strategy: HMAC double-submit.
//  1. After login/auth, the client receives a phavo_csrf cookie (not HttpOnly).
//  2. Client-side JS reads the cookie and sends it as X-CSRF-Token header.
//  3. This middleware re-derives the expected token from the session ID using
//     HMAC-SHA256 (keyed via HKDF from PHAVO_SECRET) and compares to the header.
//
// Public paths and safe-method requests (GET/HEAD/OPTIONS) are exempt.

import { err } from '@phavo/types';
import type { MiddlewareHandler } from 'hono';
import { DEV_MOCK_AUTH_ENABLED } from '$lib/server/mock-auth';
import type { AppVariables } from './auth';

const CSRF_EXEMPT_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

// Must mirror PUBLIC_PATHS in auth.ts — these have no session, so CSRF is N/A.
const PUBLIC_PATHS = new Set(['/api/v1/health', '/api/v1/auth/login', '/api/v1/auth/totp']);

// Cached CSRF HMAC key (derived once from PHAVO_SECRET via HKDF).
let _csrfKey: CryptoKey | null = null;

async function getCsrfKey(): Promise<CryptoKey> {
  if (_csrfKey) return _csrfKey;
  const raw = new TextEncoder().encode(
    process.env.PHAVO_SECRET ?? 'phavo-dev-secret-change-in-production',
  );
  const master = await crypto.subtle.importKey('raw', raw, 'HKDF', false, ['deriveKey']);
  _csrfKey = await crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: new Uint8Array(0),
      // Distinct context so CSRF key ≠ AES encryption key (key separation).
      info: new TextEncoder().encode('phavo:csrf:v1'),
    },
    master,
    { name: 'HMAC', hash: 'SHA-256', length: 256 },
    false,
    ['sign', 'verify'],
  );
  return _csrfKey;
}

/** Derives a stable CSRF token for a session ID. Used by authMiddleware to set
 *  the phavo_csrf cookie and by csrfMiddleware to validate the incoming header. */
export async function deriveCsrfToken(sessionId: string): Promise<string> {
  const key = await getCsrfKey();
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(sessionId));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export const csrfMiddleware: MiddlewareHandler<{ Variables: AppVariables }> = async (c, next) => {
  // Safe methods are never CSRF targets.
  if (CSRF_EXEMPT_METHODS.has(c.req.method)) return next();

  // Public routes have no session — CSRF does not apply.
  if (PUBLIC_PATHS.has(c.req.path)) return next();

  // Dev mock auth bypasses CSRF in non-production environments.
  if (DEV_MOCK_AUTH_ENABLED) return next();

  const session = c.get('session');
  // authMiddleware already rejected unauthenticated requests for non-public paths.
  if (!session) return c.json(err('Unauthorized'), 401);

  const headerToken = c.req.header('X-CSRF-Token');
  if (!headerToken) return c.json(err('CSRF token missing'), 403);

  const expected = await deriveCsrfToken(session.id);
  if (headerToken !== expected) return c.json(err('CSRF token invalid'), 403);

  return next();
};
