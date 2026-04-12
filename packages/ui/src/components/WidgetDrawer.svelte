<script lang="ts">
  import {
    type WidgetCategory,
    type WidgetDefinition,
    type WidgetInstance,
    type WidgetManifestEntry,
    type WidgetSize,
  } from '@phavo/types';
  import type { Snippet } from 'svelte';
  import { onMount } from 'svelte';
  import { fade } from 'svelte/transition';
  import Icon from './Icon.svelte';
  import WidgetCard from './WidgetCard.svelte';

  type Category = 'all' | WidgetCategory;
  type TileCategory = WidgetCategory | 'custom';

  interface Props {
    open: boolean;
    widgets: WidgetManifestEntry[];
    instances: WidgetInstance[];
    onClose: () => void;
    onAdd: (widgetId: string, size: WidgetSize) => void;
    onRemove: (instanceId: string) => void;
    onDragStartFromDrawer?: () => void;
    onDragEndFromDrawer?: () => void;
    tilePreview?: Snippet<[WidgetManifestEntry]>;
    labels?: {
      title?: string;
      subtitle?: string;
      addToBoard?: string;
      filterAll?: string;
      filterSystem?: string;
      filterConsumer?: string;
      filterIntegration?: string;
      filterUtility?: string;
      alreadyAdded?: string;
      remove?: string;
      removeConfirm?: string;
    };
  }

  let {
    open,
    widgets,
    instances,
    onClose,
    onAdd,
    onRemove,
    onDragStartFromDrawer,
    onDragEndFromDrawer,
    tilePreview,
    labels = {},
  }: Props = $props();

  const SIZE_OPTIONS: WidgetSize[] = ['S', 'M', 'L', 'XL'];
  const CATEGORY_ICONS: Record<Category, string> = {
    all: 'layout-grid',
    system: 'cpu',
    consumer: 'sparkles',
    integration: 'plug',
    utility: 'sliders-horizontal',
  };

  let activeFilter = $state<Category>('all');
  let confirmRemoveId = $state<string | null>(null);
  let isDraggingFromDrawer = $state(false);
  let drawerHeight = $state(60);
  let selectedSizes = $state<Record<string, WidgetSize>>({});

  const filters: { key: Category; label: () => string }[] = [
    { key: 'all', label: () => labels.filterAll ?? 'All' },
    { key: 'system', label: () => labels.filterSystem ?? 'System' },
    { key: 'consumer', label: () => labels.filterConsumer ?? 'Consumer' },
    { key: 'integration', label: () => labels.filterIntegration ?? 'Integration' },
    { key: 'utility', label: () => labels.filterUtility ?? 'Utility' },
  ];

  onMount(() => {
    return $effect.root(() => {
      $effect(() => {
        if (open) return;
        drawerHeight = 60;
        confirmRemoveId = null;
        selectedSizes = {};
      });
    });
  });

  const filteredWidgets = $derived(
    activeFilter === 'all'
      ? widgets
      : widgets.filter((widget) => widget.category === activeFilter),
  );

  function getInstanceForWidget(widgetId: string): WidgetInstance | undefined {
    return instances.find((instance) => instance.widgetId === widgetId);
  }

  function getAvailableSizes(widget: WidgetManifestEntry): WidgetSize[] {
    return widget.sizes;
  }

  function getDefaultSize(widget: WidgetManifestEntry): WidgetSize {
    const availableSizes = getAvailableSizes(widget);
    if (availableSizes.includes('M')) return 'M';
    return availableSizes[0] ?? 'M';
  }

  function getSelectedSize(widget: WidgetManifestEntry): WidgetSize {
    const selectedSize = selectedSizes[widget.id];
    return selectedSize && getAvailableSizes(widget).includes(selectedSize)
      ? selectedSize
      : getDefaultSize(widget);
  }

  function handleSizeSelect(widget: WidgetManifestEntry, size: WidgetSize) {
    if (!widget.sizes.includes(size)) return;
    selectedSizes = {
      ...selectedSizes,
      [widget.id]: size,
    };
  }

  function handleAdd(widget: WidgetManifestEntry) {
    onAdd(widget.id, getSelectedSize(widget));
  }

  function handleRemoveClick(instanceId: string) {
    confirmRemoveId = instanceId;
  }

  function handleRemoveConfirm(instanceId: string) {
    onRemove(instanceId);
    confirmRemoveId = null;
  }

  function handleBackdropClick() {
    onClose();
  }

  function handleDragStart(event: DragEvent, widget: WidgetManifestEntry) {
    if (!event.dataTransfer) return;
    isDraggingFromDrawer = true;
    event.dataTransfer.effectAllowed = 'copy';
    event.dataTransfer.setData(
      'application/phavo-widget',
      JSON.stringify({
        widgetId: widget.id,
        size: getSelectedSize(widget),
      }),
    );
    onDragStartFromDrawer?.();
  }

  function handleDragEnd() {
    isDraggingFromDrawer = false;
    onDragEndFromDrawer?.();
  }

  function getWidgetCategory(widget: WidgetManifestEntry): TileCategory {
    return widget.category;
  }

  function getWidgetCategoryLabel(widget: WidgetManifestEntry): string {
    const category = getWidgetCategory(widget);
    return category.charAt(0).toUpperCase() + category.slice(1);
  }

  function startResize(e: MouseEvent | TouchEvent) {
    e.preventDefault();
    const startY = 'touches' in e ? e.touches[0]?.clientY ?? 0 : e.clientY;
    const startHeight = drawerHeight;

    function onMove(ev: MouseEvent | TouchEvent) {
      const y = 'touches' in ev ? ev.touches[0]?.clientY ?? 0 : ev.clientY;
      const delta = startY - y;
      const newH = startHeight + (delta / window.innerHeight) * 100;
      drawerHeight = Math.min(90, Math.max(20, newH));
    }

    function onEnd() {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('mouseup', onEnd);
      window.removeEventListener('touchend', onEnd);
    }

    window.addEventListener('mousemove', onMove);
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('mouseup', onEnd);
    window.addEventListener('touchend', onEnd);
  }
</script>

{#if open}
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div
    class="drawer-backdrop"
    onclick={handleBackdropClick}
    aria-hidden="true"
    style="pointer-events: {isDraggingFromDrawer ? 'none' : 'auto'}"
    transition:fade={{ duration: 140 }}
  ></div>

  <aside
    class="drawer-panel"
    style="height: {drawerHeight}vh"
    aria-label={labels.title ?? 'Widget Tray'}
  >
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <div
      class="drawer-handle"
      role="separator"
      onmousedown={startResize}
      ontouchstart={startResize}
    >
      <div class="drawer-handle-bar"></div>
    </div>

    <div class="drawer-header">
      <div class="drawer-header-top">
        <h2 class="drawer-title">{labels.title ?? 'Widget Tray'}</h2>
        <button class="drawer-close-btn" onclick={onClose} aria-label="Close">
          <Icon name="x" size={16} />
        </button>
      </div>
      <p class="drawer-subtitle">
        {labels.subtitle ?? 'Browse and add widgets to your board.'}
      </p>
    </div>

    <div class="drawer-filters">
      {#each filters as filter (filter.key)}
        <button
          class="drawer-filter-btn"
          class:active={activeFilter === filter.key}
          onclick={() => (activeFilter = filter.key)}
        >
          {filter.label()}
        </button>
      {/each}
    </div>

    <div class="drawer-content">
      <div class="drawer-tiles-grid" role="list">
        {#each filteredWidgets as widget (widget.id)}
          {@const instance = getInstanceForWidget(widget.id)}
          <div
            class="drawer-tile"
            role="listitem"
            draggable={!instance ? 'true' : 'false'}
            ondragstart={(event) => handleDragStart(event, widget)}
            ondragend={handleDragEnd}
          >
            <!-- Top: live S-size widget preview inside WidgetCard -->
            <div class="drawer-tile-preview">
              <WidgetCard
                instanceId=""
                size="S"
                colSpan={3}
                rowSpan={1}
                draggable={false}
                glowColor="gold"
                showControls={false}
                clipContent={false}
              >
                {#if tilePreview}
                  {@render tilePreview(widget)}
                {:else}
                  <div class="drawer-locked-preview">
                    <span class="widget-category-label">{widget.name}</span>
                  </div>
                {/if}
              </WidgetCard>
            </div>

            <!-- Middle: widget info -->
            <div class="drawer-tile-info">
              <div class="drawer-tile-meta">
                <span class="drawer-tile-category">{getWidgetCategoryLabel(widget)}</span>
              </div>
              <span class="drawer-tile-name">{widget.name}</span>
              <span class="drawer-tile-desc">{widget.description}</span>
            </div>

            <!-- Bottom: size selector + action button -->
            <div class="drawer-tile-footer">
                <div class="drawer-tile-controls">
                  {#each getAvailableSizes(widget) as s}
                    <button
                      class="drawer-ctrl-size"
                      class:drawer-ctrl-size-active={s === getSelectedSize(widget)}
                      type="button"
                      onclick={() => handleSizeSelect(widget, s)}
                    >
                      {s}
                    </button>
                  {/each}
                </div>
                {#if instance}
                  {#if confirmRemoveId === instance.id}
                    <button
                      class="drawer-tile-btn drawer-tile-btn-remove"
                      onclick={() => handleRemoveConfirm(instance.id)}
                    >
                      {labels.removeConfirm ?? 'Remove?'}
                    </button>
                  {:else}
                    <button
                      class="drawer-tile-btn drawer-tile-btn-added"
                      onclick={() => handleRemoveClick(instance.id)}
                    >
                      {labels.alreadyAdded ?? 'Added'}
                    </button>
                  {/if}
                {:else}
                  <button
                    class="drawer-tile-btn drawer-tile-btn-add"
                    onclick={() => handleAdd(widget)}
                  >
                    {labels.addToBoard ?? '+ Add'}
                  </button>
                {/if}
            </div>
          </div>
        {/each}
      </div>
    </div>
  </aside>
{/if}

<style>
  @keyframes drawer-slide-up {
    from { transform: translateY(100%); opacity: 0; }
    to   { transform: translateY(0);    opacity: 1; }
  }

  .drawer-backdrop {
    position: fixed;
    inset: 0;
    background: color-mix(in srgb, var(--color-surface-dim) 50%, transparent);
    backdrop-filter: blur(4px);
    z-index: 100;
    pointer-events: all;
  }

  .drawer-panel {
    position: fixed;
    bottom: var(--space-3);
    left: calc(var(--shell-sidebar-offset, var(--sidebar-width)) + var(--space-4));
    right: calc(var(--notification-panel-width, 0px) + var(--space-4));
    min-height: 280px;
    max-height: 90vh;
    background: var(--color-surface-low);
    border-radius: 1.5rem;
    z-index: 101;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    animation: drawer-slide-up var(--motion-component);
  }

  .drawer-handle {
    width: 100%;
    padding: var(--space-3) 0 var(--space-1);
    cursor: ns-resize;
    display: flex;
    justify-content: center;
    align-items: center;
    flex-shrink: 0;
  }

  .drawer-handle-bar {
    width: 40px;
    height: 4px;
    border-radius: 9999px;
    background: color-mix(in srgb, var(--color-outline) 40%, transparent);
  }

  .drawer-header {
    padding: var(--space-4) var(--space-6) var(--space-3);
    flex-shrink: 0;
  }

  .drawer-header-top {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--space-1);
  }

  .drawer-title {
    margin: 0;
    font-size: 18px;
    font-weight: 700;
    color: var(--color-on-surface);
  }

  .drawer-subtitle {
    margin: 0;
    font-size: 12px;
    color: var(--color-on-surface-variant);
  }

  .drawer-close-btn {
    background: none;
    border: none;
    color: var(--color-on-surface-variant);
    cursor: pointer;
    padding: var(--space-1);
    border-radius: var(--radius-sm);
  }

  .drawer-close-btn:hover {
    color: var(--color-on-surface);
    background: color-mix(in srgb, var(--color-surface-high) 60%, transparent);
  }

  .drawer-filters {
    display: flex;
    gap: var(--space-2);
    padding: var(--space-2) var(--space-6) var(--space-3);
    flex-wrap: wrap;
    flex-shrink: 0;
  }

  .drawer-filter-btn {
    padding: 4px 14px;
    border-radius: var(--radius-full);
    font-size: 11px;
    font-weight: 700;
    font-family: var(--font-mono);
    letter-spacing: 0.06em;
    text-transform: uppercase;
    cursor: pointer;
    border: none;
    transition: background 0.15s, color 0.15s;
  }

  .drawer-filter-btn.active {
    background: var(--color-primary-fixed);
    color: var(--color-on-primary-fixed);
  }

  .drawer-filter-btn:not(.active) {
    background: color-mix(in srgb, var(--color-surface-high) 80%, transparent);
    color: var(--color-on-surface-variant);
  }

  .drawer-filter-btn:not(.active):hover {
    color: var(--color-on-surface);
    background: var(--color-surface-high);
  }

  .drawer-filter-btn:focus-visible {
    outline: 2px solid var(--color-primary-fixed);
    outline-offset: 2px;
  }

  .drawer-content {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
  }

  .drawer-tiles-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: var(--space-4);
    padding: var(--space-4) var(--space-6) var(--space-8);
  }

  .drawer-tile {
    display: flex;
    flex-direction: column;
    gap: 0;
    transition: transform 0.15s ease;
  }

  .drawer-tile:hover {
    transform: scale(1.01);
  }

  .drawer-tile-preview {
    background: var(--color-surface-card);
    border-radius: 1rem;
    overflow: visible;
  }

  .drawer-tile-info {
    padding: var(--space-3) var(--space-4) var(--space-2);
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    flex: 1;
  }

  .drawer-tile-footer {
    padding: var(--space-2) var(--space-4) var(--space-4);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
  }

  .drawer-tile-controls {
    display: flex;
    align-items: center;
    gap: 2px;
    background: color-mix(in srgb, var(--color-surface-dim) 80%, transparent);
    border: 1px solid color-mix(in srgb, var(--color-outline-variant) 20%, transparent);
    border-radius: var(--radius-full);
    padding: 2px;
    width: fit-content;
  }

  .drawer-ctrl-size {
    font-size: var(--font-size-xs);
    font-weight: 700;
    font-family: var(--font-mono);
    letter-spacing: 0.04em;
    color: var(--color-on-surface-variant);
    background: none;
    border: none;
    border-radius: var(--radius-full);
    padding: 3px 8px;
    cursor: pointer;
    transition: background 0.1s, color 0.1s;
    line-height: 1;
  }

  .drawer-ctrl-size:hover {
    color: var(--color-on-surface);
  }

  .drawer-ctrl-size-active {
    background: var(--color-surface-high);
    color: var(--color-on-surface);
  }

  .drawer-locked-preview {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--space-2);
    height: 100%;
    color: var(--color-outline);
  }

  .drawer-tile-meta {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .drawer-tile-category {
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--color-on-surface-variant);
  }

  .drawer-tile-name {
    font-size: 13px;
    font-weight: 600;
    color: var(--color-on-surface);
  }

  .drawer-tile-desc {
    font-size: 11px;
    color: var(--color-on-surface-variant);
    line-height: 1.4;
  }

  .drawer-tile-btn {
    padding: var(--space-2) var(--space-3);
    border-radius: var(--radius-full);
    font-size: var(--font-size-xs);
    font-weight: 700;
    font-family: var(--font-mono);
    letter-spacing: 0.06em;
    text-transform: uppercase;
    cursor: pointer;
    border: none;
    transition: background 0.15s;
    white-space: nowrap;
  }

  .drawer-tile-btn-add {
    background: color-mix(in srgb, var(--color-primary-fixed) 15%, transparent);
    color: var(--color-primary-fixed);
  }

  .drawer-tile-btn-add:hover {
    background: color-mix(in srgb, var(--color-primary-fixed) 25%, transparent);
  }

  .drawer-tile-btn-added {
    background: color-mix(in srgb, var(--color-secondary) 10%, transparent);
    color: var(--color-secondary);
    cursor: default;
  }

  .drawer-tile-btn-remove {
    color: var(--color-error);
    background: color-mix(in srgb, var(--color-error-container) 20%, transparent);
  }

  /* Pi 3/4 performance fallback */
  @media (prefers-reduced-motion: reduce), (max-resolution: 1.5dppx) {
    .drawer-backdrop {
      backdrop-filter: none;
      background: color-mix(in srgb, var(--color-surface-dim) 80%, transparent);
    }
  }
</style>
