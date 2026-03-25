<script lang="ts">
  import type { Notification } from '@phavo/types';
  import * as icons from '../icons/icons';

  interface Props {
    open: boolean;
    notifications: Notification[];
    onClose: () => void;
    onMarkAllRead: () => void;
    onClear: () => void;
    onNotificationClick: (n: Notification) => void;
  }

  let {
    open,
    notifications,
    onClose,
    onMarkAllRead,
    onClear,
    onNotificationClick,
  }: Props = $props();

  /** Pick an SVG icon string by notification type. */
  function typeIcon(type: Notification['type']): string {
    switch (type) {
      case 'update':
        return icons.download();
      case 'system-alert':
      case 'widget-error':
        return icons.alert();
      case 'widget-warning':
        return icons.alert();
      case 'info':
      default:
        return icons.info();
    }
  }

  function timeAgo(ts: number): string {
    const diff = Date.now() - ts;
    if (diff < 60_000) return 'just now';
    const mins = Math.floor(diff / 60_000);
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }

  function handleRowClick(n: Notification) {
    onNotificationClick(n);
  }

  function handleBackdropClick(e: MouseEvent) {
    if ((e.target as HTMLElement).classList.contains('notif-backdrop')) {
      onClose();
    }
  }
</script>

{#if open}
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div class="notif-backdrop" onclick={handleBackdropClick} aria-hidden="true"></div>
{/if}

<aside
  class="notif-panel"
  class:notif-panel-open={open}
  aria-label="Notifications"
  aria-hidden={!open}
>
  <div class="notif-header">
    <span class="notif-title">Notifications</span>
    <div class="notif-actions">
      {#if notifications.length > 0}
        <button class="notif-action-btn" onclick={onMarkAllRead}>Mark all read</button>
        <button class="notif-action-btn" onclick={onClear}>Clear</button>
      {/if}
      <button class="notif-close-btn" onclick={onClose} aria-label="Close notifications">
        {@html icons.close()}
      </button>
    </div>
  </div>

  <div class="notif-list">
    {#if notifications.length === 0}
      <div class="notif-empty">
        <span class="notif-empty-icon" aria-hidden="true">{@html icons.bell()}</span>
        <p class="notif-empty-text">No notifications yet</p>
      </div>
    {:else}
      {#each notifications as n (n.id)}
        <button
          class="notif-row"
          class:notif-unread={!n.read}
          onclick={() => handleRowClick(n)}
        >
          <span
            class="notif-icon notif-icon-{n.type}"
            aria-hidden="true"
          >{@html typeIcon(n.type)}</span>
          <div class="notif-body">
            <span class="notif-row-title">{n.title}</span>
            <span class="notif-row-body">{n.body}</span>
            <span class="notif-row-time">{timeAgo(n.timestamp)}</span>
          </div>
        </button>
      {/each}
    {/if}
  </div>
</aside>

<style>
  /* ------------------------------------------------------------------ */
  /* Backdrop                                                             */
  /* ------------------------------------------------------------------ */
  .notif-backdrop {
    position: fixed;
    inset: 0;
    background: transparent;
    z-index: var(--z-overlay, 199);
  }

  /* ------------------------------------------------------------------ */
  /* Panel                                                               */
  /* ------------------------------------------------------------------ */
  .notif-panel {
    position: fixed;
    top: 0;
    right: 0;
    height: 100dvh;
    width: 320px;
    display: flex;
    flex-direction: column;
    background: var(--color-bg-surface);
    border-left: 1px solid var(--color-border);
    z-index: var(--z-panel, 200);

    /* Collapsed by default */
    transform: translateX(100%);
    transition: transform 0.2s ease;
  }

  .notif-panel-open {
    transform: translateX(0);
  }

  /* ------------------------------------------------------------------ */
  /* Header                                                              */
  /* ------------------------------------------------------------------ */
  .notif-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-4) var(--space-4) var(--space-3);
    border-bottom: 1px solid var(--color-border-subtle);
    flex-shrink: 0;
  }

  .notif-title {
    font-size: 0.9rem;
    font-weight: 600;
    color: var(--color-text);
  }

  .notif-actions {
    display: flex;
    align-items: center;
    gap: var(--space-1);
  }

  .notif-action-btn {
    padding: 2px 8px;
    font-size: 0.72rem;
    color: var(--color-text-muted);
    background: none;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm, 4px);
    cursor: pointer;
    transition: color 0.15s, border-color 0.15s;
  }

  .notif-action-btn:hover {
    color: var(--color-text);
    border-color: var(--color-border-hover, var(--color-border));
  }

  .notif-close-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    color: var(--color-text-muted);
    background: none;
    border: none;
    border-radius: var(--radius-sm, 4px);
    cursor: pointer;
    transition: color 0.15s, background 0.15s;
  }

  .notif-close-btn:hover {
    color: var(--color-text);
    background: var(--color-bg-hover);
  }

  /* ------------------------------------------------------------------ */
  /* List                                                                */
  /* ------------------------------------------------------------------ */
  .notif-list {
    flex: 1;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
  }

  /* ------------------------------------------------------------------ */
  /* Empty state                                                         */
  /* ------------------------------------------------------------------ */
  .notif-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--space-3);
    padding: var(--space-8, 2rem) var(--space-4);
    flex: 1;
    color: var(--color-text-muted);
  }

  .notif-empty-icon {
    opacity: 0.4;
  }

  .notif-empty-text {
    font-size: 0.875rem;
  }

  /* ------------------------------------------------------------------ */
  /* Notification row                                                    */
  /* ------------------------------------------------------------------ */
  .notif-row {
    display: flex;
    align-items: flex-start;
    gap: var(--space-3);
    width: 100%;
    padding: var(--space-3) var(--space-4);
    background: none;
    border: none;
    border-bottom: 1px solid var(--color-border-subtle);
    text-align: left;
    cursor: pointer;
    transition: background 0.15s;
    position: relative;
  }

  .notif-row:last-child {
    border-bottom: none;
  }

  .notif-row:hover {
    background: var(--color-bg-hover);
  }

  /* Unread indicator — left accent border */
  .notif-unread::before {
    content: '';
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 3px;
    background: var(--color-accent);
    border-radius: 0 2px 2px 0;
  }

  /* ------------------------------------------------------------------ */
  /* Row icon                                                            */
  /* ------------------------------------------------------------------ */
  .notif-icon {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    margin-top: 1px;
  }

  .notif-icon-update {
    color: var(--color-accent);
    background: color-mix(in srgb, var(--color-accent) 15%, transparent);
  }

  .notif-icon-info {
    color: var(--color-accent);
    background: color-mix(in srgb, var(--color-accent) 15%, transparent);
  }

  .notif-icon-widget-warning {
    color: var(--color-warning);
    background: color-mix(in srgb, var(--color-warning) 15%, transparent);
  }

  .notif-icon-widget-error {
    color: var(--color-danger);
    background: color-mix(in srgb, var(--color-danger) 15%, transparent);
  }

  .notif-icon-system-alert {
    color: var(--color-danger);
    background: color-mix(in srgb, var(--color-danger) 15%, transparent);
  }

  /* ------------------------------------------------------------------ */
  /* Row text                                                            */
  /* ------------------------------------------------------------------ */
  .notif-body {
    display: flex;
    flex-direction: column;
    gap: 3px;
    min-width: 0;
  }

  .notif-row-title {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--color-text);
    line-height: 1.3;
  }

  .notif-row-body {
    font-size: 0.8rem;
    color: var(--color-text-muted);
    line-height: 1.4;
  }

  .notif-row-time {
    font-size: 0.72rem;
    color: var(--color-text-muted);
    margin-top: 2px;
  }
</style>
