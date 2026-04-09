<script lang="ts">
  import type { Notification } from '@phavo/types';
  import Icon from './Icon.svelte';
  import WishStar from './WishStar.svelte';

  interface Props {
    open: boolean;
    notifications: Notification[];
    muted?: boolean;
    onclose: () => void;
    onclearall: () => void;
    ondismiss: (id: string) => void;
    onaction: (notification: Notification) => void;
    onmuteall?: () => void;
  }

  let {
    open,
    notifications,
    muted = false,
    onclose,
    onclearall,
    ondismiss,
    onaction,
    onmuteall,
  }: Props = $props();

  function timeAgo(ts: number): string {
    const diff = Math.floor((Date.now() / 1000) - (ts / 1000));
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  }

  function iconFor(type: string): string {
    switch (type) {
      case 'update':       return 'arrow-up-circle';
      case 'security':     return 'shield-alert';
      case 'widget-error': return 'alert-triangle';
      case 'task':         return 'loader-2';
      default:             return 'info';
    }
  }
</script>

{#if open}
<!-- Backdrop -->
<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
<div
  class="notif-backdrop"
  role="presentation"
  onclick={onclose}
></div>
{/if}

<aside class="notif-panel" class:notif-panel-open={open} aria-label="Notifications">
  <!-- Header -->
  <div class="notif-header">
    <div class="notif-header-left">
      <WishStar size={14} />
      <span class="notif-title">NOTIFICATIONS</span>
    </div>
    <button class="notif-clear-btn" onclick={onclearall}>
      CLEAR ALL
    </button>
  </div>

  <!-- Notification list -->
  <div class="notif-list">
    {#if notifications.length === 0}
      <div class="notif-empty">
        <Icon name="bell-off" size={32} />
        <span>No notifications</span>
      </div>
    {:else}
      {#each notifications as notif (notif.id)}
        <div
          class="notif-card notif-card-{notif.type}"
          class:notif-card-read={notif.read}
        >
          <!-- Icon circle -->
          <div class="notif-icon notif-icon-{notif.type}">
            <Icon name={iconFor(notif.type)} size={16} />
          </div>

          <!-- Content -->
          <div class="notif-content">
            <div class="notif-meta">
              <span class="notif-category notif-category-{notif.type}">
                {notif.title}
              </span>
              <span class="notif-time">{timeAgo(notif.createdAt)}</span>
            </div>
            <p class="notif-message">{notif.message}</p>

            <!-- Progress bar (task type) -->
            {#if notif.type === 'task' && notif.progress !== undefined}
              <div class="notif-progress-row">
                <div class="notif-progress-track">
                  <div
                    class="notif-progress-fill"
                    style="width: {notif.progress}%"
                  ></div>
                </div>
                <span class="notif-progress-label">{notif.progress}%</span>
              </div>
            {/if}

            <!-- Action button -->
            {#if notif.actionLabel}
              <button
                class="notif-action-btn"
                onclick={() => onaction(notif)}
              >
                {notif.actionLabel}
              </button>
            {/if}
          </div>

          <!-- Dismiss button -->
          <button
            class="notif-dismiss"
            onclick={() => ondismiss(notif.id)}
            aria-label="Dismiss"
          >
            <Icon name="x" size={12} />
          </button>
        </div>
      {/each}
    {/if}
  </div>

  <!-- Footer -->
  <div class="notif-footer">
    <button
      class="notif-mute-btn"
      class:notif-mute-btn-active={muted}
      onclick={onmuteall}
      aria-label={muted ? 'Unmute notifications' : 'Mute all notifications'}
    >
      <Icon name={muted ? 'bell-off' : 'bell'} size={14} />
      <span>{muted ? 'MUTED' : 'MUTE ALL'}</span>
    </button>
  </div>
</aside>

<style>
  /* Panel */
  .notif-panel {
    position: fixed;
    top: 0;
    right: 0;
    height: 100vh;
    width: 380px;
    background: color-mix(in srgb, var(--color-surface-dim) 70%, transparent);
    backdrop-filter: blur(20px);
    border-left: 1px solid color-mix(in srgb, var(--color-outline-variant) 10%, transparent);
    z-index: 60;
    display: flex;
    flex-direction: column;
    padding: var(--space-8);
    transform: translateX(100%);
    transition: transform 0.3s cubic-bezier(0.32, 0.72, 0, 1);
  }

  .notif-panel-open {
    transform: translateX(0);
  }

  /* Backdrop */
  .notif-backdrop {
    position: fixed;
    inset: 0;
    z-index: 59;
    background: transparent;
  }

  /* Header */
  .notif-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: var(--space-8);
  }

  .notif-header-left {
    display: flex;
    align-items: center;
    gap: var(--space-3);
  }

  .notif-title {
    font-size: 12px;
    font-weight: 700;
    font-family: var(--font-mono);
    letter-spacing: 0.15em;
    text-transform: uppercase;
    color: var(--color-on-surface);
  }

  .notif-clear-btn {
    font-size: 10px;
    font-weight: 700;
    font-family: var(--font-mono);
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--color-outline);
    background: none;
    border: none;
    cursor: pointer;
    transition: color 0.15s;
  }

  .notif-clear-btn:hover {
    color: var(--color-secondary);
  }

  /* List */
  .notif-list {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    padding-right: var(--space-2);
    margin-right: calc(-1 * var(--space-2));
  }

  /* Empty state */
  .notif-empty {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--space-3);
    color: var(--color-outline);
    font-size: 13px;
  }

  /* Card */
  .notif-card {
    position: relative;
    display: flex;
    align-items: flex-start;
    gap: var(--space-4);
    padding: var(--space-5);
    border-radius: 1.5rem;
    background: color-mix(in srgb, var(--color-surface-high) 60%, transparent);
    border: 1px solid color-mix(in srgb, var(--color-outline-variant) 8%, transparent);
    transition: background 0.15s;
    height: auto;
    overflow: visible;
  }

  .notif-card:hover {
    background: var(--color-surface-high);
  }

  .notif-card-read {
    opacity: 0.6;
  }

  /* Icon circle — colored by type */
  .notif-icon {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .notif-icon-update {
    background: color-mix(in srgb, var(--color-primary-fixed) 10%, transparent);
    color: var(--color-primary-fixed);
  }

  .notif-icon-security,
  .notif-icon-widget-error {
    background: color-mix(in srgb, var(--color-error) 10%, transparent);
    color: var(--color-error);
  }

  .notif-icon-task {
    background: color-mix(in srgb, var(--color-secondary) 10%, transparent);
    color: var(--color-secondary);
  }

  .notif-icon-info {
    background: color-mix(in srgb, var(--color-outline) 15%, transparent);
    color: var(--color-on-surface-variant);
  }

  /* Content */
  .notif-content {
    flex: 1;
    min-width: 0;
  }

  .notif-meta {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--space-2);
  }

  .notif-category {
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    font-family: var(--font-mono);
  }

  .notif-category-update       { color: var(--color-primary-fixed); }
  .notif-category-security,
  .notif-category-widget-error  { color: var(--color-error); }
  .notif-category-task          { color: var(--color-secondary); }
  .notif-category-info          { color: var(--color-on-surface-variant); }

  .notif-time {
    font-size: 10px;
    color: var(--color-outline);
    font-family: var(--font-mono);
    white-space: nowrap;
  }

  .notif-message {
    font-size: 12px;
    line-height: 1.5;
    color: var(--color-on-surface-variant);
    margin: 0;
    white-space: normal;
    word-break: break-word;
    overflow-wrap: break-word;
    overflow: visible;
  }

  /* Progress bar */
  .notif-progress-row {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    margin-top: var(--space-3);
  }

  .notif-progress-track {
    flex: 1;
    height: 4px;
    background: color-mix(in srgb, var(--color-primary) 5%, transparent);
    border-radius: 9999px;
    overflow: hidden;
  }

  .notif-progress-fill {
    height: 100%;
    background: var(--color-secondary);
    border-radius: 9999px;
    transition: width 0.5s ease;
  }

  .notif-progress-label {
    font-size: 10px;
    font-weight: 700;
    color: var(--color-secondary);
    font-family: var(--font-mono);
    min-width: 28px;
    text-align: right;
  }

  /* Action button */
  .notif-action-btn {
    margin-top: var(--space-4);
    width: 100%;
    padding: var(--space-2) var(--space-4);
    border-radius: var(--radius-full);
    background: var(--color-primary-fixed);
    color: var(--color-on-primary-fixed);
    font-size: 10px;
    font-weight: 700;
    font-family: var(--font-mono);
    letter-spacing: 0.1em;
    text-transform: uppercase;
    border: none;
    cursor: pointer;
    transition: opacity 0.15s;
  }

  .notif-action-btn:hover {
    opacity: 0.9;
  }

  /* Dismiss */
  .notif-dismiss {
    position: absolute;
    top: var(--space-3);
    right: var(--space-3);
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: none;
    border: none;
    color: var(--color-outline);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0;
    transition: opacity 0.15s, background 0.15s;
  }

  .notif-card:hover .notif-dismiss {
    opacity: 1;
  }

  .notif-dismiss:hover {
    background: color-mix(in srgb, var(--color-outline) 15%, transparent);
    color: var(--color-on-surface);
  }

  /* Footer */
  .notif-footer {
    margin-top: var(--space-6);
    padding-top: var(--space-6);
    border-top: 1px solid color-mix(in srgb, var(--color-outline-variant) 10%, transparent);
  }

  .notif-mute-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-2);
    width: 100%;
    padding: var(--space-3);
    border-radius: 1rem;
    background: color-mix(in srgb, var(--color-surface-bright) 30%, transparent);
    border: 1px solid color-mix(in srgb, var(--color-outline-variant) 10%, transparent);
    color: var(--color-outline);
    font-size: 10px;
    font-weight: 700;
    font-family: var(--font-mono);
    letter-spacing: 0.1em;
    text-transform: uppercase;
    cursor: pointer;
    transition: background 0.15s, color 0.15s;
  }

  .notif-mute-btn:hover {
    background: color-mix(in srgb, var(--color-surface-high) 60%, transparent);
    color: var(--color-on-surface-variant);
  }

  .notif-mute-btn-active {
    background: color-mix(in srgb, var(--color-error) 10%, transparent);
    border-color: color-mix(in srgb, var(--color-error) 20%, transparent);
    color: var(--color-error);
  }

  .notif-mute-btn-active:hover {
    background: color-mix(in srgb, var(--color-error) 18%, transparent);
    color: var(--color-error);
  }

  /* Scrollbar */
  .notif-list::-webkit-scrollbar { width: 3px; }
  .notif-list::-webkit-scrollbar-track { background: transparent; }
  .notif-list::-webkit-scrollbar-thumb {
    background: color-mix(in srgb, var(--color-outline) 30%, transparent);
    border-radius: 9999px;
  }

  /* Animation: respects prefers-reduced-motion */
  @media (prefers-reduced-motion: reduce) {
    .notif-panel { transition: none; }
  }
</style>
