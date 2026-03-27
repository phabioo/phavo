// apps/web/src/hooks.server.ts
// SvelteKit server hooks. Module-level code runs once on server startup.

import type { Handle } from '@sveltejs/kit';
import { dbReady } from '$lib/server/db';
import { deriveInstallMethod } from '$lib/server/install';

// Derive installMethod once on startup, after migrations have run.
dbReady
  .then(() => deriveInstallMethod())
  .catch((e: unknown) => {
    console.error('[phavo] Failed to derive install method:', e);
  });

const CSP =
  "default-src 'self'; " +
  "script-src 'self'; " +
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
  "font-src 'self' https://fonts.gstatic.com; " +
  "img-src 'self' data: https:; " +
  "connect-src 'self' https://api.open-meteo.com https://geocoding-api.open-meteo.com https://api.github.com https://phavo.net; " +
  "frame-ancestors 'none'; " +
  "base-uri 'self'; " +
  "form-action 'self';";

// Gate all requests behind dbReady so no handler runs against a missing schema.
export const handle: Handle = async ({ event, resolve }) => {
  await dbReady;
  const response = await resolve(event);

  // Apply CSP to HTML responses only — API routes return JSON and don't need it.
  if (!event.url.pathname.startsWith('/api/')) {
    response.headers.set('Content-Security-Policy', CSP);
  }

  return response;
};
