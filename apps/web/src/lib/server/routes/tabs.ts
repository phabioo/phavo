import { schema } from '@phavo/db';
import { err, ok, type WidgetSize } from '@phavo/types';
import { asc, eq } from 'drizzle-orm';
import type { Hono } from 'hono';
import { z } from 'zod';
import { db } from '$lib/server/db.js';
import type { AppVariables } from '$lib/server/middleware/auth.js';
import { requireSession } from '$lib/server/middleware/auth.js';
import {
  hasPersistedConfigValue,
  hasStoredWidgetCredentials,
  parseWidgetPublicConfig,
} from '$lib/server/widget-helpers.js';

const CreateTabBodySchema = z.object({
  label: z.string().min(1).max(100).trim(),
  order: z.number().int().min(0).max(9999).optional(),
});

const UpdateTabBodySchema = z
  .object({
    label: z.string().min(1).max(100).trim().optional(),
    order: z.number().int().min(0).max(9999).optional(),
  })
  .refine((value) => value.label !== undefined || value.order !== undefined, {
    message: 'At least one field is required',
  });

export function registerTabRoutes(app: Hono<{ Variables: AppVariables }>): void {
  app.get('/tabs', requireSession(), async (c) => {
    try {
      const rows = await db.select().from(schema.tabs).orderBy(asc(schema.tabs.order));
      return c.json(ok(rows.map((r) => ({ id: r.id, label: r.label, order: r.order }))));
    } catch (e) {
      console.error('[phavo]', e);
      return c.json(err('Internal error'), 500);
    }
  });

  app.post('/tabs', requireSession(), async (c) => {
    try {
      const session = c.get('session');
      if (!session) return c.json(err('Unauthorized'), 401);

      let rawBody: unknown;
      try {
        rawBody = await c.req.json();
      } catch {
        return c.json(err('Invalid tab data'), 400);
      }

      const body = CreateTabBodySchema.safeParse(rawBody);
      if (!body.success) return c.json(err('Invalid tab data'), 400);

      if (session.tier === 'stellar') {
        const existing = await db.select().from(schema.tabs);
        if (existing.length >= 1) {
          return c.json(err('Tab limit reached — upgrade to Standard'), 403);
        }
      }

      const allTabs = await db.select().from(schema.tabs);
      const nextOrder = allTabs.length > 0 ? Math.max(...allTabs.map((t) => t.order)) + 1 : 0;

      const id = crypto.randomUUID();
      await db.insert(schema.tabs).values({
        id,
        label: body.data.label,
        order: nextOrder,
      });

      return c.json(ok({ id, label: body.data.label, order: nextOrder }), 201);
    } catch (e) {
      console.error('[phavo]', e);
      return c.json(err('Internal error'), 500);
    }
  });

  app.patch('/tabs/:id', requireSession(), async (c) => {
    try {
      const tabId = c.req.param('id');
      let rawBody: unknown;
      try {
        rawBody = await c.req.json();
      } catch {
        return c.json(err('Invalid tab data'), 400);
      }

      const body = UpdateTabBodySchema.safeParse(rawBody);
      if (!body.success) return c.json(err('Invalid tab data'), 400);

      const existing = await db.select().from(schema.tabs).where(eq(schema.tabs.id, tabId));
      if (existing.length === 0) return c.json(err('Tab not found'), 404);

      const updates: Record<string, unknown> = {};
      if (body.data.label !== undefined) updates.label = body.data.label;
      if (body.data.order !== undefined) updates.order = body.data.order;

      if (Object.keys(updates).length > 0) {
        await db.update(schema.tabs).set(updates).where(eq(schema.tabs.id, tabId));
      }

      const updated = await db.select().from(schema.tabs).where(eq(schema.tabs.id, tabId));
      const tab = updated[0];
      if (!tab) return c.json(err('Tab not found after update'), 404);
      return c.json(ok({ id: tab.id, label: tab.label, order: tab.order }));
    } catch (e) {
      console.error('[phavo]', e);
      return c.json(err('Internal error'), 500);
    }
  });

  app.delete('/tabs/:id', requireSession(), async (c) => {
    try {
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
      console.error('[phavo]', e);
      return c.json(err('Internal error'), 500);
    }
  });

  app.get('/tabs/:id/widgets', requireSession(), async (c) => {
    try {
      const tabId = c.req.param('id');
      const rows = await db
        .select()
        .from(schema.widgetInstances)
        .where(eq(schema.widgetInstances.tabId, tabId));

      const instances = await Promise.all(
        rows.map(async (r) => {
          const config = await parseWidgetPublicConfig(r.configEncrypted);
          const configured =
            hasPersistedConfigValue(config) || (await hasStoredWidgetCredentials(r.id));

          return {
            id: r.id,
            widgetId: r.widgetId,
            tabId: r.tabId,
            size: r.size as WidgetSize,
            position: { x: r.positionX, y: r.positionY },
            config,
            configured,
          };
        }),
      );

      return c.json(ok(instances));
    } catch (e) {
      console.error('[phavo]', e);
      return c.json(err('Internal error'), 500);
    }
  });
}
