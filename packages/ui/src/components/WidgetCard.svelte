<script lang="ts">
import type { WidgetSize } from '@phavo/types';
import type { Snippet } from 'svelte';
import Icon from './Icon.svelte';
import WishStar from './WishStar.svelte';

const ALL_SIZES: WidgetSize[] = ['S', 'M', 'L'];

interface Props {
  status?: 'loading' | 'active' | 'unconfigured' | 'error' | 'stale';
  title?: string;
  subtitle?: string;
  icon?: string;
  showHeader?: boolean;
  colSpan?: number;
  rowSpan?: number;
  class?: string;
  /** Sizes this widget supports — unsupported ones are greyed out. */
  availableSizes?: WidgetSize[];
  size?: WidgetSize;
  /** Unique instance id for drag-and-drop identification. */
  instanceId?: string;
  /** Whether drag-and-drop is enabled for this card. */
  draggable?: boolean;
  onSizeChange?: (size: WidgetSize) => void;
  /** Called when this widget is the drop target of a reorder. */
  onSwapDrop?: (draggedInstanceId: string) => void;
  onRemove?: (instanceId: string) => void | Promise<void>;
  /** Backward-compat: boolean loading flag (derives status when status not set). */
  loading?: boolean;
  /** Backward-compat: error message string (derives status when status not set). */
  error?: string | null;
  /** Backward-compat: children content slot. */
  children?: Snippet;
  /** Backward-compat label props accepted from consumers. */
  removeConfirmLabel?: string;
  removeCancelLabel?: string;
  removeActionLabel?: string;
  sizeLabel?: string;
  /** Custom card background CSS value. Defaults to --color-surface-card. */
  cardBackground?: string;
  /** Render a subtle dot star-field texture over the card background. */
  starField?: boolean | undefined;
  /** Dynamic glow color for hero stats: gold or teal. */
  glowColor?: 'gold' | 'teal' | undefined;
  /** Suppress hover controls and WishStar in non-interactive contexts (e.g. drawer preview). */
  showControls?: boolean;
  /** Whether to apply overflow:hidden on the inner card (disable in drawer to allow nebula bleed). */
  clipContent?: boolean;
}

let {
  status,
  title,
  subtitle,
  icon,
  showHeader = true,
  colSpan = 4,
  rowSpan = 1,
  class: cls = '',
  availableSizes = ALL_SIZES,
  size = 'M',
  instanceId = '',
  draggable = false,
  onSizeChange,
  onSwapDrop,
  onRemove,
  loading = false,
  error = null,
  children,
  removeConfirmLabel,
  removeCancelLabel,
  removeActionLabel,
  sizeLabel,
  cardBackground,
  starField = false,
  glowColor,
  showControls = true,
  clipContent = true,
}: Props = $props();

/** Effective status: explicit status prop wins, else derived from loading/error booleans. */
const effectiveStatus = $derived(
  status ?? (loading ? 'loading' : error ? 'error' : 'active'),
);

let isDragging = $state(false);
let dropIndicator = $state(false);
let confirmingRemoval = $state(false);
let removing = $state(false);

// ── Drag source (handle only) ────────────────────────────────────────
function handleDragStart(e: DragEvent) {
  if (!instanceId || !draggable || !e.dataTransfer) return;
  isDragging = true;

  // Create invisible ghost — prevents browser dragging a copy of the card
  const ghost = document.createElement('div');
  ghost.style.cssText = 'width:1px;height:1px;opacity:0;position:fixed;top:-100px;';
  document.body.appendChild(ghost);
  e.dataTransfer.setDragImage(ghost, 0, 0);
  setTimeout(() => ghost.remove(), 0);

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

function isSizeAvailable(s: WidgetSize): boolean {
  return availableSizes.includes(s);
}
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="widget-card-outer {cls}"
  class:widget-dragging={isDragging}
  class:widget-drop-target={dropIndicator}
  class:widget-featured={colSpan >= 8}
  class:widget-compact={colSpan <= 4}
  class:widget-size-s={size === 'S'}
  class:widget-size-m={size === 'M'}
  class:widget-state-error={effectiveStatus === 'error'}
  class:widget-state-stale={effectiveStatus === 'stale'}
  style:grid-column="span {colSpan}"
  style:grid-row="span {rowSpan}"
  ondragover={handleCardDragOver}
  ondragleave={handleCardDragLeave}
  ondrop={handleCardDrop}
  id={instanceId ? `widget-${instanceId}` : undefined}
  data-widget-id={instanceId || undefined}
>
  <div
    class="widget-card-inner"
    class:widget-card-inner-clip={clipContent}
    style="--widget-glow: {glowColor === 'teal'
      ? 'var(--color-secondary)'
      : 'var(--color-primary-fixed)'}; {cardBackground ? `background: ${cardBackground};` : ''}"
  >
    <!-- Background texture: star field -->
    {#if starField}
      <div style="position: absolute; inset: 0; background-image: radial-gradient(circle, color-mix(in srgb, var(--color-primary) 20%, transparent) 1px, transparent 1px); background-size: 50px 50px; opacity: 0.08; pointer-events: none; border-radius: inherit; z-index: 0;"></div>
    {/if}

    <!-- Widget body — renders children (backward compat) or state-based defaults -->
    <div class="widget-body">
      <div class="widget-content">
        {#if children}
          {#if effectiveStatus === 'loading'}
            <div class="widget-skeleton">
              <div class="skeleton-line"></div>
              <div class="skeleton-line short"></div>
              <div class="skeleton-line"></div>
            </div>
          {:else}
            {@render children()}
          {/if}
        {:else if effectiveStatus === 'loading'}
          <div class="widget-skeleton">
            <div class="skeleton-line"></div>
            <div class="skeleton-line short"></div>
            <div class="skeleton-line"></div>
          </div>
        {:else if effectiveStatus === 'error'}
          <div class="widget-error">
            <Icon name="alert-triangle" size={20} />
            <span>{error ?? 'Failed to load'}</span>
            <button class="retry-btn" type="button">Retry</button>
          </div>
        {:else if effectiveStatus === 'unconfigured'}
          <div class="widget-unconfigured">
            <Icon name="settings" size={20} />
            <span>Widget needs configuration</span>
            <a class="configure-link" href="/settings">Configure &rarr;</a>
          </div>
        {:else if effectiveStatus === 'stale'}
          <div class="widget-stale">
            <div class="stale-badge">
              <Icon name="clock" size={12} />
              <span>Stale data</span>
            </div>
          </div>
        {/if}
      </div>
    </div>
  </div>

  <!-- WishStar drag handle (outside inner, so glow isn't clipped) -->
  {#if showControls && draggable}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="wishstar-drag-handle"
      role="button"
      aria-label="Drag to reorder"
      draggable="true"
      ondragstart={handleDragStart}
      ondragend={handleDragEnd}
      onmousedown={(e) => e.stopPropagation()}
    >
      <WishStar size={20} />
    </div>
  {/if}

  <!-- Hover controls (Stitch pattern) — absolute positioned pill -->
  {#if showControls}
  <div class="widget-controls">
    {#if confirmingRemoval}
      <span class="confirm-label">Remove?</span>
      <button
        class="ctrl-btn ctrl-confirm"
        type="button"
        aria-label="Confirm removal"
        onclick={handleRemoveConfirmClick}
        disabled={removing}
      >
        <Icon name="check" size={14} />
      </button>
      <button
        class="ctrl-btn"
        type="button"
        aria-label="Cancel"
        onclick={(event) => { event.stopPropagation(); confirmingRemoval = false; }}
        disabled={removing}
      >
        <Icon name="x" size={14} />
      </button>
    {:else}
      {#if onSizeChange}
        {#each ALL_SIZES as s}
          <button
            class="ctrl-btn ctrl-size"
            class:ctrl-size-active={s === size}
            class:ctrl-size-disabled={!isSizeAvailable(s)}
            disabled={!isSizeAvailable(s)}
            onclick={() => onSizeChange?.(s)}
            aria-pressed={s === size}
          >
            {s}
          </button>
        {/each}
      {/if}
      {#if onRemove && instanceId}
        <span class="ctrl-divider" aria-hidden="true"></span>
        <button
          class="ctrl-btn ctrl-close"
          type="button"
          aria-label="Remove widget"
          onclick={(event) => { event.stopPropagation(); confirmingRemoval = true; }}
        >
          <Icon name="x" size={14} />
        </button>
      {/if}
    {/if}
  </div>
  {/if}
</div>

<style>
  /* ── Outer wrapper — NO overflow:hidden, allows glows to bleed ──────── */
  .widget-card-outer {
    position: relative;
    border-radius: 2rem;
    display: flex;
    flex-direction: column;
    min-height: 188px;
    box-shadow: var(--shadow-md);
    transition: transform 0.3s ease;
  }

  .widget-card-outer:hover {
    transform: scale(1.02);
  }

  .widget-featured {
    min-height: 264px;
  }

  .widget-compact {
    min-height: 156px;
  }

  .widget-dragging {
    opacity: 0.5;
  }

  .widget-drop-target {
    border-top: 2px solid var(--color-primary);
  }

  /* ── Inner wrapper — holds background, no overflow clip (allows glow bleed) */
  .widget-card-inner {
    position: relative;
    border-radius: inherit;
    background: var(--color-surface-card);
    width: 100%;
    height: 100%;
    min-height: inherit;
    padding: var(--space-8);
    display: flex;
    flex-direction: column;
  }

  .widget-card-inner-clip {
    overflow: hidden;
  }

  /* ── WishStar drag handle ────────────────────────────────────────────── */
  .wishstar-drag-handle {
    position: absolute;
    top: var(--space-3);
    left: var(--space-3);
    z-index: 10;
    cursor: grab;
    opacity: 0.4;
    transition: opacity 0.15s;
    pointer-events: all;
    width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .wishstar-drag-handle:hover {
    opacity: 0.9;
  }

  .wishstar-drag-handle:active {
    cursor: grabbing;
    opacity: 1;
  }

  /* ── Hover controls (Stitch pattern) ─────────────────────────────────── */
  .widget-controls {
    position: absolute;
    top: var(--space-4);
    right: var(--space-4);
    z-index: 20;
    display: flex;
    align-items: center;
    gap: var(--space-1);
    background: color-mix(in srgb, var(--color-surface-dim) 72%, transparent);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    padding: var(--space-1) var(--space-3);
    border-radius: 9999px;
    border: 1px solid color-mix(in srgb, var(--color-on-surface) 8%, transparent);
    opacity: 0;
    transition: opacity 0.2s ease;
    pointer-events: none;
  }

  .widget-card-outer:hover .widget-controls {
    opacity: 1;
    pointer-events: auto;
  }

  .ctrl-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 22px;
    height: 22px;
    padding: 0 var(--space-1);
    border: none;
    border-radius: var(--radius-sm);
    background: transparent;
    cursor: pointer;
    transition: color 0.15s, background 0.15s;
  }

  .ctrl-size {
    font-size: var(--font-size-xs);
    font-weight: 700;
    color: var(--color-outline);
    font-family: var(--font-ui);
  }

  .ctrl-size:hover:not(:disabled) {
    color: var(--color-primary);
  }

  .ctrl-size-active {
    color: var(--color-primary);
  }

  .ctrl-size-disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  .ctrl-divider {
    width: 1px;
    height: var(--space-3);
    background: var(--color-outline);
    opacity: 0.3;
    margin: 0 var(--space-1);
  }

  .ctrl-close {
    color: var(--color-outline);
  }

  .ctrl-close:hover {
    color: var(--color-danger);
  }

  .ctrl-confirm {
    color: var(--color-danger);
  }

  .confirm-label {
    font-size: var(--font-size-xs);
    font-weight: 600;
    color: var(--color-on-surface-variant);
    white-space: nowrap;
    margin-right: var(--space-1);
  }

  /* ── Widget body ─────────────────────────────────────────────────────── */
  .widget-body {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
    position: relative;
    z-index: 1;
  }

  .widget-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
  }

  /* ── Default state renders ───────────────────────────────────────────── */
  .widget-skeleton {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .skeleton-line {
    height: 14px;
    background: var(--color-surface-high);
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
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--space-2);
    color: var(--color-danger);
    font-size: var(--font-size-md);
    height: 100%;
    text-align: center;
  }

  .retry-btn {
    font-size: var(--font-size-sm);
    font-weight: 600;
    font-family: var(--font-ui);
    color: var(--color-primary);
    background: transparent;
    border: 1px solid var(--color-primary);
    border-radius: var(--radius-sm);
    padding: var(--space-1) var(--space-3);
    cursor: pointer;
    transition: background 0.15s;
  }

  .retry-btn:hover {
    background: color-mix(in srgb, var(--color-primary) 10%, transparent);
  }

  .widget-unconfigured {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--space-2);
    color: var(--color-outline);
    font-size: var(--font-size-md);
    height: 100%;
    text-align: center;
  }

  .configure-link {
    font-size: var(--font-size-sm);
    font-weight: 600;
    color: var(--color-primary);
    text-decoration: none;
  }

  .configure-link:hover {
    text-decoration: underline;
  }

  .widget-stale {
    display: flex;
    flex-direction: column;
    height: 100%;
  }

  .stale-badge {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    font-size: var(--font-size-xs);
    color: var(--color-warning);
    background: var(--color-warning-subtle);
    padding: 2px var(--space-2);
    border-radius: var(--radius-sm);
    align-self: flex-start;
  }

  /* ── Widget state styles ───────────────────────────────────────────── */

  /* Error: red top accent */
  .widget-state-error .widget-card-inner {
    border: 1px solid color-mix(in srgb, var(--color-error) 25%, transparent);
  }

  /* Stale: muted border */
  .widget-state-stale .widget-card-inner {
    border: 1px solid color-mix(in srgb, var(--color-outline) 15%, transparent);
    opacity: 0.7;
  }

  /* ── Responsive overrides ────────────────────────────────────────────── */
  @media (max-width: 639px) {
    .widget-card-outer {
      grid-column: span 1 !important;
      grid-row: auto !important;
      min-height: 120px;
    }

    .widget-controls {
      opacity: 1;
      pointer-events: auto;
    }

    .ctrl-size {
      display: none;
    }

    .ctrl-divider {
      display: none;
    }
  }

  @media (min-width: 640px) and (max-width: 1023px) {
    .widget-card-outer {
      grid-column: span 1 !important;
      grid-row: auto !important;
    }
  }

</style>
