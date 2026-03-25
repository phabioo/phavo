import { redirect, type ServerLoadEvent } from '@sveltejs/kit';
import { schema } from '@phavo/db';
import { eq } from 'drizzle-orm';
import { db, dbReady } from '$lib/server/db';
import { DEV_MOCK_AUTH, getMockSession } from '$lib/server/mock-auth';

const SETUP_PATH = '/setup';
const AUTH_PREFIX = '/auth';
const API_PREFIX = '/api';

export const load = async ({ cookies, url }: ServerLoadEvent) => {
  // API routes never need session data — bypass all guards
  if (url.pathname.startsWith(API_PREFIX)) {
    return { session: null, setupComplete: false };
  }

  const onSetup = url.pathname.startsWith(SETUP_PATH);
  const onAuth  = url.pathname.startsWith(AUTH_PREFIX);

  let config = {
    setupComplete: false,
    dashboardName: 'My Dashboard',
    tier: 'free' as const,
    tabs: [],
    sessionTimeout: '7d' as const,
    location: undefined as { name: string; latitude: number; longitude: number } | undefined,
  };

  // ── 1. Read setupComplete from DB ────────────────────────────────────────
  let setupComplete = false;
  try {
    await dbReady; // ensure schema exists before querying
    const rows = await db.query.config.findMany();
    const entries: Record<string, string> = {};
    for (const row of rows) entries[row.key] = row.value;
    setupComplete = entries['setup_complete'] === 'true';
    config = {
      setupComplete,
      dashboardName: entries['dashboard_name'] ?? 'My Dashboard',
      tier: (entries['tier'] as 'free' | 'standard' | 'local' | undefined) ?? 'free',
      tabs: [],
      sessionTimeout: (entries['session_timeout'] as '1d' | '7d' | '30d' | 'never' | undefined) ?? '7d',
      location:
        entries['location_name'] && entries['location_latitude'] && entries['location_longitude']
          ? {
              name: entries['location_name'],
              latitude: Number(entries['location_latitude']),
              longitude: Number(entries['location_longitude']),
            }
          : undefined,
    };
  } catch {
    // DB not yet initialised (first launch) — treat as incomplete
    setupComplete = false;
  }

  // ── 2. Resolve session ──────────────────────────────────────────────────
  let session: ReturnType<typeof getMockSession> | null = null;
  if (DEV_MOCK_AUTH) {
    // Dev bypass: synthetic standard-tier session, no phavo.io needed
    session = getMockSession();
  } else {
    const sessionId = cookies.get('phavo_session');
    if (sessionId) {
      const rows = await db.select().from(schema.sessions).where(eq(schema.sessions.id, sessionId));
      if (rows[0]) {
        session = {
          userId: rows[0].userId,
          tier: rows[0].tier,
          authMode: rows[0].authMode,
          validatedAt: rows[0].validatedAt,
          graceUntil: rows[0].graceUntil ?? undefined,
        };
      } else {
        session = {
          userId: sessionId,
          tier: 'free' as const,
          authMode: 'local' as const,
          validatedAt: Date.now(),
        };
      }
    }
  }

  // ── 3. Route guards ─────────────────────────────────────────────────────
  // First launch: force setup wizard (auth pages and setup itself are exempt)
  if (!setupComplete && !onSetup && !onAuth) {
    redirect(303, SETUP_PATH);
  }

  // Setup already done: don't allow re-entering the wizard
  if (setupComplete && onSetup) {
    redirect(303, '/');
  }

  // Protected routes require a session (setup page doesn't — it IS onboarding)
  if (!session && !onAuth && !onSetup) {
    redirect(303, '/auth/login');
  }

  return { session, setupComplete, devMode: DEV_MOCK_AUTH, config };
};
