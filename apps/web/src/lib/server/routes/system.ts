import { execFile } from 'node:child_process';
import { schema } from '@phavo/db';
import { err, ok } from '@phavo/types';
import { env } from '@phavo/types/env';
import { sql } from 'drizzle-orm';
import type { Hono } from 'hono';
import { db } from '$lib/server/db.js';
import type { AppVariables } from '$lib/server/middleware/auth.js';
import { requireSession } from '$lib/server/middleware/auth.js';
import { serverNotify } from '$lib/server/notifier.js';

type UpdateInfo = {
  currentVersion: string;
  latestVersion: string;
  updateAvailable: boolean;
  changelog: string;
  publishedAt: string;
  updateCommand: string;
};

let updateCache: { data: UpdateInfo; ts: number } | null = null;

async function fetchUpdateInfo(fallback: UpdateInfo): Promise<UpdateInfo> {
  const res = await fetch('https://api.github.com/repos/getphavo/phavo/releases/latest', {
    headers: { 'User-Agent': 'Phavo Dashboard' },
    signal: AbortSignal.timeout(8000),
  });

  if (!res.ok) {
    throw new Error(`GitHub release check failed with status ${res.status}`);
  }

  const release = (await res.json()) as {
    tag_name: string;
    body: string;
    published_at: string;
  };

  return {
    currentVersion: PHAVO_VERSION,
    latestVersion: release.tag_name,
    updateAvailable: release.tag_name !== `v${PHAVO_VERSION}`,
    changelog: release.body ?? '',
    publishedAt: release.published_at ?? '',
    updateCommand: fallback.updateCommand,
  };
}

function maskLicenseKey(licenseKey?: string | null): string | null {
  if (!licenseKey) return null;
  if (licenseKey.length <= 8) return licenseKey;
  return `${licenseKey.slice(0, 4)}••••${licenseKey.slice(-4)}`;
}

export function registerSystemRoutes(app: Hono<{ Variables: AppVariables }>): void {
  // Health check — always public, no auth. Polled by Tauri sidecar on startup.
  app.get('/health', async (c) => {
    try {
      await db.run(sql`SELECT 1`);
    } catch {
      return c.json(err('Database unreachable'), 503);
    }
    return c.json(ok({ version: PHAVO_VERSION, platform: process.env.PHAVO_ENV ?? 'docker' }));
  });

  app.get('/about', requireSession(), async (c) => {
    try {
      const session = c.get('session');
      if (!session) return c.json(err('Unauthorized'), 401);
      const licenseRows = await db.select().from(schema.licenseActivation);
      const latestLicense = licenseRows[licenseRows.length - 1];
      return c.json(
        ok({
          version: PHAVO_VERSION,
          tier: session.tier,
          licenseKeyMasked: maskLicenseKey(latestLicense?.licenseKey ?? null),
        }),
      );
    } catch {
      return c.json(ok({ version: PHAVO_VERSION, tier: 'free', licenseKeyMasked: null }));
    }
  });

  // Track which version we've already queued a notification for so we don't spam.
  let _notifiedUpdateVersion = '';

  app.get('/update/check', requireSession(), async (c) => {
    // In development, return a mock result to avoid GitHub API 404s in dev logs.
    if (env.nodeEnv === 'development') {
      return c.json(
        ok({
          currentVersion: PHAVO_VERSION,
          latestVersion: PHAVO_VERSION,
          updateAvailable: false,
          changelog: '',
          publishedAt: '',
          updateCommand: 'docker compose pull && docker compose up -d',
        }),
      );
    }

    const UPDATE_COMMAND = 'docker compose pull && docker compose up -d';
    const fallback: UpdateInfo = {
      currentVersion: PHAVO_VERSION,
      latestVersion: PHAVO_VERSION,
      updateAvailable: false,
      changelog: '',
      publishedAt: '',
      updateCommand: UPDATE_COMMAND,
    };

    if (updateCache && Date.now() - updateCache.ts < 3600000) {
      return c.json(ok(updateCache.data));
    }

    try {
      const data = await fetchUpdateInfo(fallback);
      updateCache = { data, ts: Date.now() };

      if (data.updateAvailable && data.latestVersion !== _notifiedUpdateVersion) {
        _notifiedUpdateVersion = data.latestVersion;
        serverNotify({
          type: 'update',
          title: `Phavo ${data.latestVersion} available`,
          body: 'Click to see changelog',
          settingsTab: 'about',
        });
      }

      return c.json(ok(data));
    } catch (e) {
      console.error('[phavo]', e);
      return c.json(ok(fallback));
    }
  });

  app.post('/update/apply', requireSession(), async (c) => {
    try {
      const { access } = await import('node:fs/promises');
      await access('/var/run/docker.sock');
      // Fire-and-forget: the container may stop mid-request once the update starts.
      execFile('docker', ['compose', 'pull'], (pullErr) => {
        if (pullErr) {
          console.error('[phavo] docker compose pull failed:', pullErr.message);
          return;
        }

        execFile('docker', ['compose', 'up', '-d'], (upErr) => {
          if (upErr) {
            console.error('[phavo] docker compose up failed:', upErr.message);
          }
        });
      });
      return c.json(ok({ started: true }));
    } catch {
      return c.json(ok({ started: false, reason: 'Docker socket not available' }));
    }
  });
}
