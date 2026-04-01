<script lang="ts">
  import type { Notification } from '@phavo/types';
  import Icon from './Icon.svelte';

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

  function typeIconName(type: Notification['type']): string {
    switch (type) {
      case 'update':
        return 'download';
      case 'system-alert':
      case 'widget-error':
        return 'alert-triangle';
      case 'widget-warning':
        return 'alert-triangle';
      case 'info':
      default:
        return 'info';
    }
  }

  function typeIconClasses(type: Notification['type']): string {
    switch (type) {
      case 'update':
      case 'info':
        return 'text-accent bg-accent/15';
      case 'widget-warning':
        return 'text-yellow-500 bg-yellow-500/15';
      case 'system-alert':
      case 'widget-error':
        return 'text-red-500 bg-red-500/15';
      default:
        return 'text-accent bg-accent/15';
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
    if (e.target === e.currentTarget) {
      onClose();
    }
  }
</script>

{#if open}
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div class="fixed inset-0 bg-transparent z-[199]" onclick={handleBackdropClick} aria-hidden="true"></div>
{/if}

<aside
  class="fixed z-[200] flex flex-col bg-surface border-border transition-transform duration-200 ease-out
    bottom-[calc(56px+env(safe-area-inset-bottom))] left-0 right-0 w-full max-h-[85dvh] border-t rounded-t-xl
    sm:top-0 sm:right-0 sm:bottom-0 sm:left-auto sm:w-[380px] sm:h-dvh sm:max-h-none sm:border-t-0 sm:border-l sm:rounded-t-none
    {open
      ? 'translate-y-0 sm:translate-y-0 sm:translate-x-0'
      : 'translate-y-[calc(100%+56px+env(safe-area-inset-bottom))] sm:translate-y-0 sm:translate-x-full'}"
  aria-label="Notifications"
  aria-hidden={!open}
>
  <!-- Header -->
  <div class="flex items-center justify-between px-4 pt-4 pb-3 border-b border-border-subtle shrink-0">
    <span class="text-sm font-semibold text-text">Notifications</span>
    <div class="flex items-center gap-1">
      {#if notifications.length > 0}
        <button class="px-2 py-0.5 text-[11px] text-text-muted bg-transparent border border-border rounded cursor-pointer transition-colors hover:text-text hover:border-text-muted sm:min-h-0 min-h-[44px] sm:py-0.5" onclick={onMarkAllRead}>Mark all read</button>
        <button class="px-2 py-0.5 text-[11px] text-text-muted bg-transparent border border-border rounded cursor-pointer transition-colors hover:text-text hover:border-text-muted sm:min-h-0 min-h-[44px] sm:py-0.5" onclick={onClear}>Clear</button>
      {/if}
      <button class="flex items-center justify-center w-7 h-7 sm:w-7 sm:h-7 min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 text-text-muted bg-transparent border-none rounded cursor-pointer transition-colors hover:text-text hover:bg-hover" onclick={onClose} aria-label="Close notifications">
        <Icon name="x" size={16} />
      </button>
    </div>
  </div>

  <!-- Notification list -->
  <div class="flex-1 overflow-y-auto flex flex-col">
    {#if notifications.length === 0}
      <div class="flex flex-col items-center justify-center gap-3 px-4 py-8 flex-1 text-text-muted">
        <span class="opacity-40"><Icon name="bell" size={24} /></span>
        <p class="text-sm">No notifications yet</p>
      </div>
    {:else}
      {#each notifications as n (n.id)}
        <button
          class="relative flex items-start gap-3 w-full px-4 py-3 bg-transparent border-none border-b border-border-subtle text-left cursor-pointer transition-colors hover:bg-hover last:border-b-0"
          onclick={() => handleRowClick(n)}
        >
          {#if !n.read}
            <div class="absolute left-0 top-0 bottom-0 w-[3px] bg-accent rounded-r-sm"></div>
          {/if}
          <span
            class="shrink-0 flex items-center justify-center w-7 h-7 rounded-full mt-0.5 {typeIconClasses(n.type)}"
            aria-hidden="true"
          ><Icon name={typeIconName(n.type)} size={14} /></span>
          <div class="flex flex-col gap-0.5 min-w-0">
            <span class="text-sm font-semibold text-text leading-snug">{n.title}</span>
            <span class="text-xs text-text-muted leading-relaxed">{n.body}</span>
            <span class="text-[11px] text-text-muted mt-0.5">{timeAgo(n.timestamp)}</span>
          </div>
        </button>
      {/each}
    {/if}
  </div>
</aside>
