import type { Notification, NotifyFn } from '@phavo/types';

/**
 * Server-side in-memory notification queue.
 * Notifications are produced by server-side triggers (update check, etc.) and
 * consumed by the client via GET /api/v1/notifications, which flushes to DB.
 */
const MAX_QUEUE = 100;
const _queue: Notification[] = [];

let _callback: NotifyFn | null = null;

/** Register a callback that fires whenever serverNotify() is called. */
export function registerNotify(fn: NotifyFn): void {
  _callback = fn;
}

/** Push a notification to the server queue and invoke any registered callback. */
export function serverNotify(n: Omit<Notification, 'id' | 'createdAt' | 'read'>): void {
  const notification: Notification = {
    ...n,
    id: crypto.randomUUID(),
    createdAt: Date.now(),
    read: false,
  };
  _queue.push(notification);
  if (_queue.length > MAX_QUEUE) _queue.shift();
  _callback?.(n);
}

/**
 * Returns all queued notifications and clears the queue.
 * Called by GET /api/v1/notifications so the route can flush to DB.
 */
export function drainQueue(): Notification[] {
  return _queue.splice(0);
}
