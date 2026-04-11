<script lang="ts">
  import { onMount } from 'svelte';
  import {
    Badge,
    Button,
    Icon,
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
  import { removeWidgetInstanceFromStore } from '$lib/stores/widgets.svelte';
  import { fetchWithCsrf } from '$lib/utils/api';
  import { getWidgetComponent, getWidgetIcon } from '$lib/widgets/widget-rendering';
  import { configSchemaMap } from '$lib/widgets/config-schemas';

  type CategoryFilter = 'all' | WidgetCategory;
  type WidgetStatus = 'active' | 'unconfigured' | 'error' | 'inactive';
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
  let isMobile = $state(typeof window !== 'undefined' ? window.innerWidth < 640 : false);

  onMount(() => {
    const resizeHandler = () => { isMobile = window.innerWidth < 640; };
    window.addEventListener('resize', resizeHandler, { passive: true });
    return () => window.removeEventListener('resize', resizeHandler);
  });

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
        void loadPreview(selectedWidget.def);
      });
    });
  });

  onMount(() => {
    const syncFromHash = () => selectFromHash();
    syncFromHash();
    window.addEventListener('hashchange', syncFromHash);
    void loadWidgets();

    return () => {
      window.removeEventListener('hashchange', syncFromHash);
    };
  });

  /**
   * Resolve the real Zod config schema for a widget from the client-side
   * schema map. Returns undefined when the widget has no configurable fields.
   */
  function getConfigSchema(widgetId: string): z.ZodSchema | undefined {
    return configSchemaMap.get(widgetId);
  }

  async function loadWidgets(): Promise<void> {
    loading = true;
    loadError = '';

    try {
      const [defsResponse, tabsResponse] = await Promise.all([
        fetchWithCsrf('/api/v1/widgets'),
        fetchWithCsrf('/api/v1/tabs'),
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
          const response = await fetchWithCsrf(`/api/v1/tabs/${encodeURIComponent(tab.id)}/widgets`);
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

    for (const def of widgetDefs) {
      const widgetInstances = grouped.get(def.id) ?? [];

      const hasConfig = configSchemaMap.has(def.id);
      let status: WidgetStatus;

      if (widgetInstances.length === 0) {
        status = 'inactive';
      } else if (hasConfig && widgetInstances.some((instance) => instance.configured === false)) {
        status = 'unconfigured';
      } else {
        status = 'active';
      }

      summaries.push({
        id: def.id,
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
    updateHash(widgetId);
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

    if (selectedWidget?.status === 'unconfigured' || selectedWidget?.status === 'inactive') {
      previewData = null;
      previewError = '';
      return;
    }

    previewLoading = true;
    previewError = '';

    try {
      const response = await fetchWithCsrf(def.dataEndpoint);
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

  function getStatusLabel(status: WidgetStatus): string {
    if (status === 'active') return 'Active';
    if (status === 'unconfigured') return 'Needs configuration';
    if (status === 'inactive') return 'Not added';
    return 'Error';
  }

  function getDetailStatus(widget: WidgetSummary): { label: string; type: WidgetStatus | 'warning' | 'unavailable' } {
    if (widget.status === 'inactive') {
      return { label: 'NOT ADDED', type: 'inactive' };
    }

    if (widget.status === 'unconfigured') {
      return { label: 'NEEDS CONFIG', type: 'warning' };
    }

    if (previewError) {
      return { label: 'ERROR', type: 'error' };
    }

    if (previewData !== null && previewData !== undefined) {
      // Temperature: check if sensor data is available
      if (widget.def.id === 'temperature') {
        const temp = previewData as { cpuTemp?: number | null };
        if (temp.cpuTemp === null || temp.cpuTemp === undefined || temp.cpuTemp === 0) {
          return { label: 'NOT AVAILABLE', type: 'unavailable' };
        }
      }
      return { label: 'ACTIVE', type: 'active' };
    }

    return { label: 'NO DATA', type: 'inactive' };
  }

  function getStatusDescription(widget: WidgetSummary): string {
    if (widget.status === 'inactive') {
      return 'This widget has not been added to any page yet.';
    }

    if (widget.status === 'unconfigured') {
      return 'This widget needs configuration before it can fetch live data.';
    }

    if (previewError) {
      return `Error: ${previewError}`;
    }

    if (previewData !== null && previewData !== undefined) {
      if (widget.def.id === 'temperature') {
        const temp = previewData as { cpuTemp?: number | null };
        if (temp.cpuTemp === null || temp.cpuTemp === undefined || temp.cpuTemp === 0) {
          return 'Temperature sensor not available on this hardware.';
        }
      }
      return 'This widget is active and polling live data.';
    }

    return 'No data received yet. The widget may still be loading.';
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
      const removedIds = new Set(widget.instances.map((instance) => instance.id));

      const responses = await Promise.all(
        widget.instances.map(async (instance) => {
          const response = await fetchWithCsrf(`/api/v1/widget-instances/${encodeURIComponent(instance.id)}`, {
            method: 'DELETE',
          });
          const payload = (await response.json()) as { ok: boolean; error?: string };
          if (!payload.ok) {
            throw new Error(payload.error ?? 'Failed to remove widget instance');
          }
          return instance.id;
        }),
      );

      for (const instanceId of responses) {
        removeWidgetInstanceFromStore(instanceId);
      }

      allInstances = allInstances.filter((instance) => !removedIds.has(instance.id));
      selectedId = widget.id;
      confirmRemove = false;
      previewData = null;
      previewError = '';
      await loadWidgets();
    } catch (error) {
      previewError = error instanceof Error ? error.message : 'Failed to remove widget instances';
    } finally {
      removing = false;
    }
  }
</script>

<div class="wt-shell">
  <aside class="wt-master" class:wt-master-hidden={isMobile && selectedWidget !== null}>
    <div class="wt-toolbar">
      <Input ariaLabel="Search widgets" placeholder="Search widgets..." bind:value={search} />
      <div class="wt-filter-chips">
        {#each filterOptions as option (option.value)}
          <button
            class="wt-filter-chip"
            class:wt-filter-chip-active={categoryFilter === option.value}
            type="button"
            onclick={() => (categoryFilter = option.value)}
          >
            {option.label}
          </button>
        {/each}
      </div>
    </div>

    {#if loading}
      <p class="wt-panel-msg">Loading widgets...</p>
    {:else if loadError}
      <p class="wt-panel-msg wt-panel-error">{loadError}</p>
    {:else if filteredWidgets.length === 0}
      <p class="wt-panel-msg">No configured widget instances yet.</p>
    {:else}
      <div class="wt-list-scroll">
        {#each filteredWidgets as widget (widget.id)}
          <button
            class="settings-item"
            class:settings-item-active={selectedWidget?.id === widget.id}
            type="button"
            onclick={() => selectWidget(widget.id)}
          >
            <div class="settings-item-icon" class:settings-item-icon-active={selectedWidget?.id === widget.id}>
              <Icon name={getWidgetIcon(widget.def.id)} size={20} />
            </div>
            <div class="settings-item-info">
              <span class="settings-item-name">{widget.def.name}</span>
              <div class="settings-item-status">
                <span class="settings-status-dot settings-status-{widget.status === 'active' ? 'active' : widget.status === 'unconfigured' ? 'warning' : widget.status === 'inactive' ? 'inactive' : 'error'}"></span>
                <span class="settings-status-label">{getStatusLabel(widget.status)}</span>
              </div>
            </div>
            <Icon name="chevron-right" size={16} class="settings-item-chevron" />
          </button>
        {/each}
      </div>
    {/if}
  </aside>

  <section class="wt-detail" class:wt-detail-full={isMobile && selectedWidget !== null}>
    {#if selectedWidget}
      {@const widget = selectedWidget}
      {#if isMobile}
        <div class="wt-mobile-back">
          <Button variant="ghost" onclick={() => (selectedId = null)}>
            <Icon name="arrow-left" size={16} />
            Back
          </Button>
        </div>
      {/if}

      <div class="widgets-detail-top">
        <div class="settings-preview-card">
          <span class="settings-card-label">LIVE PREVIEW</span>
            <div class="wt-preview-scale">
              <WidgetCard
                title={widget.def.name}
                size={widget.def.defaultSize.w >= 6 ? 'L' : 'M'}
                loading={previewLoading}
                error={widget.status === 'unconfigured' ? null : previewError || null}
                showControls={false}
                draggable={false}
              >
                {#if widget.status === 'unconfigured'}
                  <div class="wt-preview-empty">Configure this widget to see a live preview.</div>
                {:else if getWidgetComponent(widget.def.id) && previewData}
                  {@const PreviewComponent = getWidgetComponent(widget.def.id)}
                  {#if PreviewComponent}
                    <PreviewComponent data={previewData as unknown} />
                  {/if}
                {:else}
                  <div class="wt-preview-empty">No preview data available.</div>
                {/if}
              </WidgetCard>
            </div>
        </div>

        <div class="settings-hero-card">
          <span class="settings-card-label">STATUS</span>
          <h2 class="settings-hero-value">{getDetailStatus(widget).label}</h2>
          <p class="settings-hero-sub">{getStatusDescription(widget)}</p>
          <div class="wt-hero-meta">
            <Badge variant="default">{widget.def.category}</Badge>
            <Badge variant={widget.def.tier === 'celestial' ? 'accent' : 'default'}>
              {widget.def.tier}
            </Badge>
            {#if widget.isPlugin}
              <Badge variant="default">Plugin</Badge>
            {/if}
            <span class="wt-instance-count">{widget.instances.length} instance(s)</span>
          </div>
        </div>
      </div>

      {#if getConfigSchema(widget.def.id)}
        <div class="settings-form-card">
          <h3 class="settings-form-title">Configuration</h3>
          <SchemaRenderer
            schema={getConfigSchema(widget.def.id)!}
            instanceId={widget.instances[0]?.id ?? ''}
            currentConfig={getCurrentConfig(widget)}
            onSaved={handleSaved}
          />
        </div>
      {:else}
        <div class="settings-form-card">
          <h3 class="settings-form-title">Configuration</h3>
          <p class="wt-no-config">This widget needs no configuration.</p>
        </div>
      {/if}

      <div class="settings-form-actions">
        {#if confirmRemove}
          <span class="wt-confirm-text">Remove all instances of this widget?</span>
          <div class="wt-confirm-actions">
            <Button variant="destructive" onclick={() => removeAllInstances(widget)} disabled={removing}>
              <Icon name="trash-2" size={14} />
              {removing ? 'Removing...' : 'Confirm remove'}
            </Button>
            <Button variant="ghost" onclick={() => (confirmRemove = false)}>Cancel</Button>
          </div>
        {:else}
          <Button variant="destructive" onclick={() => (confirmRemove = true)}>
            <Icon name="trash-2" size={14} />
            Remove all instances
          </Button>
          <span></span>
        {/if}
      </div>
    {:else}
      <div class="settings-form-card">
        <p class="wt-no-config">Select a widget to configure.</p>
      </div>
    {/if}
  </section>
</div>

<style>
  .wt-shell {
    display: grid;
    grid-template-columns: 280px 1fr;
    gap: var(--space-6);
    min-height: 720px;
  }

  .wt-master {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    overflow-y: auto;
  }

  .wt-toolbar {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    padding-bottom: var(--space-3);
    border-bottom: 1px solid color-mix(in srgb, var(--color-outline-variant) 10%, transparent);
  }

  .wt-filter-chips {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }

  .wt-filter-chip {
    border: 1px solid color-mix(in srgb, var(--color-outline-variant) 25%, transparent);
    background: none;
    border-radius: var(--radius-full);
    color: var(--color-on-surface-variant);
    cursor: pointer;
    font-size: 12px;
    font-weight: 700;
    padding: var(--space-1) var(--space-3);
    transition: background 0.15s, border-color 0.15s, color 0.15s;
  }

  .wt-filter-chip:hover {
    background: color-mix(in srgb, var(--color-surface-high) 60%, transparent);
  }

  .wt-filter-chip-active {
    border-color: color-mix(in srgb, var(--color-primary-fixed) 40%, transparent);
    background: color-mix(in srgb, var(--color-primary-fixed) 12%, transparent);
    color: var(--color-primary-fixed);
  }

  .wt-list-scroll {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    overflow-y: auto;
  }

  .wt-detail {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    overflow-y: auto;
  }

  .widgets-detail-top {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-4);
    padding-top: 4px;
  }

  .wt-preview-scale {
    transform: scale(0.8);
    transform-origin: top left;
    width: 125%;
  }

  .wt-preview-scale :global(.widget-controls) {
    display: none !important;
  }

  .wt-preview-empty,
  .wt-no-config {
    color: var(--color-on-surface-variant);
    font-size: 14px;
  }

  .wt-panel-msg {
    padding: var(--space-8) var(--space-4);
    text-align: center;
    color: var(--color-on-surface-variant);
    font-size: 13px;
    line-height: 1.5;
  }

  .wt-panel-error {
    color: var(--color-error);
  }

  .wt-hero-meta {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    flex-wrap: wrap;
    margin-top: var(--space-2);
  }

  .wt-instance-count {
    font-size: 12px;
    font-weight: 700;
    font-family: var(--font-mono);
    color: color-mix(in srgb, var(--color-on-primary-fixed) 60%, transparent);
  }

  .wt-confirm-text {
    font-size: 13px;
    color: var(--color-on-surface-variant);
  }

  .wt-confirm-actions {
    display: flex;
    gap: var(--space-2);
  }

  .wt-mobile-back {
    display: none;
  }

  @media (max-width: 768px) {
    .wt-shell {
      grid-template-columns: 1fr;
      min-height: auto;
    }

    .wt-master-hidden {
      display: none;
    }

    .wt-detail-full {
      min-height: 100dvh;
    }

    .wt-mobile-back {
      display: block;
    }

    .widgets-detail-top {
      grid-template-columns: 1fr;
    }
  }
</style>