// apps/web/src/hooks.server.ts
// SvelteKit server hooks. Module-level code runs once on server startup.

import { loadOrCreateSecret, schema } from '@phavo/db';
import { env } from '@phavo/types/env';
import type { Handle } from '@sveltejs/kit';
import { lt } from 'drizzle-orm';
import { db, dbReady } from '$lib/server/db';
import { deriveInstallMethod } from '$lib/server/install';
import { paths } from '$lib/server/paths';

let shutdownRegistered = false;

async function shutdown(signal: string): Promise<void> {
  console.log(`[phavo] Received ${signal}, shutting down...`);

  try {
    // Drizzle keeps the underlying libSQL client on $client, but it is not surfaced
    // in the app-level wrapper type, so shutdown uses a narrow structural access here.
    const client = (db as typeof db & { $client?: { close?: () => Promise<void> | void } }).$client;
    await client?.close?.();
    console.log('[phavo] Shutdown complete');
  } catch (e) {
    console.error('[phavo] Shutdown error:', e);
  }

  process.exit(0);
}

// Reject the default placeholder secret in production.
if (env.nodeEnv === 'production' && process.env.PHAVO_SECRET === 'change-me') {
  console.error(
    '[phavo] PHAVO_SECRET is still set to the default "change-me". Set a strong random value and restart.',
  );
  process.exit(1);
}

// Eagerly initialise the encryption secret on startup: reads PHAVO_SECRET env var,
// falls back to the persisted data/secret.key, or auto-generates one on first start.
dbReady
  .then(() => loadOrCreateSecret())
  .then(() => {
    console.log(`[phavo] Phavo v${PHAVO_VERSION} starting`);
    console.log(`[phavo] Platform: ${env.platform}`);
    console.log(`[phavo] Port: ${env.port}`);
    console.log(`[phavo] Data dir: ${env.dataDir}`);
    console.log(`[phavo] DB: ${paths.db}`);
    console.log(`[phavo] Ready`);
  })
  .catch((e: unknown) => {
    console.error('[phavo] Failed to initialise encryption secret:', e);
    process.exit(1);
  });

// Derive installMethod once on startup, after migrations have run.
dbReady
  .then(() => deriveInstallMethod())
  .catch((e: unknown) => {
    console.error('[phavo] Failed to derive install method:', e);
  });

dbReady
  .then(() => {
    if (shutdownRegistered) return;
    shutdownRegistered = true;
    process.on('SIGTERM', () => void shutdown('SIGTERM'));
    process.on('SIGINT', () => void shutdown('SIGINT'));
  })
  .catch((e: unknown) => {
    console.error('[phavo] Failed to register shutdown handlers:', e);
  });

dbReady
  .then(() => {
    setInterval(
      async () => {
        try {
          const now = Date.now();
          await db.delete(schema.sessions).where(lt(schema.sessions.expiresAt, now));
          console.log('[phavo] Pruned expired sessions');
        } catch (e) {
          console.error('[phavo] Session pruning failed:', e);
        }
      },
      60 * 60 * 1000,
    );
  })
  .catch((e: unknown) => {
    console.error('[phavo] Failed to start session pruning:', e);
  });

// Build a Content-Security-Policy header for a given request.
// The nonce is generated per-request by SvelteKit (csp.mode = 'nonce' in svelte.config.js)
// and set on event.locals.nonce after resolve() completes.
// Falls back to 'unsafe-inline' if nonce is absent (e.g. non-HTML responses).
function buildCsp(nonce: string | undefined): string {
  const scriptSrc = nonce ? `'self' 'nonce-${nonce}'` : "'self' 'unsafe-inline'";
  return [
    "default-src 'self'",
    `script-src ${scriptSrc}`,
    // 'unsafe-inline' required for Svelte's runtime
    // style injection. Nonce-based styles are not yet
    // supported by SvelteKit. Tracked for future removal.
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self'",
    "img-src 'self' data: https:",
    [
      "connect-src 'self'",
      'https://api.open-meteo.com',
      'https://geocoding-api.open-meteo.com',
      'https://api.github.com',
    ].join(' '),
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');
}

// Gate all requests behind dbReady so no handler runs against a missing schema.
export const handle: Handle = async ({ event, resolve }) => {
  await dbReady;
  const response = await resolve(event);

  // Apply CSP to HTML responses only — API routes return JSON and don't need it.
  // event.locals.nonce is set by SvelteKit (after resolve) when csp.mode = 'nonce'.
  if (!event.url.pathname.startsWith('/api/')) {
    response.headers.set('Content-Security-Policy', buildCsp(event.locals.nonce));
  }

  return response;
};
