<script lang="ts">
  import {
    isWidgetDefinition,
    isWidgetTeaserDefinition,
    type WidgetCategory,
    type WidgetInstance,
    type WidgetManifestEntry,
    type WidgetSize,
  } from '@phavo/types';
  import type { Snippet } from 'svelte';
  import { onMount } from 'svelte';
  import { fade, fly } from 'svelte/transition';
  import Icon from './Icon.svelte';

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
      locked?: string;
      upgradePrompt?: string;
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

  const DEFAULT_MOBILE_HEIGHT = 60;
  const DESKTOP_BREAKPOINT = 640;
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
  let activeLockedId = $state<string | null>(null);
  let isDraggingFromDrawer = $state(false);
  let isDesktop = $state(false);
  let mobileDrawerHeight = $state(DEFAULT_MOBILE_HEIGHT);
  let selectedSizes = $state<Record<string, WidgetSize>>({});

  const filters: { key: Category; label: () => string }[] = [
    { key: 'all', label: () => labels.filterAll ?? 'All' },
    { key: 'system', label: () => labels.filterSystem ?? 'System' },
    { key: 'consumer', label: () => labels.filterConsumer ?? 'Consumer' },
    { key: 'integration', label: () => labels.filterIntegration ?? 'Integration' },
    { key: 'utility', label: () => labels.filterUtility ?? 'Utility' },
  ];

  onMount(() => {
    const syncViewport = () => {
      isDesktop = window.innerWidth >= DESKTOP_BREAKPOINT;
    };

    syncViewport();
    window.addEventListener('resize', syncViewport);

    return () => {
      window.removeEventListener('resize', syncViewport);
    };
  });

  onMount(() => {
    return $effect.root(() => {
      $effect(() => {
        if (open) return;
        mobileDrawerHeight = DEFAULT_MOBILE_HEIGHT;
        confirmRemoveId = null;
        activeLockedId = null;
        selectedSizes = {};
      });
    });
  });

  const filteredWidgets = $derived(
    activeFilter === 'all'
      ? widgets
      : widgets.filter(
          (widget) =>
            isWidgetTeaserDefinition(widget) ||
            (isWidgetDefinition(widget) && widget.category === activeFilter),
        ),
  );

  const visibleTileCount = $derived(filteredWidgets.length);

  function getInstanceForWidget(widgetId: string): WidgetInstance | undefined {
    return instances.find((instance) => instance.widgetId === widgetId);
  }

  function isLocked(widget: WidgetManifestEntry): boolean {
    return isWidgetTeaserDefinition(widget);
  }

  function getAvailableSizes(widget: WidgetManifestEntry): WidgetSize[] {
    return isWidgetDefinition(widget) ? widget.sizes : ['S'];
  }

  function getDefaultSize(widget: WidgetManifestEntry): WidgetSize {
    const availableSizes = getAvailableSizes(widget);
    return availableSizes.includes('S') ? 'S' : (availableSizes[0] ?? 'S');
  }

  function getSelectedSize(widget: WidgetManifestEntry): WidgetSize {
    const selectedSize = selectedSizes[widget.id];
    return selectedSize && getAvailableSizes(widget).includes(selectedSize)
      ? selectedSize
      : getDefaultSize(widget);
  }

  function handleSizeSelect(widget: WidgetManifestEntry, size: WidgetSize) {
    if (!isWidgetDefinition(widget) || !widget.sizes.includes(size)) return;
    selectedSizes = {
      ...selectedSizes,
      [widget.id]: size,
    };
  }

  function handleAdd(widget: WidgetManifestEntry) {
    onAdd(widget.id, getSelectedSize(widget));
  }

  function handleLockedClick(widgetId: string) {
    activeLockedId = activeLockedId === widgetId ? null : widgetId;
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
    if (isLocked(widget) || !isWidgetDefinition(widget) || !event.dataTransfer) return;
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
    if (!isWidgetDefinition(widget)) return 'custom';
    return widget.category;
  }

  function getWidgetCategoryLabel(widget: WidgetManifestEntry): string {
    const category = getWidgetCategory(widget);
    return category.charAt(0).toUpperCase() + category.slice(1);
  }

  function getWidgetIcon(widget: WidgetManifestEntry): string {
    if (isWidgetTeaserDefinition(widget)) return 'lock';
    return CATEGORY_ICONS[widget.category] ?? 'layout-grid';
  }

  function getTierLabel(widget: WidgetManifestEntry): string {
    if (isWidgetTeaserDefinition(widget)) {
      return labels.locked ?? 'Locked';
    }

    return widget.tier.charAt(0).toUpperCase() + widget.tier.slice(1);
  }
</script>

{#if open}
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div
    class="fixed inset-0 z-[210] bg-black/42 backdrop-blur-[2px]"
    onclick={handleBackdropClick}
    aria-hidden="true"
    style="pointer-events: {isDraggingFromDrawer ? 'none' : 'auto'}"
    transition:fade={{ duration: 140 }}
  ></div>

  <aside
    class="widget-tray fixed z-[220] flex flex-col overflow-hidden"
    style="height: {isDesktop ? 'min(72dvh, 760px)' : `${mobileDrawerHeight}vh`}"
    aria-label={labels.title ?? 'Widget Tray'}
    transition:fly={{ y: isDesktop ? 520 : 360, duration: isDesktop ? 260 : 220 }}
  >
    <div class="tray-header">
      <div class="tray-header-copy">
        <span class="tray-eyebrow">Widget library</span>
        <div class="tray-title-row">
          <h2 class="tray-title">{labels.title ?? 'Widget Tray'}</h2>
          <span class="tray-count">{visibleTileCount} tiles</span>
        </div>
        <p class="tray-description">
          {labels.subtitle ?? 'Browse structured S-size widget tiles and place them onto the board.'}
        </p>
      </div>

      <button class="tray-close" onclick={onClose} aria-label="Close">
        <Icon name="x" size={16} />
      </button>
    </div>

    <div class="tray-filter-row">
      {#each filters as filter (filter.key)}
        <button
          class="tray-filter-chip"
          class:tray-filter-chip-active={activeFilter === filter.key}
          onclick={() => (activeFilter = filter.key)}
        >
          {filter.label()}
        </button>
      {/each}
    </div>

    <div class="tray-scroll">
      <div class="tray-grid" role="list">
        {#each filteredWidgets as widget (widget.id)}
          {@const instance = getInstanceForWidget(widget.id)}
          {@const locked = isLocked(widget)}
          <div
            class="tray-tile"
            class:tray-tile-added={!!instance && !locked}
            class:tray-tile-locked={locked}
            role="listitem"
            draggable={!locked && !instance ? 'true' : 'false'}
            ondragstart={(event) => handleDragStart(event, widget)}
            ondragend={handleDragEnd}
          >
            <div class="tray-tile-preview">
              <div class="tray-tile-meta-row">
                <span class="tray-tile-category">{getWidgetCategoryLabel(widget)}</span>
                <span class="tray-tile-tier">{getTierLabel(widget)}</span>
              </div>

              <div class="tray-tile-preview-body">
                {#if tilePreview}
                  <div class="tray-tile-preview-content">
                    {@render tilePreview(widget)}
                  </div>
                {:else}
                  <div class="tray-tile-preview-fallback">
                    <span class="tray-tile-fallback-icon">
                      <Icon name={getWidgetIcon(widget)} size={18} />
                    </span>
                    <div class="tray-tile-fallback-copy">
                      <span class="tray-tile-fallback-kicker">
                        {locked ? (labels.locked ?? 'Locked') : 'Live preview'}
                      </span>
                      <p class="tray-tile-fallback-text">
                        {locked
                          ? 'Upgrade to unlock this widget preview.'
                          : 'Live widget data appears here when available.'}
                      </p>
                    </div>
                  </div>
                {/if}
              </div>
            </div>

            <div class="tray-tile-body">
              <div class="tray-tile-copy">
                <h3 class="tray-tile-title">{widget.name}</h3>
                <p class="tray-tile-description">{widget.description}</p>
              </div>

              <div class="tray-size-row" aria-label="Widget sizes">
                {#each SIZE_OPTIONS as size}
                  <button
                    class="tray-size-chip"
                    class:tray-size-chip-active={size === getSelectedSize(widget)}
                    type="button"
                    disabled={locked || !getAvailableSizes(widget).includes(size)}
                    aria-pressed={size === getSelectedSize(widget)}
                    onclick={() => handleSizeSelect(widget, size)}
                  >
                    {size}
                  </button>
                {/each}
              </div>

              <div class="tray-tile-footer">
                {#if locked}
                  <button class="tray-action tray-action-locked" onclick={() => handleLockedClick(widget.id)}>
                    <Icon name="lock" size={14} />
                    <span>{labels.locked ?? 'Locked'}</span>
                  </button>
                {:else if instance}
                  {#if confirmRemoveId === instance.id}
                    <button class="tray-action tray-action-remove" onclick={() => handleRemoveConfirm(instance.id)}>
                      {labels.removeConfirm ?? 'Remove?'}
                    </button>
                  {:else}
                    <button class="tray-action tray-action-added" onclick={() => handleRemoveClick(instance.id)}>
                      <Icon name="check" size={14} />
                      <span>{labels.alreadyAdded ?? 'Added'}</span>
                    </button>
                  {/if}
                {:else}
                  <button class="tray-action tray-action-add" onclick={() => handleAdd(widget)}>
                    <Icon name="plus" size={14} />
                    <span>{labels.addToBoard ?? 'Add to board'}</span>
                  </button>
                {/if}
              </div>

              {#if locked && activeLockedId === widget.id}
                <div class="tray-tile-message">
                  <Icon name="sparkles" size={14} />
                  <span>
                    {labels.upgradePrompt ?? 'Upgrade to Standard to unlock this widget and add it to the board.'}
                  </span>
                </div>
              {/if}
            </div>
          </div>
        {/each}
      </div>
    </div>
  </aside>
{/if}

<style>
  .widget-tray {
    left: 0;
    right: 0;
    bottom: 0;
    background:
      radial-gradient(
        ellipse 78% 90% at 50% 0%,
        color-mix(in srgb, var(--color-accent-t) 38%, transparent),
        transparent 74%
      ),
      linear-gradient(
        180deg,
        color-mix(in srgb, var(--color-bg-elevated) 94%, transparent),
        color-mix(in srgb, var(--color-bg-surface) 98%, transparent)
      );
    border: 1px solid color-mix(in srgb, var(--color-accent) 20%, var(--color-border-subtle));
    border-bottom: none;
    border-radius: calc(var(--radius-xl) + 4px) calc(var(--radius-xl) + 4px) 0 0;
    box-shadow:
      0 -22px 60px rgba(0, 0, 0, 0.56),
      inset 0 1px 0 color-mix(in srgb, var(--color-accent) 12%, transparent);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
  }

  .tray-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--space-4);
    padding: var(--space-6) var(--space-6) var(--space-5);
    border-bottom: 1px solid color-mix(in srgb, var(--color-border-subtle) 88%, transparent);
  }

  .tray-header-copy {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    min-width: 0;
  }

  .tray-eyebrow {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.24em;
    text-transform: uppercase;
    color: var(--color-accent-text);
  }

  .tray-title-row {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    flex-wrap: wrap;
  }

  .tray-title {
    margin: 0;
    font-size: 1.1rem;
    font-weight: 700;
    letter-spacing: -0.03em;
    color: var(--color-text-primary);
  }

  .tray-count {
    display: inline-flex;
    align-items: center;
    padding: 2px var(--space-2);
    border-radius: 999px;
    background: color-mix(in srgb, var(--color-bg-base) 72%, transparent);
    border: 1px solid color-mix(in srgb, var(--color-accent) 20%, transparent);
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--color-text-secondary);
  }

  .tray-description {
    margin: 0;
    font-size: var(--font-size-sm);
    line-height: 1.6;
    color: var(--color-text-secondary);
    max-width: 58ch;
  }

  .tray-close {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 38px;
    height: 38px;
    flex-shrink: 0;
    background: color-mix(in srgb, var(--color-bg-base) 76%, transparent);
    border: 1px solid var(--color-border-subtle);
    border-radius: 999px;
    color: var(--color-text-secondary);
    cursor: pointer;
    transition: color 0.15s ease, border-color 0.15s ease, background 0.15s ease;
  }

  .tray-close:hover {
    color: var(--color-text-primary);
    border-color: color-mix(in srgb, var(--color-accent) 24%, transparent);
    background: color-mix(in srgb, var(--color-bg-hover) 84%, transparent);
  }

  .tray-filter-row {
    display: flex;
    gap: var(--space-2);
    padding: 0 var(--space-6) var(--space-5);
    overflow-x: auto;
    scrollbar-width: none;
  }

  .tray-filter-row::-webkit-scrollbar {
    display: none;
  }

  .tray-filter-chip {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 34px;
    padding: 0 var(--space-4);
    border-radius: 999px;
    border: 1px solid var(--color-border-subtle);
    background: color-mix(in srgb, var(--color-bg-base) 72%, transparent);
    color: var(--color-text-secondary);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    white-space: nowrap;
    cursor: pointer;
    transition: color 0.15s ease, border-color 0.15s ease, background 0.15s ease;
  }

  .tray-filter-chip:hover {
    color: var(--color-text-primary);
    border-color: color-mix(in srgb, var(--color-accent) 18%, transparent);
  }

  .tray-filter-chip-active {
    color: var(--color-bg-base);
    border-color: var(--color-accent);
    background: var(--color-accent);
  }

  .tray-scroll {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 0 var(--space-6) calc(var(--space-7) + env(safe-area-inset-bottom, 0px));
    scrollbar-width: none;
    background:
      linear-gradient(180deg, transparent, color-mix(in srgb, var(--color-bg-base) 12%, transparent));
  }

  .tray-scroll::-webkit-scrollbar {
    display: none;
  }

  .tray-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: var(--space-4);
    grid-auto-rows: minmax(0, auto);
    align-content: start;
    padding-bottom: var(--space-1);
  }

  .tray-tile {
    display: grid;
    grid-template-rows: minmax(128px, 144px) minmax(0, 1fr);
    min-height: 264px;
    border-radius: var(--radius-xl);
    border: 1px solid color-mix(in srgb, var(--color-accent) 10%, var(--color-border-subtle));
    background:
      linear-gradient(
        180deg,
        color-mix(in srgb, var(--color-bg-elevated) 88%, transparent),
        color-mix(in srgb, var(--color-bg-surface) 96%, transparent)
      );
    box-shadow: var(--shadow-sm);
    overflow: hidden;
    transition: transform 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease;
  }

  .tray-tile:hover {
    transform: translateY(-1px);
    border-color: color-mix(in srgb, var(--color-accent) 24%, var(--color-border-subtle));
    box-shadow: var(--shadow-md);
  }

  .tray-tile-added {
    border-color: color-mix(in srgb, var(--color-success) 32%, var(--color-border-subtle));
  }

  .tray-tile-locked {
    border-color: color-mix(in srgb, var(--color-warning) 28%, var(--color-border-subtle));
  }

  .tray-tile-preview {
    display: grid;
    grid-template-rows: auto minmax(0, 1fr);
    gap: var(--space-4);
    min-height: 0;
    padding: var(--space-4) var(--space-5);
    border-bottom: 1px solid color-mix(in srgb, var(--color-border-subtle) 86%, transparent);
    background:
      radial-gradient(
        ellipse 56% 70% at 0% 0%,
        color-mix(in srgb, var(--color-accent-t) 30%, transparent),
        transparent 78%
      ),
      color-mix(in srgb, var(--color-bg-base) 18%, var(--color-bg-surface));
    overflow: hidden;
  }

  .tray-tile-preview-body {
    display: flex;
    align-items: stretch;
    min-height: 0;
    overflow: hidden;
  }

  .tray-tile-meta-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
  }

  .tray-tile-category,
  .tray-tile-tier {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.16em;
    text-transform: uppercase;
  }

  .tray-tile-category {
    color: var(--color-text-muted);
  }

  .tray-tile-tier {
    color: var(--color-text-secondary);
  }

  .tray-tile-preview-content {
    display: flex;
    align-items: center;
    width: 100%;
    min-height: 0;
    overflow: hidden;
  }

  .tray-tile-preview-fallback {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    width: 100%;
    min-height: 0;
    padding: var(--space-3);
    border-radius: var(--radius-lg);
    border: 1px solid color-mix(in srgb, var(--color-border-subtle) 84%, transparent);
    background: color-mix(in srgb, var(--color-bg-base) 42%, transparent);
    overflow: hidden;
  }

  .tray-tile-fallback-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 34px;
    height: 34px;
    border-radius: 10px;
    flex-shrink: 0;
    background: color-mix(in srgb, var(--color-accent-t) 90%, transparent);
    border: 1px solid color-mix(in srgb, var(--color-accent) 18%, transparent);
    color: var(--color-accent-text);
  }

  .tray-tile-fallback-copy {
    display: flex;
    min-width: 0;
    flex-direction: column;
    gap: 4px;
  }

  .tray-tile-fallback-kicker {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: var(--color-text-muted);
  }

  .tray-tile-fallback-text {
    margin: 0;
    color: var(--color-text-secondary);
    font-size: 11px;
    line-height: 1.45;
  }

  .tray-tile-body {
    display: grid;
    grid-template-rows: auto auto minmax(0, 1fr) auto;
    gap: var(--space-4);
    padding: var(--space-4) var(--space-5) var(--space-5);
    min-height: 0;
  }

  .tray-tile-copy {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    min-height: 0;
  }

  .tray-tile-title {
    margin: 0;
    font-size: 1rem;
    font-weight: 700;
    letter-spacing: -0.02em;
    color: var(--color-text-primary);
  }

  .tray-tile-description {
    margin: 0;
    font-size: var(--font-size-sm);
    line-height: 1.55;
    color: var(--color-text-secondary);
    line-clamp: 2;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .tray-size-row {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  .tray-size-chip {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 28px;
    min-height: 28px;
    padding: 0 var(--space-2);
    border-radius: 999px;
    border: 1px solid var(--color-border-subtle);
    background: color-mix(in srgb, var(--color-bg-base) 60%, transparent);
    color: var(--color-text-muted);
    font-size: 11px;
    font-weight: 700;
    cursor: pointer;
    transition:
      color 0.15s ease,
      border-color 0.15s ease,
      background 0.15s ease,
      opacity 0.15s ease;
  }

  .tray-size-chip:disabled {
    cursor: not-allowed;
    opacity: 0.4;
  }

  .tray-size-chip-active {
    opacity: 1;
    border-color: color-mix(in srgb, var(--color-accent) 26%, transparent);
    color: var(--color-accent-text);
    background: color-mix(in srgb, var(--color-accent-t) 90%, transparent);
  }

  .tray-tile-footer {
    margin-top: auto;
  }

  .tray-action {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-2);
    width: 100%;
    min-height: 40px;
    padding: 0 var(--space-4);
    border-radius: 999px;
    border: 1px solid var(--color-border-subtle);
    background: color-mix(in srgb, var(--color-bg-base) 68%, transparent);
    color: var(--color-text-primary);
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.02em;
    cursor: pointer;
    transition: color 0.15s ease, border-color 0.15s ease, background 0.15s ease;
  }

  .tray-action:hover {
    border-color: color-mix(in srgb, var(--color-accent) 22%, transparent);
    background: color-mix(in srgb, var(--color-bg-hover) 86%, transparent);
  }

  .tray-action-add {
    border-color: color-mix(in srgb, var(--color-accent) 24%, var(--color-border-subtle));
    color: var(--color-accent-text);
  }

  .tray-action-added {
    color: var(--color-success);
    border-color: color-mix(in srgb, var(--color-success) 28%, transparent);
  }

  .tray-action-remove {
    color: var(--color-text-primary);
    border-color: color-mix(in srgb, var(--color-danger) 32%, transparent);
    background: color-mix(in srgb, var(--color-danger-subtle) 72%, transparent);
  }

  .tray-action-locked {
    color: var(--color-warning);
    border-color: color-mix(in srgb, var(--color-warning) 28%, transparent);
  }

  .tray-tile-message {
    display: flex;
    align-items: flex-start;
    gap: var(--space-2);
    padding: var(--space-3);
    border-radius: var(--radius-lg);
    border: 1px solid color-mix(in srgb, var(--color-warning) 24%, transparent);
    background: color-mix(in srgb, var(--color-warning-subtle) 78%, transparent);
    color: var(--color-text-primary);
    font-size: 11px;
    line-height: 1.5;
  }

  @media (min-width: 640px) {
    .widget-tray {
      left: calc(var(--shell-sidebar-offset, 0px) + var(--space-8));
      right: var(--space-8);
      bottom: var(--space-6);
      border-bottom: 1px solid color-mix(in srgb, var(--color-accent) 20%, var(--color-border-subtle));
      border-radius: calc(var(--radius-xl) + 12px);
    }
  }

  @media (max-width: 639px) {
    .tray-header,
    .tray-filter-row,
    .tray-scroll {
      padding-left: var(--space-5);
      padding-right: var(--space-5);
    }

    .tray-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: var(--space-3);
    }

    .tray-tile {
      min-height: 236px;
    }
  }
</style>
