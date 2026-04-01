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
  import Icon from './Icon.svelte';

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
    class="fixed inset-0 bg-black/40 z-[199] animate-[fade-in_0.2s_ease]"
    onclick={handleBackdropClick}
    aria-hidden="true"
    style="pointer-events: {isDraggingFromDrawer ? 'none' : 'auto'}"
  ></div>
{/if}

<aside
  class="fixed z-[200] flex flex-col bg-surface overflow-hidden transition-transform duration-300 ease-out
    bottom-0 left-0 w-full rounded-t-xl border-t border-border
    sm:top-0 sm:right-0 sm:bottom-0 sm:left-auto sm:w-[380px] sm:rounded-t-none sm:rounded-l-xl sm:border-t-0 sm:border-l
    {open ? 'translate-y-0 sm:translate-y-0 sm:translate-x-0' : 'translate-y-full sm:translate-y-0 sm:translate-x-full'}
    {isResizing ? 'select-none !transition-none' : ''}"
  style="height: {isDesktop ? '100%' : `${mobileDrawerHeight}vh`}"
  aria-label={labels.title ?? 'Add Widgets'}
  aria-hidden={!open}
>
  <!-- Mobile resize handle -->
  <div
    class="flex sm:hidden justify-center py-2 shrink-0 cursor-ns-resize touch-none"
    onpointerdown={handleMobileResizeStart}
    onpointermove={handleMobileResizeMove}
    onpointerup={handleMobileResizeEnd}
    role="separator"
    aria-label="Resize drawer"
    aria-orientation="horizontal"
  >
    <div class="w-10 h-1 rounded-full bg-border"></div>
  </div>

  <!-- Header -->
  <div class="flex items-center justify-between px-5 pt-5 pb-3 shrink-0">
    <div class="flex flex-col gap-0.5">
      <span class="text-base font-semibold text-text">{labels.title ?? 'Add Widgets'}</span>
      <span class="text-xs text-text-muted">{labels.subtitle ?? 'Drag to place or click to add'}</span>
    </div>
    <button class="flex items-center justify-center w-8 h-8 text-text-muted bg-transparent border-none rounded cursor-pointer transition-colors hover:text-text hover:bg-hover" onclick={onClose} aria-label="Close">
      <Icon name="x" size={16} />
    </button>
  </div>

  <!-- Category filter pills -->
  <div class="flex gap-2 px-5 pb-3 shrink-0 overflow-x-auto">
    {#each filters as f (f.key)}
      <button
        class="px-3 py-1 text-xs font-medium rounded-full border whitespace-nowrap transition-all cursor-pointer
          {activeFilter === f.key
            ? 'bg-accent text-black border-accent'
            : 'bg-transparent text-text-muted border-border hover:text-text hover:border-text-muted'}"
        onclick={() => (activeFilter = f.key)}
      >
        {f.label()}
      </button>
    {/each}
  </div>

{#snippet drawerCardInner(w: WidgetManifestEntry, inst: WidgetInstance | undefined, locked: boolean)}
  <!-- Preview area -->
  <div class="relative h-[140px] overflow-hidden border-b border-border-subtle bg-surface {locked ? 'flex flex-1 items-center justify-center min-h-[140px] p-4 bg-base/20' : ''}">
    {#if locked}
      <div class="flex flex-col items-center justify-center gap-1.5">
        <span class="text-yellow-500 flex"><Icon name="lock" size={20} /></span>
        <span class="text-[11px] font-semibold text-yellow-500 tracking-wider uppercase">{labels.locked ?? 'LOCKED'}</span>
      </div>
    {:else if preview && isWidgetDefinition(w)}
      <div class="w-[145%] h-[145%] scale-[0.69] origin-top-left pointer-events-none">
        {@render preview(
          w.id,
          previewData[w.id],
          previewLoading[w.id] === true,
          (previewErrors[w.id] ?? null) !== null,
        )}
      </div>
    {:else}
      <div class="flex items-center justify-center h-full text-text-muted text-sm font-medium">
        <span class="opacity-60">{w.name}</span>
      </div>
    {/if}
  </div>

  <!-- Card footer -->
  <div class="p-3 flex flex-col gap-2">
    <div class="flex flex-col gap-0.5 min-w-0">
      <span class="text-[13px] font-semibold text-text truncate">{w.name}</span>
      <span class="text-[11px] text-text-muted line-clamp-2">{w.description}</span>
    </div>

    <!-- Size selector + action -->
    <div class="flex items-center justify-between gap-2">
      {#if isWidgetDefinition(w)}
        <div class="flex gap-0.5">
          {#each w.sizes as s (s)}
            <button
              class="text-[10px] font-semibold px-1.5 py-0.5 rounded border transition-all cursor-pointer
                {getSelectedSize(w) === s
                  ? 'bg-accent text-black border-accent'
                  : 'bg-transparent text-text-muted border-border hover:text-text hover:border-text-muted'}
                disabled:opacity-40 disabled:cursor-not-allowed"
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
          <div class="inline-flex items-center flex-wrap gap-1 px-2 py-1 rounded bg-accent-subtle text-black text-[11px] font-semibold leading-snug">
            <span class="flex shrink-0"><Icon name="lock" size={12} /></span>
            <span>{labels.upgradePrompt ?? 'Upgrade to Standard to unlock this widget — €8.99 one-time'}</span>
            <a
              class="text-black font-bold underline hover:text-text"
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
          <button class="flex items-center gap-1 px-2.5 py-0.5 text-[11px] font-semibold rounded border cursor-pointer transition-all whitespace-nowrap text-white bg-red-500 border-red-500" onclick={() => handleRemoveConfirm(inst.id)}>
            {labels.removeConfirm ?? 'Remove?'}
          </button>
        {:else}
          <button class="flex items-center gap-1 px-2.5 py-0.5 text-[11px] font-semibold rounded border cursor-pointer transition-all whitespace-nowrap text-green-400 border-green-400 bg-transparent hover:text-red-400 hover:border-red-400" onclick={() => handleRemoveClick(inst.id)}>
            <Icon name="check" size={12} />
            <span>{labels.alreadyAdded ?? 'Added'}</span>
          </button>
        {/if}
      {:else}
        {#if isWidgetDefinition(w)}
          <button class="flex items-center gap-1 px-2.5 py-0.5 text-[11px] font-semibold rounded border cursor-pointer transition-all whitespace-nowrap text-accent border-accent bg-transparent hover:bg-accent hover:text-black" onclick={() => handleAdd(w)}>
            <Icon name="plus" size={12} />
            <span>{labels.addToBoard ?? 'Add'}</span>
          </button>
        {/if}
      {/if}
    </div>
  </div>
{/snippet}

  <!-- Widget grid -->
  <div class="flex-1 min-h-0 px-5 pb-5 overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4" role="list">
      {#each filteredWidgets as w (w.id)}
        {@const inst = getInstanceForWidget(w.id)}
        {@const locked = isLocked(w)}
        {#if locked}
          <div
            class="flex flex-col border border-border rounded-lg bg-base overflow-hidden transition-[border-color,box-shadow] duration-150 cursor-pointer hover:border-accent hover:shadow-md"
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
            class="flex flex-col border rounded-lg bg-base overflow-hidden transition-[border-color,box-shadow] duration-150
              {inst ? 'border-green-400 cursor-default' : 'border-border cursor-grab hover:border-accent hover:shadow-md'}"
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
