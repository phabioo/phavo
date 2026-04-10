import { schema } from '@phavo/db';
import type { Notification } from '@phavo/types';
import { err, ok } from '@phavo/types';
import { desc, eq } from 'drizzle-orm';
import type { Hono } from 'hono';
import { db, dbReady } from '$lib/server/db.js';
import type { AppVariables } from '$lib/server/middleware/auth.js';
import { requireSession } from '$lib/server/middleware/auth.js';
import { drainQueue } from '$lib/server/notifier.js';

/** Map a DB row to the API Notification shape. */
function toApi(row: typeof schema.notifications.$inferSelect): Notification {
  return {
    id: row.id,
    type: row.type as Notification['type'],
    title: row.title,
    message: row.message,
    read: row.read === 1,
    ...(row.actionLabel != null ? { actionLabel: row.actionLabel } : {}),
    ...(row.actionUrl != null ? { actionUrl: row.actionUrl } : {}),
    ...(row.widgetId != null ? { widgetId: row.widgetId } : {}),
    ...(row.progress != null ? { progress: row.progress } : {}),
    createdAt: row.createdAt,
  };
}

/** Persist any pending in-memory notifications to the DB and clear the queue. */
async function flushQueueToDb(): Promise<void> {
  const queued = drainQueue();
  if (queued.length === 0) return;

  for (const n of queued) {
    await db.insert(schema.notifications).values({
      id: n.id,
      type: n.type,
      title: n.title,
      message: n.message,
      read: n.read ? 1 : 0,
      actionLabel: n.actionLabel ?? null,
      actionUrl: n.actionUrl ?? null,
      widgetId: n.widgetId ?? null,
      progress: n.progress ?? null,
      createdAt: n.createdAt,
    });
  }
}

export function registerNotificationRoutes(app: Hono<{ Variables: AppVariables }>): void {
  // GET /notifications — list all, newest first
  app.get('/notifications', requireSession(), async (c) => {
    await dbReady;
    await flushQueueToDb();

    const rows = await db
      .select()
      .from(schema.notifications)
      .orderBy(desc(schema.notifications.createdAt));

    return c.json(ok(rows.map(toApi)));
  });

  // POST /notifications — create a notification
  app.post('/notifications', requireSession(), async (c) => {
    await dbReady;
    let body: {
      type: string;
      title: string;
      message: string;
      actionLabel?: string;
      actionUrl?: string;
      widgetId?: string;
      progress?: number;
    };
    try {
      body = await c.req.json();
    } catch {
      return c.json(err('Invalid request body'), 400);
    }

    if (!body.type || !body.title || !body.message) {
      return c.json(err('type, title, and message are required'), 400);
    }

    const id = crypto.randomUUID();
    await db.insert(schema.notifications).values({
      id,
      type: body.type,
      title: body.title,
      message: body.message,
      read: 0,
      actionLabel: body.actionLabel ?? null,
      actionUrl: body.actionUrl ?? null,
      widgetId: body.widgetId ?? null,
      progress: body.progress ?? null,
    });

    const rows = await db
      .select()
      .from(schema.notifications)
      .where(eq(schema.notifications.id, id));
    return c.json(ok(rows[0] ? toApi(rows[0]) : null), 201);
  });

  // PATCH /notifications/mute — toggle mute (ack-only, client manages state)
  app.patch('/notifications/mute', requireSession(), (c) => {
    return c.json(ok(null));
  });

  // PATCH /notifications/:id — mark read, update progress
  app.patch('/notifications/:id', requireSession(), async (c) => {
    await dbReady;
    const id = c.req.param('id');
    let body: { read?: boolean; progress?: number; readAll?: boolean };
    try {
      body = await c.req.json();
    } catch {
      return c.json(err('Invalid request body'), 400);
    }

    const updates: Record<string, unknown> = {};
    if (body.read !== undefined) updates.read = body.read ? 1 : 0;
    if (body.progress !== undefined) updates.progress = body.progress;

    if (Object.keys(updates).length > 0) {
      await db.update(schema.notifications).set(updates).where(eq(schema.notifications.id, id));
    }

    return c.json(ok(null));
  });

  // PATCH /notifications — bulk operations (mark all read)
  app.patch('/notifications', requireSession(), async (c) => {
    await dbReady;
    let body: { readAll?: boolean };
    try {
      body = await c.req.json();
    } catch {
      return c.json(err('Invalid request body'), 400);
    }

    if (body.readAll) {
      await db.update(schema.notifications).set({ read: 1 });
    }

    return c.json(ok(null));
  });

  // DELETE /notifications/:id — delete one
  app.delete('/notifications/:id', requireSession(), async (c) => {
    await dbReady;
    const id = c.req.param('id');
    await db.delete(schema.notifications).where(eq(schema.notifications.id, id));
    return c.json(ok(null));
  });

  // DELETE /notifications — clear all
  app.delete('/notifications', requireSession(), async (c) => {
    await dbReady;
    await db.delete(schema.notifications);
    return c.json(ok(null));
  });
}
