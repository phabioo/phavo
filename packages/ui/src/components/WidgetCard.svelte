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
  onRemove?: (instanceId: string) => void | Promise<void>;
  removeConfirmLabel?: string;
  removeCancelLabel?: string;
  removeActionLabel?: string;
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
  onRemove,
  removeConfirmLabel = 'Remove widget?',
  removeCancelLabel = 'Cancel',
  removeActionLabel = 'Remove',
  sizeLabel = 'Size',
}: Props = $props();

let isDragging = $state(false);
let dropIndicator = $state(false);
let confirmingRemoval = $state(false);
let removing = $state(false);

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

async function handleRemoveConfirmClick(event: MouseEvent): Promise<void> {
  event.stopPropagation();
  if (!instanceId || !onRemove || removing) return;

  removing = true;
  try {
    await onRemove(instanceId);
    confirmingRemoval = false;
  } finally {
    removing = false;
  }
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
  class:widget-removable={Boolean(onRemove && instanceId)}
  class:widget-dragging={isDragging}
  class:widget-drop-target={dropIndicator}
  ondragover={handleCardDragOver}
  ondragleave={handleCardDragLeave}
  ondrop={handleCardDrop}
  id={instanceId ? `widget-${instanceId}` : undefined}
>
  <div class="widget-toolbar">
    {#if draggable}
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <span
        class="drag-handle"
        aria-hidden="true"
        draggable="true"
        ondragstart={handleDragStart}
        ondragend={handleDragEnd}
      >
        {@html icons.drag()}
      </span>
    {:else}
      <span class="drag-handle drag-handle-placeholder" aria-hidden="true"></span>
    {/if}
    <h3 class="widget-title">{title}</h3>
    <div class="widget-toolbar-actions">
      {#if confirmingRemoval}
        <div class="widget-remove-inline" role="group" aria-label={removeConfirmLabel}>
          <span class="widget-remove-inline-copy">{removeConfirmLabel}</span>
          <button
            class="widget-remove-inline-action widget-remove-inline-confirm"
            type="button"
            aria-label={removeActionLabel}
            onclick={handleRemoveConfirmClick}
            disabled={removing}
          >
            {@html icons.check()}
          </button>
          <button
            class="widget-remove-inline-action"
            type="button"
            aria-label={removeCancelLabel}
            onclick={(event) => {
              event.stopPropagation();
              confirmingRemoval = false;
            }}
            disabled={removing}
          >
            {@html icons.close()}
          </button>
        </div>
      {:else}
        {#if onSizeChange}
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
        {#if onRemove && instanceId}
          <span class="toolbar-divider" aria-hidden="true"></span>
          <button
            class="widget-remove-trigger"
            type="button"
            aria-label={removeActionLabel}
            onclick={(event) => {
              event.stopPropagation();
              confirmingRemoval = true;
            }}
          >
            {@html icons.close()}
          </button>
        {/if}
      {/if}
    </div>
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

  .widget-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    min-height: 32px;
    padding: 0 var(--space-2);
    background: var(--color-bg-elevated);
    border-bottom: 1px solid var(--color-border-subtle);
    gap: var(--space-2);
  }

  .widget-title {
    font-size: 12px;
    font-weight: 600;
    color: var(--color-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .widget-body {
    flex: 1;
    padding: var(--space-4);
  }

  .widget-toolbar-actions {
    display: flex;
    align-items: center;
    gap: var(--space-1);
    flex-shrink: 0;
    min-width: 0;
  }

  .widget-remove-trigger {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    border: none;
    border-radius: var(--radius-sm);
    background: transparent;
    color: var(--color-text-muted);
    cursor: pointer;
    transition: color 0.15s, background 0.15s;
  }

  .widget-remove-trigger:hover {
    color: var(--color-danger);
    background: var(--color-bg-hover);
  }

  .toolbar-divider {
    width: 1px;
    height: 14px;
    background: var(--color-border-subtle);
  }

  .widget-remove-inline {
    display: flex;
    align-items: center;
    gap: var(--space-1);
    min-width: 0;
  }

  .widget-remove-inline-copy {
    font-size: 11px;
    font-weight: 600;
    color: var(--color-text-secondary);
    white-space: nowrap;
  }

  .widget-remove-inline-action {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    border-radius: var(--radius-sm);
    border: none;
    background: transparent;
    color: var(--color-text-muted);
    cursor: pointer;
    transition: color 0.15s, background 0.15s, opacity 0.15s;
  }

  .widget-remove-inline-confirm {
    color: var(--color-danger);
  }

  .widget-remove-inline-action:hover {
    background: var(--color-bg-hover);
  }

  .widget-remove-inline-action:disabled {
    opacity: 0.6;
    cursor: not-allowed;
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
    transition: color 0.15s;
    flex-shrink: 0;
    width: 16px;
    justify-content: center;
  }

  .drag-handle-placeholder {
    opacity: 0;
    cursor: default;
  }

  .drag-handle:active {
    cursor: grabbing;
  }

  /* Size selector */
  .size-selector {
    display: flex;
    gap: 2px;
    flex-shrink: 0;
  }

  .size-btn {
    min-width: 20px;
    height: 20px;
    padding: 0 6px;
    font-size: 11px;
    font-weight: 600;
    color: var(--color-text-muted);
    background: transparent;
    border: none;
    border-radius: var(--radius-sm);
    cursor: pointer;
    transition: background 0.15s, color 0.15s;
  }

  .size-btn:hover:not(:disabled) {
    background: var(--color-bg-hover);
  }

  .size-active {
    background: var(--color-accent);
    color: var(--color-text-inverse);
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

  /* ── MOBILE (<640px): single-column grid, simplified toolbar ──────────── */
  @media (max-width: 639px) {
    .widget-card {
      min-height: 120px;
    }

    /* All sizes span full width on single-column grid */
    .widget-S,
    .widget-M,
    .widget-L,
    .widget-XL {
      grid-column: span 1;
      grid-row: auto;
    }

    /* Toolbar: hide size selector, keep only remove button */
    .size-selector {
      display: none;
    }

    .toolbar-divider {
      display: none;
    }

    /* WCAG 2.1 AA touch target: 44px minimum */
    .widget-toolbar {
      min-height: 44px;
    }

    .widget-remove-trigger {
      min-height: 44px;
      min-width: 44px;
      width: 44px;
      height: 44px;
    }
  }

  /* ── TABLET (640px–1023px): two-column grid span overrides ───────────── */
  @media (min-width: 640px) and (max-width: 1023px) {
    .widget-S {
      grid-column: span 1;
    }

    .widget-M {
      grid-column: span 1;
    }

    .widget-L {
      grid-column: span 2;
    }

    .widget-XL {
      grid-column: span 2;
    }
  }
</style>
