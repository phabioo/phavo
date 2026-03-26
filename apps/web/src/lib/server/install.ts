// apps/web/src/lib/server/install.ts
// Derives the installMethod once on first start and persists it to the config
// table. Subsequent starts read from DB — never re-derived at runtime.

import { existsSync, readFileSync } from 'node:fs';
import { schema } from '@phavo/db';
import { env, type InstallMethod } from '@phavo/types/env';
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';

/**
 * Checks whether the server is running inside Docker Compose by testing for /
 * .dockerenv (indicates Docker) and 'compose' in the cgroup path (indicates
 * Docker Compose specifically). Falls back to 'docker-run' if neither matches.
 */
function isDockerCompose(): boolean {
  if (!existsSync('/.dockerenv')) return false;
  try {
    const cgroup = readFileSync('/proc/1/cgroup', 'utf-8');
    return cgroup.includes('docker-compose') || cgroup.includes('/compose/');
  } catch {
    return false;
  }
}

/**
 * Derives and persists the installMethod to the config table.
 * Returns the cached value on subsequent calls (reads from DB).
 * Must be called after dbReady resolves.
 */
export async function deriveInstallMethod(): Promise<InstallMethod> {
  // Read existing value first — never re-derive after first start.
  const rows = await db.select().from(schema.config).where(eq(schema.config.key, 'installMethod'));
  const existing = rows[0];
  if (existing) return existing.value as InstallMethod;

  const method: InstallMethod =
    env.platform === 'tauri'
      ? 'tauri'
      : env.platform === 'bun'
        ? 'bun-direct'
        : isDockerCompose()
          ? 'docker-compose'
          : 'docker-run';

  await db
    .insert(schema.config)
    .values({ key: 'installMethod', value: method })
    .onConflictDoUpdate({
      target: schema.config.key,
      set: { value: method, updatedAt: new Date() },
    });

  return method;
}
