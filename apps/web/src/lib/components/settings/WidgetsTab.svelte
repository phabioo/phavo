<script lang="ts">
  import { onMount } from 'svelte';
  import {
    Badge,
    Button,
    Card,
    Input,
    SchemaRenderer,
    WidgetCard,
  } from '@phavo/ui';
  import {
    isWidgetDefinition,
    z,
    type WidgetCategory,
    type WidgetDefinition,
    type WidgetInstance,
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

  type CategoryFilter = 'all' | WidgetCategory;
  type WidgetStatus = 'active' | 'unconfigured' | 'error';
  type LinksPreviewData = {
    groups: Array<{
      label: string;
      links: Array<{ title: string; url: string; icon?: string }>;
    }>;
  };
  type WidgetSummary = {
    id: string;
    def: WidgetDefinition;
    instances: WidgetInstance[];
    status: WidgetStatus;
    isPlugin: boolean;
  };

  const filterOptions: Array<{ value: CategoryFilter; label: string }> = [
    { value: 'all', label: 'All' },
    { value: 'system', label: 'System' },
    { value: 'consumer', label: 'Consumer' },
    { value: 'integration', label: 'Integration' },
    { value: 'utility', label: 'Utility' },
  ];

  let loading = $state(true);
  let loadError = $state('');
  let widgetDefs = $state<WidgetDefinition[]>([]);
  let search = $state('');
  let categoryFilter = $state<CategoryFilter>('all');
  let selectedId = $state<string | null>(null);
  let allInstances = $state<WidgetInstance[]>([]);
  let previewData = $state<unknown>(null);
  let previewLoading = $state(false);
  let previewError = $state('');
  let removing = $state(false);
  let confirmRemove = $state(false);

  const widgetSummaries = $derived(buildWidgetSummaries(allInstances));
  const filteredWidgets = $derived(filterWidgets(widgetSummaries, search, categoryFilter));
  const selectedWidget = $derived(
    filteredWidgets.find((widget) => widget.id === selectedId) ?? filteredWidgets[0] ?? null,
  );
  const isMobile = $derived(typeof window !== 'undefined' ? window.innerWidth < 640 : false);

  onMount(() => {
    $effect.root(() => {
      $effect(() => {
        if (!selectedWidget) return;
        selectedId = selectedWidget.id;
      });
    });
  });

  onMount(() => {
    $effect.root(() => {
      $effect(() => {
        if (!selectedWidget) return;
        updateHash(selectedWidget.id);
        void loadPreview(selectedWidget.def);
      });
    });
  });

  onMount(() => {
    selectFromHash();
    void loadWidgets();
  });

  /**
   * configSchema is typed as unknown in the client-side WidgetDefinition because
   * the API manifest strips the actual Zod object. The `{#if configSchema}` guard
   * ensures this is only called when truthy — in practice it never is (API omits it).
   */
  function asZodSchema(v: unknown): z.ZodSchema {
    return v as z.ZodSchema;
  }

  async function loadWidgets(): Promise<void> {
    loading = true;
    loadError = '';

    try {
      const [defsResponse, tabsResponse] = await Promise.all([
        fetch('/api/v1/widgets'),
        fetch('/api/v1/tabs'),
      ]);

      const defsPayload = (await defsResponse.json()) as {
        ok: boolean;
        data?: Array<unknown>;
      };
      if (defsPayload.ok && Array.isArray(defsPayload.data)) {
        widgetDefs = defsPayload.data.filter(
          (entry): entry is WidgetDefinition => isWidgetDefinition(entry as never),
        );
      }

      const tabsPayload = (await tabsResponse.json()) as {
        ok: boolean;
        data?: Array<{ id: string }>;
        error?: string;
      };

      if (!tabsPayload.ok || !tabsPayload.data) {
        throw new Error(tabsPayload.error ?? 'Failed to load tabs');
      }

      const instances = await Promise.all(
        tabsPayload.data.map(async (tab) => {
          const response = await fetch(`/api/v1/tabs/${encodeURIComponent(tab.id)}/widgets`);
          const payload = (await response.json()) as {
            ok: boolean;
            data?: WidgetInstance[];
            error?: string;
          };

          if (!payload.ok || !payload.data) {
            throw new Error(payload.error ?? 'Failed to load widgets');
          }

          return payload.data;
        }),
      );

      allInstances = instances.flat();
      if (!selectedId && allInstances.length > 0) {
        selectedId = allInstances[0]?.widgetId ?? null;
      }
    } catch (error) {
      loadError = error instanceof Error ? error.message : 'Failed to load widgets';
    } finally {
      loading = false;
    }
  }

  function buildWidgetSummaries(instances: WidgetInstance[]): WidgetSummary[] {
    const grouped = new Map<string, WidgetInstance[]>();

    for (const instance of instances) {
      const bucket = grouped.get(instance.widgetId) ?? [];
      bucket.push(instance);
      grouped.set(instance.widgetId, bucket);
    }

    const summaries: WidgetSummary[] = [];

    for (const [widgetId, widgetInstances] of grouped.entries()) {
      const def = widgetDefs.find((d) => d.id === widgetId);
      if (!def) continue;

      const status: WidgetStatus = widgetInstances.some((instance) => instance.configured === false)
        ? 'unconfigured'
        : 'active';

      summaries.push({
        id: widgetId,
        def,
        instances: widgetInstances,
        status,
        isPlugin: false,
      });
    }

    return summaries.sort((left, right) => left.def.name.localeCompare(right.def.name));
  }

  function filterWidgets(
    widgets: WidgetSummary[],
    term: string,
    filter: CategoryFilter,
  ): WidgetSummary[] {
    const query = term.trim().toLowerCase();
    return widgets.filter((widget) => {
      const matchesCategory = filter === 'all' || widget.def.category === filter;
      const matchesSearch =
        query.length === 0 ||
        widget.def.name.toLowerCase().includes(query) ||
        widget.def.description.toLowerCase().includes(query);

      return matchesCategory && matchesSearch;
    });
  }

  function selectWidget(widgetId: string): void {
    selectedId = widgetId;
    confirmRemove = false;
  }

  function selectFromHash(): void {
    if (typeof window === 'undefined') return;
    const rawHash = window.location.hash.replace(/^#/, '');
    if (!rawHash.startsWith('widgets')) return;
    const [, widgetId] = rawHash.split('/');
    if (widgetId) selectedId = decodeURIComponent(widgetId);
  }

  function updateHash(widgetId: string): void {
    if (typeof window === 'undefined') return;
    const nextHash = widgetId ? `#widgets/${encodeURIComponent(widgetId)}` : '#widgets';
    if (window.location.hash === nextHash) return;
    history.replaceState(history.state, '', `${window.location.pathname}${nextHash}`);
  }

  async function loadPreview(def: WidgetDefinition | null): Promise<void> {
    if (!def) {
      previewData = null;
      previewError = '';
      return;
    }

    if (selectedWidget?.status === 'unconfigured') {
      previewData = null;
      previewError = '';
      return;
    }

    previewLoading = true;
    previewError = '';

    try {
      const response = await fetch(def.dataEndpoint);
      const payload = (await response.json()) as { ok: boolean; data?: unknown; error?: string };
      if (!payload.ok) {
        throw new Error(payload.error ?? 'Failed to load preview');
      }
      previewData = payload.data ?? null;
    } catch (error) {
      previewData = null;
      previewError = error instanceof Error ? error.message : 'Failed to load preview';
    } finally {
      previewLoading = false;
    }
  }

  function getStatusGlyph(status: WidgetStatus): string {
    if (status === 'active') return '✓';
    if (status === 'unconfigured') return '⚠';
    return '✗';
  }

  function getStatusLabel(status: WidgetStatus): string {
    if (status === 'active') return 'Active';
    if (status === 'unconfigured') return 'Needs configuration';
    return 'Error';
  }

  function getStatusDescription(widget: WidgetSummary): string {
    if (widget.status === 'unconfigured') {
      return 'This widget needs configuration before it can fetch live data.';
    }

    if (previewError) {
      return `Error: ${previewError}`;
    }

    return 'This widget is active and polling live data.';
  }

  function getCurrentConfig(widget: WidgetSummary): Record<string, unknown> {
    return (widget.instances[0]?.config as Record<string, unknown> | undefined) ?? {};
  }

  async function handleSaved(): Promise<void> {
    previewError = '';
    await loadWidgets();
    if (selectedWidget?.def) {
      await loadPreview(selectedWidget.def);
    }
  }

  async function removeAllInstances(widget: WidgetSummary): Promise<void> {
    removing = true;
    try {
      await Promise.all(
        widget.instances.map((instance) =>
          fetch(`/api/v1/widget-instances/${encodeURIComponent(instance.id)}`, { method: 'DELETE' }),
        ),
      );
      confirmRemove = false;
      previewData = null;
      await loadWidgets();
    } finally {
      removing = false;
    }
  }
</script>

<Card padding="none">
  <div class="widgets-tab">
    <aside class="widgets-list" class:widgets-list-hidden={isMobile && selectedWidget !== null}>
      <div class="widgets-list-toolbar">
        <Input label="Search" placeholder="Search widgets..." bind:value={search} />
        <div class="filter-chips">
          {#each filterOptions as option (option.value)}
            <button
              class="filter-chip"
              class:filter-chip-active={categoryFilter === option.value}
              type="button"
              onclick={() => (categoryFilter = option.value)}
            >
              {option.label}
            </button>
          {/each}
        </div>
      </div>

      {#if loading}
        <p class="panel-message">Loading widgets...</p>
      {:else if loadError}
        <p class="panel-message panel-error">{loadError}</p>
      {:else if filteredWidgets.length === 0}
        <p class="panel-message">No configured widget instances yet.</p>
      {:else}
        <div class="widgets-list-scroll">
          {#each filteredWidgets as widget (widget.id)}
            <button
              class="widget-row"
              class:widget-row-active={selectedWidget?.id === widget.id}
              type="button"
              onclick={() => selectWidget(widget.id)}
            >
              <div class="widget-row-main">
                <span class="widget-row-title">{widget.def.name}</span>
                <span class="widget-row-description">{widget.def.description}</span>
              </div>
              <div class="widget-row-meta">
                {#if widget.isPlugin}
                  <Badge variant="default">Plugin</Badge>
                {/if}
                <span class="status-dot status-{widget.status}">{getStatusGlyph(widget.status)}</span>
              </div>
            </button>
          {/each}
        </div>
      {/if}
    </aside>

    <section class="widget-detail" class:widget-detail-full={isMobile && selectedWidget !== null}>
      {#if selectedWidget}
        {@const widget = selectedWidget}
        {#if isMobile}
          <div class="mobile-back-row">
            <Button variant="ghost" onclick={() => (selectedId = null)}>Back</Button>
          </div>
        {/if}

        <div class="detail-header">
          <div>
            <h2 class="detail-title">{widget.def.name}</h2>
            <div class="detail-badges">
              <Badge variant="default">{widget.def.category}</Badge>
              <Badge variant={widget.def.tier === 'standard' ? 'accent' : 'default'}>
                {widget.def.tier}
              </Badge>
              {#if widget.isPlugin}
                <Badge variant="default">Plugin</Badge>
              {/if}
            </div>
          </div>
          <div class="instance-count">{widget.instances.length} instance(s)</div>
        </div>

        <div class="preview-shell">
          <div class="preview-scale">
            <WidgetCard
              title={widget.def.name}
              size={widget.def.defaultSize.w >= 6 ? 'L' : 'M'}
              loading={previewLoading}
              error={widget.status === 'unconfigured' ? null : previewError || null}
            >
              {#if widget.status === 'unconfigured'}
                <div class="preview-empty">Configure this widget to see a live preview.</div>
              {:else if widget.def.id === 'cpu' && previewData}
                <CpuWidget data={previewData as CpuMetrics} />
              {:else if widget.def.id === 'memory' && previewData}
                <MemoryWidget data={previewData as MemoryMetrics} />
              {:else if widget.def.id === 'disk' && previewData}
                <DiskWidget data={previewData as DiskMetrics[]} />
              {:else if widget.def.id === 'network' && previewData}
                <NetworkWidget data={previewData as NetworkMetrics} />
              {:else if widget.def.id === 'temperature' && previewData}
                <TemperatureWidget data={previewData as TemperatureMetrics} />
              {:else if widget.def.id === 'uptime' && previewData}
                <UptimeWidget data={previewData as UptimeMetrics} />
              {:else if widget.def.id === 'weather' && previewData}
                <WeatherWidget data={previewData as WeatherMetrics} />
              {:else if widget.def.id === 'pihole' && previewData}
                <PiholeWidget data={previewData as PiholeMetrics} />
              {:else if widget.def.id === 'rss' && previewData}
                <RssWidget data={previewData as RssFeedResult} />
              {:else if widget.def.id === 'links' && previewData}
                <LinksWidget data={previewData as LinksPreviewData} />
              {:else}
                <div class="preview-empty">No preview data available.</div>
              {/if}
            </WidgetCard>
          </div>
        </div>

        <div class="detail-status">
          <span class="detail-status-label">{getStatusLabel(widget.status)}</span>
          <p class="detail-status-description">{getStatusDescription(widget)}</p>
        </div>

        {#if widget.def.configSchema}
          <SchemaRenderer
            schema={asZodSchema(widget.def.configSchema)}
            instanceId={widget.instances[0]?.id ?? ''}
            currentConfig={getCurrentConfig(widget)}
            onSaved={handleSaved}
          />
        {:else}
          <p class="no-config">This widget needs no configuration.</p>
        {/if}

        <div class="detail-footer">
          {#if confirmRemove}
            <div class="confirm-row">
              <span>Remove all instances of this widget?</span>
              <div class="confirm-actions">
                <Button variant="danger" onclick={() => removeAllInstances(widget)} disabled={removing}>
                  {removing ? 'Removing...' : 'Confirm remove'}
                </Button>
                <Button variant="ghost" onclick={() => (confirmRemove = false)}>Cancel</Button>
              </div>
            </div>
          {:else}
            <Button variant="danger" onclick={() => (confirmRemove = true)}>Remove all instances</Button>
          {/if}
        </div>
      {:else}
        <div class="empty-detail">Select a widget to configure.</div>
      {/if}
    </section>
  </div>
</Card>

<style>
  .widgets-tab {
    display: grid;
    grid-template-columns: minmax(280px, 340px) minmax(0, 1fr);
    min-height: 720px;
  }

  .widgets-list {
    border-right: 1px solid var(--color-border-subtle);
    display: flex;
    flex-direction: column;
    min-height: 0;
  }

  .widgets-list-toolbar {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    padding: var(--space-4);
    border-bottom: 1px solid var(--color-border-subtle);
  }

  .filter-chips {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }

  .filter-chip {
    border: 1px solid var(--color-border);
    background: var(--color-bg-base);
    border-radius: 999px;
    color: var(--color-text-secondary);
    cursor: pointer;
    font-size: 12px;
    padding: var(--space-1) var(--space-3);
  }

  .filter-chip-active {
    border-color: var(--color-accent);
    background: var(--color-accent-subtle);
    color: var(--color-accent-text);
  }

  .widgets-list-scroll {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    overflow-y: auto;
    padding: var(--space-3);
  }

  .widget-row {
    align-items: center;
    background: var(--color-bg-surface);
    border: 1px solid var(--color-border-subtle);
    border-radius: var(--radius-md);
    cursor: pointer;
    display: flex;
    gap: var(--space-3);
    justify-content: space-between;
    padding: var(--space-3);
    text-align: left;
  }

  .widget-row-active {
    border-color: var(--color-accent);
    background: var(--color-accent-subtle);
  }

  .widget-row-main {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
  }

  .widget-row-title {
    color: var(--color-text-primary);
    font-size: 14px;
    font-weight: 600;
  }

  .widget-row-description {
    color: var(--color-text-muted);
    font-size: 12px;
  }

  .widget-row-meta {
    align-items: center;
    display: flex;
    gap: var(--space-2);
  }

  .status-dot {
    align-items: center;
    border-radius: 999px;
    display: inline-flex;
    font-size: 13px;
    height: 24px;
    justify-content: center;
    width: 24px;
  }

  .status-active {
    color: var(--color-success);
  }

  .status-unconfigured {
    color: var(--color-accent-text);
  }

  .status-error {
    color: var(--color-danger);
  }

  .widget-detail {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    min-width: 0;
    padding: var(--space-5);
  }

  .detail-header {
    align-items: flex-start;
    display: flex;
    justify-content: space-between;
    gap: var(--space-4);
  }

  .detail-title {
    color: var(--color-text-primary);
    font-size: 22px;
    font-weight: 700;
    margin: 0;
  }

  .detail-badges {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
    margin-top: var(--space-2);
  }

  .instance-count {
    color: var(--color-text-muted);
    font-size: 12px;
    white-space: nowrap;
  }

  .preview-shell {
    overflow: hidden;
  }

  .preview-scale {
    transform: scale(0.8);
    transform-origin: top left;
    width: 125%;
  }

  .preview-empty,
  .no-config,
  .empty-detail,
  .panel-message {
    color: var(--color-text-muted);
    font-size: 14px;
  }

  .panel-error {
    color: var(--color-danger);
  }

  .detail-status {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .detail-status-label {
    color: var(--color-text-primary);
    font-size: 14px;
    font-weight: 600;
  }

  .detail-status-description {
    color: var(--color-text-secondary);
    margin: 0;
  }

  .detail-footer {
    border-top: 1px solid var(--color-border-subtle);
    margin-top: auto;
    padding-top: var(--space-4);
  }

  .confirm-row {
    align-items: center;
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-3);
    justify-content: space-between;
  }

  .confirm-actions {
    display: flex;
    gap: var(--space-2);
  }

  .mobile-back-row {
    display: none;
  }

  @media (max-width: 639px) {
    .widgets-tab {
      grid-template-columns: 1fr;
      min-height: auto;
    }

    .widgets-list-hidden {
      display: none;
    }

    .widget-detail-full {
      min-height: 100dvh;
    }

    .mobile-back-row {
      display: block;
    }

    .detail-header,
    .confirm-row,
    .confirm-actions {
      flex-direction: column;
      align-items: stretch;
    }
  }
</style>