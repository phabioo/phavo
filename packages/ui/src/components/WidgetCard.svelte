<script lang="ts">
import type { WidgetSize } from '@phavo/types';
import type { Snippet } from 'svelte';
import * as icons from '../icons/icons';

const ALL_SIZES: WidgetSize[] = ['S', 'M', 'L', 'XL'];

interface Props {
  title: string;
  size?: WidgetSize;
  loading?: boolean;
  error?: string | null;
  children: Snippet;
  /** Sizes this widget supports — unsupported ones are greyed out. */
  availableSizes?: WidgetSize[];
  /** Unique instance id for drag-and-drop identification. */
  instanceId?: string;
  /** Whether drag-and-drop is enabled for this card. */
  draggable?: boolean;
  onSizeChange?: (size: WidgetSize) => void;
  /** Called when this widget is the drop target of a reorder. */
  onSwapDrop?: (draggedInstanceId: string) => void;
  sizeLabel?: string;
}

let {
  title,
  size = 'M',
  loading = false,
  error = null,
  children,
  availableSizes = ALL_SIZES,
  instanceId = '',
  draggable = false,
  onSizeChange,
  onSwapDrop,
  sizeLabel = 'Size',
}: Props = $props();

let isDragging = $state(false);
let showControls = $state(false);
let dropIndicator = $state(false);

// ── Drag source (handle only) ────────────────────────────────────────
function handleDragStart(e: DragEvent) {
  if (!instanceId || !draggable || !e.dataTransfer) return;
  isDragging = true;
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('application/phavo-instance', JSON.stringify({ instanceId }));
}

function handleDragEnd() {
  isDragging = false;
}

// ── Drop target (reorder) ────────────────────────────────────────────
function handleCardDragOver(e: DragEvent) {
  if (!e.dataTransfer?.types.includes('application/phavo-instance')) return;
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  dropIndicator = true;
}

function handleCardDragLeave() {
  dropIndicator = false;
}

function handleCardDrop(e: DragEvent) {
  e.preventDefault();
  dropIndicator = false;
  const raw = e.dataTransfer?.getData('application/phavo-instance');
  if (!raw) return;
  try {
    const { instanceId: draggedId } = JSON.parse(raw) as { instanceId: string };
    if (draggedId === instanceId) return;
    onSwapDrop?.(draggedId);
  } catch { /* ignore malformed */ }
}

/** True if this widget supports the given size. */
function isSizeAvailable(s: WidgetSize): boolean {
  return availableSizes.includes(s);
}
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="widget-card widget-{size}"
  class:widget-dragging={isDragging}
  class:widget-drop-target={dropIndicator}
  onmouseenter={() => (showControls = true)}
  onmouseleave={() => (showControls = false)}
  ondragover={handleCardDragOver}
  ondragleave={handleCardDragLeave}
  ondrop={handleCardDrop}
  id={instanceId ? `widget-${instanceId}` : undefined}
>
  <div class="widget-header">
    {#if draggable}
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <span
        class="drag-handle"
        class:drag-visible={showControls}
        aria-hidden="true"
        draggable="true"
        ondragstart={handleDragStart}
        ondragend={handleDragEnd}
      >
        {@html icons.drag()}
      </span>
    {/if}
    <h3 class="widget-title">{title}</h3>
    {#if onSizeChange && showControls}
      <div class="size-selector" role="group" aria-label={sizeLabel}>
        {#each ALL_SIZES as s}
          <button
            class="size-btn"
            class:size-active={s === size}
            class:size-disabled={!isSizeAvailable(s)}
            disabled={!isSizeAvailable(s)}
            onclick={() => onSizeChange?.(s)}
            aria-pressed={s === size}
          >
            {s}
          </button>
        {/each}
      </div>
    {/if}
  </div>
  <div class="widget-body">
    {#if loading}
      <div class="widget-skeleton">
        <div class="skeleton-line"></div>
        <div class="skeleton-line short"></div>
        <div class="skeleton-line"></div>
      </div>
    {:else if error}
      <div class="widget-error">
        <span>{error}</span>
      </div>
    {:else}
      {@render children()}
    {/if}
  </div>
</div>

<style>
  .widget-card {
    background: var(--color-bg-surface);
    border: 1px solid var(--color-border-subtle);
    border-radius: var(--radius-md);
    overflow: hidden;
    display: flex;
    flex-direction: column;
    transition: opacity 0.15s;
  }

  .widget-dragging {
    opacity: 0.5;
  }

  .widget-drop-target {
    border-top: 2px solid var(--color-accent);
  }

  .widget-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-3) var(--space-4);
    border-bottom: 1px solid var(--color-border-subtle);
    gap: var(--space-2);
  }

  .widget-title {
    font-size: 13px;
    font-weight: 600;
    color: var(--color-text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    flex: 1;
    min-width: 0;
  }

  .widget-body {
    flex: 1;
    padding: var(--space-4);
  }

  /* Grid sizing: S=3×2, M=4×3, L=6×4, XL=12×4 */
  .widget-S { grid-column: span 3; grid-row: span 2; }
  .widget-M { grid-column: span 4; grid-row: span 3; }
  .widget-L { grid-column: span 6; grid-row: span 4; }
  .widget-XL { grid-column: span 12; grid-row: span 4; }

  /* Drag handle */
  .drag-handle {
    display: flex;
    align-items: center;
    color: var(--color-text-muted);
    cursor: grab;
    opacity: 0;
    transition: opacity 0.15s;
    flex-shrink: 0;
  }

  .drag-visible {
    opacity: 1;
  }

  .drag-handle:active {
    cursor: grabbing;
  }

  /* Size selector */
  .size-selector {
    display: flex;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm, 4px);
    overflow: hidden;
    flex-shrink: 0;
  }

  .size-btn {
    padding: 2px 8px;
    font-size: 11px;
    font-weight: 600;
    color: var(--color-text-muted);
    background: none;
    border: none;
    border-right: 1px solid var(--color-border);
    cursor: pointer;
    transition: background 0.15s, color 0.15s;
  }

  .size-btn:last-child {
    border-right: none;
  }

  .size-btn:hover:not(:disabled) {
    background: var(--color-bg-hover);
  }

  .size-active {
    background: var(--color-accent);
    color: var(--color-bg, #fff);
  }

  .size-active:hover:not(:disabled) {
    background: var(--color-accent);
  }

  .size-disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  /* Skeleton / error states */
  .widget-skeleton {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .skeleton-line {
    height: 14px;
    background: var(--color-bg-hover);
    border-radius: var(--radius-sm);
    animation: pulse 1.5s ease-in-out infinite;
  }

  .skeleton-line.short {
    width: 60%;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.4; }
  }

  .widget-error {
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--color-danger);
    font-size: 13px;
    height: 100%;
  }
</style>
