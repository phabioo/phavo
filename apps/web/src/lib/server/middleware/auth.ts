// apps/web/src/lib/server/middleware/auth.ts
// authMiddleware: validates session cookie against DB on every request.
// requireSession: per-route access guard.

import { schema } from '@phavo/db';
import { err } from '@phavo/types';
import { eq } from 'drizzle-orm';
import type { MiddlewareHandler } from 'hono';
import { db } from '$lib/server/db';

export type SessionRecord = typeof schema.sessions.$inferSelect;

export type AppVariables = {
  session?: SessionRecord;
};

// Routes that bypass session validation entirely (no auth required).
const PUBLIC_PATHS = new Set([
  '/api/v1/system/health',
  '/api/v1/auth/login',
  '/api/v1/auth/totp',
  '/api/v1/auth/register',
  '/api/v1/auth/setup-status',
]);

function parseCookieValue(header: string, name: string): string | undefined {
  return header
    .split(';')
    .map((p) => p.trim())
    .find((p) => p.startsWith(`${name}=`))
    ?.slice(name.length + 1);
}

export const authMiddleware: MiddlewareHandler<{ Variables: AppVariables }> = async (c, next) => {
  // Public routes bypass session validation entirely.
  if (PUBLIC_PATHS.has(c.req.path)) {
    return next();
  }

  // Read session token from HttpOnly cookie.
  const cookieHeader = c.req.header('cookie') ?? '';
  const token = parseCookieValue(cookieHeader, 'phavo_session');
  if (!token) return c.json(err('Unauthorized'), 401);

  // Validate session against DB.
  const rows = await db.select().from(schema.sessions).where(eq(schema.sessions.id, token));
  const session = rows[0];
  if (!session) return c.json(err('Unauthorized'), 401);

  const now = Date.now();

  // Hard expiry check — delete expired sessions.
  if (session.expiresAt < now) {
    await db.delete(schema.sessions).where(eq(schema.sessions.id, token));
    return c.json(err('Session expired'), 401);
  }

  c.set('session', session);
  return next();
};

export function requireSession(): MiddlewareHandler<{ Variables: AppVariables }> {
  return async (c, next) => {
    if (!c.get('session')) return c.json(err('Unauthorized'), 401);
    await next();
  };
}
