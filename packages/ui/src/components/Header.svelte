<script lang="ts">
import { onMount } from 'svelte';
import type { Snippet } from 'svelte';
import * as icons from '../icons/icons';

interface Props {
  dashboardName?: string;
  brandingLabel?: string | undefined;
  updateBadge?: Snippet;
  userMenu?: Snippet;
  unreadCount?: number;
  onBellClick?: () => void;
  onAddWidgetClick?: () => void;
  addWidgetLabel?: string;
}

let {
  dashboardName = 'My Dashboard',
  brandingLabel,
  updateBadge,
  userMenu,
  unreadCount = 0,
  onBellClick,
  onAddWidgetClick,
  addWidgetLabel = 'Add widget',
}: Props = $props();

let time = $state(new Date());

onMount(() => {
  return $effect.root(() => {
    $effect(() => {
      const interval = setInterval(() => {
        time = new Date();
      }, 1000);
      return () => clearInterval(interval);
    });
  });
});

const formattedTime = $derived(
  time.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
);
</script>

<header class="header">
  <div class="header-left">
    <div class="header-title-row">
      <h1 class="header-title">{dashboardName}</h1>
      {#if brandingLabel}
        <span class="header-branding-badge">{brandingLabel}</span>
      {/if}
    </div>
  </div>
  <div class="header-right">
    {#if onAddWidgetClick}
      <button class="add-widget-btn" onclick={onAddWidgetClick} aria-label={addWidgetLabel}>
        {@html icons.plus()}
        <span class="add-widget-text">{addWidgetLabel}</span>
      </button>
    {/if}
    <span class="header-clock mono">{formattedTime}</span>
    {#if updateBadge}
      {@render updateBadge()}
    {/if}
    <!-- Bell icon -->
    <button
      class="bell-btn"
      onclick={onBellClick}
      aria-label="Notifications{unreadCount > 0 ? ` (${unreadCount} unread)` : ''}"
    >
      {@html icons.bell()}
      {#if unreadCount > 0}
        <span class="bell-badge" aria-hidden="true">
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      {/if}
    </button>
    {#if userMenu}
      {@render userMenu()}
    {/if}
  </div>
</header>

<style>
  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-3) var(--space-6);
    background: var(--color-bg-surface);
    border-bottom: 1px solid var(--color-border-subtle);
    height: 56px;
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: var(--space-4);
  }

  .header-title-row {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    min-width: 0;
  }

  .header-title {
    font-size: 16px;
    font-weight: 600;
    color: var(--color-text-primary);
  }

  .header-branding-badge {
    display: inline-flex;
    align-items: center;
    padding: 2px var(--space-2);
    font-size: 11px;
    font-weight: 600;
    border-radius: var(--radius-sm);
    background: var(--color-bg-elevated);
    color: var(--color-text-secondary);
    white-space: nowrap;
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: var(--space-4);
  }

  .header-clock {
    font-size: 14px;
    color: var(--color-text-secondary);
  }

  /* --- Add widget button --- */
  .add-widget-btn {
    display: flex;
    align-items: center;
    gap: var(--space-1);
    padding: var(--space-1) var(--space-3);
    font-size: 13px;
    font-weight: 500;
    color: var(--color-accent-text, var(--color-accent));
    background: var(--color-accent-subtle, transparent);
    border: 1px solid var(--color-accent);
    border-radius: var(--radius-sm, 4px);
    cursor: pointer;
    transition: background 0.15s;
  }

  .add-widget-btn:hover {
    background: var(--color-accent);
    color: var(--color-bg, #fff);
  }

  .add-widget-text {
    white-space: nowrap;
  }

  /* --- Bell button --- */
  .bell-btn {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    background: none;
    border: none;
    border-radius: var(--radius-sm, 4px);
    color: var(--color-text-muted);
    cursor: pointer;
    transition: color 0.15s, background 0.15s;
    flex-shrink: 0;
  }

  .bell-btn:hover {
    color: var(--color-text);
    background: var(--color-bg-hover);
  }

  /* Badge */
  .bell-badge {
    position: absolute;
    top: 2px;
    right: 2px;
    min-width: 16px;
    height: 16px;
    padding: 0 4px;
    background: var(--color-accent);
    color: var(--color-bg, #fff);
    font-size: 9px;
    font-weight: 700;
    line-height: 16px;
    border-radius: 999px;
    text-align: center;
    pointer-events: none;
  }
</style>
