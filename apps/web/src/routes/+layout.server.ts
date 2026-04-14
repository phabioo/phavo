import { hostname } from 'node:os';
import { schema } from '@phavo/db';
import type { DashboardConfig } from '@phavo/types';
import { redirect, type ServerLoadEvent } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { db, dbReady } from '$lib/server/db';

const SETUP_PATH = '/setup';
const AUTH_PREFIX = '/auth';
const API_PREFIX = '/api';

export const load = async ({ cookies, url }: ServerLoadEvent) => {
  // API routes never need session data — bypass all guards
  if (url.pathname.startsWith(API_PREFIX)) {
    return { session: null, setupComplete: false, dashboardName: 'My Dashboard' };
  }

  const onSetup = url.pathname.startsWith(SETUP_PATH);
  const onAuth = url.pathname.startsWith(AUTH_PREFIX);

  let config: DashboardConfig = {
    setupComplete: false,
    dashboardName: 'My Dashboard',
    tabs: [],
    sessionTimeout: '7d',
  };

  // ── 1. Read setupComplete from DB ────────────────────────────────────────
  let setupComplete = false;
  try {
    await dbReady; // ensure schema exists before querying
    const rows = await db.query.config.findMany();
    const entries: Record<string, string> = {};
    for (const row of rows) entries[row.key] = row.value;
    setupComplete = entries.setup_complete === 'true';
    config = {
      setupComplete,
      dashboardName: entries.dashboard_name ?? 'My Dashboard',
      tabs: [],
      sessionTimeout:
        (entries.session_timeout as '1d' | '7d' | '30d' | 'never' | undefined) ?? '7d',
      location:
        entries.location_name && entries.location_latitude && entries.location_longitude
          ? {
              name: entries.location_name,
              latitude: Number(entries.location_latitude),
              longitude: Number(entries.location_longitude),
            }
          : undefined,
    };
  } catch {
    // DB not yet initialised (first launch) — treat as incomplete
    setupComplete = false;
  }

  // ── 2. Resolve session ──────────────────────────────────────────────────
  let session: { userId: string; authMode: string; validatedAt: number } | null = null;
  let username = '';
  {
    const sessionId = cookies.get('phavo_session');
    if (sessionId) {
      const rows = await db.select().from(schema.sessions).where(eq(schema.sessions.id, sessionId));
      const row = rows[0];
      const now = Date.now();

      if (!row || row.expiresAt < now) {
        if (row?.expiresAt && row.expiresAt < now) {
          await db.delete(schema.sessions).where(eq(schema.sessions.id, sessionId));
        }

        cookies.delete('phavo_session', { path: '/' });
        cookies.delete('phavo_csrf', { path: '/' });
        redirect(303, SETUP_PATH);
      }

      session = {
        userId: row.userId,
        authMode: row.authMode,
        validatedAt: row.validatedAt,
      };

      const userRows = await db
        .select({ email: schema.users.email })
        .from(schema.users)
        .where(eq(schema.users.id, row.userId))
        .limit(1);
      username = userRows[0]?.email ?? '';
    }
  }

  // ── 3. Route guards ─────────────────────────────────────────────────────
  // First launch: force setup wizard (auth pages and setup itself are exempt)
  if (!setupComplete && !onSetup && !onAuth) {
    redirect(303, SETUP_PATH);
  }

  // Setup already done: don't allow re-entering the wizard
  if (setupComplete && onSetup && session) {
    redirect(303, '/');
  }

  // Protected routes require a session (setup page doesn't — it IS onboarding)
  if (!session && !onAuth && !onSetup) {
    redirect(303, '/auth/login');
  }

  return {
    session,
    setupComplete,
    config,
    dashboardName: config.dashboardName,
    hostname: hostname(),
    username,
  };
};
