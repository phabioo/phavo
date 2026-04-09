import {
  type DiskMetrics,
  isWidgetDefinition,
  type Tab,
  type TemperatureMetrics,
  type WidgetDefinition,
  type WidgetInstance,
  type WidgetManifestEntry,
  type WidgetSize,
} from '@phavo/types';
import en from '$lib/i18n/en.json';
import { notify } from '$lib/stores/notifications.svelte';
import { fetchWithCsrf } from '$lib/utils/api';

let currentTabId = $state<string>('');
let tabs = $state<Tab[]>([]);
let widgetInstances = $state<WidgetInstance[]>([]);
let isDrawerOpen = $state(false);
let widgetManifest = $state<WidgetManifestEntry[]>([]);
let widgetData = $state<Record<string, unknown>>({});
let widgetStates = $state<Record<string, WidgetState>>({});
let widgetErrors = $state<Record<string, string | null>>({});
let widgetWarnings = $state<Record<string, string | null>>({});
let widgetLastSuccess = $state<Record<string, number | null>>({});
let widgetFailureCounts = $state<Record<string, number>>({});
let widgetPreviewLoading = $state<Record<string, boolean>>({});
let widgetPreviewErrors = $state<Record<string, string | null>>({});
let drawerPreviewToken = $state(0);
let drawerPreviewRequests = $state<Record<string, number>>({});

const inflightFetches = new Map<string, Promise<void>>();

export type WidgetState = 'loading' | 'active' | 'unconfigured' | 'error' | 'stale';

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
  if (open && !isDrawerOpen) {
    drawerPreviewToken += 1;
    drawerPreviewRequests = {};
    widgetPreviewLoading = {};
    widgetPreviewErrors = {};
  }
  isDrawerOpen = open;
}

export function getWidgetInstances(): WidgetInstance[] {
  return widgetInstances;
}

export function getWidgetManifest(): WidgetManifestEntry[] {
  return widgetManifest;
}

export function getWidgetData(widgetId: string): unknown {
  return widgetData[widgetId];
}

export function getWidgetPreviewLoading(widgetId: string): boolean {
  return widgetPreviewLoading[widgetId] ?? false;
}

export function getWidgetPreviewError(widgetId: string): string | null {
  return widgetPreviewErrors[widgetId] ?? null;
}

export function getWidgetState(instanceId: string): WidgetState {
  return widgetStates[instanceId] ?? 'loading';
}

export function getWidgetError(instanceId: string): string | null {
  return widgetErrors[instanceId] ?? null;
}

export function getWidgetWarning(instanceId: string): string | null {
  return widgetWarnings[instanceId] ?? null;
}

export function getWidgetLastSuccess(instanceId: string): number | null {
  return widgetLastSuccess[instanceId] ?? null;
}

export async function loadWidgetManifest(): Promise<void> {
  try {
    const res = await fetchWithCsrf('/api/v1/widgets');
    const json = (await res.json()) as { ok: boolean; data: WidgetManifestEntry[] };
    if (json.ok) widgetManifest = json.data;
  } catch {
    // silently fail
  }
}

export async function retryWidget(instanceId: string): Promise<void> {
  const instance = widgetInstances.find((entry) => entry.id === instanceId);
  if (!instance) return;

  const def = getDefinition(instance.widgetId);
  if (!def || !canPollInstance(instance, def)) return;

  widgetStates = { ...widgetStates, [instanceId]: 'loading' };
  widgetErrors = { ...widgetErrors, [instanceId]: null };
  widgetWarnings = { ...widgetWarnings, [instanceId]: null };

  await fetchWidgetData(def, false);
}

function getDefinition(widgetId: string): WidgetDefinition | undefined {
  const entry = widgetManifest.find((widget) => widget.id === widgetId);
  return entry && isWidgetDefinition(entry) ? entry : undefined;
}

function canPollInstance(instance: WidgetInstance, def: WidgetDefinition): boolean {
  return !def.configSchema || instance.configured !== false;
}

function getPollableInstances(widgetId: string): WidgetInstance[] {
  const def = getDefinition(widgetId);
  if (!def) return [];
  return widgetInstances.filter(
    (instance) => instance.widgetId === widgetId && canPollInstance(instance, def),
  );
}

function buildNextStateForInstance(instance: WidgetInstance): WidgetState {
  const def = getDefinition(instance.widgetId);
  if (def?.configSchema && instance.configured === false) return 'unconfigured';

  const previous = widgetStates[instance.id];
  if (previous === 'active' || previous === 'stale' || previous === 'error') {
    return previous;
  }

  if (previous === 'unconfigured') return 'loading';
  if (widgetData[instance.widgetId] !== undefined) return 'active';
  return 'loading';
}

function reconcileWidgetRuntime(): void {
  const nextStates: Record<string, WidgetState> = {};
  const nextErrors: Record<string, string | null> = {};
  const nextWarnings: Record<string, string | null> = {};
  const nextLastSuccess: Record<string, number | null> = {};

  for (const instance of widgetInstances) {
    nextStates[instance.id] = buildNextStateForInstance(instance);
    nextErrors[instance.id] = widgetErrors[instance.id] ?? null;
    nextWarnings[instance.id] = widgetWarnings[instance.id] ?? null;
    nextLastSuccess[instance.id] = widgetLastSuccess[instance.id] ?? null;

    if (nextStates[instance.id] === 'unconfigured') {
      nextErrors[instance.id] = null;
      nextWarnings[instance.id] = null;
    }
  }

  widgetStates = nextStates;
  widgetErrors = nextErrors;
  widgetWarnings = nextWarnings;
  widgetLastSuccess = nextLastSuccess;
}

function checkThresholds(widgetId: string, data: unknown): void {
  if (widgetId === 'disk') {
    for (const disk of data as DiskMetrics[]) {
      if (disk.usePercent > 90) {
        const last = diskThrottleMap.get(disk.mount) ?? 0;
        if (Date.now() - last > 3_600_000) {
          notify({
            type: 'info',
            title: en.notifications.diskAlmostFull,
            message: `${disk.mount} at ${Math.round(disk.usePercent)}%`,
            widgetId: 'disk',
          });
          diskThrottleMap.set(disk.mount, Date.now());
        }
      }
    }
  }

  if (widgetId === 'temperature') {
    const temp = data as TemperatureMetrics;
    if (temp.cpuTemp !== null && temp.cpuTemp > 80) {
      if (Date.now() - tempLastNotified > 1_800_000) {
        notify({
          type: 'security',
          title: en.notifications.highCpuTemp,
          message: `${temp.cpuTemp}°C detected`,
          widgetId: 'temperature',
        });
        tempLastNotified = Date.now();
      }
    }
  }
}

function trackPiholeFailure(widgetId: string): void {
  if (widgetId !== 'pihole') return;
  piholeFailStreak++;
  if (piholeFailStreak >= 3) {
    notify({
      type: 'widget-error',
      title: en.notifications.piholeUnreachable,
      message: en.notifications.piholeUnreachableBody,
      widgetId: 'pihole',
      actionUrl: '/settings?tab=general',
    });
    piholeFailStreak = 0;
  }
}

async function fetchWidgetData(def: WidgetDefinition, silent: boolean): Promise<void> {
  const activeInstances = getPollableInstances(def.id);
  const previewOnly = activeInstances.length === 0;
  if (previewOnly && !isDrawerOpen) return;

  const existing = inflightFetches.get(def.id);
  if (existing) {
    await existing;
    return;
  }

  const request = (async () => {
    try {
      const res = await fetchWithCsrf(def.dataEndpoint);
      const json = (await res.json()) as { ok: boolean; data?: unknown; error?: string };

      if (!json.ok) {
        throw new Error(json.error ?? en.errors.generic);
      }

      const nextData = json.data;
      const timestamp = Date.now();
      widgetData = { ...widgetData, [def.id]: nextData };
      widgetFailureCounts = { ...widgetFailureCounts, [def.id]: 0 };
      piholeFailStreak = def.id === 'pihole' ? 0 : piholeFailStreak;
      widgetPreviewLoading = { ...widgetPreviewLoading, [def.id]: false };
      widgetPreviewErrors = { ...widgetPreviewErrors, [def.id]: null };

      if (activeInstances.length > 0) {
        const nextStates = { ...widgetStates };
        const nextErrors = { ...widgetErrors };
        const nextWarnings = { ...widgetWarnings };
        const nextLastSuccess = { ...widgetLastSuccess };

        for (const instance of activeInstances) {
          nextStates[instance.id] = 'active';
          nextErrors[instance.id] = null;
          nextWarnings[instance.id] = null;
          nextLastSuccess[instance.id] = timestamp;
        }

        widgetStates = nextStates;
        widgetErrors = nextErrors;
        widgetWarnings = nextWarnings;
        widgetLastSuccess = nextLastSuccess;
      }

      if (activeInstances.length > 0 && nextData !== undefined) {
        checkThresholds(def.id, nextData);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : en.errors.networkError;
      const previousData = widgetData[def.id];
      widgetPreviewLoading = { ...widgetPreviewLoading, [def.id]: false };
      widgetPreviewErrors = { ...widgetPreviewErrors, [def.id]: message };

      if (previewOnly) return;

      const nextFailureCount = (widgetFailureCounts[def.id] ?? 0) + 1;
      widgetFailureCounts = { ...widgetFailureCounts, [def.id]: nextFailureCount };

      const nextStates = { ...widgetStates };
      const nextErrors = { ...widgetErrors };
      const nextWarnings = { ...widgetWarnings };

      for (const instance of activeInstances) {
        const previousState = widgetStates[instance.id];
        const shouldShowStale =
          previousData !== undefined && (previousState === 'active' || previousState === 'stale');

        if (shouldShowStale && nextFailureCount < 3) {
          nextStates[instance.id] = 'stale';
          nextWarnings[instance.id] = message;
          nextErrors[instance.id] = null;
          continue;
        }

        nextStates[instance.id] = 'error';
        nextErrors[instance.id] = message;
        nextWarnings[instance.id] = null;
      }

      if (previousData !== undefined && nextFailureCount >= 3) {
        const nextData = { ...widgetData };
        delete nextData[def.id];
        widgetData = nextData;
      }

      widgetStates = nextStates;
      widgetErrors = nextErrors;
      widgetWarnings = nextWarnings;

      if (!silent || previousData === undefined) {
        trackPiholeFailure(def.id);
      }
    } finally {
      inflightFetches.delete(def.id);
    }
  })();

  inflightFetches.set(def.id, request);
  await request;
}

const diskThrottleMap = new Map<string, number>();
let tempLastNotified = 0;
let piholeFailStreak = 0;

/** Load all tabs from server and set the first one as active if no tab is active. */
export async function loadTabs(): Promise<void> {
  try {
    const res = await fetchWithCsrf('/api/v1/tabs');
    const json = (await res.json()) as { ok: boolean; data: Tab[] };
    if (json.ok) {
      tabs = json.data;

      // Auto-create a "Home" tab on first launch if none exist
      if (tabs.length === 0) {
        const result = await createTab('Home');
        if (result.ok && tabs.length > 0) {
          const first = tabs[0];
          if (first) {
            currentTabId = first.id;
            await loadWidgetInstances(currentTabId);
            return;
          }
        }
      }

      if (tabs.length > 0 && (!currentTabId || !tabs.find((t) => t.id === currentTabId))) {
        const first = tabs[0];
        if (first) {
          currentTabId = first.id;
          await loadWidgetInstances(currentTabId);
        }
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
    const res = await fetchWithCsrf('/api/v1/tabs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label }),
    });
    const json = (await res.json()) as { ok: boolean; data?: Tab; error?: string };
    if (json.ok && json.data) {
      tabs = [...tabs, json.data];
      return { ok: true };
    }
    return { ok: false, error: json.error ?? 'Request failed' };
  } catch {
    return { ok: false, error: 'Network error' };
  }
}

/** Rename or reorder a tab. */
export async function updateTab(
  id: string,
  patch: { label?: string; order?: number },
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetchWithCsrf(`/api/v1/tabs/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    const json = (await res.json()) as { ok: boolean; data?: Tab; error?: string };
    if (json.ok && json.data) {
      const updatedTab = json.data;
      tabs = tabs.map((t) => (t.id === id ? updatedTab : t));
      return { ok: true };
    }
    return { ok: false, error: json.error ?? 'Request failed' };
  } catch {
    return { ok: false, error: 'Network error' };
  }
}

/** Delete a tab. Widgets are reassigned server-side. */
export async function deleteTab(id: string): Promise<void> {
  try {
    const res = await fetchWithCsrf(`/api/v1/tabs/${encodeURIComponent(id)}`, { method: 'DELETE' });
    const json = (await res.json()) as { ok: boolean };
    if (json.ok) {
      tabs = tabs.filter((t) => t.id !== id);
      if (currentTabId === id && tabs.length > 0) {
        const first = tabs[0];
        if (first) await setActiveTab(first.id);
      }
    }
  } catch {
    // silently fail
  }
}

// ── Widget instances ───────────────────────────────────────────────────
// ── Dev-only default size migration ───────────────────────────────────
// Upgrades any instance that was saved at 'S' before M became the default.
// Safe to run on every load: only touches instances still at 'S'.
const PREFERS_M_WIDGETS = new Set([
  'cpu',
  'memory',
  'disk',
  'network',
  'weather',
  'pihole',
  'links',
  'docker',
  'service-health',
  'speedtest',
  'calendar',
  'rss',
]);

async function upgradeDefaultSizeIfNeeded(instances: WidgetInstance[]): Promise<WidgetInstance[]> {
  const staleS = instances.filter((i) => i.size === 'S' && PREFERS_M_WIDGETS.has(i.widgetId));
  if (staleS.length === 0) return instances;

  await Promise.allSettled(
    staleS.map((i) =>
      fetchWithCsrf(`/api/v1/widget-instances/${encodeURIComponent(i.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ size: 'M' }),
      }),
    ),
  );

  return instances.map((i) =>
    i.size === 'S' && PREFERS_M_WIDGETS.has(i.widgetId) ? { ...i, size: 'M' as WidgetSize } : i,
  );
}

async function loadWidgetInstances(tabId: string): Promise<void> {
  try {
    const res = await fetchWithCsrf(`/api/v1/tabs/${encodeURIComponent(tabId)}/widgets`);
    const json = (await res.json()) as { ok: boolean; data: WidgetInstance[] };
    if (json.ok) {
      widgetInstances = await upgradeDefaultSizeIfNeeded(json.data);
      reconcileWidgetRuntime();
    }
  } catch {
    // silently fail
  }
}

/** Add a widget to the current tab (optimistic). */
export async function addWidget(
  widgetId: string,
  size?: WidgetSize,
): Promise<WidgetInstance | null> {
  if (!currentTabId) return null;
  try {
    const res = await fetchWithCsrf('/api/v1/widget-instances', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ widgetId, tabId: currentTabId, size }),
    });
    const json = (await res.json()) as { ok: boolean; data?: WidgetInstance };
    if (json.ok && json.data) {
      widgetInstances = [...widgetInstances, json.data];
      reconcileWidgetRuntime();
      return json.data;
    }
  } catch {
    // silently fail
  }
  return null;
}

/** Remove a widget instance (optimistic). */
export async function removeWidget(instanceId: string): Promise<void> {
  const prevInstances = widgetInstances;
  const prevData = widgetData;
  const prevStates = widgetStates;
  const prevErrors = widgetErrors;
  const prevWarnings = widgetWarnings;
  const prevLastSuccess = widgetLastSuccess;
  const prevFailureCounts = widgetFailureCounts;
  removeWidgetInstanceFromStore(instanceId);
  try {
    const res = await fetchWithCsrf(`/api/v1/widget-instances/${encodeURIComponent(instanceId)}`, {
      method: 'DELETE',
    });
    const json = (await res.json()) as { ok: boolean };
    if (!json.ok) {
      widgetInstances = prevInstances;
      widgetData = prevData;
      widgetStates = prevStates;
      widgetErrors = prevErrors;
      widgetWarnings = prevWarnings;
      widgetLastSuccess = prevLastSuccess;
      widgetFailureCounts = prevFailureCounts;
      reconcileWidgetRuntime();
    }
  } catch {
    widgetInstances = prevInstances;
    widgetData = prevData;
    widgetStates = prevStates;
    widgetErrors = prevErrors;
    widgetWarnings = prevWarnings;
    widgetLastSuccess = prevLastSuccess;
    widgetFailureCounts = prevFailureCounts;
    reconcileWidgetRuntime();
  }
}

export function removeWidgetInstanceFromStore(instanceId: string): void {
  const removedInstance = widgetInstances.find((instance) => instance.id === instanceId);
  if (!removedInstance) return;

  widgetInstances = widgetInstances.filter((instance) => instance.id !== instanceId);

  const nextStates = { ...widgetStates };
  delete nextStates[instanceId];
  widgetStates = nextStates;

  const nextErrors = { ...widgetErrors };
  delete nextErrors[instanceId];
  widgetErrors = nextErrors;

  const nextWarnings = { ...widgetWarnings };
  delete nextWarnings[instanceId];
  widgetWarnings = nextWarnings;

  const nextLastSuccess = { ...widgetLastSuccess };
  delete nextLastSuccess[instanceId];
  widgetLastSuccess = nextLastSuccess;

  const hasRemainingInstances = widgetInstances.some(
    (instance) => instance.widgetId === removedInstance.widgetId,
  );

  if (!hasRemainingInstances) {
    if (!isDrawerOpen) {
      const nextData = { ...widgetData };
      delete nextData[removedInstance.widgetId];
      widgetData = nextData;

      const nextFailureCounts = { ...widgetFailureCounts };
      delete nextFailureCounts[removedInstance.widgetId];
      widgetFailureCounts = nextFailureCounts;
    }
  }

  reconcileWidgetRuntime();
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
    await fetchWithCsrf(`/api/v1/widget-instances/${encodeURIComponent(id)}`, {
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
      fetchWithCsrf(`/api/v1/widget-instances/${encodeURIComponent(draggedId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ positionX: targetPos.x, positionY: targetPos.y }),
      }),
      fetchWithCsrf(`/api/v1/widget-instances/${encodeURIComponent(targetId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ positionX: draggedPos.x, positionY: draggedPos.y }),
      }),
    ]);
  } catch {
    // already optimistically updated
  }
}

$effect.root(() => {
  $effect(() => {
    if (!isDrawerOpen || drawerPreviewToken === 0) return;

    const previewDefs = widgetManifest.filter(
      (entry): entry is WidgetDefinition =>
        isWidgetDefinition(entry) &&
        widgetData[entry.id] === undefined &&
        drawerPreviewRequests[entry.id] !== drawerPreviewToken,
    );

    if (previewDefs.length === 0) return;

    const nextRequests = { ...drawerPreviewRequests };
    const nextPreviewLoading = { ...widgetPreviewLoading };
    const nextPreviewErrors = { ...widgetPreviewErrors };

    for (const def of previewDefs) {
      nextRequests[def.id] = drawerPreviewToken;
      nextPreviewLoading[def.id] = true;
      nextPreviewErrors[def.id] = null;
    }

    drawerPreviewRequests = nextRequests;
    widgetPreviewLoading = nextPreviewLoading;
    widgetPreviewErrors = nextPreviewErrors;

    for (const def of previewDefs) {
      void fetchWidgetData(def, false);
    }
  });

  $effect(() => {
    const activeDefinitions = widgetManifest.filter(
      (entry): entry is WidgetDefinition =>
        isWidgetDefinition(entry) && getPollableInstances(entry.id).length > 0,
    );

    if (activeDefinitions.length === 0) return;

    for (const def of activeDefinitions) {
      void fetchWidgetData(def, false);
    }

    const intervals = activeDefinitions
      .filter((def) => def.refreshInterval > 0)
      .map((def) => setInterval(() => void fetchWidgetData(def, true), def.refreshInterval));

    return () => {
      for (const interval of intervals) clearInterval(interval);
    };
  });
});
