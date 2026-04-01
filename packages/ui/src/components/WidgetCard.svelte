<script lang="ts">
import type { WidgetSize } from '@phavo/types';
import type { Snippet } from 'svelte';
import Icon from './Icon.svelte';

const ALL_SIZES: WidgetSize[] = ['S', 'M', 'L', 'XL'];

interface Props {
  status?: 'loading' | 'active' | 'unconfigured' | 'error' | 'stale';
  title: string;
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
  class="widget-card {cls}"
  class:widget-dragging={isDragging}
  class:widget-drop-target={dropIndicator}
  class:widget-featured={colSpan >= 8}
  class:widget-compact={colSpan <= 4}
  style:grid-column="span {colSpan}"
  style:grid-row="span {rowSpan}"
  ondragover={handleCardDragOver}
  ondragleave={handleCardDragLeave}
  ondrop={handleCardDrop}
  id={instanceId ? `widget-${instanceId}` : undefined}
>
  <!-- Hover controls (Stitch pattern) — absolute positioned pill -->
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

  <!-- Drag handle (when draggable) -->
  {#if draggable}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <span
      class="drag-handle"
      aria-hidden="true"
      draggable="true"
      ondragstart={handleDragStart}
      ondragend={handleDragEnd}
    >
      <Icon name="grip-vertical" size={16} />
    </span>
  {/if}

  <!-- Widget body — renders children (backward compat) or state-based defaults -->
  <div class="widget-body">
    {#if showHeader && (title || subtitle || icon)}
      <div class="widget-meta">
        <div class="widget-copy">
          {#if subtitle}
            <p class="widget-subtitle">{subtitle}</p>
          {/if}
          {#if title}
            <h3 class="widget-title">{title}</h3>
          {/if}
        </div>
        {#if icon}
          <span class="widget-icon-shell" aria-hidden="true">
            <Icon name={icon} size={colSpan >= 8 ? 22 : 18} />
          </span>
        {/if}
      </div>
    {/if}

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

<style>
  .widget-card {
    background: var(--color-bg-elevated);
    border: 1px solid var(--color-border-subtle);
    border-radius: var(--radius-xl);
    overflow: hidden;
    display: flex;
    flex-direction: column;
    position: relative;
    padding: var(--space-6);
    min-height: 188px;
    box-shadow: var(--shadow-md);
    transition: opacity 0.15s, border-color 0.15s, transform 0.15s;
  }

  .widget-card:hover {
    border-color: color-mix(in srgb, var(--color-accent) 20%, var(--color-border-subtle));
    transform: translateY(-1px);
  }

  .widget-featured {
    min-height: 264px;
    padding: var(--space-8);
  }

  .widget-compact {
    min-height: 156px;
  }

  .widget-dragging {
    opacity: 0.5;
  }

  .widget-drop-target {
    border-top: 2px solid var(--color-accent);
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
    background: color-mix(in srgb, var(--color-bg-base) 72%, transparent);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    padding: var(--space-1) var(--space-3);
    border-radius: 9999px;
    border: 1px solid color-mix(in srgb, var(--color-text-primary) 8%, transparent);
    opacity: 0;
    transition: opacity 0.2s ease;
    pointer-events: none;
  }

  .widget-card:hover .widget-controls {
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
    color: var(--color-text-muted);
    font-family: var(--font-ui);
  }

  .ctrl-size:hover:not(:disabled) {
    color: var(--color-accent);
  }

  .ctrl-size-active {
    color: var(--color-accent);
  }

  .ctrl-size-disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  .ctrl-divider {
    width: 1px;
    height: var(--space-3);
    background: var(--color-text-muted);
    opacity: 0.3;
    margin: 0 var(--space-1);
  }

  .ctrl-close {
    color: var(--color-text-muted);
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
    color: var(--color-text-secondary);
    white-space: nowrap;
    margin-right: var(--space-1);
  }

  /* ── Drag handle ─────────────────────────────────────────────────────── */
  .drag-handle {
    position: absolute;
    top: var(--space-4);
    left: var(--space-4);
    display: flex;
    align-items: center;
    color: var(--color-text-muted);
    cursor: grab;
    transition: color 0.15s;
    opacity: 0;
    z-index: 10;
  }

  .widget-card:hover .drag-handle {
    opacity: 1;
  }

  .drag-handle:active {
    cursor: grabbing;
  }

  /* ── Widget body ─────────────────────────────────────────────────────── */
  .widget-body {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: var(--space-5);
    min-height: 0;
  }

  .widget-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
  }

  .widget-meta {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--space-3);
    min-width: 0;
  }

  .widget-copy {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    min-width: 0;
  }

  .widget-subtitle {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: var(--color-text-muted);
    margin: 0;
  }

  .widget-title {
    font-size: 1.3rem;
    font-weight: 700;
    letter-spacing: -0.03em;
    color: var(--color-text-primary);
    line-height: 1.08;
    margin: 0;
    max-width: 22ch;
  }

  .widget-icon-shell {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 2.5rem;
    height: 2.5rem;
    border-radius: 999px;
    background: color-mix(in srgb, var(--color-accent-t) 86%, transparent);
    color: var(--color-accent-text);
    flex-shrink: 0;
    border: 1px solid color-mix(in srgb, var(--color-accent) 24%, transparent);
  }

  /* ── Default state renders ───────────────────────────────────────────── */
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
    color: var(--color-accent);
    background: transparent;
    border: 1px solid var(--color-accent);
    border-radius: var(--radius-sm);
    padding: var(--space-1) var(--space-3);
    cursor: pointer;
    transition: background 0.15s;
  }

  .retry-btn:hover {
    background: var(--color-accent-t);
  }

  .widget-unconfigured {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--space-2);
    color: var(--color-text-muted);
    font-size: var(--font-size-md);
    height: 100%;
    text-align: center;
  }

  .configure-link {
    font-size: var(--font-size-sm);
    font-weight: 600;
    color: var(--color-accent);
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

  /* ── Responsive overrides ────────────────────────────────────────────── */
  @media (max-width: 639px) {
    .widget-card {
      grid-column: span 1 !important;
      grid-row: auto !important;
      min-height: 120px;
    }

    .widget-title {
      font-size: 1.05rem;
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
    .widget-card {
      grid-column: span 1 !important;
      grid-row: auto !important;
    }
  }

  .widget-featured .widget-title {
    font-size: 1.85rem;
    max-width: 18ch;
  }

  .widget-compact .widget-title {
    font-size: 1.05rem;
  }
</style>
