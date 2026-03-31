<script lang="ts">
import { onMount } from 'svelte';
import {
  type CalendarMetrics,
  type CpuMetrics,
  type DiskMetrics,
  type DockerMetrics,
  isWidgetDefinition,
  isWidgetTeaserDefinition,
  type MemoryMetrics,
  type NetworkMetrics,
  type PiholeMetrics,
  type RssFeedResult,
  type ServiceHealthMetrics,
  type SpeedtestMetrics,
  type TemperatureMetrics,
  type UptimeMetrics,
  type WeatherMetrics,
  type WidgetDefinition,
  type WidgetManifestEntry,
  type WidgetSize,
} from '@phavo/types';
import { BentoGrid, Button, Icon, Modal, WidgetCard, TabBar, WidgetDrawer } from '@phavo/ui';
import en from '$lib/i18n/en.json';
import { getConfig, updateConfig } from '$lib/stores/config.svelte';
import { getSession } from '$lib/stores/session.svelte';
import { relativeTime } from '$lib/utils/time';
import { fetchWithCsrf } from '$lib/utils/api';
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
import CalendarWidget from '$lib/widgets/CalendarWidget.svelte';
import CpuWidget from '$lib/widgets/CpuWidget.svelte';
import DiskWidget from '$lib/widgets/DiskWidget.svelte';
import DockerWidget from '$lib/widgets/DockerWidget.svelte';
import LinksWidget from '$lib/widgets/LinksWidget.svelte';
import MemoryWidget from '$lib/widgets/MemoryWidget.svelte';
import NetworkWidget from '$lib/widgets/NetworkWidget.svelte';
import PiholeWidget from '$lib/widgets/PiholeWidget.svelte';
import RssWidget from '$lib/widgets/RssWidget.svelte';
import ServiceHealthWidget from '$lib/widgets/ServiceHealthWidget.svelte';
import SpeedtestWidget from '$lib/widgets/SpeedtestWidget.svelte';
import TemperatureWidget from '$lib/widgets/TemperatureWidget.svelte';
import UptimeWidget from '$lib/widgets/UptimeWidget.svelte';
import WeatherWidget from '$lib/widgets/WeatherWidget.svelte';

let showUpgradeBanner = $state(false);
let upgradeBannerMessage = $state('');
let hideUpgradeBannerTimeout: ReturnType<typeof setTimeout> | null = null;

// ── Telemetry opt-in modal ───────────────────────────────────────────
let telemetryOpen = $state(false);

const config = $derived(getConfig());
const session = $derived(getSession());

// Show telemetry modal once after setup completes (non-local tiers only)
$effect(() => {
  if (
    config.setupComplete &&
    !config.telemetryAsked &&
    session?.tier !== 'local'
  ) {
    telemetryOpen = true;
  }
});

async function handleTelemetryChoice(enabled: boolean) {
  telemetryOpen = false;
  updateConfig({ telemetryAsked: true, telemetryEnabled: enabled });
  await fetchWithCsrf('/api/v1/config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ telemetryAsked: true, telemetryEnabled: enabled }),
  });
}

// ── Helpers ──────────────────────────────────────────────────────────
function getDef(widgetId: string): WidgetDefinition | undefined {
  const entry = getWidgetManifest().find((w) => w.id === widgetId);
  return entry && isWidgetDefinition(entry) ? entry : undefined;
}

/** Compute grid colSpan for a widget instance. CPU is always hero (8). */
function colSpanFor(widgetId: string, size: WidgetSize): number {
  if (widgetId === 'cpu') return 8;
  if (size === 'XL') return 12;
  if (size === 'L') return 8;
  return 4;
}

// ── Tab handlers ─────────────────────────────────────────────────────
function handleSelectTab(id: string) {
  setActiveTab(id);
}

const sessionTier = $derived(session?.tier ?? 'free');
const freeTabLimitReached = $derived(sessionTier === 'free' && getTabs().length >= 1);

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
    showUpgradePrompt('Upgrade to Standard to add unlimited tabs — €8.99 one-time');
    return;
  }

  const result = await createTab(label);
  if (!result.ok && result.error === 'Tab limit reached — upgrade to Standard') {
    showUpgradePrompt('Upgrade to Standard to add unlimited tabs — €8.99 one-time');
  }
}

function handleLockedAddTab() {
  if (!freeTabLimitReached) return;
  showUpgradePrompt('Upgrade to Standard to add unlimited tabs — €8.99 one-time');
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
    setTimeout(() => {
      document.getElementById(`widget-${inst.id}`)?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  }
}

function handleDrawerRemove(instanceId: string) {
  removeWidget(instanceId);
}

async function handleWidgetRemove(instanceId: string) {
  await removeWidget(instanceId);
}

// ── Size change ──────────────────────────────────────────────────────
function handleSizeChange(instanceId: string, newSize: WidgetSize) {
  updateInstance(instanceId, { size: newSize });
}

// ── Drag and drop ────────────────────────────────────────────────────
let gridDragOver = $state(false);
let isDrawerDragging = $state(false);

function handleGridDragOver(e: DragEvent) {
  if (!e.dataTransfer?.types.includes('application/phavo-widget')) return;
  e.preventDefault();
  e.dataTransfer.dropEffect = 'copy';
  gridDragOver = true;
}

function handleGridDragLeave(e: DragEvent) {
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

function handleSwapDrop(targetInstanceId: string, draggedInstanceId: string) {
  swapWidgets(draggedInstanceId, targetInstanceId);
}

const sortedInstances = $derived(
  [...getWidgetInstances()].sort(
    (a, b) => a.position.y - b.position.y || a.position.x - b.position.x,
  ),
);

// ── Init ─────────────────────────────────────────────────────────────
onMount(() => {
  $effect.root(() => {
    $effect(() => {
      loadWidgetManifest();
      loadTabs();
    });
  });
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

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="dashboard-content"
  class:drag-over={gridDragOver}
  class:drawer-dragging={isDrawerDragging}
  ondragover={handleGridDragOver}
  ondragleave={handleGridDragLeave}
  ondrop={handleGridDrop}
>
<div class="grid-wrapper">
  <BentoGrid>
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
          colSpan={colSpanFor(instance.widgetId, instance.size)}
          loading={state === 'loading'}
          error={null}
          availableSizes={def.sizes}
          instanceId={instance.id}
          draggable={true}
          onSizeChange={(s) => handleSizeChange(instance.id, s)}
          onSwapDrop={(draggedId) => handleSwapDrop(instance.id, draggedId)}
          onRemove={handleWidgetRemove}
          removeConfirmLabel={en.dashboard.removeConfirm}
          removeCancelLabel={en.common.cancel}
          removeActionLabel={en.dashboard.remove}
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
              <CpuWidget data={data as CpuMetrics} size={instance.size} />
            {:else if instance.widgetId === 'memory' && data}
              <MemoryWidget data={data as MemoryMetrics} size={instance.size} />
            {:else if instance.widgetId === 'disk' && data}
              <DiskWidget data={data as DiskMetrics[]} size={instance.size} />
            {:else if instance.widgetId === 'network' && data}
              <NetworkWidget data={data as NetworkMetrics} size={instance.size} />
            {:else if instance.widgetId === 'temperature' && data}
              <TemperatureWidget data={data as TemperatureMetrics} size={instance.size} />
            {:else if instance.widgetId === 'uptime' && data}
              <UptimeWidget data={data as UptimeMetrics} size={instance.size} />
            {:else if instance.widgetId === 'weather' && data}
              <WeatherWidget data={data as WeatherMetrics} size={instance.size} />
            {:else if instance.widgetId === 'pihole' && data}
              <PiholeWidget data={data as PiholeMetrics} size={instance.size} />
            {:else if instance.widgetId === 'rss' && data}
              <RssWidget data={data as RssFeedResult} size={instance.size} />
            {:else if instance.widgetId === 'links' && data}
              <LinksWidget data={data as { groups: { label: string; links: { title: string; url: string; icon?: string }[] }[] }} size={instance.size} />
            {:else if instance.widgetId === 'docker' && data}
              <DockerWidget data={data as DockerMetrics} size={instance.size} />
            {:else if instance.widgetId === 'service-health' && data}
              <ServiceHealthWidget data={data as ServiceHealthMetrics} size={instance.size} />
            {:else if instance.widgetId === 'speedtest' && data}
              <SpeedtestWidget data={data as SpeedtestMetrics} size={instance.size} />
            {:else if instance.widgetId === 'calendar' && data}
              <CalendarWidget data={data as CalendarMetrics} size={instance.size} />
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
  </BentoGrid>
</div>
</div>

<!-- Widget drawer -->
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
  {#snippet preview(widgetId: string, data: unknown, loading: boolean, hasError: boolean)}
    {@const def = getDef(widgetId)}
    <WidgetCard
      title={def?.name ?? widgetId}
      size={def?.defaultSize?.w && def.defaultSize.w >= 6 ? 'L' : 'M'}
      {loading}
      error={null}
    >
      {#if hasError || !data}
        <div class="preview-loading">
          <span class="preview-loading-text">{def?.name ?? widgetId}</span>
        </div>
      {:else if widgetId === 'cpu'}
        <CpuWidget data={data as CpuMetrics} size="M" />
      {:else if widgetId === 'memory'}
        <MemoryWidget data={data as MemoryMetrics} size="M" />
      {:else if widgetId === 'disk'}
        <DiskWidget data={data as DiskMetrics[]} size="M" />
      {:else if widgetId === 'network'}
        <NetworkWidget data={data as NetworkMetrics} size="M" />
      {:else if widgetId === 'temperature'}
        <TemperatureWidget data={data as TemperatureMetrics} size="M" />
      {:else if widgetId === 'uptime'}
        <UptimeWidget data={data as UptimeMetrics} size="M" />
      {:else if widgetId === 'weather'}
        <WeatherWidget data={data as WeatherMetrics} size="M" />
      {:else if widgetId === 'pihole'}
        <PiholeWidget data={data as PiholeMetrics} size="M" />
      {:else if widgetId === 'rss'}
        <RssWidget data={data as RssFeedResult} size="M" />
      {:else if widgetId === 'links'}
        <LinksWidget data={data as { groups: { label: string; links: { title: string; url: string; icon?: string }[] }[] }} size="M" />
      {:else if widgetId === 'docker'}
        <DockerWidget data={data as DockerMetrics} size="M" />
      {:else if widgetId === 'service-health'}
        <ServiceHealthWidget data={data as ServiceHealthMetrics} size="M" />
      {:else if widgetId === 'speedtest'}
        <SpeedtestWidget data={data as SpeedtestMetrics} size="M" />
      {:else if widgetId === 'calendar'}
        <CalendarWidget data={data as CalendarMetrics} size="M" />
      {:else}
        <div class="preview-loading">
          <span class="preview-loading-text">{def?.name ?? widgetId}</span>
        </div>
      {/if}
    </WidgetCard>
  {/snippet}
</WidgetDrawer>

<!-- Telemetry opt-in modal -->
<Modal bind:open={telemetryOpen}>
  <div class="telemetry-modal">
    <Icon name="bar-chart-3" size={32} class="text-accent" />
    <h2 class="telemetry-title">Help improve Phavo</h2>
    <p class="telemetry-body">
      Share anonymous usage data so we can prioritize features and fix bugs faster.
      No personal information is collected. You can change this anytime in Settings.
    </p>
    <div class="telemetry-actions">
      <Button variant="secondary" onclick={() => handleTelemetryChoice(false)}>No thanks</Button>
      <Button variant="primary" onclick={() => handleTelemetryChoice(true)}>Enable telemetry</Button>
    </div>
  </div>
</Modal>

<style>
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

  .grid-wrapper {
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

  /* Telemetry modal */
  .telemetry-modal {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-4);
    text-align: center;
    padding: var(--space-4);
  }

  .telemetry-title {
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--color-text-primary);
    margin: 0;
  }

  .telemetry-body {
    font-size: 0.875rem;
    color: var(--color-text-secondary);
    margin: 0;
    max-width: 36ch;
    line-height: 1.5;
  }

  .telemetry-actions {
    display: flex;
    gap: var(--space-3);
    margin-top: var(--space-2);
  }

  @media (max-width: 639px) {
    .grid-wrapper {
      padding: var(--space-3);
    }

    .widget-stale-banner {
      align-items: flex-start;
      flex-direction: column;
      gap: var(--space-1);
    }

    .upgrade-wrapper {
      padding: 0 var(--space-3);
    }
  }
</style>