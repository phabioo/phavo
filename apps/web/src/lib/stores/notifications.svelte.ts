import type { Notification, NotifyFn } from '@phavo/types';
import { fetchWithCsrf } from '$lib/utils/api';

let _notifications = $state<Notification[]>([]);
let _panelOpen = $state(false);
let _muted = $state(false);

export function getNotifications(): Notification[] {
  return _notifications;
}

export function getUnreadCount(): number {
  return _notifications.filter((n) => !n.read).length;
}

export function getPanelOpen(): boolean {
  return _panelOpen;
}

export function setPanelOpen(open: boolean): void {
  _panelOpen = open;
}

export function togglePanel(): void {
  _panelOpen = !_panelOpen;
  if (_panelOpen) {
    // Mark all as read on open
    markAllRead();
  }
}

export const notify: NotifyFn = (n) => {
  const notification: Notification = {
    ...n,
    id: crypto.randomUUID(),
    createdAt: Date.now(),
    read: false,
  };
  _notifications = [notification, ..._notifications];
};

export function markRead(id: string): void {
  _notifications = _notifications.map((n) => (n.id === id ? { ...n, read: true } : n));
  void fetchWithCsrf(`/api/v1/notifications/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ read: true }),
  });
}

export function markAllRead(): void {
  _notifications = _notifications.map((n) => ({ ...n, read: true }));
  void fetchWithCsrf('/api/v1/notifications', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ readAll: true }),
  });
}

export function dismiss(id: string): void {
  _notifications = _notifications.filter((n) => n.id !== id);
  void fetchWithCsrf(`/api/v1/notifications/${id}`, { method: 'DELETE' });
}

export function clearAll(): void {
  _notifications = [];
  void fetchWithCsrf('/api/v1/notifications', { method: 'DELETE' });
}

export function clearHistory(): void {
  clearAll();
}

export function getMuted(): boolean {
  return _muted;
}

export function toggleMute(): void {
  _muted = !_muted;
  void fetchWithCsrf('/api/v1/notifications/mute', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ muted: _muted }),
  });
}

/**
 * Fetches all notifications from the server and replaces the local list.
 */
export async function syncFromServer(): Promise<void> {
  try {
    const res = await fetchWithCsrf('/api/v1/notifications');
    if (!res.ok) return;
    const json = (await res.json()) as { ok: boolean; data: Notification[] };
    if (json.ok && Array.isArray(json.data)) {
      _notifications = json.data;
    }
  } catch {
    // silently fail — no network connectivity or server down
  }
}
