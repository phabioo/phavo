import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { getPihole, getRss, type RssFeedConfig } from '@phavo/agent';
import { schema } from '@phavo/db';
import { err, ok } from '@phavo/types';
import { desc, eq } from 'drizzle-orm';
import type { Hono } from 'hono';
import { z } from 'zod';
import { cached } from '$lib/server/agent.js';
import { db } from '$lib/server/db.js';
import type { AppVariables } from '$lib/server/middleware/auth.js';
import { requireSession } from '$lib/server/middleware/auth.js';
import { serverNotify } from '$lib/server/notifier.js';
import { assertNotCloudMetadata } from '$lib/server/security.js';
import {
  credentialStorageKey,
  loadDecryptedCredential,
  loadInstanceCredentialMap,
  parseEncryptedWidgetConfig,
} from '$lib/server/widget-helpers.js';
import {
  CalendarWidgetConfigSchema,
  DockerWidgetConfigSchema,
  LinksWidgetConfigSchema,
  RssWidgetConfigSchema,
  ServiceHealthWidgetConfigSchema,
} from '$lib/server/widget-registry.js';

// ── Docker helper ────────────────────────────────────────────────────────────

async function fetchDockerContainers(_socketPath: string): Promise<{
  containers: Array<{
    id: string;
    name: string;
    status: 'running' | 'stopped' | 'paused';
    cpuPercent: number;
    memoryUsed: number;
    memoryTotal: number;
  }>;
}> {
  // Try Docker CLI first (more portable)
  try {
    const output = await execFileAsync('docker', ['ps', '-a', '--format', '{{json .}}']);

    const containers = output
      .trim()
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        const c = JSON.parse(line) as {
          ID: string;
          Names: string;
          State: string;
        };
        return {
          id: c.ID,
          name: c.Names,
          status: mapDockerState(c.State),
          cpuPercent: 0,
          memoryUsed: 0,
          memoryTotal: 0,
        };
      });

    return { containers };
  } catch {
    // Docker CLI not available
    return { containers: [] };
  }
}

function mapDockerState(state: string): 'running' | 'stopped' | 'paused' {
  if (state === 'running') return 'running';
  if (state === 'paused') return 'paused';
  return 'stopped';
}

function execFileAsync(cmd: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { timeout: 10000 }, (error, stdout) => {
      if (error) return reject(error);
      resolve(stdout);
    });
  });
}

// ── Service Health helper ────────────────────────────────────────────────────

async function checkServiceHealth(svc: {
  name: string;
  url: string;
  method?: string | undefined;
}): Promise<{
  name: string;
  url: string;
  status: 'up' | 'down' | 'timeout';
  responseTimeMs: number;
  lastChecked: number;
}> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);
  const start = performance.now();

  try {
    const method = svc.method === 'HEAD' ? 'HEAD' : 'GET';
    const response = await fetch(svc.url, {
      method,
      signal: controller.signal,
      redirect: 'follow',
    });

    const responseTimeMs = Math.round(performance.now() - start);
    const status = response.ok ? 'up' : 'down';

    return {
      name: svc.name,
      url: svc.url,
      status,
      responseTimeMs,
      lastChecked: Date.now(),
    };
  } catch (e) {
    const responseTimeMs = Math.round(performance.now() - start);
    const isTimeout = e instanceof DOMException && e.name === 'AbortError';

    return {
      name: svc.name,
      url: svc.url,
      status: isTimeout ? 'timeout' : 'down',
      responseTimeMs,
      lastChecked: Date.now(),
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

// ── Speedtest helper ─────────────────────────────────────────────────────────

let speedtestInProgress = false;
let speedtestCooldownUntil: number | null = null;

interface SpeedtestCliResult {
  download: { bandwidth: number };
  upload: { bandwidth: number };
  ping: { latency: number };
  server: { name: string; location: string };
  timestamp: string;
}

async function runSpeedtest(): Promise<{
  downloadMbps: number;
  uploadMbps: number;
  latencyMs: number;
  timestamp: number;
}> {
  const output = await execFileAsync('speedtest', ['--format=json', '--accept-license']);
  const result = JSON.parse(output) as SpeedtestCliResult;

  return {
    downloadMbps: Math.round(((result.download.bandwidth * 8) / 1_000_000) * 100) / 100,
    uploadMbps: Math.round(((result.upload.bandwidth * 8) / 1_000_000) * 100) / 100,
    latencyMs: Math.round(result.ping.latency * 100) / 100,
    timestamp: Date.now(),
  };
}

// ── Calendar helper ──────────────────────────────────────────────────────────

async function fetchCalendarEvents(
  calDavUrl: string,
  username: string,
  password: string,
  calendarNameFilter?: string,
): Promise<
  Array<{
    title: string;
    startTime: string;
    endTime: string;
    calendarName: string;
  }>
> {
  const now = new Date();
  const future = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const timeMin = `${now.toISOString().replace(/[-:]/g, '').split('.')[0] ?? ''}Z`;
  const timeMax = `${future.toISOString().replace(/[-:]/g, '').split('.')[0] ?? ''}Z`;

  // CalDAV REPORT request for events in range
  const body = `<?xml version="1.0" encoding="utf-8" ?>
<C:calendar-query xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
  <D:prop>
    <D:getetag/>
    <C:calendar-data/>
  </D:prop>
  <C:filter>
    <C:comp-filter name="VCALENDAR">
      <C:comp-filter name="VEVENT">
        <C:time-range start="${timeMin}" end="${timeMax}"/>
      </C:comp-filter>
    </C:comp-filter>
  </C:filter>
</C:calendar-query>`;

  const response = await fetch(calDavUrl, {
    method: 'REPORT',
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      Depth: '1',
      Authorization: `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`,
    },
    body,
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) return [];

  const text = await response.text();
  const events = parseICalEvents(text, calendarNameFilter);

  return events
    .filter((e) => new Date(e.startTime).getTime() >= now.getTime())
    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
}

function parseICalEvents(
  xmlText: string,
  calendarNameFilter?: string,
): Array<{
  title: string;
  startTime: string;
  endTime: string;
  calendarName: string;
}> {
  const events: Array<{
    title: string;
    startTime: string;
    endTime: string;
    calendarName: string;
  }> = [];

  // Extract calendar-data from XML response
  const calDataRegex = /<(?:C:|cal:)?calendar-data[^>]*>([\s\S]*?)<\/(?:C:|cal:)?calendar-data>/gi;

  for (const match of xmlText.matchAll(calDataRegex)) {
    const ical = (match[1] ?? '')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"');

    // Parse individual VEVENTs
    const veventRegex = /BEGIN:VEVENT([\s\S]*?)END:VEVENT/g;

    for (const eventMatch of ical.matchAll(veventRegex)) {
      const block = eventMatch[1] ?? '';

      const summary = extractICalProp(block, 'SUMMARY') ?? 'Untitled';
      const dtstart = extractICalProp(block, 'DTSTART');
      const dtend = extractICalProp(block, 'DTEND');
      const calName = extractICalProp(ical, 'X-WR-CALNAME') ?? 'Calendar';

      if (calendarNameFilter && calName !== calendarNameFilter) continue;

      if (dtstart) {
        events.push({
          title: summary,
          startTime: parseICalDate(dtstart),
          endTime: dtend ? parseICalDate(dtend) : parseICalDate(dtstart),
          calendarName: calName,
        });
      }
    }
  }

  return events;
}

function extractICalProp(block: string, prop: string): string | null {
  // Handle properties with parameters like DTSTART;TZID=...
  const regex = new RegExp(`^${prop}[;:]([^\\r\\n]*)`, 'm');
  const match = regex.exec(block);
  if (!match) return null;

  // If there's a parameter (e.g., ;TZID=...:value), extract the value part
  const raw = match[1] ?? '';
  const colonIdx = raw.indexOf(':');
  if ((match[0] ?? '').charAt(prop.length) === ';' && colonIdx !== -1) {
    return raw.slice(colonIdx + 1).trim();
  }
  return raw.trim();
}

function parseICalDate(value: string): string {
  // Handle formats: 20240101T120000Z, 20240101T120000, 20240101
  const cleaned = value.replace(/[^\dTZ]/g, '');
  if (cleaned.length >= 15) {
    const y = cleaned.slice(0, 4);
    const m = cleaned.slice(4, 6);
    const d = cleaned.slice(6, 8);
    const h = cleaned.slice(9, 11);
    const mi = cleaned.slice(11, 13);
    const s = cleaned.slice(13, 15);
    const tz = cleaned.endsWith('Z') ? 'Z' : '';
    return `${y}-${m}-${d}T${h}:${mi}:${s}${tz}`;
  }
  if (cleaned.length >= 8) {
    return `${cleaned.slice(0, 4)}-${cleaned.slice(4, 6)}-${cleaned.slice(6, 8)}T00:00:00`;
  }
  return new Date().toISOString();
}

type PiholeCredentials = {
  url: string;
  token: string;
};

// Note: these flags reset on server restart.
// Acceptable for single-instance self-hosted deployment.
// Multi-instance deployments would need shared state (Redis etc.)
// Tracked as post-v1.0 architectural debt.
let piholeMissingConfigNotified = false;
let piholeFailureCount = 0;

type RssFeedSettings = z.infer<typeof RssWidgetConfigSchema>;
type LinksConfig = z.infer<typeof LinksWidgetConfigSchema>;

async function findConfiguredPiholeCredentials(): Promise<PiholeCredentials | null> {
  const instances = await db
    .select()
    .from(schema.widgetInstances)
    .where(eq(schema.widgetInstances.widgetId, 'pihole'))
    .orderBy(desc(schema.widgetInstances.updatedAt));

  for (const instance of instances) {
    const url = await loadDecryptedCredential(credentialStorageKey(instance.id, 'url'));
    const token = await loadDecryptedCredential(credentialStorageKey(instance.id, 'token'));

    if (url && token) {
      return { url, token };
    }
  }

  return null;
}

function buildRssFeedAuth(
  feed: RssFeedSettings['feeds'][number],
  credentials: Map<string, string>,
): RssFeedConfig['auth'] | null {
  const authType = feed.authType ?? 'none';

  if (authType === 'none') return undefined;

  if (authType === 'basic') {
    const username = credentials.get(`feeds.${feed.id}.username`);
    const password = credentials.get(`feeds.${feed.id}.password`);

    if (!username || !password) {
      return null;
    }

    return {
      type: 'basic',
      value: Buffer.from(`${username}:${password}`).toString('base64'),
    };
  }

  const token = credentials.get(`feeds.${feed.id}.token`);
  if (!token) {
    return null;
  }

  return {
    type: 'bearer',
    value: token,
  };
}

export function registerIntegrationRoutes(app: Hono<{ Variables: AppVariables }>): void {
  app.get('/pihole', requireSession(), async (c) => {
    try {
      const credentials = await findConfiguredPiholeCredentials();

      if (!credentials) {
        if (!piholeMissingConfigNotified) {
          serverNotify({
            type: 'widget-error',
            title: 'Pi-hole not configured',
            message: 'Add your Pi-hole URL and token in Settings.',
            widgetId: 'pihole',
            actionUrl: '/settings?tab=widgets#widgets/pihole',
          });
          piholeMissingConfigNotified = true;
        }

        return c.json(ok(null));
      }

      piholeMissingConfigNotified = false;

      const data = await getPihole(credentials.url, credentials.token);
      piholeFailureCount = 0;
      return c.json(ok(data));
    } catch {
      piholeFailureCount += 1;

      if (piholeFailureCount >= 3) {
        serverNotify({
          type: 'widget-error',
          title: 'Pi-hole unreachable',
          message: 'Phavo could not reach your Pi-hole instance after 3 attempts.',
          widgetId: 'pihole',
          actionUrl: '/settings?tab=widgets#widgets/pihole',
        });
        piholeFailureCount = 0;
      }

      return c.json(ok(null));
    }
  });

  app.post('/pihole/test', requireSession(), async (c) => {
    try {
      let rawBody: unknown;
      try {
        rawBody = await c.req.json();
      } catch {
        return c.json(err('Invalid request body'), 400);
      }

      const PiholeTestSchema = z.object({
        url: z.string().url().max(2048),
        token: z.string().min(1).max(512),
      });
      const parsed = PiholeTestSchema.safeParse(rawBody);
      if (!parsed.success) {
        return c.json(err('Valid URL and token required'), 400);
      }

      try {
        assertNotCloudMetadata(parsed.data.url);
      } catch {
        return c.json(err('URL not allowed'), 400);
      }

      const data = await getPihole(parsed.data.url, parsed.data.token);
      return c.json(ok(data));
    } catch {
      return c.json(err('Could not connect to Pi-hole'), 500);
    }
  });

  app.get('/rss', requireSession(), async (c) => {
    try {
      const instances = await db
        .select()
        .from(schema.widgetInstances)
        .where(eq(schema.widgetInstances.widgetId, 'rss'));

      const feeds: RssFeedConfig[] = [];
      const configErrors: Array<{ feedUrl: string; error: string }> = [];

      for (const instance of instances) {
        const config = await parseEncryptedWidgetConfig(
          instance.configEncrypted,
          RssWidgetConfigSchema,
        );
        if (!config) continue;

        const credentials = await loadInstanceCredentialMap(instance.id);

        for (const feed of config.feeds) {
          const normalizedFeed = { ...feed, authType: feed.authType ?? 'none' };
          try {
            assertNotCloudMetadata(normalizedFeed.url);
          } catch {
            configErrors.push({
              feedUrl: feed.url,
              error: 'Feed URL not allowed',
            });
            continue;
          }
          const auth = buildRssFeedAuth(normalizedFeed, credentials);
          const authType = normalizedFeed.authType;

          if (authType !== 'none' && auth === null) {
            configErrors.push({
              feedUrl: feed.url,
              error: 'Missing RSS credentials for this feed',
            });
            continue;
          }

          feeds.push(auth ? { url: feed.url, auth } : { url: feed.url });
        }
      }

      if (feeds.length === 0) {
        return c.json(ok({ items: [], errors: configErrors }));
      }

      const keySource = feeds
        .map((feed) => `${feed.url}:${feed.auth?.type ?? 'none'}`)
        .sort()
        .join('|');
      const cacheKey = `rss:${createHash('sha256').update(keySource).digest('hex').slice(0, 16)}`;
      const data = await cached(cacheKey, 60000, () => getRss(feeds));
      return c.json(ok({ items: data.items, errors: [...configErrors, ...data.errors] }));
    } catch {
      return c.json(ok({ items: [], errors: [{ feedUrl: 'rss', error: 'RSS data unavailable' }] }));
    }
  });

  app.get('/links', requireSession(), async (c) => {
    try {
      const instances = await db
        .select()
        .from(schema.widgetInstances)
        .where(eq(schema.widgetInstances.widgetId, 'links'));

      const groups: LinksConfig['groups'] = [];

      for (const instance of instances) {
        const config = await parseEncryptedWidgetConfig(
          instance.configEncrypted,
          LinksWidgetConfigSchema,
        );
        if (!config) continue;
        groups.push(...config.groups);
      }

      return c.json(ok({ groups }));
    } catch (e) {
      console.error('[phavo]', e);
      return c.json(err('Internal error'), 500);
    }
  });

  // ── Docker ───────────────────────────────────────────────────────────
  app.get('/docker', requireSession(), async (c) => {
    try {
      const instances = await db
        .select()
        .from(schema.widgetInstances)
        .where(eq(schema.widgetInstances.widgetId, 'docker'));

      if (instances.length === 0) {
        return c.json(ok({ containers: [] }));
      }

      let socketPath = '/var/run/docker.sock';
      for (const instance of instances) {
        const config = await parseEncryptedWidgetConfig(
          instance.configEncrypted,
          DockerWidgetConfigSchema,
        );
        if (config?.socketPath) {
          socketPath = config.socketPath;
          break;
        }
      }

      const data = await cached('docker', 10000, () => fetchDockerContainers(socketPath));
      return c.json(ok(data));
    } catch {
      return c.json(ok({ containers: [] }));
    }
  });

  // ── Service Health ───────────────────────────────────────────────────
  app.get('/service-health', requireSession(), async (c) => {
    try {
      const instances = await db
        .select()
        .from(schema.widgetInstances)
        .where(eq(schema.widgetInstances.widgetId, 'service-health'));

      const allServices: Array<{
        name: string;
        url: string;
        status: 'up' | 'down' | 'timeout';
        responseTimeMs: number;
        lastChecked: number;
      }> = [];

      for (const instance of instances) {
        const config = await parseEncryptedWidgetConfig(
          instance.configEncrypted,
          ServiceHealthWidgetConfigSchema,
        );
        if (!config) continue;

        for (const svc of config.services) {
          try {
            assertNotCloudMetadata(svc.url);
          } catch {
            allServices.push({
              name: svc.name,
              url: svc.url,
              status: 'down',
              responseTimeMs: 0,
              lastChecked: Date.now(),
            });
            continue;
          }

          const cacheKey = `svc-health:${svc.url}`;
          const result = await cached(cacheKey, 30000, () =>
            checkServiceHealth({ name: svc.name, url: svc.url, method: svc.method }),
          );
          allServices.push(result);
        }
      }

      return c.json(ok({ services: allServices }));
    } catch {
      return c.json(ok({ services: [] }));
    }
  });

  // ── Speedtest ────────────────────────────────────────────────────────
  app.get('/speedtest', requireSession(), async (c) => {
    try {
      const rows = await db
        .select()
        .from(schema.pluginData)
        .where(eq(schema.pluginData.widgetId, 'speedtest'))
        .orderBy(desc(schema.pluginData.updatedAt));

      const results = rows
        .map((row) => {
          try {
            return JSON.parse(row.value);
          } catch {
            return null;
          }
        })
        .filter(Boolean)
        .slice(0, 30);

      return c.json(
        ok({
          lastResult: results[0] ?? null,
          history: results,
          testInProgress: speedtestInProgress,
          cooldownUntil: speedtestCooldownUntil,
        }),
      );
    } catch {
      return c.json(
        ok({
          lastResult: null,
          history: [],
          testInProgress: false,
          cooldownUntil: null,
        }),
      );
    }
  });

  app.post('/speedtest', requireSession(), async (c) => {
    if (speedtestInProgress) {
      return c.json(err('A speed test is already in progress'), 429);
    }

    if (speedtestCooldownUntil && Date.now() < speedtestCooldownUntil) {
      const retryAfterSec = Math.ceil((speedtestCooldownUntil - Date.now()) / 1000);
      return c.json(err('Please wait before running another test'), 429, {
        'Retry-After': String(retryAfterSec),
      });
    }

    speedtestInProgress = true;
    speedtestCooldownUntil = Date.now() + 5 * 60 * 1000; // 5 min cooldown

    try {
      const result = await runSpeedtest();

      await db.insert(schema.pluginData).values({
        widgetId: 'speedtest',
        key: `result:${result.timestamp}`,
        value: JSON.stringify(result),
        updatedAt: Math.floor(Date.now() / 1000),
      });

      // Prune old results beyond 30
      const allRows = await db
        .select({ id: schema.pluginData.id })
        .from(schema.pluginData)
        .where(eq(schema.pluginData.widgetId, 'speedtest'))
        .orderBy(desc(schema.pluginData.updatedAt));

      if (allRows.length > 30) {
        for (const row of allRows.slice(30)) {
          await db.delete(schema.pluginData).where(eq(schema.pluginData.id, row.id));
        }
      }

      return c.json(ok(result));
    } catch {
      return c.json(err('Speed test failed — is speedtest CLI installed?'), 500);
    } finally {
      speedtestInProgress = false;
    }
  });

  // ── Calendar ─────────────────────────────────────────────────────────
  app.get('/calendar', requireSession(), async (c) => {
    try {
      const instances = await db
        .select()
        .from(schema.widgetInstances)
        .where(eq(schema.widgetInstances.widgetId, 'calendar'));

      const allEvents: Array<{
        title: string;
        startTime: string;
        endTime: string;
        calendarName: string;
      }> = [];

      for (const instance of instances) {
        const config = await parseEncryptedWidgetConfig(
          instance.configEncrypted,
          CalendarWidgetConfigSchema,
        );
        if (!config) continue;

        const username = await loadDecryptedCredential(
          credentialStorageKey(instance.id, 'username'),
        );
        const password = await loadDecryptedCredential(
          credentialStorageKey(instance.id, 'password'),
        );

        if (!username || !password) continue;

        try {
          assertNotCloudMetadata(config.url);
        } catch {
          continue;
        }

        const cacheKey = `calendar:${createHash('sha256').update(`${config.url}:${username}`).digest('hex').slice(0, 16)}`;
        const events = await cached(cacheKey, 300000, () =>
          fetchCalendarEvents(config.url, username, password, config.calendarName),
        );
        allEvents.push(...events);
      }

      allEvents.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

      return c.json(ok({ events: allEvents }));
    } catch {
      return c.json(ok({ events: [] }));
    }
  });
}
