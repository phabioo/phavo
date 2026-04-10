import { encrypt, schema } from '@phavo/db';
import { err, ok, type WidgetSize } from '@phavo/types';
import { eq } from 'drizzle-orm';
import type { Hono } from 'hono';
import { z } from 'zod';
import { db } from '$lib/server/db.js';
import type { AppVariables } from '$lib/server/middleware/auth.js';
import { requireSession } from '$lib/server/middleware/auth.js';
import {
  hasPersistedConfigValue,
  splitWidgetConfig,
  syncInstanceCredentials,
} from '$lib/server/widget-helpers.js';
import { registry } from '$lib/server/widget-registry.js';

export function registerWidgetRoutes(app: Hono<{ Variables: AppVariables }>): void {
  // ─── Widget manifest ──────────────────────────────────────────────────────────
  app.get('/widgets', requireSession(), (c) => {
    const session = c.get('session');
    if (!session) return c.json(err('Unauthorized'), 401);
    return c.json(ok(registry.getManifest(session.tier)));
  });

  // ─── Widget Instances ──────────────────────────────────────────────────
  app.post('/widget-instances', requireSession(), async (c) => {
    try {
      const body = (await c.req.json()) as {
        widgetId?: string;
        tabId?: string;
        size?: WidgetSize;
      };
      if (!body.widgetId || !body.tabId) {
        return c.json(err('widgetId and tabId are required'), 400);
      }

      const def = registry.getById(body.widgetId);
      if (!def) return c.json(err('Unknown widget'), 400);

      const size =
        (body.size && def.sizes.includes(body.size)
          ? body.size
          : def.sizes.includes('M')
            ? 'M'
            : def.sizes[0]) ?? 'M';

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
        ok({
          id,
          widgetId: body.widgetId,
          tabId: body.tabId,
          size,
          position: { x: 0, y: posY },
        }),
        201,
      );
    } catch (e) {
      console.error('[phavo]', e);
      return c.json(err('Internal error'), 500);
    }
  });

  app.patch('/widget-instances/:id', requireSession(), async (c) => {
    try {
      const instanceId = c.req.param('id');
      let rawBody: unknown;
      try {
        rawBody = await c.req.json();
      } catch {
        return c.json(err('Invalid request body'), 400);
      }

      const patchSchema = z
        .object({
          size: z.enum(['S', 'M', 'L', 'XL']).optional(),
          positionX: z.number().int().min(0).max(1000).optional(),
          positionY: z.number().int().min(0).max(1000).optional(),
        })
        .refine((value) => Object.keys(value).length > 0, {
          message: 'No updates provided',
        });
      const bodyResult = patchSchema.safeParse(rawBody);
      if (!bodyResult.success) {
        return c.json(err(bodyResult.error.issues[0]?.message ?? 'Invalid update payload'), 400);
      }
      const body = bodyResult.data;

      const existing = await db
        .select()
        .from(schema.widgetInstances)
        .where(eq(schema.widgetInstances.id, instanceId));
      if (existing.length === 0) return c.json(err('Widget instance not found'), 404);
      const current = existing[0];
      if (!current) return c.json(err('Widget instance not found'), 404);

      if (body.size !== undefined) {
        const widgetDef = registry.getById(current.widgetId);
        if (!widgetDef) return c.json(err('Unknown widget'), 400);
        if (!widgetDef.sizes.includes(body.size)) {
          return c.json(err('Unsupported widget size'), 400);
        }
      }

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
      if (!inst) return c.json(err('Widget instance not found after update'), 404);
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
      console.error('[phavo]', e);
      return c.json(err('Internal error'), 500);
    }
  });

  app.delete('/widget-instances/:id', requireSession(), async (c) => {
    try {
      const instanceId = c.req.param('id');
      await db.delete(schema.widgetInstances).where(eq(schema.widgetInstances.id, instanceId));
      return c.json(ok(null));
    } catch (e) {
      console.error('[phavo]', e);
      return c.json(err('Internal error'), 500);
    }
  });

  app.post('/widgets/:instanceId/config', requireSession(), async (c) => {
    try {
      const session = c.get('session');
      if (!session) return c.json(err('Unauthorized'), 401);

      const instanceId = c.req.param('instanceId');
      const instanceRows = await db
        .select()
        .from(schema.widgetInstances)
        .where(eq(schema.widgetInstances.id, instanceId))
        .limit(1);
      const instance = instanceRows[0];

      if (!instance) {
        return c.json(err('Widget instance not found'), 404);
      }

      const widget = registry.getById(instance.widgetId);
      if (!widget) {
        return c.json(err('Unknown widget'), 404);
      }

      if (widget.tier === 'celestial' && session.tier === 'stellar') {
        return c.json(err('Upgrade required'), 403);
      }

      if (!widget.configSchema) {
        return c.json(err('This widget does not support configuration'), 400);
      }

      let rawBody: unknown;
      try {
        rawBody = await c.req.json();
      } catch {
        return c.json(err('Invalid request body'), 400);
      }

      const requestSchema = z.object({ config: z.unknown() });
      const requestBody = requestSchema.safeParse(rawBody);
      if (!requestBody.success) {
        return c.json(err('Invalid widget config payload'), 400);
      }

      const validatedConfig = widget.configSchema.safeParse(requestBody.data.config);
      if (!validatedConfig.success) {
        const issue = validatedConfig.error.issues[0];
        return c.json(err(issue?.message ?? 'Invalid widget config'), 400);
      }

      const splitConfig = splitWidgetConfig(validatedConfig.data, widget.configSchema);
      await syncInstanceCredentials(
        instanceId,
        splitConfig.credentials,
        splitConfig.preservedCredentialPaths,
      );

      const configEncrypted = hasPersistedConfigValue(splitConfig.publicConfig)
        ? await encrypt(JSON.stringify(splitConfig.publicConfig))
        : null;

      await db
        .update(schema.widgetInstances)
        .set({ configEncrypted, updatedAt: new Date() })
        .where(eq(schema.widgetInstances.id, instanceId));

      return c.json(ok({ saved: true }));
    } catch (e) {
      console.error('[phavo]', e);
      return c.json(err('Internal error'), 500);
    }
  });
}
