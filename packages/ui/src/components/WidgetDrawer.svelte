<script lang="ts">
  import {
    isWidgetDefinition,
    isWidgetTeaserDefinition,
    type WidgetCategory,
    type WidgetDefinition,
    type WidgetInstance,
    type WidgetManifestEntry,
    type WidgetSize,
  } from '@phavo/types';
  import { onMount } from 'svelte';
  import type { Snippet } from 'svelte';
  import * as icons from '../icons/icons';

  type Category = 'all' | WidgetCategory;

  interface Props {
    open: boolean;
    widgets: WidgetManifestEntry[];
    instances: WidgetInstance[];
    onClose: () => void;
    onAdd: (widgetId: string, size: WidgetSize) => void;
    onRemove: (instanceId: string) => void;
    /** Render a live widget preview for a given widgetId */
    preview?: Snippet<[string, unknown | undefined, boolean, boolean]>;
    /** Called when a drag starts from inside the drawer */
    onDragStartFromDrawer?: () => void;
    /** Called when a drag from the drawer ends (drop or cancel) */
    onDragEndFromDrawer?: () => void;
    /** i18n labels */
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
    preview,
    onDragStartFromDrawer,
    onDragEndFromDrawer,
    labels = {},
  }: Props = $props();

  let activeFilter = $state<Category>('all');
  let selectedSizes = $state<Record<string, WidgetSize>>({});
  let confirmRemoveId = $state<string | null>(null);
  let activeLockedId = $state<string | null>(null);
  let isDraggingFromDrawer = $state(false);
  let previewData = $state<Record<string, unknown>>({});
  let previewLoading = $state<Record<string, boolean>>({});
  let previewErrors = $state<Record<string, string | null>>({});

  const previewRequests = new Map<string, Promise<void>>();
  const DEFAULT_MOBILE_HEIGHT = 60;
  const DEFAULT_DESKTOP_HEIGHT = 400;
  const MIN_DESKTOP_HEIGHT = 200;
  const DESKTOP_BREAKPOINT = 640;

  let isDesktop = $state(false);
  let desktopDrawerHeight = $state(DEFAULT_DESKTOP_HEIGHT);
  let mobileDrawerHeight = $state(DEFAULT_MOBILE_HEIGHT);
  let isResizing = $state(false);

  onMount(() => {
    return $effect.root(() => {
      $effect(() => {
        if (!open) {
          desktopDrawerHeight = DEFAULT_DESKTOP_HEIGHT;
          mobileDrawerHeight = DEFAULT_MOBILE_HEIGHT;
          previewData = {};
          previewLoading = {};
          previewErrors = {};
          previewRequests.clear();
          return;
        }

        const previewableWidgets = widgets.filter(
          (widget): widget is WidgetDefinition => isWidgetDefinition(widget),
        );

        for (const widget of previewableWidgets) {
          void loadPreview(widget);
        }
      });
    });
  });

  onMount(() => {
    const syncViewport = () => {
      isDesktop = window.innerWidth >= DESKTOP_BREAKPOINT;
      if (isDesktop) {
        desktopDrawerHeight = Math.min(getMaxDesktopHeight(), Math.max(MIN_DESKTOP_HEIGHT, desktopDrawerHeight));
      }
    };

    syncViewport();
    window.addEventListener('resize', syncViewport);

    return () => {
      window.removeEventListener('resize', syncViewport);
    };
  });

  const filters: { key: Category; label: () => string }[] = [
    { key: 'all', label: () => labels.filterAll ?? 'All' },
    { key: 'system', label: () => labels.filterSystem ?? 'System' },
    { key: 'consumer', label: () => labels.filterConsumer ?? 'Consumer' },
    { key: 'integration', label: () => labels.filterIntegration ?? 'Integration' },
    { key: 'utility', label: () => labels.filterUtility ?? 'Utility' },
  ];

  const filteredWidgets = $derived(
    activeFilter === 'all'
      ? widgets
      : widgets.filter(
          (w) => isWidgetTeaserDefinition(w) || (isWidgetDefinition(w) && w.category === activeFilter),
        ),
  );

  function getInstanceForWidget(widgetId: string): WidgetInstance | undefined {
    return instances.find((i) => i.widgetId === widgetId);
  }

  function isLocked(w: WidgetManifestEntry): boolean {
    return isWidgetTeaserDefinition(w);
  }

  function getSelectedSize(w: WidgetManifestEntry): WidgetSize {
    if (!isWidgetDefinition(w)) return 'M';
    return selectedSizes[w.id] ?? w.sizes[0] ?? 'M';
  }

  function handleSizeSelect(widgetId: string, size: WidgetSize) {
    selectedSizes = { ...selectedSizes, [widgetId]: size };
  }

  function handleAdd(w: WidgetDefinition) {
    onAdd(w.id, getSelectedSize(w));
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

  function handleDragStart(e: DragEvent, w: WidgetManifestEntry) {
    if (isLocked(w) || !isWidgetDefinition(w) || !e.dataTransfer) return;
    isDraggingFromDrawer = true;
    e.dataTransfer.effectAllowed = 'copy';
    e.dataTransfer.setData('application/phavo-widget', JSON.stringify({
      widgetId: w.id,
      size: getSelectedSize(w),
    }));
    onDragStartFromDrawer?.();
  }

  function handleDragEnd() {
    isDraggingFromDrawer = false;
    onDragEndFromDrawer?.();
  }

  function getMaxDesktopHeight(): number {
    return Math.max(MIN_DESKTOP_HEIGHT, Math.floor(window.innerHeight * 0.85));
  }

  function startResize(event: MouseEvent) {
    if (!isDesktop) return;

    isResizing = true;
    const startY = event.clientY;
    const startHeight = desktopDrawerHeight;

    function onMouseMove(nextEvent: MouseEvent) {
      const delta = startY - nextEvent.clientY;
      desktopDrawerHeight = Math.min(getMaxDesktopHeight(), Math.max(MIN_DESKTOP_HEIGHT, startHeight + delta));
    }

    function onMouseUp() {
      isResizing = false;
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    }

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }

  function handleMobileResizeStart(e: PointerEvent) {
    isResizing = true;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    (e.currentTarget as HTMLElement).dataset.startY = String(e.clientY);
    (e.currentTarget as HTMLElement).dataset.startHeight = String(mobileDrawerHeight);
  }

  function handleMobileResizeMove(e: PointerEvent) {
    if (!isResizing) return;
    const handle = e.currentTarget as HTMLElement;
    const startY = Number(handle.dataset.startY ?? e.clientY);
    const startHeight = Number(handle.dataset.startHeight ?? mobileDrawerHeight);
    const delta = startY - e.clientY;
    const newHeightVh = startHeight + (delta / window.innerHeight) * 100;
    mobileDrawerHeight = Math.min(85, Math.max(25, newHeightVh));
  }

  function handleMobileResizeEnd(e: PointerEvent) {
    isResizing = false;
    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
  }

  async function loadPreview(widget: WidgetDefinition): Promise<void> {
    const inflightRequest = previewRequests.get(widget.id);
    if (inflightRequest) {
      await inflightRequest;
      return;
    }

    previewLoading = { ...previewLoading, [widget.id]: true };

    const request = (async () => {
      try {
        const response = await fetch(widget.dataEndpoint, { credentials: 'same-origin' });
        const payload = (await response.json().catch(() => null)) as
          | { ok: boolean; data?: unknown; error?: string }
          | null;

        if (!response.ok || !payload?.ok || payload.data == null) {
          throw new Error(payload?.error ?? 'Preview unavailable');
        }

        previewData = { ...previewData, [widget.id]: payload.data };
        previewErrors = { ...previewErrors, [widget.id]: null };
      } catch (error) {
        const nextPreviewData = { ...previewData };
        delete nextPreviewData[widget.id];
        previewData = nextPreviewData;
        previewErrors = {
          ...previewErrors,
          [widget.id]: error instanceof Error ? error.message : 'Preview unavailable',
        };
      } finally {
        previewLoading = { ...previewLoading, [widget.id]: false };
        previewRequests.delete(widget.id);
      }
    })();

    previewRequests.set(widget.id, request);
    await request;
  }
</script>

{#if open}
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div
    class="drawer-backdrop"
    onclick={handleBackdropClick}
    aria-hidden="true"
    style="pointer-events: {isDraggingFromDrawer ? 'none' : 'auto'}"
  ></div>
{/if}

<aside
  class="bottom-sheet"
  class:sheet-open={open}
  class:sheet-resizing={isResizing}
  style="height: {isDesktop ? `${desktopDrawerHeight}px` : `${mobileDrawerHeight}vh`}"
  aria-label={labels.title ?? 'Add Widgets'}
  aria-hidden={!open}
>
  <button
    class="drawer-resize-handle"
    onmousedown={startResize}
    type="button"
    aria-label="Resize drawer"
  >
    <div class="drawer-resize-bar"></div>
  </button>

  <!-- Resize handle -->
  <div
    class="sheet-handle-area"
    onpointerdown={handleMobileResizeStart}
    onpointermove={handleMobileResizeMove}
    onpointerup={handleMobileResizeEnd}
    role="separator"
    aria-label="Resize drawer"
    aria-orientation="horizontal"
  >
    <div class="sheet-handle"></div>
  </div>

  <!-- Header -->
  <div class="sheet-header">
    <div class="sheet-header-text">
      <span class="sheet-title">{labels.title ?? 'Add Widgets'}</span>
      <span class="sheet-subtitle">{labels.subtitle ?? 'Drag to place or click to add'}</span>
    </div>
    <button class="sheet-close" onclick={onClose} aria-label="Close">
      {@html icons.close()}
    </button>
  </div>

  <!-- Category filter pills -->
  <div class="sheet-filters">
    {#each filters as f (f.key)}
      <button
        class="filter-pill"
        class:filter-active={activeFilter === f.key}
        onclick={() => (activeFilter = f.key)}
      >
        {f.label()}
      </button>
    {/each}
  </div>

{#snippet drawerCardInner(w: WidgetManifestEntry, inst: WidgetInstance | undefined, locked: boolean)}
  <!-- Preview area -->
  <div class="drawer-card-preview" class:drawer-card-preview-locked={locked}>
    {#if locked}
      <div class="locked-preview-content">
        <span class="lock-icon">{@html icons.lock()}</span>
        <span class="lock-text">{labels.locked ?? 'LOCKED'}</span>
      </div>
    {:else if preview && isWidgetDefinition(w)}
      <div class="drawer-preview-scale">
        {@render preview(
          w.id,
          previewData[w.id],
          previewLoading[w.id] === true,
          (previewErrors[w.id] ?? null) !== null,
        )}
      </div>
    {:else}
      <div class="preview-placeholder">
        <span class="preview-name">{w.name}</span>
      </div>
    {/if}
  </div>

  <!-- Card footer -->
  <div class="drawer-card-footer">
    <div class="drawer-card-info">
      <span class="drawer-card-name">{w.name}</span>
      <span class="drawer-card-desc">{w.description}</span>
    </div>

    <!-- Size selector -->
    <div class="drawer-card-controls">
      {#if isWidgetDefinition(w)}
        <div class="size-selector">
          {#each w.sizes as s (s)}
            <button
              class="size-pill"
              class:size-active={getSelectedSize(w) === s}
              onclick={() => handleSizeSelect(w.id, s)}
              disabled={locked}
            >
              {s}
            </button>
          {/each}
        </div>
      {/if}

      <!-- Action button -->
      {#if locked}
        {#if activeLockedId === w.id}
          <div class="locked-prompt">
            <span class="locked-prompt-icon">{@html icons.lock()}</span>
            <span>{labels.upgradePrompt ?? 'Upgrade to Standard to unlock this widget — €8.99 one-time'}</span>
            <a
              class="locked-prompt-link"
              href="https://phavo.net/upgrade"
              target="_blank"
              rel="noreferrer"
              onclick={(event) => event.stopPropagation()}
            >
              phavo.net/upgrade
            </a>
          </div>
        {/if}
      {:else if inst}
        {#if confirmRemoveId === inst.id}
          <button class="action-btn action-remove-confirm" onclick={() => handleRemoveConfirm(inst.id)}>
            {labels.removeConfirm ?? 'Remove?'}
          </button>
        {:else}
          <button class="action-btn action-added" onclick={() => handleRemoveClick(inst.id)}>
            {@html icons.check()}
            <span>{labels.alreadyAdded ?? 'Added'}</span>
          </button>
        {/if}
      {:else}
        {#if isWidgetDefinition(w)}
          <button class="action-btn action-add" onclick={() => handleAdd(w)}>
            {@html icons.plus()}
            <span>{labels.addToBoard ?? 'Add'}</span>
          </button>
        {/if}
      {/if}
    </div>
  </div>
{/snippet}

  <!-- Widget grid -->
  <div class="sheet-body drawer-content">
    <div class="widget-grid-drawer" role="list">
      {#each filteredWidgets as w (w.id)}
        {@const inst = getInstanceForWidget(w.id)}
        {@const locked = isLocked(w)}
        {#if locked}
          <div
            class="drawer-card drawer-card-locked"
            role="button"
            tabindex="0"
            aria-label="{w.name} locked"
            onclick={() => handleLockedClick(w.id)}
            onkeydown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                handleLockedClick(w.id);
              }
            }}
            ondragstart={(e) => handleDragStart(e, w)}
            ondragend={handleDragEnd}
          >
            {@render drawerCardInner(w, inst, locked)}
          </div>
        {:else}
          <div
            class="drawer-card"
            class:drawer-card-added={!!inst}
            role="listitem"
            draggable={!inst ? 'true' : 'false'}
            ondragstart={(e) => handleDragStart(e, w)}
            ondragend={handleDragEnd}
          >
            {@render drawerCardInner(w, inst, locked)}
          </div>
        {/if}
      {/each}
    </div>
  </div>
</aside>

<style>
  .drawer-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.4);
    z-index: var(--z-overlay, 199);
    animation: fade-in 0.2s ease;
  }

  @keyframes fade-in {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  .bottom-sheet {
    position: fixed;
    bottom: 0;
    left: 0;
    width: 100%;
    height: 60vh; /* fallback; overridden by inline style */
    display: flex;
    flex-direction: column;
    background: var(--color-bg-surface);
    border-top: 1px solid var(--color-border);
    border-radius: var(--radius-lg, 12px) var(--radius-lg, 12px) 0 0;
    z-index: var(--z-panel, 200);
    transform: translateY(100%);
    transition: transform 0.3s ease-out;
  }

  .sheet-resizing {
    user-select: none;
    transition: none;
  }

  .sheet-open {
    transform: translateY(0);
  }

  .drawer-resize-handle {
    width: 100%;
    height: 16px;
    display: none;
    align-items: center;
    justify-content: center;
    cursor: ns-resize;
    flex-shrink: 0;
    padding: 0;
    background: none;
    border: none;
  }

  .drawer-resize-bar {
    width: 40px;
    height: 4px;
    background: var(--color-border);
    border-radius: 2px;
  }

  .drawer-resize-handle:hover .drawer-resize-bar {
    background: var(--color-text-muted);
  }

  .sheet-handle-area {
    display: flex;
    justify-content: center;
    padding: var(--space-2) 0;
    flex-shrink: 0;
    cursor: ns-resize;
    touch-action: none; /* prevent scroll interference on touch */
  }

  .sheet-handle {
    width: 40px;
    height: 4px;
    border-radius: 2px;
    background: var(--color-border);
  }

  .sheet-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 20px var(--space-6) var(--space-3);
    flex-shrink: 0;
  }

  .sheet-header-text {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .sheet-title {
    font-size: 1rem;
    font-weight: 600;
    color: var(--color-text);
  }

  .sheet-subtitle {
    font-size: 0.8rem;
    color: var(--color-text-muted);
  }

  .sheet-close {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    color: var(--color-text-muted);
    background: none;
    border: none;
    border-radius: var(--radius-sm, 4px);
    cursor: pointer;
    transition: color 0.15s, background 0.15s;
  }

  .sheet-close:hover {
    color: var(--color-text);
    background: var(--color-bg-hover);
  }

  .sheet-filters {
    display: flex;
    gap: var(--space-2);
    padding: 0 var(--space-6) var(--space-3);
    flex-shrink: 0;
    overflow-x: auto;
  }

  .filter-pill {
    padding: var(--space-1) var(--space-3);
    font-size: 0.8rem;
    font-weight: 500;
    border-radius: 999px;
    border: 1px solid var(--color-border);
    background: none;
    color: var(--color-text-muted);
    cursor: pointer;
    white-space: nowrap;
    transition: all 0.15s;
  }

  .filter-pill:hover {
    color: var(--color-text);
    border-color: var(--color-text-muted);
  }

  .filter-active {
    background: var(--color-accent);
    color: var(--color-bg);
    border-color: var(--color-accent);
  }

  .filter-active:hover {
    background: var(--color-accent);
    color: var(--color-bg);
    border-color: var(--color-accent);
  }

  .sheet-body {
    flex: 1;
    min-height: 0;
    padding: 0 var(--space-6) var(--space-6);
  }

  .drawer-content {
    overflow-y: auto;
    scrollbar-width: none;
    -ms-overflow-style: none;
  }

  .drawer-content::-webkit-scrollbar {
    display: none;
  }

  .widget-grid-drawer {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: var(--space-4);
  }

  .drawer-card {
    display: flex;
    flex-direction: column;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md, 8px);
    background: var(--color-bg);
    overflow: hidden;
    transition: border-color 0.15s, box-shadow 0.15s;
    cursor: grab;
  }

  .drawer-card:hover {
    border-color: var(--color-accent);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  }

  .drawer-card-locked {
    cursor: pointer;
  }

  .drawer-card-locked:hover {
    border-color: var(--color-accent);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
  }

  .drawer-card-added {
    border-color: var(--color-success, var(--color-accent));
    cursor: default;
  }

  .drawer-card-preview {
    position: relative;
    height: 140px;
    overflow: hidden;
    border-bottom: 1px solid var(--color-border-subtle);
    background: var(--color-bg-surface);
  }

  .drawer-preview-scale {
    width: 145%;
    height: 145%;
    transform: scale(0.69);
    transform-origin: top left;
    pointer-events: none;
  }

  .drawer-card-preview-locked {
    display: flex;
    flex: 1 1 auto;
    align-items: center;
    justify-content: center;
    min-height: 140px;
    padding: var(--space-4);
    background: color-mix(in srgb, var(--color-bg) 20%, transparent);
  }

  .locked-preview-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 6px;
  }

  .lock-icon {
    color: var(--color-warning);
    display: flex;
  }

  .lock-text {
    font-size: 11px;
    font-weight: 600;
    color: var(--color-warning);
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  .preview-placeholder {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: var(--color-text-muted);
    font-size: 0.9rem;
    font-weight: 500;
  }

  .preview-name {
    opacity: 0.6;
  }

  .locked-prompt {
    display: inline-flex;
    align-items: center;
    flex-wrap: wrap;
    gap: var(--space-1);
    padding: 4px 8px;
    border-radius: var(--radius-sm, 4px);
    background: var(--color-accent-subtle);
    color: var(--color-bg);
    font-size: 11px;
    font-weight: 600;
    line-height: 1.4;
  }

  .locked-prompt-icon {
    display: flex;
    flex-shrink: 0;
  }

  .locked-prompt-link {
    color: var(--color-bg);
    font-weight: 700;
    text-decoration: underline;
  }

  .locked-prompt-link:hover {
    color: var(--color-text-primary);
  }

  .drawer-card-footer {
    padding: var(--space-3);
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .drawer-card-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .drawer-card-name {
    font-size: 13px;
    font-weight: 600;
    color: var(--color-text);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .drawer-card-desc {
    font-size: 11px;
    color: var(--color-text-muted);
    line-clamp: 2;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .drawer-card-controls {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
  }

  .size-selector {
    display: flex;
    gap: 2px;
  }

  .size-pill {
    font-size: 10px;
    font-weight: 600;
    padding: 2px 6px;
    border-radius: var(--radius-sm, 4px);
    border: 1px solid var(--color-border);
    background: none;
    color: var(--color-text-muted);
    cursor: pointer;
    transition: all 0.15s;
  }

  .size-pill:hover:not(:disabled) {
    color: var(--color-text);
    border-color: var(--color-text-muted);
  }

  .size-pill:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .size-active {
    background: var(--color-accent);
    color: var(--color-bg);
    border-color: var(--color-accent);
  }

  .action-btn {
    display: flex;
    align-items: center;
    gap: var(--space-1);
    padding: 3px 10px;
    font-size: 11px;
    font-weight: 600;
    border-radius: var(--radius-sm, 4px);
    border: 1px solid var(--color-border);
    background: none;
    cursor: pointer;
    transition: all 0.15s;
    white-space: nowrap;
  }

  .action-add {
    color: var(--color-accent);
    border-color: var(--color-accent);
  }

  .action-add:hover {
    background: var(--color-accent);
    color: var(--color-bg);
  }

  .action-added {
    color: var(--color-success, var(--color-accent));
    border-color: var(--color-success, var(--color-accent));
  }

  .action-added:hover {
    color: var(--color-danger);
    border-color: var(--color-danger);
  }

  .action-remove-confirm {
    color: var(--color-bg, #fff);
    background: var(--color-danger);
    border-color: var(--color-danger);
  }

  @media (max-width: 1024px) {
    .widget-grid-drawer {
      grid-template-columns: repeat(2, 1fr);
    }
  }

  @media (max-width: 639px) {
    .widget-grid-drawer {
      grid-template-columns: 1fr;
    }

    .sheet-header,
    .sheet-filters,
    .sheet-body {
      padding-left: var(--space-4);
      padding-right: var(--space-4);
    }
  }

  @media (min-width: 640px) {
    .drawer-resize-handle {
      display: flex;
    }

    .sheet-handle-area {
      display: none;
    }
  }
</style>
