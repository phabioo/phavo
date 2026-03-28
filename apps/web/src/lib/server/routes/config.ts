import { decrypt, encrypt, schema } from '@phavo/db';
import { err, ok } from '@phavo/types';
import { asc, eq } from 'drizzle-orm';
import type { Hono } from 'hono';
import { z } from 'zod';
import { parseConfigEntries } from '$lib/server/config-helpers.js';
import { db } from '$lib/server/db.js';
import type { AppVariables } from '$lib/server/middleware/auth.js';
import { requireSession } from '$lib/server/middleware/auth.js';
import { serverNotify } from '$lib/server/notifier.js';
import {
  credentialStorageKey,
  hasStoredWidgetCredentials,
  parseWidgetPublicConfig,
} from '$lib/server/widget-helpers.js';
import { registry } from '$lib/server/widget-registry.js';

// ─── Passphrase-based AES-GCM (for config export/import with credentials) ────

const _EXPORT_SALT_LEN = 16;
const _EXPORT_IV_LEN = 12;
const _EXPORT_PBKDF2_ITERS = 100_000;

async function exportEncrypt(plaintext: string, passphrase: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(_EXPORT_SALT_LEN));
  const iv = crypto.getRandomValues(new Uint8Array(_EXPORT_IV_LEN));
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  const key = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: _EXPORT_PBKDF2_ITERS, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt'],
  );
  const enc = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, tagLength: 128 },
    key,
    new TextEncoder().encode(plaintext),
  );
  const combined = new Uint8Array(salt.length + iv.length + enc.byteLength);
  combined.set(salt, 0);
  combined.set(iv, salt.length);
  combined.set(new Uint8Array(enc), salt.length + iv.length);
  return Buffer.from(combined).toString('base64');
}

async function exportDecrypt(ciphertext: string, passphrase: string): Promise<string> {
  const combined = Uint8Array.from(Buffer.from(ciphertext, 'base64'));
  const salt = combined.slice(0, _EXPORT_SALT_LEN);
  const iv = combined.slice(_EXPORT_SALT_LEN, _EXPORT_SALT_LEN + _EXPORT_IV_LEN);
  const data = combined.slice(_EXPORT_SALT_LEN + _EXPORT_IV_LEN);
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  const key = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: _EXPORT_PBKDF2_ITERS, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt'],
  );
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv, tagLength: 128 }, key, data);
  return new TextDecoder().decode(decrypted);
}

// Zod schema for the export envelope — validated on import before any DB write.
const ExportConfigSchema = z.object({
  dashboardName: z.string().optional(),
  sessionTimeout: z.enum(['1d', '7d', '30d', 'never']).optional(),
  location: z
    .object({ name: z.string(), latitude: z.number(), longitude: z.number() })
    .nullable()
    .optional(),
});

const ExportTabSchema = z.object({
  id: z.string(),
  label: z.string(),
  order: z.number().int(),
});

const ExportWidgetInstanceSchema = z.object({
  id: z.string(),
  widgetId: z.string(),
  tabId: z.string(),
  size: z.enum(['S', 'M', 'L', 'XL']),
  positionX: z.number().int(),
  positionY: z.number().int(),
  config: z.record(z.unknown()).nullable().optional(),
});

const ExportEnvelopeSchema = z.object({
  version: z.literal('1'),
  exportedAt: z.number(),
  config: ExportConfigSchema,
  tabs: z.array(ExportTabSchema),
  widgetInstances: z.array(ExportWidgetInstanceSchema),
  credentials: z.string().optional(),
});

const ConfigTabSchema = z.object({
  id: z.string().uuid(),
  label: z.string().max(100),
  order: z.number().int().min(0),
});

type ExportEnvelope = z.infer<typeof ExportEnvelopeSchema>;

async function buildExportPayload(): Promise<Omit<ExportEnvelope, 'credentials'>> {
  const configRows = await db.query.config.findMany();
  const parsed = parseConfigEntries(configRows);

  const tabRows = await db.select().from(schema.tabs).orderBy(asc(schema.tabs.order));

  const instanceRows = await db.select().from(schema.widgetInstances);
  const widgetInstances = await Promise.all(
    instanceRows.map(async (r) => ({
      id: r.id,
      widgetId: r.widgetId,
      tabId: r.tabId,
      size: r.size as 'S' | 'M' | 'L' | 'XL',
      positionX: r.positionX,
      positionY: r.positionY,
      config: (await parseWidgetPublicConfig(r.configEncrypted)) ?? null,
    })),
  );

  return {
    version: '1',
    exportedAt: Date.now(),
    config: {
      dashboardName: parsed.dashboardName,
      sessionTimeout: parsed.sessionTimeout,
      location: parsed.location,
    },
    tabs: tabRows.map((t) => ({ id: t.id, label: t.label, order: t.order })),
    widgetInstances,
  };
}

async function collectExportCredentials(): Promise<Record<string, Record<string, string>>> {
  const rows = await db.select().from(schema.credentials);
  const out: Record<string, Record<string, string>> = {};

  for (const row of rows) {
    if (!row.key.startsWith('widget:')) continue;
    const withoutPrefix = row.key.slice('widget:'.length);
    const colonIdx = withoutPrefix.indexOf(':');
    if (colonIdx < 0) continue;
    const instanceId = withoutPrefix.slice(0, colonIdx);
    const fieldPath = withoutPrefix.slice(colonIdx + 1);
    if (!instanceId || !fieldPath) continue;
    try {
      const value = await decrypt(row.valueEncrypted);
      // biome-ignore lint/suspicious/noAssignInExpressions: intentional initialisation
      (out[instanceId] ??= {})[fieldPath] = value;
    } catch {
      // Skip rows that can no longer be decrypted.
    }
  }

  return out;
}

export function registerConfigRoutes(app: Hono<{ Variables: AppVariables }>): void {
  // Config endpoints are accessible to any authenticated session.
  app.get('/config', requireSession(), async (c) => {
    try {
      const rows = await db.query.config.findMany();
      return c.json(ok(parseConfigEntries(rows)));
    } catch {
      return c.json(
        ok({
          setupComplete: false,
          dashboardName: 'My Dashboard',
          tabs: [],
          sessionTimeout: '7d',
        }),
      );
    }
  });

  app.post('/config', requireSession(), async (c) => {
    try {
      let rawBody: unknown;
      try {
        rawBody = await c.req.json();
      } catch {
        return c.json(err('Invalid request body'), 400);
      }

      const ConfigPostSchema = z.object({
        setupComplete: z.boolean().optional(),
        dashboardName: z.string().max(100).optional(),
        sessionTimeout: z.enum(['1d', '7d', '30d', 'never']).optional(),
        location: z
          .object({
            name: z.string().max(200),
            latitude: z.number().min(-90).max(90),
            longitude: z.number().min(-180).max(180),
          })
          .nullable()
          .optional(),
        tabs: z.array(ConfigTabSchema).max(50).optional(),
      });
      const parsed = ConfigPostSchema.safeParse(rawBody);
      if (!parsed.success) return c.json(err('Invalid config'), 400);
      const body = parsed.data;

      const upserts: Array<{ key: string; value: string }> = [];
      const deletes: string[] = [];
      if (body.setupComplete !== undefined)
        upserts.push({
          key: 'setup_complete',
          value: body.setupComplete ? 'true' : 'false',
        });
      if (body.dashboardName !== undefined)
        upserts.push({
          key: 'dashboard_name',
          value: body.dashboardName.trim() || 'My Dashboard',
        });
      if (body.sessionTimeout) upserts.push({ key: 'session_timeout', value: body.sessionTimeout });
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
      console.error('[phavo]', e);
      return c.json(err('Internal error'), 500);
    }
  });

  // ─── Config Export / Import ───────────────────────────────────────────────────

  // GET /config/export — no credentials. Client downloads via blob URL.
  app.get('/config/export', requireSession(), async (c) => {
    try {
      const payload = await buildExportPayload();
      const dateStr = new Date().toISOString().slice(0, 10);
      return new Response(JSON.stringify(payload, null, 2), {
        status: 200,
        headers: {
          'Content-Type': 'application/octet-stream',
          'Content-Disposition': `attachment; filename="phavo-config-${dateStr}.phavo"`,
        },
      });
    } catch (e) {
      console.error('[phavo]', e);
      return c.json(err('Internal error'), 500);
    }
  });

  // POST /config/export — with encrypted credentials (requires passphrase in body).
  app.post('/config/export', requireSession(), async (c) => {
    try {
      let rawBody: unknown;
      try {
        rawBody = await c.req.json();
      } catch {
        return c.json(err('Invalid request body'), 400);
      }

      const bodySchema = z.object({ passphrase: z.string().min(1) });
      const bodyParsed = bodySchema.safeParse(rawBody);
      if (!bodyParsed.success) {
        return c.json(err('passphrase is required when exporting credentials'), 400);
      }

      const payload = await buildExportPayload();
      const rawCredentials = await collectExportCredentials();
      const credentialBlob = await exportEncrypt(
        JSON.stringify(rawCredentials),
        bodyParsed.data.passphrase,
      );

      const dateStr = new Date().toISOString().slice(0, 10);
      return new Response(JSON.stringify({ ...payload, credentials: credentialBlob }, null, 2), {
        status: 200,
        headers: {
          'Content-Type': 'application/octet-stream',
          'Content-Disposition': `attachment; filename="phavo-config-${dateStr}.phavo"`,
        },
      });
    } catch (e) {
      console.error('[phavo]', e);
      return c.json(err('Internal error'), 500);
    }
  });

  // POST /config/import — applies an exported config JSON.
  app.post('/config/import', requireSession(), async (c) => {
    try {
      const session = c.get('session');
      if (!session) return c.json(err('Unauthorized'), 401);

      let rawBody: unknown;
      try {
        rawBody = await c.req.json();
      } catch {
        return c.json(err('Invalid request body'), 400);
      }

      const requestSchema = z.object({
        exportJson: z.string().min(1),
        passphrase: z.string().optional(),
      });
      const requestParsed = requestSchema.safeParse(rawBody);
      if (!requestParsed.success) {
        return c.json(err('exportJson is required'), 400);
      }

      // Parse and validate the export envelope before touching the DB.
      let parsedExport: unknown;
      try {
        parsedExport = JSON.parse(requestParsed.data.exportJson);
      } catch {
        return c.json(err('Export file is not valid JSON'), 400);
      }

      const exportResult = ExportEnvelopeSchema.safeParse(parsedExport);
      if (!exportResult.success) {
        const issue = exportResult.error.issues[0];
        return c.json(
          err(`Invalid export file: ${issue?.message ?? 'unknown validation error'}`),
          400,
        );
      }

      const exportData = exportResult.data;
      const warnings: string[] = [];

      // ── Resolve which tabs will actually be imported (free tier cap = 1) ──────
      let tabsToImport = exportData.tabs;
      if (session.tier === 'free' && tabsToImport.length > 1) {
        tabsToImport = tabsToImport.slice(0, 1);
        warnings.push(`Tab count reduced to 1 (Free tier limit)`);
      }
      const keptTabIds = new Set(tabsToImport.map((t) => t.id));

      // All DB mutations inside a single transaction — atomic rollback on failure.
      const tabIdMap = new Map<string, string>();
      const widgetIdMap = new Map<string, string>();

      await db.transaction(async (tx) => {
        // ── Apply config keys (skip setupComplete — preserve current value) ───────
        const cfgUpserts: Array<{ key: string; value: string }> = [];
        if (exportData.config.dashboardName !== undefined) {
          cfgUpserts.push({
            key: 'dashboard_name',
            value: exportData.config.dashboardName.trim() || 'My Dashboard',
          });
        }
        if (exportData.config.sessionTimeout !== undefined) {
          cfgUpserts.push({
            key: 'session_timeout',
            value: exportData.config.sessionTimeout,
          });
        }
        if (exportData.config.location != null) {
          cfgUpserts.push({
            key: 'location_name',
            value: exportData.config.location.name,
          });
          cfgUpserts.push({
            key: 'location_latitude',
            value: String(exportData.config.location.latitude),
          });
          cfgUpserts.push({
            key: 'location_longitude',
            value: String(exportData.config.location.longitude),
          });
        }
        for (const entry of cfgUpserts) {
          await tx
            .insert(schema.config)
            .values({ key: entry.key, value: entry.value })
            .onConflictDoUpdate({
              target: schema.config.key,
              set: { value: entry.value, updatedAt: new Date() },
            });
        }

        // ── Replace tabs ──────────────────────────────────────────────────────────
        await tx.delete(schema.widgetInstances);
        await tx.delete(schema.tabs);

        for (const tab of tabsToImport) {
          const newId = crypto.randomUUID();
          tabIdMap.set(tab.id, newId);
          await tx.insert(schema.tabs).values({ id: newId, label: tab.label, order: tab.order });
        }

        if (tabIdMap.size === 0) {
          const homeId = crypto.randomUUID();
          await tx.insert(schema.tabs).values({ id: homeId, label: 'Home', order: 0 });
          return;
        }

        const firstNewTabId = tabIdMap.values().next().value as string;

        // ── Import widget instances ───────────────────────────────────────────────
        for (const wi of exportData.widgetInstances) {
          const resolvedOldTabId = keptTabIds.has(wi.tabId) ? wi.tabId : tabsToImport[0]?.id;
          if (!resolvedOldTabId) continue;

          const newTabId = tabIdMap.get(resolvedOldTabId) ?? firstNewTabId;
          const newInstanceId = crypto.randomUUID();
          widgetIdMap.set(wi.id, newInstanceId);

          const configEncrypted =
            wi.config && Object.keys(wi.config).length > 0
              ? await encrypt(JSON.stringify(wi.config))
              : null;

          await tx.insert(schema.widgetInstances).values({
            id: newInstanceId,
            widgetId: wi.widgetId,
            tabId: newTabId,
            size: wi.size,
            positionX: wi.positionX,
            positionY: wi.positionY,
            configEncrypted,
          });
        }

        // ── Import credentials (if blob present and passphrase provided) ──────────
        if (exportData.credentials && requestParsed.data.passphrase) {
          let decryptedCredentials: Record<string, Record<string, string>>;
          try {
            const raw = await exportDecrypt(exportData.credentials, requestParsed.data.passphrase);
            const credentialSchema = z.record(z.record(z.string()));
            const parsed = credentialSchema.safeParse(JSON.parse(raw));
            if (!parsed.success) throw new Error('Invalid credential structure');
            decryptedCredentials = parsed.data;
          } catch {
            warnings.push('Could not decrypt credentials — wrong passphrase or corrupted file');
            decryptedCredentials = {};
          }

          for (const [oldInstanceId, fields] of Object.entries(decryptedCredentials)) {
            const newInstanceId = widgetIdMap.get(oldInstanceId);
            if (!newInstanceId) continue;
            for (const [fieldPath, value] of Object.entries(fields)) {
              const key = credentialStorageKey(newInstanceId, fieldPath);
              const valueEncrypted = await encrypt(value);
              await tx
                .insert(schema.credentials)
                .values({ key, valueEncrypted, updatedAt: Date.now() })
                .onConflictDoUpdate({
                  target: schema.credentials.key,
                  set: { valueEncrypted, updatedAt: Date.now() },
                });
            }
          }
        } else if (exportData.credentials && !requestParsed.data.passphrase) {
          warnings.push(
            'Export contains credentials but no passphrase was provided — credentials were not imported',
          );
        }
      });

      // Early return if no tabs were imported (tabIdMap was empty inside tx).
      if (tabIdMap.size === 0) {
        return c.json(ok({ warnings }));
      }

      // ── Queue reconfiguration notifications for widgets that lack credentials ─
      for (const wi of exportData.widgetInstances) {
        const newInstanceId = widgetIdMap.get(wi.id);
        if (!newInstanceId) continue;
        const def = registry.getById(wi.widgetId);
        if (!def?.configSchema) continue;
        const hasCredentials = await hasStoredWidgetCredentials(newInstanceId);
        if (!hasCredentials) {
          const hasCredentialField = JSON.stringify(def.configSchema._def).includes('"credential"');
          if (hasCredentialField) {
            serverNotify({
              type: 'widget-warning',
              title: `${def.name} needs reconfiguration`,
              body: `Widget "${def.name}" needs credentials configured after import`,
              widgetId: wi.widgetId,
              settingsTab: 'widgets',
            });
          }
        }
      }

      return c.json(ok({ warnings }));
    } catch (e) {
      console.error('[phavo]', e);
      return c.json(err('Internal error'), 500);
    }
  });
}
