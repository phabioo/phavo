<script lang="ts">
import {
  isWidgetDefinition,
  type WidgetDefinition,
  type WidgetManifestEntry,
  type WidgetSize,
} from '@phavo/types';
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
import { Button, WidgetCard, TabBar, WidgetDrawer } from '@phavo/ui';
import en from '$lib/i18n/en.json';
import { getConfig } from '$lib/stores/config.svelte';
import { relativeTime } from '$lib/utils/time';
import {
  getTabs,
  getCurrentTabId,
  getWidgetInstances,
  getWidgetManifest,
  getWidgetData,
  getWidgetError,
  getIsDrawerOpen,
  getWidgetLastSuccess,
  getWidgetState,
  getWidgetWarning,
  setDrawerOpen,
  setActiveTab,
  loadTabs,
  loadWidgetManifest,
  createTab,
  updateTab,
  deleteTab,
  addWidget,
  removeWidget,
  retryWidget,
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

let showUpgradeBanner = $state(false);
let upgradeBannerMessage = $state('');
let hideUpgradeBannerTimeout: ReturnType<typeof setTimeout> | null = null;

// Get the WidgetDefinition for a widget id
function getDef(widgetId: string): WidgetDefinition | undefined {
  const entry = getWidgetManifest().find((w) => w.id === widgetId);
  return entry && isWidgetDefinition(entry) ? entry : undefined;
}

// ── Tab handlers ─────────────────────────────────────────────────────
function handleSelectTab(id: string) {
  setActiveTab(id);
}

const configTier = $derived(getConfig().tier);
const freeTabLimitReached = $derived(configTier === 'free' && getTabs().length >= 1);

function showUpgradePrompt(message: string) {
  upgradeBannerMessage = message;
  showUpgradeBanner = true;
  if (hideUpgradeBannerTimeout) clearTimeout(hideUpgradeBannerTimeout);
  hideUpgradeBannerTimeout = setTimeout(() => {
    showUpgradeBanner = false;
    hideUpgradeBannerTimeout = null;
  }, 5000);
}

async function handleAddTab(label: string) {
  if (freeTabLimitReached) {
    showUpgradePrompt('Upgrade to Standard to add unlimited tabs — €7.99 one-time');
    return;
  }

  const result = await createTab(label);
  if (!result.ok && result.error === 'Tab limit reached — upgrade to Standard') {
    showUpgradePrompt('Upgrade to Standard to add unlimited tabs — €7.99 one-time');
  }
}

function handleLockedAddTab() {
  if (!freeTabLimitReached) return;
  showUpgradePrompt('Upgrade to Standard to add unlimited tabs — €7.99 one-time');
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
  loadWidgetManifest();
  loadTabs();
});
</script>

<!-- Tab bar -->
<TabBar
  tabs={getTabs()}
  activeTabId={getCurrentTabId()}
  canAddTab={!freeTabLimitReached}
  onSelectTab={handleSelectTab}
  onAddTab={handleAddTab}
  onLockedAddTab={handleLockedAddTab}
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

{#if showUpgradeBanner}
  <div class="upgrade-wrapper">
    <div class="upgrade-prompt" role="status" aria-live="polite">
      {upgradeBannerMessage}
    </div>
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
    {@const state = getWidgetState(instance.id)}
    {@const data = getWidgetData(instance.widgetId)}
    {@const warning = getWidgetWarning(instance.id)}
    {@const error = getWidgetError(instance.id)}
    {@const lastSuccess = getWidgetLastSuccess(instance.id)}
    {#if def}
      <WidgetCard
        title={def.name}
        size={instance.size}
        loading={state === 'loading'}
        error={null}
        availableSizes={def.sizes}
        instanceId={instance.id}
        draggable={true}
        onSizeChange={(s) => handleSizeChange(instance.id, s)}
        onSwapDrop={(draggedId) => handleSwapDrop(instance.id, draggedId)}
        sizeLabel={en.dashboard.sizeLabel}
      >
        {#if state === 'unconfigured'}
          <div class="widget-state widget-state-warning">
            <p class="widget-state-title">Configuration required</p>
            <p class="widget-state-body">Open Settings and save this widget before it starts polling.</p>
            <a class="widget-state-link" href={`/settings#widgets/${instance.widgetId}`}>Configure</a>
          </div>
        {:else if state === 'error'}
          <div class="widget-state widget-state-error">
            <p class="widget-state-title">Unable to load widget</p>
            <p class="widget-state-body">{error ?? en.errors.generic}</p>
            <Button variant="secondary" size="sm" onclick={() => retryWidget(instance.id)}>
              Retry
            </Button>
          </div>
        {:else}
          {#if state === 'stale' && warning}
            <div class="widget-stale-banner">
              <span>{warning}</span>
              {#if lastSuccess}
                <span>Last success {relativeTime(new Date(lastSuccess))}</span>
              {/if}
            </div>
          {/if}

        {#if instance.widgetId === 'cpu' && data}
          <CpuWidget data={data as CpuMetrics} />
        {:else if instance.widgetId === 'memory' && data}
          <MemoryWidget data={data as MemoryMetrics} />
        {:else if instance.widgetId === 'disk' && data}
          <DiskWidget data={data as DiskMetrics[]} />
        {:else if instance.widgetId === 'network' && data}
          <NetworkWidget data={data as NetworkMetrics} />
        {:else if instance.widgetId === 'temperature' && data}
          <TemperatureWidget data={data as TemperatureMetrics} />
        {:else if instance.widgetId === 'uptime' && data}
          <UptimeWidget data={data as UptimeMetrics} />
        {:else if instance.widgetId === 'weather' && data}
          <WeatherWidget data={data as WeatherMetrics} />
        {:else if instance.widgetId === 'pihole' && data}
          <PiholeWidget data={data as PiholeMetrics} />
        {:else if instance.widgetId === 'rss' && data}
          <RssWidget data={data as RssFeedResult} />
        {:else if instance.widgetId === 'links' && data}
          <LinksWidget data={data as { groups: { label: string; links: { title: string; url: string; icon?: string }[] }[] }} />
        {:else if data}
          <div class="widget-data mono">
            <pre>{JSON.stringify(data, null, 2)}</pre>
          </div>
        {:else}
          <span class="no-data">{en.common.noData}</span>
        {/if}
        {/if}
      </WidgetCard>
    {/if}
  {/each}
</div>
</div>

<!-- Widget drawer (triggered from Header's "+" button) -->
<WidgetDrawer
  open={getIsDrawerOpen()}
  widgets={getWidgetManifest()}
  instances={getWidgetInstances()}
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
    filterUtility: en.dashboard.filterUtility,
    alreadyAdded: en.dashboard.alreadyAdded,
    remove: en.dashboard.remove,
    removeConfirm: en.dashboard.removeConfirm,
    locked: en.dashboard.locked,
    upgradePrompt: en.upgrade.widgetLocked,
  }}
>
  {#snippet preview(widgetId: string)}
    {@const data = getWidgetData(widgetId)}
    {#if widgetId === 'cpu' && data}
      <CpuWidget data={data as CpuMetrics} />
    {:else if widgetId === 'memory' && data}
      <MemoryWidget data={data as MemoryMetrics} />
    {:else if widgetId === 'disk' && data}
      <DiskWidget data={data as DiskMetrics[]} />
    {:else if widgetId === 'network' && data}
      <NetworkWidget data={data as NetworkMetrics} />
    {:else if widgetId === 'temperature' && data}
      <TemperatureWidget data={data as TemperatureMetrics} />
    {:else if widgetId === 'uptime' && data}
      <UptimeWidget data={data as UptimeMetrics} />
    {:else if widgetId === 'weather' && data}
      <WeatherWidget data={data as WeatherMetrics} />
    {:else if widgetId === 'pihole' && data}
      <PiholeWidget data={data as PiholeMetrics} />
    {:else if widgetId === 'rss' && data}
      <RssWidget data={data as RssFeedResult} />
    {:else if widgetId === 'links' && data}
      <LinksWidget data={data as { groups: { label: string; links: { title: string; url: string; icon?: string }[] }[] }} />
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

  .widget-state {
    align-items: flex-start;
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .widget-state-title {
    color: var(--color-text-primary);
    font-size: 0.95rem;
    font-weight: 600;
    margin: 0;
  }

  .widget-state-body {
    color: var(--color-text-secondary);
    margin: 0;
  }

  .widget-state-link {
    color: var(--color-accent-text);
    font-size: 0.875rem;
    font-weight: 600;
    text-decoration: none;
  }

  .widget-state-warning {
    color: var(--color-accent-text);
  }

  .widget-state-error {
    color: var(--color-text-primary);
  }

  .widget-stale-banner {
    align-items: center;
    background: var(--color-warning-subtle);
    border: 1px solid var(--color-warning);
    border-radius: var(--radius-sm);
    color: var(--color-text-primary);
    display: flex;
    font-size: 0.75rem;
    justify-content: space-between;
    margin-bottom: var(--space-3);
    padding: var(--space-2) var(--space-3);
  }

  .upgrade-wrapper {
    padding: 0 var(--space-6);
    margin-top: var(--space-3);
  }

  .upgrade-prompt {
    border: 1px solid var(--color-accent);
    border-radius: var(--radius-md);
    background: var(--color-accent-subtle);
    color: var(--color-accent-text);
    padding: var(--space-4);
    font-size: 0.95rem;
    font-weight: 500;
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

    .widget-stale-banner {
      align-items: flex-start;
      flex-direction: column;
      gap: var(--space-1);
    }
  }
</style>
