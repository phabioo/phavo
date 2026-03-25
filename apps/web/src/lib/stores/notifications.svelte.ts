import type { Notification, NotifyFn } from '@phavo/types';

let _notifications = $state<Notification[]>([]);

export function getNotifications(): Notification[] {
  return _notifications;
}

export function getUnreadCount(): number {
  return _notifications.filter((n) => !n.read).length;
}

export const notify: NotifyFn = (n) => {
  const notification: Notification = {
    ...n,
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    read: false,
  };
  _notifications = [notification, ..._notifications];
};

export function markRead(id: string): void {
  _notifications = _notifications.map((n) => (n.id === id ? { ...n, read: true } : n));
}

export function markAllRead(): void {
  _notifications = _notifications.map((n) => ({ ...n, read: true }));
}

export function clearHistory(): void {
  _notifications = [];
}

/**
 * Fetches server-generated notifications (update checks, etc.) and
 * prepends any new ones to the local in-memory list.
 * Server drains its queue on each successful GET, so duplicates are avoided.
 */
export async function syncFromServer(): Promise<void> {
  try {
    const res = await fetch('/api/v1/notifications');
    if (!res.ok) return;
    const json = (await res.json()) as { ok: boolean; data: Notification[] };
    if (json.ok && Array.isArray(json.data) && json.data.length > 0) {
      _notifications = [...json.data, ..._notifications];
    }
  } catch {
    // silently fail — no network connectivity or server down
  }
}
