import { decrypt, schema } from '@phavo/db';
import { err, ok } from '@phavo/types';
import { hashPassword, verifyPassword } from 'better-auth/crypto';
import { eq } from 'drizzle-orm';
import type { Hono } from 'hono';
import { z } from 'zod';
import { checkRateLimit, getLoginAttemptCount, recordLoginAttempt } from '$lib/server/auth.js';
import { db } from '$lib/server/db.js';
import type { AppVariables } from '$lib/server/middleware/auth.js';
import { requireSession } from '$lib/server/middleware/auth.js';
import { getClientIp } from '$lib/server/middleware/rate-limit.js';
import { DEV_MOCK_AUTH_ENABLED } from '$lib/server/mock-auth.js';
import {
  clearSessionCookies,
  generateSessionToken,
  partialSessions,
  setSessionCookies,
  verifyTotpCode,
} from '$lib/server/routes/_auth-helpers.js';

// ─── Zod schemas for request validation ──────────────────────────────────────

const LoginSchema = z.object({
  authMode: z.literal('local'),
  username: z.string().min(1),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

const TotpSchema = z.object({
  partialToken: z.string().min(1),
  code: z.string().length(6),
});

const PasswordSchema = z.object({
  currentPassword: z.string().min(1).max(256),
  newPassword: z.string().min(8).max(256),
});

export function registerAuthRoutes(app: Hono<{ Variables: AppVariables }>): void {
  /**
   * POST /api/v1/auth/login — public, rate-limited.
   * Handles local authentication.
   */
  app.post('/auth/login', async (c) => {
    // In dev mode, always succeed without real credentials.
    if (DEV_MOCK_AUTH_ENABLED) {
      const response = c.json(ok(null));
      await setSessionCookies(response, 'dev', 7 * 24 * 60 * 60);
      return response;
    }

    const ip = getClientIp(c.req);

    const rateCheck = checkRateLimit(ip);
    if (!rateCheck.allowed) {
      console.log(`[phavo] Rate limit: ip=${ip}`);
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
      console.log(`[phavo] Login failed: ip=${ip} attempt=${getLoginAttemptCount(ip)}`);
      const msg = parsed.error.issues[0]?.message ?? 'Validation failed';
      return c.json(err(msg), 400);
    }

    const body = parsed.data;
    const SESSION_MAX_AGE = 7 * 24 * 60 * 60; // 7 days in seconds

    // ── Local auth ──────────────────────────────────────────────────────────────
    const { username, password } = body;

    const localUsers = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.authMode, 'local'));
    const user = localUsers.find((u) => u.email === username);

    if (!user || !user.passwordHash) {
      recordLoginAttempt(ip, false);
      console.log(`[phavo] Login failed: ip=${ip} attempt=${getLoginAttemptCount(ip)}`);
      return c.json(err('Invalid credentials'), 401);
    }

    const valid = await verifyPassword({ hash: user.passwordHash, password });
    if (!valid) {
      recordLoginAttempt(ip, false);
      console.log(`[phavo] Login failed: ip=${ip} attempt=${getLoginAttemptCount(ip)}`);
      return c.json(err('Invalid credentials'), 401);
    }

    // Check if TOTP is enabled for this user.
    if (user.totpSecret) {
      const partialToken = generateSessionToken();
      if (partialSessions.size >= 1000) {
        return c.json(err('Too many pending sessions'), 429);
      }
      partialSessions.set(partialToken, {
        userId: user.id,
        authMode: 'local',
        expiresMs: Date.now() + 5 * 60 * 1000,
      });
      return c.json(ok({ requiresTotp: true as const, partialToken }));
    }

    const token = generateSessionToken();
    await db.insert(schema.sessions).values({
      id: token,
      userId: user.id,
      authMode: 'local',
      validatedAt: Date.now(),
      expiresAt: Date.now() + SESSION_MAX_AGE * 1000,
    });

    recordLoginAttempt(ip, true);
    console.log(`[phavo] Login success: userId=${user.id} ip=${ip}`);
    const response = c.json(ok(null));
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
      authMode: pending.authMode,
      validatedAt: Date.now(),
      expiresAt: Date.now() + SESSION_MAX_AGE * 1000,
    });
    partialSessions.delete(partialToken);

    const response = c.json(ok(null));
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
   */
  app.get('/auth/session', requireSession(), (c) => {
    const session = c.get('session');
    if (!session) return c.json(err('Unauthorized'), 401);
    return c.json(
      ok({
        authMode: session.authMode,
        validatedAt: session.validatedAt,
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

      let rawBody: unknown;
      try {
        rawBody = await c.req.json();
      } catch {
        return c.json(err('Invalid password data'), 400);
      }

      const body = PasswordSchema.safeParse(rawBody);
      if (!body.success) return c.json(err('Invalid password data'), 400);

      const users = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.id, session.userId))
        .limit(1);
      const user = users[0];
      if (!user?.passwordHash) {
        return c.json(err('User account not found'), 404);
      }

      const currentValid = await verifyPassword({
        hash: user.passwordHash,
        password: body.data.currentPassword,
      });
      if (!currentValid) {
        return c.json(err('Current password is incorrect'), 401);
      }

      const passwordHash = await hashPassword(body.data.newPassword);
      await db
        .update(schema.users)
        .set({ passwordHash })
        .where(eq(schema.users.id, session.userId));

      return c.json(ok(null));
    } catch (e) {
      console.error('[phavo]', e);
      return c.json(err('Internal error'), 500);
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
      console.error('[phavo]', e);
      return c.json(err('Internal error'), 500);
    }
  });
}
