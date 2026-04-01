<script lang="ts">
import { onMount } from 'svelte';
import {
  type CalendarMetrics,
  type CpuMetrics,
  type DashboardConfig,
  type DiskMetrics,
  type DockerMetrics,
  isWidgetDefinition,
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
  type WidgetSize,
} from '@phavo/types';
import { BentoGrid, Button, Icon, Modal, WidgetCard, WidgetDrawer } from '@phavo/ui';
import en from '$lib/i18n/en.json';
import { getConfig, updateConfig } from '$lib/stores/config.svelte';
import { getSession } from '$lib/stores/session.svelte';
import { fetchWithCsrf } from '$lib/utils/api';
import { relativeTime } from '$lib/utils/time';
import {
  addWidget,
  getCurrentTabId,
  getIsDrawerOpen,
  getTabs,
  getWidgetData,
  getWidgetError,
  getWidgetInstances,
  getWidgetLastSuccess,
  getWidgetManifest,
  getWidgetState,
  getWidgetWarning,
  removeWidget,
  retryWidget,
  setDrawerOpen,
  swapWidgets,
  updateTab,
  updateInstance,
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

type LinksMetrics = {
  groups: {
    label: string;
    links: { title: string; url: string; icon?: string }[];
  }[];
};

let telemetryOpen = $state(false);
let gridDragOver = $state(false);
let isDrawerDragging = $state(false);
let heroEditor = $state<'title' | 'subtitle' | null>(null);
let heroTitleDraft = $state('');
let heroSubtitleDraft = $state('');
let heroError = $state('');
let heroSaving = $state<'title' | 'subtitle' | null>(null);

const config = $derived(getConfig());
const session = $derived(getSession());

const sessionTierLabel = $derived(
  session?.tier === 'local'
    ? 'Local Edition'
    : session?.tier === 'standard'
      ? 'Standard Edition'
      : 'Free Edition',
);

async function handleTelemetryChoice(enabled: boolean) {
  telemetryOpen = false;
  updateConfig({ telemetryAsked: true, telemetryEnabled: enabled });
  await fetchWithCsrf('/api/v1/config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ telemetryAsked: true, telemetryEnabled: enabled }),
  });
}

function getDef(widgetId: string): WidgetDefinition | undefined {
  const entry = getWidgetManifest().find((widget) => widget.id === widgetId);
  return entry && isWidgetDefinition(entry) ? entry : undefined;
}

function colSpanFor(widgetId: string, size: WidgetSize): number {
  if (widgetId === 'cpu') return 8;
  if (size === 'XL') return 12;
  if (size === 'L') return 8;
  return 4;
}

const widgetHeadings: Record<string, { title: string; subtitle: string; icon: string }> = {
  cpu: { title: 'CPU Utilization', subtitle: 'Processor Unit', icon: 'cpu' },
  memory: { title: 'Memory Usage', subtitle: 'Memory', icon: 'memory-stick' },
  disk: { title: 'Storage Overview', subtitle: 'Storage', icon: 'database' },
  network: { title: 'Network Activity', subtitle: 'Network', icon: 'globe' },
  temperature: { title: 'Thermal Status', subtitle: 'Temperature', icon: 'thermometer' },
  uptime: { title: 'System Uptime', subtitle: 'System', icon: 'clock-3' },
  weather: { title: 'Current Weather', subtitle: 'Environment', icon: 'cloud-sun' },
  pihole: { title: 'DNS Filtering', subtitle: 'Pi-hole', icon: 'shield' },
  rss: { title: 'News Feed', subtitle: 'RSS', icon: 'rss' },
  links: { title: 'Bookmarks', subtitle: 'Quick Access', icon: 'bookmark' },
  docker: { title: 'Containers', subtitle: 'Docker', icon: 'box' },
  'service-health': { title: 'Service Health', subtitle: 'Monitoring', icon: 'activity' },
  speedtest: { title: 'Network Benchmark', subtitle: 'Speedtest', icon: 'gauge' },
  calendar: { title: 'Calendar', subtitle: 'Schedule', icon: 'calendar-days' },
};

function widgetHeadingFor(widgetId: string, def: WidgetDefinition): {
  title: string;
  subtitle: string;
  icon: string;
} {
  const preset = widgetHeadings[widgetId];
  if (preset) return preset;

  return {
    title: def.name,
    subtitle: def.category.replace('-', ' '),
    icon: 'layout-grid',
  };
}

async function handleDrawerAdd(widgetId: string, defaultSize: WidgetSize) {
  const instance = await addWidget(widgetId, defaultSize);
  setDrawerOpen(false);

  if (instance) {
    setTimeout(() => {
      document.getElementById(`widget-${instance.id}`)?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  }
}

function handleDrawerRemove(instanceId: string) {
  removeWidget(instanceId);
}

async function handleWidgetRemove(instanceId: string) {
  await removeWidget(instanceId);
}

function handleSizeChange(instanceId: string, newSize: WidgetSize) {
  updateInstance(instanceId, { size: newSize });
}

function handleGridDragOver(event: DragEvent) {
  if (!event.dataTransfer?.types.includes('application/phavo-widget')) return;
  event.preventDefault();
  event.dataTransfer.dropEffect = 'copy';
  gridDragOver = true;
}

function handleGridDragLeave(event: DragEvent) {
  const element = event.currentTarget as HTMLElement;
  if (!element.contains(event.relatedTarget as Node | null)) {
    gridDragOver = false;
  }
}

async function handleGridDrop(event: DragEvent) {
  event.preventDefault();
  gridDragOver = false;

  const raw = event.dataTransfer?.getData('application/phavo-widget');
  if (!raw) return;

  try {
    const { widgetId, size } = JSON.parse(raw) as { widgetId: string; size: WidgetSize };
    await handleDrawerAdd(widgetId, size);
  } catch {
    // Ignore malformed drag payloads.
  }
}

function handleSwapDrop(targetInstanceId: string, draggedInstanceId: string) {
  swapWidgets(draggedInstanceId, targetInstanceId);
}

const sortedInstances = $derived(
  [...getWidgetInstances()].sort(
    (left, right) => left.position.y - right.position.y || left.position.x - right.position.x,
  ),
);

const activePage = $derived(getTabs().find((tab) => tab.id === getCurrentTabId()) ?? getTabs()[0]);

const dashboardSubtitle = $derived(
  config.dashboardSubtitle?.trim() || 'System overview & performance',
);

const configuredWidgetCount = $derived(
  sortedInstances.filter((instance) => getWidgetState(instance.id) !== 'unconfigured').length,
);

function openHeroEditor(field: 'title' | 'subtitle') {
  heroError = '';
  heroEditor = field;

  if (field === 'title') {
    heroTitleDraft = activePage?.label ?? 'Home';
    return;
  }

  heroSubtitleDraft = dashboardSubtitle;
}

function closeHeroEditor() {
  heroEditor = null;
  heroError = '';
  heroSaving = null;
}

async function saveHeroTitle() {
  if (!activePage) {
    closeHeroEditor();
    return;
  }

  const nextTitle = heroTitleDraft.trim() || 'Home';
  heroSaving = 'title';
  heroError = '';

  const result = await updateTab(activePage.id, { label: nextTitle });
  if (!result.ok) {
    heroError = result.error ?? 'Unable to rename page';
    heroSaving = null;
    return;
  }

  closeHeroEditor();
}

async function saveHeroSubtitle() {
  const nextSubtitle = heroSubtitleDraft.trim() || 'System overview & performance';
  heroSaving = 'subtitle';
  heroError = '';

  try {
    const response = await fetchWithCsrf('/api/v1/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dashboardSubtitle: nextSubtitle }),
    });
    const payload = (await response.json()) as {
      ok: boolean;
      data?: DashboardConfig;
      error?: string;
    };

    if (!payload.ok || !payload.data) {
      throw new Error(payload.error ?? 'Unable to update page subtitle');
    }

    updateConfig(payload.data);
    closeHeroEditor();
  } catch (error) {
    heroError = error instanceof Error ? error.message : 'Unable to update page subtitle';
    heroSaving = null;
  }
}

onMount(() => {
  return $effect.root(() => {
    $effect(() => {
      if (
        config.setupComplete &&
        !config.telemetryAsked &&
        session?.tier !== 'local'
      ) {
        telemetryOpen = true;
      }
    });
  });
});
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="dashboard-content"
  class:drag-over={gridDragOver}
  class:drawer-dragging={isDrawerDragging}
  ondragover={handleGridDragOver}
  ondragleave={handleGridDragLeave}
  ondrop={handleGridDrop}
>
  <div class="grid-shell">
    <section class="dashboard-hero">
      <div class="hero-copy">
        {#if heroEditor === 'title'}
          <form
            class="hero-editor"
            onsubmit={(event) => {
              event.preventDefault();
              void saveHeroTitle();
            }}
          >
            <label class="hero-label" for="dashboard-page-title">Page name</label>
            <input
              id="dashboard-page-title"
              class="hero-input hero-input-title"
              bind:value={heroTitleDraft}
              maxlength="100"
              autofocus
            />
            <div class="hero-editor-actions">
              <Button
                variant="secondary"
                size="sm"
                type="button"
                disabled={heroSaving === 'title'}
                onclick={closeHeroEditor}
              >
                Cancel
              </Button>
              <Button size="sm" type="submit" disabled={heroSaving === 'title'}>
                {heroSaving === 'title' ? 'Saving…' : 'Save'}
              </Button>
            </div>
          </form>
        {:else}
          <button class="hero-editable hero-title" onclick={() => openHeroEditor('title')}>
            <span>{activePage?.label ?? 'Home'}</span>
            <span class="hero-edit-icon" aria-hidden="true">
              <Icon name="pencil-line" size={18} />
            </span>
          </button>
        {/if}

        {#if heroEditor === 'subtitle'}
          <form
            class="hero-editor hero-editor-subtitle"
            onsubmit={(event) => {
              event.preventDefault();
              void saveHeroSubtitle();
            }}
          >
            <label class="hero-label" for="dashboard-page-subtitle">Page subtitle</label>
            <input
              id="dashboard-page-subtitle"
              class="hero-input hero-input-subtitle"
              bind:value={heroSubtitleDraft}
              maxlength="120"
              autofocus
            />
            <div class="hero-editor-actions">
              <Button
                variant="secondary"
                size="sm"
                type="button"
                disabled={heroSaving === 'subtitle'}
                onclick={closeHeroEditor}
              >
                Cancel
              </Button>
              <Button size="sm" type="submit" disabled={heroSaving === 'subtitle'}>
                {heroSaving === 'subtitle' ? 'Saving…' : 'Save'}
              </Button>
            </div>
          </form>
        {:else}
          <button class="hero-editable hero-subtitle" onclick={() => openHeroEditor('subtitle')}>
            <span>{dashboardSubtitle}</span>
            <span class="hero-edit-icon" aria-hidden="true">
              <Icon name="pencil-line" size={14} />
            </span>
          </button>
        {/if}

        {#if heroError}
          <p class="hero-error">{heroError}</p>
        {/if}
      </div>

      <div class="hero-meta-strip" aria-label="Dashboard summary">
        <span class="meta-item"><span class="meta-value">{getTabs().length}</span> Pages</span>
        <span class="meta-sep" aria-hidden="true">·</span>
        <span class="meta-item"><span class="meta-value">{sortedInstances.length}</span> Widgets</span>
        <span class="meta-sep" aria-hidden="true">·</span>
        <span class="meta-item"><span class="meta-value">{configuredWidgetCount}</span> Ready</span>
        <span class="meta-sep" aria-hidden="true">·</span>
        <span class="meta-item meta-edition">{sessionTierLabel}</span>
      </div>
    </section>

    {#if sortedInstances.length === 0}
      <section class="dashboard-empty">
        <div class="empty-icon">
          <Icon name="layout-dashboard" size={20} />
        </div>
        <div class="empty-copy">
          <h2>Build your dashboard</h2>
          <p>Add a widget to start shaping this page.</p>
        </div>
        <Button onclick={() => setDrawerOpen(true)}>{en.dashboard.addWidget}</Button>
      </section>
    {:else}
      <section class="dashboard-stage">
        <BentoGrid class="dashboard-grid" gap="1.75rem">
          {#each sortedInstances as instance (instance.id)}
            {@const def = getDef(instance.widgetId)}
            {@const state = getWidgetState(instance.id)}
            {@const data = getWidgetData(instance.widgetId)}
            {@const warning = getWidgetWarning(instance.id)}
            {@const error = getWidgetError(instance.id)}
            {@const lastSuccess = getWidgetLastSuccess(instance.id)}
            {#if def}
              {@const heading = widgetHeadingFor(instance.widgetId, def)}
              <WidgetCard
                status={state}
                title={heading.title}
                subtitle={heading.subtitle}
                icon={heading.icon}
                size={instance.size}
                colSpan={colSpanFor(instance.widgetId, instance.size)}
                loading={state === 'loading'}
                error={null}
                availableSizes={def.sizes}
                instanceId={instance.id}
                draggable={true}
                onSizeChange={(size) => handleSizeChange(instance.id, size)}
                onSwapDrop={(draggedId) => handleSwapDrop(instance.id, draggedId)}
                onRemove={handleWidgetRemove}
                removeConfirmLabel={en.dashboard.removeConfirm}
                removeCancelLabel={en.common.cancel}
                removeActionLabel={en.dashboard.remove}
                sizeLabel={en.dashboard.sizeLabel}
              >
                {#if state === 'unconfigured'}
                  <div class="widget-state widget-state-warning">
                    <p class="widget-state-kicker">Widget Setup</p>
                    <p class="widget-state-title">Configuration required</p>
                    <p class="widget-state-body">
                      Save this widget in Settings before it begins polling.
                    </p>
                    <a class="widget-state-link" href={`/settings#widgets/${instance.widgetId}`}>
                      Open widget settings
                    </a>
                  </div>
                {:else if state === 'error'}
                  <div class="widget-state widget-state-error">
                    <p class="widget-state-kicker">Widget Status</p>
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
                    <LinksWidget data={data as LinksMetrics} size={instance.size} />
                  {:else if instance.widgetId === 'docker' && data}
                    <DockerWidget data={data as DockerMetrics} size={instance.size} />
                  {:else if instance.widgetId === 'service-health' && data}
                    <ServiceHealthWidget data={data as ServiceHealthMetrics} size={instance.size} />
                  {:else if instance.widgetId === 'speedtest' && data}
                    <SpeedtestWidget data={data as SpeedtestMetrics} size={instance.size} />
                  {:else if instance.widgetId === 'calendar' && data}
                    <CalendarWidget data={data as CalendarMetrics} size={instance.size} />
                  {:else if data}
                    <div class="widget-state widget-state-muted">
                      <p class="widget-state-kicker">Widget View</p>
                      <p class="widget-state-title">Dashboard view unavailable</p>
                      <p class="widget-state-body">
                        This widget is ready, but its dashboard presentation still needs a PHAVO-native view.
                      </p>
                    </div>
                  {:else}
                    <div class="widget-state widget-state-muted">
                      <p class="widget-state-kicker">Widget Status</p>
                      <p class="widget-state-title">Waiting for data</p>
                      <p class="widget-state-body">
                        Content will appear here after the next successful refresh finishes.
                      </p>
                    </div>
                  {/if}
                {/if}
              </WidgetCard>
            {/if}
          {/each}
        </BentoGrid>
      </section>
    {/if}

    <footer class="dashboard-footer">
      <div class="footer-brandline">
        <span class="footer-kicker">Powered by</span>
        <span class="footer-brand">PHAVO</span>
      </div>
      <div class="footer-meta">
        <span class="footer-edition">{sessionTierLabel}</span>
        <span class="footer-version">Version {PHAVO_VERSION}</span>
      </div>
    </footer>
  </div>
</div>

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
    subtitle: 'Browse widgets, drag them into place, or add them directly',
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
/>

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
  }

  .drag-over {
    background: color-mix(in srgb, var(--color-accent-t) 40%, transparent);
  }

  .drawer-dragging {
    background: color-mix(in srgb, var(--color-accent-t) 55%, transparent);
  }

  .grid-shell {
    width: 100%;
    padding: 0 var(--space-8) var(--space-10);
  }

  .dashboard-hero {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    margin-bottom: var(--space-8);
  }

  .hero-copy {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    min-width: 0;
  }

  .hero-editable {
    display: inline-flex;
    align-items: center;
    gap: var(--space-3);
    width: fit-content;
    max-width: 100%;
    padding: 0;
    background: none;
    border: none;
    color: inherit;
    cursor: pointer;
    text-align: left;
  }

  .hero-title {
    font-size: clamp(2.5rem, 6vw, 3.6rem);
    font-weight: 800;
    letter-spacing: -0.05em;
    line-height: 0.96;
    color: var(--color-text-primary);
  }

  .hero-subtitle {
    font-size: 0.78rem;
    font-weight: 700;
    letter-spacing: 0.24em;
    text-transform: uppercase;
    color: var(--color-text-muted);
  }

  .hero-edit-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: var(--color-accent-text);
    opacity: 0;
    transition: opacity 0.2s ease;
    flex-shrink: 0;
  }

  .hero-editable:hover .hero-edit-icon,
  .hero-editable:focus-visible .hero-edit-icon {
    opacity: 1;
  }

  .hero-editor {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    max-width: min(40rem, 100%);
  }

  .hero-editor-subtitle {
    max-width: min(36rem, 100%);
  }

  .hero-label {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: var(--color-text-muted);
  }

  .hero-input {
    width: 100%;
    padding: var(--space-3) var(--space-4);
    border-radius: var(--radius-xl);
    border: 1px solid color-mix(in srgb, var(--color-accent) 24%, var(--color-border));
    background: color-mix(in srgb, var(--color-bg-elevated) 92%, transparent);
    color: var(--color-text-primary);
    font-family: var(--font-ui);
    outline: none;
  }

  .hero-input:focus {
    border-color: color-mix(in srgb, var(--color-accent) 48%, transparent);
    box-shadow: 0 0 0 1px color-mix(in srgb, var(--color-accent) 24%, transparent);
  }

  .hero-input-title {
    font-size: clamp(2rem, 5vw, 3.2rem);
    font-weight: 800;
    letter-spacing: -0.05em;
    line-height: 1;
  }

  .hero-input-subtitle {
    font-size: 0.85rem;
    font-weight: 700;
    letter-spacing: 0.18em;
    text-transform: uppercase;
  }

  .hero-editor-actions {
    display: flex;
    align-items: center;
    gap: var(--space-3);
  }

  .hero-error {
    font-size: 0.85rem;
    color: var(--color-danger);
    margin: 0;
  }

  .hero-meta-strip {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    flex-wrap: wrap;
  }

  .meta-item {
    font-size: 0.75rem;
    font-weight: 600;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--color-text-muted);
  }

  .meta-value {
    color: var(--color-text-secondary);
    font-family: var(--font-mono);
    font-weight: 700;
  }

  .meta-sep {
    color: var(--color-text-muted);
    opacity: 0.4;
    font-size: 0.85rem;
  }

  .meta-edition {
    color: var(--color-accent-text);
    font-weight: 700;
  }

  .dashboard-stage {
    width: 100%;
  }

  .dashboard-empty {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-6);
    padding: var(--space-8);
    border: 1px solid var(--color-border-subtle);
    border-radius: 28px;
    background: color-mix(in srgb, var(--color-bg-elevated) 92%, transparent);
    box-shadow: var(--shadow-md);
  }

  .empty-icon {
    width: 48px;
    height: 48px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 999px;
    background: var(--color-accent-t);
    color: var(--color-accent-text);
    flex-shrink: 0;
  }

  .empty-copy {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: var(--space-1);
  }

  .empty-copy h2 {
    font-size: 1.25rem;
    font-weight: 700;
    letter-spacing: -0.02em;
    margin: 0;
  }

  .empty-copy p {
    color: var(--color-text-secondary);
    margin: 0;
  }

  .widget-state {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-3);
  }

  .widget-state-kicker {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: var(--color-text-muted);
    margin: 0;
  }

  .widget-state-title {
    color: var(--color-text-primary);
    font-size: 1rem;
    font-weight: 700;
    letter-spacing: -0.02em;
    margin: 0;
  }

  .widget-state-body {
    color: var(--color-text-secondary);
    margin: 0;
    max-width: 40ch;
  }

  .widget-state-link {
    color: var(--color-accent-text);
    font-size: 0.875rem;
    font-weight: 600;
    text-decoration: none;
  }

  .widget-state-link:hover {
    text-decoration: underline;
  }

  .widget-state-warning .widget-state-kicker,
  .widget-state-warning .widget-state-link {
    color: var(--color-accent-text);
  }

  .widget-state-error .widget-state-kicker {
    color: var(--color-danger);
  }

  .widget-state-muted .widget-state-kicker {
    color: var(--color-text-muted);
  }

  .widget-stale-banner {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
    margin-bottom: var(--space-4);
    padding: var(--space-2) var(--space-3);
    border: 1px solid color-mix(in srgb, var(--color-warning) 30%, transparent);
    border-radius: var(--radius-md);
    background: var(--color-warning-subtle);
    color: var(--color-text-primary);
    font-size: 0.75rem;
  }

  .dashboard-footer {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-3);
    margin-top: var(--space-10);
    padding-top: var(--space-8);
    border-top: 1px solid var(--color-border-subtle);
    text-align: center;
  }

  .footer-brandline {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
  }

  .footer-kicker {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: var(--color-text-muted);
  }

  .footer-brand {
    font-size: 0.95rem;
    font-weight: 800;
    letter-spacing: -0.04em;
    color: var(--color-accent-text);
  }

  .footer-meta {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .footer-edition,
  .footer-version {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.16em;
    text-transform: uppercase;
  }

  .footer-edition {
    color: var(--color-text-muted);
  }

  .footer-version {
    color: var(--color-text-secondary);
  }

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
    .grid-shell {
      padding: 0 var(--space-4) calc(var(--space-8) + env(safe-area-inset-bottom));
    }

    .dashboard-hero {
      gap: var(--space-2);
      margin-bottom: var(--space-6);
    }

    .hero-title {
      font-size: 2.4rem;
    }

    .hero-subtitle {
      font-size: 0.72rem;
      letter-spacing: 0.2em;
    }

    .hero-meta-strip {
      gap: var(--space-2);
    }

    .dashboard-empty {
      flex-direction: column;
      align-items: flex-start;
    }

    .widget-stale-banner {
      flex-direction: column;
      align-items: flex-start;
    }

    .telemetry-actions {
      width: 100%;
      flex-direction: column;
    }
  }

  @media (min-width: 640px) and (max-width: 1023px) {
    .dashboard-hero {
      gap: var(--space-3);
    }
  }
</style>
