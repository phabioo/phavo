<script lang="ts">
import { onMount } from 'svelte';
import { page } from '$app/state';
import {
  type WidgetDefinition,
  type WidgetManifestEntry,
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
  getWidgetPreviewError,
  getWidgetPreviewLoading,
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
  updateInstance,
  updateTab,
} from '$lib/stores/widgets.svelte';
import { getWidgetComponent, getWidgetHeading } from '$lib/widgets/widget-rendering';

let telemetryOpen = $state(false);
let gridDragOver = $state(false);
let isDrawerDragging = $state(false);
let editingPageName = $state(false);
let editingName = $state('');
let pageNameInput = $state<HTMLInputElement | null>(null);

const config = $derived(getConfig());
const session = $derived(getSession());

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
  return getWidgetManifest().find((widget) => widget.id === widgetId);
}

const COL_SPAN_MAP: Record<WidgetSize, number> = { S: 1, M: 2, L: 4, XL: 8 };
const ROW_SPAN_MAP: Record<WidgetSize, number> = { S: 1, M: 2, L: 4, XL: 4 };

function colSpanFor(size: WidgetSize): number {
  return COL_SPAN_MAP[size] ?? 2;
}

function rowSpanFor(size: WidgetSize): number {
  return ROW_SPAN_MAP[size] ?? 2;
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

const deviceName = $derived(
  ((page.data as Record<string, unknown>).hostname as string | undefined) ?? '',
);

const activePage = $derived(getTabs().find((tab) => tab.id === getCurrentTabId()) ?? getTabs()[0]);

const isHomePage = $derived(activePage?.order === 0);

function startEditingPageName() {
  editingName = activePage?.label ?? '';
  editingPageName = true;
}

async function savePageName() {
  editingPageName = false;
  const trimmed = editingName.trim();
  if (!trimmed || !activePage || trimmed === activePage.label) return;
  await updateTab(activePage.id, { label: trimmed });
}

$effect(() => {
  if (editingPageName) {
    pageNameInput?.focus();
    pageNameInput?.select();
  }
});

onMount(() => {
  return $effect.root(() => {
    $effect(() => {
      if (
        config.setupComplete &&
        !config.telemetryAsked
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
    {#if isHomePage}
      <div class="welcome-section">
        <div class="welcome-copy">
          <h1 class="welcome-heading">
            Welcome Back, <span class="welcome-name">{session?.userId ?? ''}</span>
          </h1>
          <p class="welcome-sub">{config.dashboardName} is humming quietly.</p>
        </div>
        <button class="add-widget-hero-btn" onclick={() => setDrawerOpen(true)}>
          <Icon name="plus" size={15} />
          <span>{en.dashboard.addWidget}</span>
        </button>
      </div>
    {:else}
      <div class="welcome-section">
        <div class="welcome-copy">
          <div class="page-title-row">
            {#if editingPageName}
              <input
                class="page-name-input"
                bind:this={pageNameInput}
                bind:value={editingName}
                onblur={savePageName}
                onkeydown={(e) => e.key === 'Enter' && savePageName()}
              />
            {:else}
              <h1 class="welcome-heading">{activePage?.label ?? ''}</h1>
              <button class="page-edit-btn" onclick={() => startEditingPageName()}>
                <Icon name="pencil" size={14} />
              </button>
            {/if}
          </div>
        </div>
        <button class="add-widget-hero-btn" onclick={() => setDrawerOpen(true)}>
          <Icon name="plus" size={15} />
          <span>{en.dashboard.addWidget}</span>
        </button>
      </div>
    {/if}

    {#if sortedInstances.length === 0}
      <button class="dashboard-empty" type="button" onclick={() => setDrawerOpen(true)}>
        <div class="empty-icon">
          <Icon name="layout-dashboard" size={20} />
        </div>
        <div class="empty-copy">
          <h2>Build your dashboard</h2>
          <p>Add a widget to start shaping this page.</p>
        </div>
      </button>
    {:else}
      <section class="dashboard-stage">
        <BentoGrid class="dashboard-grid" gap="1.75rem">
          {#each sortedInstances as instance, i (instance.id)}
            {@const def = getDef(instance.widgetId)}
            {@const state = getWidgetState(instance.id)}
            {@const data = getWidgetData(instance.widgetId)}
            {@const warning = getWidgetWarning(instance.id)}
            {@const error = getWidgetError(instance.id)}
            {@const lastSuccess = getWidgetLastSuccess(instance.id)}
            {#if def}
              {@const heading = getWidgetHeading(instance.widgetId, {
                name: def.name,
                category: def.category,
              })}
              {@const WidgetComponent = getWidgetComponent(instance.widgetId)}
              <WidgetCard
                status={state}
                title={heading.title}
                subtitle={heading.subtitle}
                icon={heading.icon}
                size={instance.size}
                colSpan={colSpanFor(instance.size)}
                rowSpan={rowSpanFor(instance.size)}
                loading={state === 'loading'}
                error={null}
                availableSizes={def.sizes}
                instanceId={instance.id}
                draggable={true}
                starField={instance.widgetId === 'cpu'}
                glowColor="gold"
                staggerIndex={i}
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

                  {#key instance.size}
                  {#if WidgetComponent && data}
                    <WidgetComponent data={data as unknown} size={instance.size} />
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
                  {/key}
                {/if}
              </WidgetCard>
            {/if}
          {/each}
        </BentoGrid>
      </section>
    {/if}

    <div class="footer-wrap">
      <div class="footer-pill">
        <span class="f-dim">POWERED BY</span>
        <span class="f-brand">PHAVO</span>
        <span class="f-dot"></span>
        <span class="f-dim">CELESTIAL EDITION</span>
        <span class="f-dot"></span>
        <span class="f-dim">VERSION {PHAVO_VERSION}</span>
        {#if deviceName}
          <span class="f-dot"></span>
          <span class="f-dim">{deviceName}</span>
        {/if}
      </div>
    </div>
  </div>
</div>

{#snippet drawerTilePreview(widget: WidgetManifestEntry)}
  {@const liveData = getWidgetData(widget.id)}
  {@const previewLoading = getWidgetPreviewLoading(widget.id)}
  {@const previewError = getWidgetPreviewError(widget.id)}
  {@const WidgetComponent = getWidgetComponent(widget.id)}

  {#if previewLoading && !liveData}
    <div class="tray-live-state">
      <span class="tray-live-icon" aria-hidden="true">
        <Icon name="activity" size={16} />
      </span>
      <div class="tray-live-copy-group">
        <span class="tray-live-kicker">Checking live data</span>
        <p class="tray-live-copy">Phavo is loading the latest widget snapshot for this tray preview.</p>
      </div>
    </div>
  {:else if WidgetComponent && liveData}
    <div class="tray-live-render">
      <WidgetComponent data={liveData as unknown} size="S" />
    </div>
  {:else if previewError}
    <div class="tray-live-state">
      <span class="tray-live-icon" aria-hidden="true">
        <Icon name={widget.configSchema ? 'sliders-horizontal' : 'activity'} size={16} />
      </span>
      <div class="tray-live-copy-group">
        <span class="tray-live-kicker">
          {widget.configSchema ? 'Preview unavailable' : 'Live data unavailable'}
        </span>
        <p class="tray-live-copy">
          {widget.configSchema
            ? 'Finish this widget’s configuration in Settings to load a live tray preview.'
            : 'Phavo could not load a live preview for this widget yet. Try again after the next refresh.'}
        </p>
      </div>
    </div>
  {:else if widget.configSchema}
    <div class="tray-live-state">
      <span class="tray-live-icon" aria-hidden="true">
        <Icon name="sliders-horizontal" size={16} />
      </span>
      <div class="tray-live-copy-group">
        <span class="tray-live-kicker">Awaiting configuration</span>
        <p class="tray-live-copy">Configure this widget or add it to the board to start live updates.</p>
      </div>
    </div>
  {:else if liveData}
    <div class="tray-live-state">
      <span class="tray-live-icon" aria-hidden="true">
        <Icon name="sparkles" size={16} />
      </span>
      <div class="tray-live-copy-group">
        <span class="tray-live-kicker">Live data ready</span>
        <p class="tray-live-copy">This widget is active, but its compact tray preview is not available yet.</p>
      </div>
    </div>
  {:else}
    <div class="tray-live-state">
      <span class="tray-live-icon" aria-hidden="true">
        <Icon name="activity" size={16} />
      </span>
      <div class="tray-live-copy-group">
        <span class="tray-live-kicker">Live when available</span>
        <p class="tray-live-copy">This preview fills with real board data once the widget is active.</p>
      </div>
    </div>
  {/if}
{/snippet}

<WidgetDrawer
  open={getIsDrawerOpen()}
  widgets={getWidgetManifest()}
  instances={getWidgetInstances()}
  onClose={() => setDrawerOpen(false)}
  onAdd={handleDrawerAdd}
  onRemove={handleDrawerRemove}
  onDragStartFromDrawer={() => (isDrawerDragging = true)}
  onDragEndFromDrawer={() => (isDrawerDragging = false)}
  tilePreview={drawerTilePreview}
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
    overflow: visible;
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
    overflow: visible; /* Allow nebula gradient to bleed into widget grid */
  }

  .welcome-section {
    position: relative;
    min-height: 80px;
    padding: var(--space-6) 0 var(--space-12);
    margin-bottom: calc(-1 * var(--space-6));
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: var(--space-6);
  }

  .welcome-copy {
    min-width: 0;
  }

  .welcome-heading {
    font-size: var(--font-size-3xl);
    font-weight: 300;
    letter-spacing: -0.02em;
    color: var(--color-on-surface);
    line-height: 1.2;
    margin: 0;
  }

  .welcome-name {
    color: var(--color-primary-fixed);
    font-weight: 400;
  }

  .welcome-sub {
    font-size: var(--font-size-md);
    color: var(--color-on-surface-variant);
    margin-top: var(--space-2);
    margin-bottom: 0;
  }

  .add-widget-hero-btn {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    flex-shrink: 0;
    padding: 8px 20px;
    border-radius: var(--radius-full);
    border: 1px solid color-mix(in srgb, var(--color-primary) 18%, transparent);
    background: color-mix(in srgb, var(--color-surface-highest) 60%, transparent);
    color: var(--color-on-surface-variant);
    font-family: var(--font-mono);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    cursor: pointer;
    transition: color 0.15s, background 0.15s, border-color 0.15s;
  }

  .add-widget-hero-btn:hover {
    color: var(--color-primary-fixed);
    background: color-mix(in srgb, var(--color-primary) 8%, transparent);
    border-color: color-mix(in srgb, var(--color-primary) 32%, transparent);
  }

  .page-title-row {
    display: flex;
    align-items: center;
    gap: var(--space-3);
  }

  .page-edit-btn {
    opacity: 0;
    background: none;
    border: none;
    color: var(--color-outline);
    cursor: pointer;
    padding: var(--space-1);
    border-radius: var(--radius-sm);
    transition: opacity 0.15s, color 0.15s;
  }

  .page-title-row:hover .page-edit-btn {
    opacity: 1;
  }

  .page-edit-btn:hover {
    color: var(--color-primary-fixed);
  }

  .page-name-input {
    font-size: var(--font-size-3xl);
    font-weight: 300;
    letter-spacing: -0.02em;
    background: transparent;
    border: none;
    border-bottom: 1px solid var(--color-primary-fixed);
    color: var(--color-on-surface);
    outline: none;
    padding: 0 var(--space-2);
    font-family: var(--font-ui);
  }

  .dashboard-stage {
    width: 100%;
  }

  .dashboard-empty {
    appearance: none;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-6);
    width: 100%;
    padding: var(--space-8);
    border: 1px solid color-mix(in srgb, var(--color-outline-variant) 15%, transparent);
    border-radius: 28px;
    background: color-mix(in srgb, var(--color-surface-card) 92%, transparent);
    box-shadow: var(--shadow-md);
    cursor: pointer;
    font: inherit;
    text-align: left;
    transition:
      transform 0.18s ease,
      border-color 0.18s ease,
      background 0.18s ease,
      box-shadow 0.18s ease;
  }

  .dashboard-empty:hover,
  .dashboard-empty:focus-visible {
    border-color: color-mix(in srgb, var(--color-primary-fixed) 28%, transparent);
    background:
      radial-gradient(
        ellipse 78% 90% at 0% 0%,
        color-mix(in srgb, var(--color-primary-fixed) 8%, transparent),
        transparent 78%
      ),
      color-mix(in srgb, var(--color-surface-card) 96%, transparent);
    box-shadow: 0 24px 52px color-mix(in srgb, var(--color-surface-dim) 28%, transparent);
    transform: translateY(-1px);
  }

  .dashboard-empty:focus-visible {
    outline: 2px solid color-mix(in srgb, var(--color-accent) 56%, transparent);
    outline-offset: 3px;
  }

  .empty-icon {
    width: 48px;
    height: 48px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 999px;
    background: color-mix(in srgb, var(--color-primary-fixed) 12%, transparent);
    color: var(--color-primary-fixed);
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
    color: var(--color-on-surface);
  }

  .empty-copy p {
    color: var(--color-on-surface-variant);
    margin: 0;
  }

  .tray-live-render {
    display: flex;
    align-items: center;
    width: 100%;
    min-height: 0;
    overflow: hidden;
  }

  .tray-live-state {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    width: 100%;
    min-height: 0;
    padding: var(--space-3);
    border-radius: var(--radius-lg);
    border: 1px solid color-mix(in srgb, var(--color-border-subtle) 88%, transparent);
    background: color-mix(in srgb, var(--color-bg-base) 42%, transparent);
    overflow: hidden;
  }

  .tray-live-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border-radius: 10px;
    flex-shrink: 0;
    background: color-mix(in srgb, var(--color-accent-t) 90%, transparent);
    color: var(--color-accent-text);
  }

  .tray-live-copy-group {
    display: flex;
    min-width: 0;
    flex-direction: column;
    gap: 4px;
  }

  .tray-live-kicker {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: var(--color-text-muted);
  }

  .tray-live-copy {
    margin: 0;
    color: var(--color-text-secondary);
    font-size: 11px;
    line-height: 1.45;
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

  .footer-wrap {
    display: flex;
    justify-content: center;
    padding: 48px 0 32px;
  }

  .footer-pill {
    display: inline-flex;
    align-items: center;
    gap: 24px;
    padding: 12px 32px;
    border-radius: 9999px;
    background: var(--color-surface-highest);
    border: 1px solid color-mix(in srgb, var(--color-outline-variant) 15%, transparent);
    font-family: var(--font-mono);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }

  .f-brand {
    color: var(--color-primary-fixed);
  }

  .f-dim {
    color: var(--color-on-surface);
  }

  .f-dot {
    width: 4px;
    height: 4px;
    border-radius: 50%;
    background: color-mix(in srgb, var(--color-primary-fixed) 40%, transparent);
    flex-shrink: 0;
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
</style>
