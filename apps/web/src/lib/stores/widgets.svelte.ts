import type { Tab, WidgetInstance, WidgetSize } from '@phavo/types';

let currentTabId = $state<string>('');
let tabs = $state<Tab[]>([]);
let widgetInstances = $state<WidgetInstance[]>([]);
let isDrawerOpen = $state(false);

// ── Tab state ──────────────────────────────────────────────────────────
export function getCurrentTabId(): string {
  return currentTabId;
}

export function getTabs(): Tab[] {
  return tabs;
}

export function getIsDrawerOpen(): boolean {
  return isDrawerOpen;
}

export function setDrawerOpen(open: boolean): void {
  isDrawerOpen = open;
}

export function getWidgetInstances(): WidgetInstance[] {
  return widgetInstances;
}

/** Load all tabs from server and set the first one as active if no tab is active. */
export async function loadTabs(): Promise<void> {
  try {
    const res = await fetch('/api/v1/tabs');
    const json = (await res.json()) as { ok: boolean; data: Tab[] };
    if (json.ok) {
      tabs = json.data;

      // Auto-create a "Home" tab on first launch if none exist
      if (tabs.length === 0) {
        const result = await createTab('Home');
        if (result.ok && tabs.length > 0) {
          currentTabId = tabs[0].id;
          await loadWidgetInstances(currentTabId);
          return;
        }
      }

      if (tabs.length > 0 && (!currentTabId || !tabs.find((t) => t.id === currentTabId))) {
        currentTabId = tabs[0].id;
        await loadWidgetInstances(currentTabId);
      }
    }
  } catch {
    // silently fail
  }
}

/** Switch the active tab and fetch its widget instances. */
export async function setActiveTab(id: string): Promise<void> {
  currentTabId = id;
  await loadWidgetInstances(id);
}

/** Create a new tab via API, then refresh the tab list. */
export async function createTab(label: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch('/api/v1/tabs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label }),
    });
    const json = (await res.json()) as { ok: boolean; data?: Tab; error?: string };
    if (json.ok && json.data) {
      tabs = [...tabs, json.data];
      return { ok: true };
    }
    return { ok: false, error: json.error };
  } catch {
    return { ok: false, error: 'Network error' };
  }
}

/** Rename or reorder a tab. */
export async function updateTab(id: string, patch: { label?: string; order?: number }): Promise<void> {
  try {
    const res = await fetch(`/api/v1/tabs/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    const json = (await res.json()) as { ok: boolean; data?: Tab };
    if (json.ok && json.data) {
      tabs = tabs.map((t) => (t.id === id ? json.data! : t));
    }
  } catch {
    // silently fail
  }
}

/** Delete a tab. Widgets are reassigned server-side. */
export async function deleteTab(id: string): Promise<void> {
  try {
    const res = await fetch(`/api/v1/tabs/${encodeURIComponent(id)}`, { method: 'DELETE' });
    const json = (await res.json()) as { ok: boolean };
    if (json.ok) {
      tabs = tabs.filter((t) => t.id !== id);
      if (currentTabId === id && tabs.length > 0) {
        await setActiveTab(tabs[0].id);
      }
    }
  } catch {
    // silently fail
  }
}

// ── Widget instances ───────────────────────────────────────────────────
async function loadWidgetInstances(tabId: string): Promise<void> {
  try {
    const res = await fetch(`/api/v1/tabs/${encodeURIComponent(tabId)}/widgets`);
    const json = (await res.json()) as { ok: boolean; data: WidgetInstance[] };
    if (json.ok) {
      widgetInstances = json.data;
    }
  } catch {
    // silently fail
  }
}

/** Add a widget to the current tab (optimistic). */
export async function addWidget(widgetId: string, size?: WidgetSize): Promise<WidgetInstance | null> {
  if (!currentTabId) return null;
  try {
    const res = await fetch('/api/v1/widget-instances', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ widgetId, tabId: currentTabId, size }),
    });
    const json = (await res.json()) as { ok: boolean; data?: WidgetInstance };
    if (json.ok && json.data) {
      widgetInstances = [...widgetInstances, json.data];
      return json.data;
    }
  } catch {
    // silently fail
  }
  return null;
}

/** Remove a widget instance (optimistic). */
export async function removeWidget(instanceId: string): Promise<void> {
  const prev = widgetInstances;
  widgetInstances = widgetInstances.filter((w) => w.id !== instanceId);
  try {
    const res = await fetch(`/api/v1/widget-instances/${encodeURIComponent(instanceId)}`, {
      method: 'DELETE',
    });
    const json = (await res.json()) as { ok: boolean };
    if (!json.ok) widgetInstances = prev; // revert
  } catch {
    widgetInstances = prev; // revert
  }
}

/** Optimistic update, then persist to server. */
export async function updateInstance(
  id: string,
  patch: { size?: WidgetSize; positionX?: number; positionY?: number },
): Promise<void> {
  // Optimistic local update
  widgetInstances = widgetInstances.map((w) => {
    if (w.id !== id) return w;
    return {
      ...w,
      size: patch.size ?? w.size,
      position: {
        x: patch.positionX ?? w.position.x,
        y: patch.positionY ?? w.position.y,
      },
    };
  });

  try {
    await fetch(`/api/v1/widget-instances/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
  } catch {
    // already optimistically updated
  }
}

/** Swap positions of two widget instances (optimistic). */
export async function swapWidgets(draggedId: string, targetId: string): Promise<void> {
  const dragged = widgetInstances.find((w) => w.id === draggedId);
  const target = widgetInstances.find((w) => w.id === targetId);
  if (!dragged || !target || draggedId === targetId) return;

  const draggedPos = { x: dragged.position.x, y: dragged.position.y };
  const targetPos = { x: target.position.x, y: target.position.y };

  // Optimistic local swap
  widgetInstances = widgetInstances.map((w) => {
    if (w.id === draggedId) return { ...w, position: targetPos };
    if (w.id === targetId) return { ...w, position: draggedPos };
    return w;
  });

  // Persist both
  try {
    await Promise.all([
      fetch(`/api/v1/widget-instances/${encodeURIComponent(draggedId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ positionX: targetPos.x, positionY: targetPos.y }),
      }),
      fetch(`/api/v1/widget-instances/${encodeURIComponent(targetId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ positionX: draggedPos.x, positionY: draggedPos.y }),
      }),
    ]);
  } catch {
    // already optimistically updated
  }
}
