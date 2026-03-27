// apps/web/src/lib/server/middleware/auth.ts
// authMiddleware: validates session cookie against DB on every request.
// requireSession / requireTier: per-route access guards.

import { schema } from '@phavo/db';
import { err } from '@phavo/types';
import { eq } from 'drizzle-orm';
import type { MiddlewareHandler } from 'hono';
import { db } from '$lib/server/db';
import { DEV_MOCK_AUTH_ENABLED, getMockSession } from '$lib/server/mock-auth';

export type SessionRecord = typeof schema.sessions.$inferSelect;

export type AppVariables = {
  session?: SessionRecord;
};

type Tier = 'free' | 'standard' | 'local';

const TIER_RANK: Record<Tier, number> = { free: 0, standard: 1, local: 2 };

// Routes that bypass session validation entirely (no auth required).
const PUBLIC_PATHS = new Set(['/api/v1/health', '/api/v1/auth/login', '/api/v1/auth/totp']);

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

  // Dev auth bypass — only allowed outside production.
  if (DEV_MOCK_AUTH_ENABLED) {
    const mockSession = getMockSession();
    const devSession: SessionRecord = {
      id: 'dev',
      userId: mockSession.userId,
      tier: mockSession.tier,
      authMode: mockSession.authMode,
      validatedAt: mockSession.validatedAt,
      graceUntil: null,
      expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
    };
    c.set('session', devSession);
    return next();
  }

  // Read session token from HttpOnly cookie.
  const cookieHeader = c.req.header('cookie') ?? '';
  const token = parseCookieValue(cookieHeader, 'phavo_session');
  if (!token) return c.json(err('Unauthorized'), 401);

  // Validate session against DB — tier always comes from DB, never from cookie payload.
  const rows = await db.select().from(schema.sessions).where(eq(schema.sessions.id, token));
  const session = rows[0];
  if (!session) return c.json(err('Unauthorized'), 401);

  const now = Date.now();

  // Hard expiry check — delete expired sessions.
  if (session.expiresAt < now) {
    await db.delete(schema.sessions).where(eq(schema.sessions.id, token));
    return c.json(err('Session expired'), 401);
  }

  // phavo.net grace period check (arch spec "Session Validation" step 2).
  if (session.authMode === 'phavo-io' && session.graceUntil !== null && session.graceUntil < now) {
    return c.json(err('Grace period expired — please log in again'), 401);
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

export function requireTier(minimum: Tier): MiddlewareHandler<{ Variables: AppVariables }> {
  return async (c, next) => {
    const session = c.get('session');
    if (!session) return c.json(err('Unauthorized'), 401);
    if (TIER_RANK[session.tier] < TIER_RANK[minimum]) {
      return c.json(err('Upgrade required'), 403);
    }
    await next();
  };
}
