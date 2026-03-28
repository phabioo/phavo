import { ok } from '@phavo/types';
import type { Hono } from 'hono';
import type { AppVariables } from '$lib/server/middleware/auth.js';
import { requireSession } from '$lib/server/middleware/auth.js';
import { drainQueue } from '$lib/server/notifier.js';

export function registerNotificationRoutes(app: Hono<{ Variables: AppVariables }>): void {
  app.get('/notifications', requireSession(), (c) => {
    return c.json(ok(drainQueue()));
  });

  app.post('/notifications/read', requireSession(), (c) => {
    // Client manages read state; server queue already drained on GET.
    return c.json(ok(null));
  });
}
