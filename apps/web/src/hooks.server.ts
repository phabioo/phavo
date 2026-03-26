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

// Gate all requests behind dbReady so no handler runs against a missing schema.
export const handle: Handle = async ({ event, resolve }) => {
  await dbReady;
  return resolve(event);
};
