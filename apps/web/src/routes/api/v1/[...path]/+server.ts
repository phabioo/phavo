import {
  getCpu,
  getDisk,
  getMemory,
  getNetwork,
  getPihole,
  getRss,
  getTemperature,
  getUptime,
  getWeather,
} from '@phavo/agent';
import { err, ok } from '@phavo/types';
import type { WidgetSize } from '@phavo/types';
import { schema } from '@phavo/db';
import type { RequestEvent } from '@sveltejs/kit';
import { Hono } from 'hono';
import { eq, asc } from 'drizzle-orm';
import { cached } from '$lib/server/agent';
import { db, dbReady } from '$lib/server/db';
import { DEV_MOCK_AUTH } from '$lib/server/mock-auth';
import { drainQueue, serverNotify } from '$lib/server/notifier';
import { registry } from '$lib/server/widget-registry';

const app = new Hono().basePath('/api/v1');
const PHAVO_VERSION = process.env.PHAVO_VERSION ?? '0.0.1';

function parseConfigEntries(rows: Array<{ key: string; value: string }>) {
  const entries: Record<string, string> = {};
  for (const row of rows) entries[row.key] = row.value;
  return {
    setupComplete: entries['setup_complete'] === 'true',
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
}

function getCookieValue(request: Request, name: string): string | undefined {
  const cookie = request.headers.get('cookie');
  if (!cookie) return undefined;
  const match = cookie
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : undefined;
}

async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hash))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function maskLicenseKey(licenseKey?: string | null): string | null {
  if (!licenseKey) return null;
  if (licenseKey.length <= 8) return licenseKey;
  return `${licenseKey.slice(0, 4)}••••${licenseKey.slice(-4)}`;
}

async function resolveSessionContext(request: Request) {
  if (DEV_MOCK_AUTH) {
    return {
      ...{
        userId: 'dev',
        tier: 'standard' as const,
        authMode: 'local' as const,
        validatedAt: Date.now(),
      },
      email: null as string | null,
      sessionId: 'dev',
    };
  }

  const sessionId = getCookieValue(request, 'phavo_session');
  if (!sessionId) return null;

  const sessionRows = await db.select().from(schema.sessions).where(eq(schema.sessions.id, sessionId));
  if (sessionRows[0]) {
    const userRows = await db.select().from(schema.users).where(eq(schema.users.id, sessionRows[0].userId));
    return {
      userId: sessionRows[0].userId,
      tier: sessionRows[0].tier,
      authMode: sessionRows[0].authMode,
      validatedAt: sessionRows[0].validatedAt,
      graceUntil: sessionRows[0].graceUntil ?? undefined,
      email: userRows[0]?.email ?? null,
      sessionId,
    };
  }

  const userRows = await db.select().from(schema.users).where(eq(schema.users.id, sessionId));
  if (userRows[0]) {
    return {
      userId: userRows[0].id,
      tier: 'free' as const,
      authMode: userRows[0].authMode,
      validatedAt: Date.now(),
      email: userRows[0].email ?? null,
      sessionId,
    };
  }

  return null;
}

// Widget manifest
app.get('/widgets', (c) => c.json(ok(registry.getManifest())));

// Config
app.get('/config', async (c) => {
  try {
    const rows = await db.query.config.findMany();
    return c.json(ok(parseConfigEntries(rows)));
  } catch {
    return c.json(
      ok({
        setupComplete: false,
        dashboardName: 'My Dashboard',
        tier: 'free',
        tabs: [],
        sessionTimeout: '7d',
      }),
    );
  }
});

app.post('/config', async (c) => {
  try {
    await dbReady;
    const body = (await c.req.json()) as {
      setupComplete?: boolean;
      dashboardName?: string;
      tier?: string;
      sessionTimeout?: '1d' | '7d' | '30d' | 'never';
      location?: { name: string; latitude: number; longitude: number } | null;
    };

    const upserts: Array<{ key: string; value: string }> = [];
    const deletes: string[] = [];
    if (body.setupComplete !== undefined)
      upserts.push({ key: 'setup_complete', value: body.setupComplete ? 'true' : 'false' });
    if (body.dashboardName !== undefined)
      upserts.push({ key: 'dashboard_name', value: body.dashboardName.trim() || 'My Dashboard' });
    if (body.tier)
      upserts.push({ key: 'tier', value: body.tier });
    if (body.sessionTimeout)
      upserts.push({ key: 'session_timeout', value: body.sessionTimeout });
    if (body.location === null) {
      deletes.push('location_name', 'location_latitude', 'location_longitude');
    } else if (body.location) {
      upserts.push({ key: 'location_name', value: body.location.name });
      upserts.push({ key: 'location_latitude', value: String(body.location.latitude) });
      upserts.push({ key: 'location_longitude', value: String(body.location.longitude) });
    }

    for (const key of deletes) {
      await db.delete(schema.config).where(eq(schema.config.key, key));
    }

    for (const entry of upserts) {
      await db
        .insert(schema.config)
        .values({ key: entry.key, value: entry.value })
        .onConflictDoUpdate({
          target: schema.config.key,
          set: { value: entry.value, updatedAt: new Date() },
        });
    }

    // Auto-create a "Home" tab when setup completes for the first time
    if (body.setupComplete) {
      const existingTabs = await db.select().from(schema.tabs);
      if (existingTabs.length === 0) {
        await db.insert(schema.tabs).values({
          id: crypto.randomUUID(),
          label: 'Home',
          order: 0,
        });
      }
    }

    const rows = await db.query.config.findMany();
    return c.json(ok(parseConfigEntries(rows)));
  } catch (e) {
    console.error('[phavo] POST /config error:', e);
    return c.json(err(e instanceof Error ? e.message : 'Failed to save config'), 500);
  }
});

// Auth
app.post('/auth/login', async (c) => {
  try {
    // In dev mode, always succeed so the setup wizard can advance without real credentials
    if (DEV_MOCK_AUTH) {
      return c.json(ok({ userId: 'dev', tier: 'standard', devMode: true }));
    }
    const body = (await c.req.json()) as { email?: string; password?: string };
    if (!body.email || !body.password) {
      return c.json(err('Email and password required'), 400);
    }
    // TODO: implement real auth with Better Auth
    return c.json(ok({ userId: crypto.randomUUID(), tier: 'free' }));
  } catch {
    return c.json(err('Login failed'), 500);
  }
});

app.post('/auth/logout', (c) => {
  // TODO: invalidate session
  return c.json(ok(null));
});

app.get('/auth/session', async (c) => {
  try {
    await dbReady;
    const session = await resolveSessionContext(c.req.raw);
    return c.json(ok(session));
  } catch {
    return c.json(ok(null));
  }
});

app.patch('/auth/password', async (c) => {
  try {
    await dbReady;
    const session = await resolveSessionContext(c.req.raw);
    if (!session) return c.json(err('Not signed in'), 401);
    if (session.authMode !== 'local' && session.tier !== 'local') {
      return c.json(err('Password changes are only available for local accounts'), 403);
    }

    const body = (await c.req.json()) as { newPassword?: string };
    if (!body.newPassword || body.newPassword.length < 8) {
      return c.json(err('Password must be at least 8 characters'), 400);
    }

    const passwordHash = await sha256(body.newPassword);
    const existingUsers = await db.select().from(schema.users).where(eq(schema.users.id, session.userId));
    if (existingUsers[0]) {
      await db
        .update(schema.users)
        .set({ passwordHash })
        .where(eq(schema.users.id, session.userId));
    } else {
      await db.insert(schema.users).values({
        id: session.userId,
        email: session.email,
        passwordHash,
        authMode: 'local',
      });
    }

    return c.json(ok(null));
  } catch (e) {
    return c.json(err(e instanceof Error ? e.message : 'Failed to update password'), 500);
  }
});

app.post('/auth/logout-all', async (c) => {
  try {
    await dbReady;
    const session = await resolveSessionContext(c.req.raw);
    if (session && !DEV_MOCK_AUTH) {
      await db.delete(schema.sessions).where(eq(schema.sessions.userId, session.userId));
    }
    c.header('Set-Cookie', 'phavo_session=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax');
    return c.json(ok(null));
  } catch (e) {
    return c.json(err(e instanceof Error ? e.message : 'Failed to sign out all sessions'), 500);
  }
});

// System metrics
app.get('/cpu', async (c) => {
  try {
    const data = await cached('cpu', 5000, getCpu);
    return c.json(ok(data));
  } catch {
    return c.json(ok({ usage: 0, cores: [], loadAvg: [0, 0, 0], speed: 0, model: 'Unknown' }));
  }
});

app.get('/memory', async (c) => {
  try {
    const data = await cached('memory', 5000, getMemory);
    return c.json(ok(data));
  } catch {
    return c.json(ok({ used: 0, total: 0, free: 0, swap: { used: 0, total: 0 } }));
  }
});

app.get('/disk', async (c) => {
  try {
    const data = await cached('disk', 5000, getDisk);
    return c.json(ok(data));
  } catch {
    return c.json(ok([]));
  }
});

app.get('/network', async (c) => {
  try {
    const data = await cached('network', 5000, getNetwork);
    return c.json(ok(data));
  } catch {
    return c.json(ok({ uploadSpeed: 0, downloadSpeed: 0, totalSent: 0, totalReceived: 0 }));
  }
});

app.get('/temperature', async (c) => {
  try {
    const data = await cached('temperature', 10000, getTemperature);
    return c.json(ok(data));
  } catch {
    return c.json(ok({ cpuTemp: null, unit: '°C' }));
  }
});

app.get('/uptime', async (c) => {
  try {
    const data = await cached('uptime', 30000, getUptime);
    return c.json(ok(data));
  } catch {
    return c.json(ok({ seconds: 0, formatted: 'Unknown' }));
  }
});

// Integration widgets
app.get('/weather', async (c) => {
  try {
    const rows = await db.query.config.findMany();
    const config = parseConfigEntries(rows);
    const latitude = config.location?.latitude ?? 52.52;
    const longitude = config.location?.longitude ?? 13.405;
    const cacheKey = `weather:${latitude}:${longitude}`;
    const data = await cached(cacheKey, 300000, () => getWeather(latitude, longitude));
    return c.json(ok(data));
  } catch {
    return c.json(err('Weather data unavailable'), 500);
  }
});

app.get('/pihole', async (c) => {
  try {
    // TODO: read credentials from db (decrypted)
    return c.json(
      ok({
        totalQueries: 0,
        blockedQueries: 0,
        percentBlocked: 0,
        domainsOnBlocklist: 0,
        status: 'disabled',
      }),
    );
  } catch {
    return c.json(err('Pi-hole data unavailable'), 500);
  }
});

app.post('/pihole/test', async (c) => {
  try {
    const body = (await c.req.json()) as { url?: string; token?: string };
    if (!body.url || !body.token) {
      return c.json(err('URL and token required'), 400);
    }
    const data = await getPihole(body.url, body.token);
    return c.json(ok(data));
  } catch {
    return c.json(err('Could not connect to Pi-hole'), 500);
  }
});

app.get('/rss', async (c) => {
  try {
    // TODO: read feed configs from db
    const data = await cached('rss', 60000, () => getRss([]));
    return c.json(ok(data));
  } catch {
    return c.json(err('RSS data unavailable'), 500);
  }
});

app.get('/links', (c) => {
  // TODO: read links from db
  return c.json(ok([]));
});

// Update check
// Track which version we've already queued a notification for so we don't spam.
let _notifiedUpdateVersion = '';

app.get('/about', async (c) => {
  try {
    await dbReady;
    const configRows = await db.query.config.findMany();
    const config = parseConfigEntries(configRows);
    const licenseRows = await db.select().from(schema.licenseActivation);
    const latestLicense = licenseRows[licenseRows.length - 1];
    return c.json(
      ok({
        version: PHAVO_VERSION,
        tier: config.tier,
        licenseKeyMasked: maskLicenseKey(latestLicense?.licenseKey ?? null),
      }),
    );
  } catch {
    return c.json(ok({ version: PHAVO_VERSION, tier: 'free', licenseKeyMasked: null }));
  }
});

app.get('/update/check', async (c) => {
  const UPDATE_COMMAND = 'docker compose pull && docker compose up -d';
  const fallback = {
    currentVersion: PHAVO_VERSION,
    latestVersion: PHAVO_VERSION,
    updateAvailable: false,
    changelog: '',
    publishedAt: '',
    updateCommand: UPDATE_COMMAND,
  };
  try {
    const data = await cached('update-check', 3600000, async () => {
      const res = await fetch('https://api.github.com/repos/phabioo/phavo/releases/latest', {
        headers: { 'User-Agent': 'Phavo Dashboard' },
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) return fallback;
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
        updateCommand: UPDATE_COMMAND,
      };
    }) as {
      currentVersion: string;
      latestVersion: string;
      updateAvailable: boolean;
      changelog: string;
      publishedAt: string;
      updateCommand: string;
    };

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
  } catch {
    return c.json(ok(fallback));
  }
});

app.post('/update/apply', async (c) => {
  const session = await resolveSessionContext(c.req.raw);
  if (!session) return c.json(err('Unauthorized'), 401);

  try {
    const { access } = await import('node:fs/promises');
    await access('/var/run/docker.sock');
    const { exec } = await import('node:child_process');
    // Fire-and-forget: the container will stop mid-request
    exec('docker compose pull && docker compose up -d');
    return c.json(ok({ started: true }));
  } catch {
    return c.json(ok({ started: false, reason: 'Docker socket not available' }));
  }
});

// Notifications
app.get('/notifications', (c) => {
  return c.json(ok(drainQueue()));
});

app.post('/notifications/read', (c) => {
  // Client manages read state; server queue already drained on GET.
  return c.json(ok(null));
});

// ─── Tabs ──────────────────────────────────────────────────────────────
app.get('/tabs', async (c) => {
  try {
    await dbReady;
    const rows = await db.select().from(schema.tabs).orderBy(asc(schema.tabs.order));
    return c.json(ok(rows.map((r) => ({ id: r.id, label: r.label, order: r.order }))));
  } catch (e) {
    return c.json(err(e instanceof Error ? e.message : 'Failed to list tabs'), 500);
  }
});

app.post('/tabs', async (c) => {
  try {
    await dbReady;
    const body = (await c.req.json()) as { label?: string };
    if (!body.label || typeof body.label !== 'string' || !body.label.trim()) {
      return c.json(err('Label is required'), 400);
    }

    // Enforce free-tier tab limit
    const configRows = await db.query.config.findMany();
    const tierRow = configRows.find((r) => r.key === 'tier');
    const tier = tierRow?.value ?? 'free';

    if (tier === 'free' && !DEV_MOCK_AUTH) {
      const existing = await db.select().from(schema.tabs);
      if (existing.length >= 1) {
        return c.json(err('Free tier is limited to 1 tab. Upgrade to Standard for unlimited tabs.'), 403);
      }
    }

    const allTabs = await db.select().from(schema.tabs);
    const nextOrder = allTabs.length > 0 ? Math.max(...allTabs.map((t) => t.order)) + 1 : 0;

    const id = crypto.randomUUID();
    await db.insert(schema.tabs).values({
      id,
      label: body.label.trim(),
      order: nextOrder,
    });

    return c.json(ok({ id, label: body.label.trim(), order: nextOrder }), 201);
  } catch (e) {
    return c.json(err(e instanceof Error ? e.message : 'Failed to create tab'), 500);
  }
});

app.patch('/tabs/:id', async (c) => {
  try {
    await dbReady;
    const tabId = c.req.param('id');
    const body = (await c.req.json()) as { label?: string; order?: number };

    const existing = await db.select().from(schema.tabs).where(eq(schema.tabs.id, tabId));
    if (existing.length === 0) return c.json(err('Tab not found'), 404);

    const updates: Record<string, unknown> = {};
    if (body.label !== undefined) updates.label = body.label.trim();
    if (body.order !== undefined) updates.order = body.order;

    if (Object.keys(updates).length > 0) {
      await db.update(schema.tabs).set(updates).where(eq(schema.tabs.id, tabId));
    }

    const updated = await db.select().from(schema.tabs).where(eq(schema.tabs.id, tabId));
    const tab = updated[0];
    return c.json(ok({ id: tab.id, label: tab.label, order: tab.order }));
  } catch (e) {
    return c.json(err(e instanceof Error ? e.message : 'Failed to update tab'), 500);
  }
});

app.delete('/tabs/:id', async (c) => {
  try {
    await dbReady;
    const tabId = c.req.param('id');
    const allTabs = await db.select().from(schema.tabs).orderBy(asc(schema.tabs.order));

    if (allTabs.length <= 1) {
      return c.json(err('Cannot delete the last tab'), 400);
    }

    const firstOther = allTabs.find((t) => t.id !== tabId);
    if (!firstOther) return c.json(err('No remaining tab to reassign widgets'), 400);

    // Reassign widgets from the deleted tab to the first remaining tab
    await db
      .update(schema.widgetInstances)
      .set({ tabId: firstOther.id })
      .where(eq(schema.widgetInstances.tabId, tabId));

    await db.delete(schema.tabs).where(eq(schema.tabs.id, tabId));

    return c.json(ok(null));
  } catch (e) {
    return c.json(err(e instanceof Error ? e.message : 'Failed to delete tab'), 500);
  }
});

app.get('/tabs/:id/widgets', async (c) => {
  try {
    await dbReady;
    const tabId = c.req.param('id');
    const rows = await db
      .select()
      .from(schema.widgetInstances)
      .where(eq(schema.widgetInstances.tabId, tabId));

    const instances = rows.map((r) => ({
      id: r.id,
      widgetId: r.widgetId,
      tabId: r.tabId,
      size: r.size as WidgetSize,
      position: { x: r.positionX, y: r.positionY },
    }));

    return c.json(ok(instances));
  } catch (e) {
    return c.json(err(e instanceof Error ? e.message : 'Failed to list widgets'), 500);
  }
});

// ─── Widget Instances ──────────────────────────────────────────────────
app.post('/widget-instances', async (c) => {
  try {
    await dbReady;
    const body = (await c.req.json()) as { widgetId?: string; tabId?: string; size?: WidgetSize };
    if (!body.widgetId || !body.tabId) {
      return c.json(err('widgetId and tabId are required'), 400);
    }

    const def = registry.getById(body.widgetId);
    if (!def) return c.json(err('Unknown widget'), 400);

    const size = body.size && def.sizes.includes(body.size) ? body.size : def.sizes[0];

    // Calculate next position: place after last widget on this tab
    const existing = await db
      .select()
      .from(schema.widgetInstances)
      .where(eq(schema.widgetInstances.tabId, body.tabId));
    const posY = existing.length;

    const id = crypto.randomUUID();
    await db.insert(schema.widgetInstances).values({
      id,
      widgetId: body.widgetId,
      tabId: body.tabId,
      size,
      positionX: 0,
      positionY: posY,
    });

    return c.json(
      ok({ id, widgetId: body.widgetId, tabId: body.tabId, size, position: { x: 0, y: posY } }),
      201,
    );
  } catch (e) {
    return c.json(err(e instanceof Error ? e.message : 'Failed to add widget'), 500);
  }
});

app.patch('/widget-instances/:id', async (c) => {
  try {
    await dbReady;
    const instanceId = c.req.param('id');
    const body = (await c.req.json()) as { size?: WidgetSize; positionX?: number; positionY?: number };

    const existing = await db
      .select()
      .from(schema.widgetInstances)
      .where(eq(schema.widgetInstances.id, instanceId));
    if (existing.length === 0) return c.json(err('Widget instance not found'), 404);

    const updates: Record<string, unknown> = {};
    if (body.size !== undefined) updates.size = body.size;
    if (body.positionX !== undefined) updates.positionX = body.positionX;
    if (body.positionY !== undefined) updates.positionY = body.positionY;
    updates.updatedAt = new Date();

    if (Object.keys(updates).length > 1) {
      await db
        .update(schema.widgetInstances)
        .set(updates)
        .where(eq(schema.widgetInstances.id, instanceId));
    }

    const updated = await db
      .select()
      .from(schema.widgetInstances)
      .where(eq(schema.widgetInstances.id, instanceId));
    const inst = updated[0];
    return c.json(
      ok({
        id: inst.id,
        widgetId: inst.widgetId,
        tabId: inst.tabId,
        size: inst.size as WidgetSize,
        position: { x: inst.positionX, y: inst.positionY },
      }),
    );
  } catch (e) {
    return c.json(err(e instanceof Error ? e.message : 'Failed to update widget instance'), 500);
  }
});

app.delete('/widget-instances/:id', async (c) => {
  try {
    await dbReady;
    const instanceId = c.req.param('id');
    await db.delete(schema.widgetInstances).where(eq(schema.widgetInstances.id, instanceId));
    return c.json(ok(null));
  } catch (e) {
    return c.json(err(e instanceof Error ? e.message : 'Failed to remove widget'), 500);
  }
});

function honoHandler(event: RequestEvent): Response | Promise<Response> {
  return app.fetch(event.request);
}

export const GET = (event: RequestEvent) => honoHandler(event);
export const POST = (event: RequestEvent) => honoHandler(event);
export const PUT = (event: RequestEvent) => honoHandler(event);
export const PATCH = (event: RequestEvent) => honoHandler(event);
export const DELETE = (event: RequestEvent) => honoHandler(event);
