<script lang="ts">
import type { WidgetDefinition, WidgetSize } from '@phavo/types';
import type {
  CpuMetrics,
  DiskMetrics,
  MemoryMetrics,
  NetworkMetrics,
  PiholeMetrics,
  RssFeedResult,
  TemperatureMetrics,
  UptimeMetrics,
  WeatherMetrics,
} from '@phavo/agent';
import { page } from '$app/state';
import { WidgetCard, TabBar, WidgetDrawer, UpgradeBanner } from '@phavo/ui';
import en from '$lib/i18n/en.json';
import { notify } from '$lib/stores/notifications.svelte';
import { getConfig } from '$lib/stores/config.svelte';
import {
  getTabs,
  getCurrentTabId,
  getWidgetInstances,
  getIsDrawerOpen,
  setDrawerOpen,
  setActiveTab,
  loadTabs,
  createTab,
  updateTab,
  deleteTab,
  addWidget,
  removeWidget,
  updateInstance,
  swapWidgets,
} from '$lib/stores/widgets.svelte';
import CpuWidget from '$lib/widgets/CpuWidget.svelte';
import DiskWidget from '$lib/widgets/DiskWidget.svelte';
import LinksWidget from '$lib/widgets/LinksWidget.svelte';
import MemoryWidget from '$lib/widgets/MemoryWidget.svelte';
import NetworkWidget from '$lib/widgets/NetworkWidget.svelte';
import PiholeWidget from '$lib/widgets/PiholeWidget.svelte';
import RssWidget from '$lib/widgets/RssWidget.svelte';
import TemperatureWidget from '$lib/widgets/TemperatureWidget.svelte';
import UptimeWidget from '$lib/widgets/UptimeWidget.svelte';
import WeatherWidget from '$lib/widgets/WeatherWidget.svelte';

let widgetData = $state<Record<string, unknown>>({});
let widgetLoading = $state<Record<string, boolean>>({});
let widgetErrors = $state<Record<string, string | null>>({});
let widgetManifest = $state<WidgetDefinition[]>([]);
let showUpgradeBanner = $state(false);

// ── Threshold-notification throttle state ────────────────────────────
const diskThrottleMap = new Map<string, number>();
let tempLastNotified = 0;
let piholeFailStreak = 0;

function checkThresholds(widgetId: string, data: unknown): void {
  if (widgetId === 'disk') {
    for (const disk of data as DiskMetrics[]) {
      if (disk.usePercent > 90) {
        const last = diskThrottleMap.get(disk.mount) ?? 0;
        if (Date.now() - last > 3_600_000) {
          notify({
            type: 'widget-warning',
            title: en.notifications.diskAlmostFull,
            body: `${disk.mount} at ${Math.round(disk.usePercent)}%`,
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
          type: 'system-alert',
          title: en.notifications.highCpuTemp,
          body: `${temp.cpuTemp}°C detected`,
          widgetId: 'temperature',
        });
        tempLastNotified = Date.now();
      }
    }
  }
}

async function fetchWidgetManifest() {
  try {
    const res = await fetch('/api/v1/widgets');
    const json = (await res.json()) as { ok: boolean; data: WidgetDefinition[] };
    if (json.ok) widgetManifest = json.data;
  } catch {
    // silently fail
  }
}

async function fetchWidgetData(widgetId: string, endpoint: string, silent = false) {
  if (!silent) widgetLoading[widgetId] = true;
  widgetErrors[widgetId] = null;
  try {
    const res = await fetch(endpoint);
    const json = (await res.json()) as { ok: boolean; data: unknown; error?: string };
    if (json.ok) {
      widgetData[widgetId] = json.data;
      checkThresholds(widgetId, json.data);
      if (widgetId === 'pihole') piholeFailStreak = 0;
    } else {
      if (!silent) widgetErrors[widgetId] = json.error ?? en.errors.generic;
      trackPiholeFailure(widgetId);
    }
  } catch {
    if (!silent) widgetErrors[widgetId] = en.errors.networkError;
    trackPiholeFailure(widgetId);
  } finally {
    if (!silent) widgetLoading[widgetId] = false;
  }
}

function trackPiholeFailure(widgetId: string): void {
  if (widgetId !== 'pihole') return;
  piholeFailStreak++;
  if (piholeFailStreak >= 3) {
    notify({
      type: 'widget-error',
      title: en.notifications.piholeUnreachable,
      body: en.notifications.piholeUnreachableBody,
      widgetId: 'pihole',
      settingsTab: 'general',
    });
    piholeFailStreak = 0;
  }
}

// Get the WidgetDefinition for a widget id
function getDef(widgetId: string): WidgetDefinition | undefined {
  return widgetManifest.find((w) => w.id === widgetId);
}

// ── Tab handlers ─────────────────────────────────────────────────────
function handleSelectTab(id: string) {
  setActiveTab(id);
}

const devMode = $derived(!!page.data.devMode);

function handleAddTab(label: string) {
  const config = getConfig();
  if (config.tier === 'free' && !devMode) {
    showUpgradeBanner = true;
    setTimeout(() => (showUpgradeBanner = false), 5000);
    return;
  }
  createTab(label);
}

function handleRenameTab(id: string, newLabel: string) {
  updateTab(id, { label: newLabel });
}

function handleDeleteTab(id: string) {
  deleteTab(id);
}

// ── Widget drawer handlers ───────────────────────────────────────────
async function handleDrawerAdd(widgetId: string, defaultSize: WidgetSize) {
  const inst = await addWidget(widgetId, defaultSize);
  setDrawerOpen(false);
  if (inst) {
    // Scroll to the newly added widget
    setTimeout(() => {
      document.getElementById(`widget-${inst.id}`)?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  }
}

function handleDrawerRemove(instanceId: string) {
  removeWidget(instanceId);
}

// ── Size change ──────────────────────────────────────────────────────
function handleSizeChange(instanceId: string, newSize: WidgetSize) {
  updateInstance(instanceId, { size: newSize });
}

// ── Drag and drop ────────────────────────────────────────────────────
let gridDragOver = $state(false);
let isDrawerDragging = $state(false);

// Part A: Drawer → dashboard
function handleGridDragOver(e: DragEvent) {
  if (!e.dataTransfer?.types.includes('application/phavo-widget')) return;
  e.preventDefault();
  e.dataTransfer.dropEffect = 'copy';
  gridDragOver = true;
}

function handleGridDragLeave(e: DragEvent) {
  // Only clear when the cursor leaves the container entirely (not when moving between children)
  const el = e.currentTarget as HTMLElement;
  if (!el.contains(e.relatedTarget as Node | null)) {
    gridDragOver = false;
  }
}

async function handleGridDrop(e: DragEvent) {
  e.preventDefault();
  gridDragOver = false;
  const raw = e.dataTransfer?.getData('application/phavo-widget');
  if (!raw) return;
  try {
    const { widgetId, size } = JSON.parse(raw) as { widgetId: string; size: WidgetSize };
    await handleDrawerAdd(widgetId, size);
  } catch { /* ignore malformed */ }
}

// Part B: Reorder via swap
function handleSwapDrop(targetInstanceId: string, draggedInstanceId: string) {
  swapWidgets(draggedInstanceId, targetInstanceId);
}

/** Sort instances by positionY then positionX for rendering. */
const sortedInstances = $derived(
  [...getWidgetInstances()].sort(
    (a, b) => a.position.y - b.position.y || a.position.x - b.position.x,
  ),
);

// ── Init and polling ─────────────────────────────────────────────────
$effect(() => {
  fetchWidgetManifest();
  loadTabs();
});

$effect(() => {
  if (widgetManifest.length === 0) return;

  // Only fetch data for widgets that are on the current tab
  const instanceWidgetIds = new Set(getWidgetInstances().map((i) => i.widgetId));
  const activeWidgets = widgetManifest.filter(
    (w) => instanceWidgetIds.size === 0 || instanceWidgetIds.has(w.id),
  );

  for (const widget of activeWidgets) {
    fetchWidgetData(widget.id, widget.dataEndpoint);
  }

  const intervals = activeWidgets
    .filter((w) => w.refreshInterval > 0)
    .map((w) =>
      setInterval(() => fetchWidgetData(w.id, w.dataEndpoint, true), w.refreshInterval),
    );

  return () => {
    for (const interval of intervals) clearInterval(interval);
  };
});
</script>

<!-- Tab bar -->
<TabBar
  tabs={getTabs()}
  activeTabId={getCurrentTabId()}
  canAddTab={devMode || getConfig().tier !== 'free'}
  onSelectTab={handleSelectTab}
  onAddTab={handleAddTab}
  onRenameTab={handleRenameTab}
  onDeleteTab={handleDeleteTab}
  addTabLabel={en.dashboard.addTab}
  labels={{
    rename: en.dashboard.renameTab ?? 'Rename',
    delete: en.dashboard.deleteTab ?? 'Delete',
    deleteConfirm: en.dashboard.tabDeleteConfirm,
    tabPlaceholder: en.setup.tabs.addTab ?? 'Tab name',
  }}
/>

{#if showUpgradeBanner && !devMode}
  <div class="upgrade-wrapper">
    <UpgradeBanner feature={en.upgrade.tabLimit} />
  </div>
{/if}

<!-- Full-height dashboard content area, acts as the drop target for drawer drags -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="dashboard-content"
  class:drag-over={gridDragOver}
  class:drawer-dragging={isDrawerDragging}
  ondragover={handleGridDragOver}
  ondragleave={handleGridDragLeave}
  ondrop={handleGridDrop}
>
<!-- Widget grid -->
<div class="widget-grid" role="grid">
  {#each sortedInstances as instance (instance.id)}
    {@const def = getDef(instance.widgetId)}
    {#if def}
      <WidgetCard
        title={def.name}
        size={instance.size}
        loading={widgetLoading[instance.widgetId] ?? true}
        error={widgetErrors[instance.widgetId] ?? null}
        availableSizes={def.sizes}
        instanceId={instance.id}
        draggable={true}
        onSizeChange={(s) => handleSizeChange(instance.id, s)}
        onSwapDrop={(draggedId) => handleSwapDrop(instance.id, draggedId)}
        sizeLabel={en.dashboard.sizeLabel}
      >
        {#if instance.widgetId === 'cpu' && widgetData[instance.widgetId]}
          <CpuWidget data={widgetData[instance.widgetId] as CpuMetrics} />
        {:else if instance.widgetId === 'memory' && widgetData[instance.widgetId]}
          <MemoryWidget data={widgetData[instance.widgetId] as MemoryMetrics} />
        {:else if instance.widgetId === 'disk' && widgetData[instance.widgetId]}
          <DiskWidget data={widgetData[instance.widgetId] as DiskMetrics[]} />
        {:else if instance.widgetId === 'network' && widgetData[instance.widgetId]}
          <NetworkWidget data={widgetData[instance.widgetId] as NetworkMetrics} />
        {:else if instance.widgetId === 'temperature' && widgetData[instance.widgetId]}
          <TemperatureWidget data={widgetData[instance.widgetId] as TemperatureMetrics} />
        {:else if instance.widgetId === 'uptime' && widgetData[instance.widgetId]}
          <UptimeWidget data={widgetData[instance.widgetId] as UptimeMetrics} />
        {:else if instance.widgetId === 'weather' && widgetData[instance.widgetId]}
          <WeatherWidget data={widgetData[instance.widgetId] as WeatherMetrics} />
        {:else if instance.widgetId === 'pihole' && widgetData[instance.widgetId]}
          <PiholeWidget data={widgetData[instance.widgetId] as PiholeMetrics} />
        {:else if instance.widgetId === 'rss' && widgetData[instance.widgetId]}
          <RssWidget data={widgetData[instance.widgetId] as RssFeedResult} />
        {:else if instance.widgetId === 'links' && widgetData[instance.widgetId]}
          <LinksWidget data={widgetData[instance.widgetId] as { label: string; url: string; category?: string }[]} />
        {:else if widgetData[instance.widgetId]}
          <div class="widget-data mono">
            <pre>{JSON.stringify(widgetData[instance.widgetId], null, 2)}</pre>
          </div>
        {:else}
          <span class="no-data">{en.common.noData}</span>
        {/if}
      </WidgetCard>
    {/if}
  {/each}
</div>
</div>

<!-- Widget drawer (triggered from Header's "+" button) -->
<WidgetDrawer
  open={getIsDrawerOpen()}
  widgets={widgetManifest}
  instances={getWidgetInstances()}
  tier={devMode ? 'standard' : getConfig().tier}
  onClose={() => setDrawerOpen(false)}
  onAdd={handleDrawerAdd}
  onRemove={handleDrawerRemove}
  onDragStartFromDrawer={() => (isDrawerDragging = true)}
  onDragEndFromDrawer={() => (isDrawerDragging = false)}
  labels={{
    title: en.dashboard.addWidgets,
    subtitle: en.dashboard.dragToPlace,
    addToBoard: en.dashboard.addToBoard,
    filterAll: en.dashboard.filterAll,
    filterSystem: en.dashboard.filterSystem,
    filterConsumer: en.dashboard.filterConsumer,
    filterIntegration: en.dashboard.filterIntegration,
    alreadyAdded: en.dashboard.alreadyAdded,
    remove: en.dashboard.remove,
    removeConfirm: en.dashboard.removeConfirm,
    locked: en.dashboard.locked,
  }}
>
  {#snippet preview(widgetId: string)}
    {#if widgetId === 'cpu' && widgetData[widgetId]}
      <CpuWidget data={widgetData[widgetId] as CpuMetrics} />
    {:else if widgetId === 'memory' && widgetData[widgetId]}
      <MemoryWidget data={widgetData[widgetId] as MemoryMetrics} />
    {:else if widgetId === 'disk' && widgetData[widgetId]}
      <DiskWidget data={widgetData[widgetId] as DiskMetrics[]} />
    {:else if widgetId === 'network' && widgetData[widgetId]}
      <NetworkWidget data={widgetData[widgetId] as NetworkMetrics} />
    {:else if widgetId === 'temperature' && widgetData[widgetId]}
      <TemperatureWidget data={widgetData[widgetId] as TemperatureMetrics} />
    {:else if widgetId === 'uptime' && widgetData[widgetId]}
      <UptimeWidget data={widgetData[widgetId] as UptimeMetrics} />
    {:else if widgetId === 'weather' && widgetData[widgetId]}
      <WeatherWidget data={widgetData[widgetId] as WeatherMetrics} />
    {:else if widgetId === 'pihole' && widgetData[widgetId]}
      <PiholeWidget data={widgetData[widgetId] as PiholeMetrics} />
    {:else if widgetId === 'rss' && widgetData[widgetId]}
      <RssWidget data={widgetData[widgetId] as RssFeedResult} />
    {:else if widgetId === 'links' && widgetData[widgetId]}
      <LinksWidget data={widgetData[widgetId] as { label: string; url: string; category?: string }[]} />
    {:else}
      <div class="preview-loading">
        <span class="preview-loading-text">{getDef(widgetId)?.name ?? widgetId}</span>
      </div>
    {/if}
  {/snippet}
</WidgetDrawer>

<style>
  /* Full-height drop zone — fills all remaining viewport height */
  .dashboard-content {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    border: 2px dashed transparent;
    border-radius: var(--radius-sm, 4px);
    transition: border-color 0.15s, background 0.15s;
  }

  .drag-over {
    border-color: var(--color-accent);
  }

  .drawer-dragging {
    background: color-mix(in srgb, var(--color-accent) 5%, transparent);
  }

  .widget-grid {
    display: grid;
    grid-template-columns: repeat(12, 1fr);
    gap: var(--grid-gap);
    padding: var(--space-6);
  }

  .widget-data {
    font-size: 12px;
    overflow: auto;
  }

  .widget-data pre {
    white-space: pre-wrap;
    word-break: break-all;
  }

  .no-data {
    color: var(--color-text-muted);
    font-style: italic;
  }

  .preview-loading {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: var(--color-text-muted);
  }

  .preview-loading-text {
    font-size: 0.85rem;
    opacity: 0.5;
  }

  .upgrade-wrapper {
    padding: 0 var(--space-6);
    margin-top: var(--space-3);
  }

  @media (max-width: 768px) {
    .widget-grid {
      grid-template-columns: repeat(6, 1fr);
      padding: var(--space-3);
    }
  }

  @media (max-width: 480px) {
    .widget-grid {
      grid-template-columns: repeat(4, 1fr);
    }
  }
</style>
