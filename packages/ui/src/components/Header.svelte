<script lang="ts">
import { onMount } from 'svelte';
import Icon from './Icon.svelte';
import HeaderSearch from './HeaderSearch.svelte';
import type { SearchEntry, AiProviders } from './HeaderSearch.svelte';

interface Props {
  dashboardName?: string;
  tierLabel?: string;
  weather?: { temp: number; condition: string } | undefined;
  notificationCount?: number;
  unreadCount?: number;
  systemOnline?: boolean | null;
  onBellClick?: () => void;
  onAddWidgetClick?: (() => void) | undefined;
  addWidgetLabel?: string;
  searchIndex?: SearchEntry[];
  searchEngineUrl?: string;
  aiProviders?: AiProviders;
  tier?: 'stellar' | 'celestial';
  onSearchAction?: (entry: SearchEntry) => void;
  onAiChat?: (provider: 'ollama' | 'openai' | 'anthropic', query: string) => Promise<string>;
}

let {
  dashboardName = 'PHAVO',
  tierLabel = 'STELLAR',
  notificationCount,
  unreadCount = 0,
  systemOnline = null,
  onBellClick,
  onAddWidgetClick,
  addWidgetLabel = 'Add widget',
  searchIndex = [],
  searchEngineUrl,
  aiProviders,
  tier = 'stellar',
  onSearchAction,
  onAiChat,
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

const effectiveUnread = $derived(notificationCount ?? unreadCount);
const formattedTime = $derived(
  time.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }),
);
</script>

<header class="phavo-header">
  <!-- LEFT: Dashboard name -->
  <div class="header-left">
    <span class="header-dashboard-name">{dashboardName}</span>
  </div>

  <!-- CENTER: Command palette — mathematically centered via grid 1fr/auto/1fr -->
  <div class="header-center">
    <HeaderSearch
      {searchIndex}
      {searchEngineUrl}
      {aiProviders}
      {tier}
      onAction={onSearchAction}
      {onAiChat}
    />
  </div>

  <!-- RIGHT: Info pill · System status · Action buttons -->
  <div class="header-right">
    <!-- System status pill -->
    {#if systemOnline}
      <div class="status-pill status-online">
        <span class="status-dot"></span>
        <span>SYSTEM ONLINE</span>
      </div>
    {:else}
      <div class="status-pill status-offline status-offline-force">
        <span class="status-dot"></span>
        <span>OFFLINE</span>
      </div>
    {/if}

    <!-- Info pill: clock -->
    <div class="header-info-pill">
      <Icon name="clock" size={14} />
      <span class="header-clock">{formattedTime}</span>
    </div>

    <button
      class="header-action bell-btn"
      onclick={onBellClick}
      aria-label="Notifications{effectiveUnread > 0 ? ` (${effectiveUnread} unread)` : ''}"
    >
      <Icon name="bell" size={17} />
      {#if effectiveUnread > 0}
        <span class="bell-badge" aria-hidden="true">
          {effectiveUnread > 99 ? '99+' : effectiveUnread}
        </span>
      {/if}
    </button>
  </div>
</header>

<style>
  /* ── Layout: 1fr / auto / 1fr ensures center is always mathematically centered ── */
  .phavo-header {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    height: 64px;
    padding: 0 var(--space-8);
    gap: var(--space-4);
    background: color-mix(in srgb, var(--color-surface-dim) 60%, transparent);
    backdrop-filter: blur(20px);
    position: sticky;
    top: 0;
    z-index: 40;
  }

  .header-left {
    justify-self: start;
    display: flex;
    align-items: center;
    gap: var(--space-3);
  }

  .header-dashboard-name {
    font-size: 14px;
    font-weight: 700;
    color: var(--color-primary-fixed);
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }

  .header-center {
    justify-self: center;
    width: 100%;
    max-width: 440px;
  }

  .header-right {
    justify-self: end;
    display: flex;
    align-items: center;
    gap: 20px;
  }

  /* ── Info pill: clock · weather ── */
  .header-info-pill {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 6px 16px;
    border-radius: var(--radius-full);
    background: color-mix(in srgb, var(--color-surface-highest) 40%, transparent);
    backdrop-filter: blur(20px);
    border: 1px solid color-mix(in srgb, var(--color-primary) 8%, transparent);
    font-family: var(--font-mono);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--color-on-surface-variant);
  }

  .header-clock {
    color: var(--color-on-surface-variant);
  }

  /* ── System status pills ── */
  :global(.status-pill) {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 14px;
    border-radius: 9999px;
    font-family: var(--font-mono);
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    white-space: nowrap;
    flex-shrink: 0;
  }

  :global(.status-online) {
    background: color-mix(in srgb, var(--color-secondary) 10%, transparent);
    color: var(--color-secondary);
    border: 1px solid color-mix(in srgb, var(--color-secondary) 20%, transparent);
  }

  :global(.status-offline) {
    background: color-mix(in srgb, var(--color-error) 10%, transparent);
    color: var(--color-error);
    border: 1px solid color-mix(in srgb, var(--color-error) 25%, transparent);
  }

  :global(.status-dot) {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: currentColor;
    flex-shrink: 0;
  }

  :global(.status-online .status-dot) {
    animation: pulse 2s ease-in-out infinite;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50%       { opacity: 0.3; }
  }

  /* ── Action buttons (Add Widget, Bell) ── */
  .header-action {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-2);
    background: var(--color-surface-highest);
    border: none;
    color: var(--color-on-surface-variant);
    cursor: pointer;
    font-family: var(--font-mono);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    padding: 6px 14px;
    border-radius: var(--radius-full);
    transition: color 0.15s, background 0.15s;
  }

  .header-action:hover {
    color: var(--color-on-surface);
    background: var(--color-surface-bright);
  }

  .bell-btn {
    position: relative;
  }

  .bell-badge {
    position: absolute;
    top: 2px;
    right: 2px;
    min-width: 16px;
    height: 16px;
    padding: 0 4px;
    border-radius: var(--radius-full);
    background: var(--color-error);
    color: var(--color-on-surface);
    font-size: 9px;
    font-weight: 500;
    line-height: 16px;
    text-align: center;
    pointer-events: none;
  }

  @media (max-width: 960px) {
    .phavo-header {
      grid-template-columns: auto 1fr auto;
      height: auto;
      padding: var(--space-3) var(--space-8);
    }

    .header-center {
      max-width: none;
    }
  }

  @media (max-width: 639px) {
    .phavo-header {
      padding: var(--space-3) var(--space-4);
    }

    .header-dashboard-name {
      display: none;
    }
  }

  .status-offline-force {
    color: var(--color-error) !important;
    background-color: color-mix(in srgb, var(--color-error) 10%, transparent) !important;
  }

  .status-offline-force :global(.dot),
  .status-offline-force :global(span) {
    background-color: var(--color-error) !important;
    color: var(--color-error) !important;
  }
</style>
