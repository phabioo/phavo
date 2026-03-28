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
import { requireTier } from '$lib/server/middleware/auth.js';
import { serverNotify } from '$lib/server/notifier.js';
import { assertNotCloudMetadata } from '$lib/server/security.js';
import {
  credentialStorageKey,
  loadDecryptedCredential,
  loadInstanceCredentialMap,
  parseEncryptedWidgetConfig,
} from '$lib/server/widget-helpers.js';
import { LinksWidgetConfigSchema, RssWidgetConfigSchema } from '$lib/server/widget-registry.js';

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
  app.get('/pihole', requireTier('standard'), async (c) => {
    try {
      const credentials = await findConfiguredPiholeCredentials();

      if (!credentials) {
        if (!piholeMissingConfigNotified) {
          serverNotify({
            type: 'widget-error',
            title: 'Pi-hole not configured',
            body: 'Add your Pi-hole URL and token in Settings.',
            widgetId: 'pihole',
            settingsTab: 'widgets',
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
          body: 'Phavo could not reach your Pi-hole instance after 3 attempts.',
          widgetId: 'pihole',
          settingsTab: 'widgets',
        });
        piholeFailureCount = 0;
      }

      return c.json(ok(null));
    }
  });

  app.post('/pihole/test', requireTier('standard'), async (c) => {
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

  app.get('/rss', requireTier('standard'), async (c) => {
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

  app.get('/links', requireTier('standard'), async (c) => {
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
}
