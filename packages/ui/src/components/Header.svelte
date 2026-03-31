<script lang="ts">
import { onMount } from 'svelte';
import type { Snippet } from 'svelte';
import Icon from './Icon.svelte';
import HeaderSearch from './HeaderSearch.svelte';
import type { SearchEntry, AiProviders } from './HeaderSearch.svelte';

interface Props {
  pageTitle?: string;
  pageSubtitle?: string;
  dashboardName?: string;
  brandingLabel?: string | undefined;
  weather?: { temp: number; condition: string } | undefined;
  notificationCount?: number;
  updateAvailable?: boolean;
  updateBadge?: Snippet;
  userMenu?: Snippet;
  unreadCount?: number;
  onBellClick?: () => void;
  onAddWidgetClick?: () => void;
  addWidgetLabel?: string;
  searchIndex?: SearchEntry[];
  searchEngineUrl?: string;
  aiProviders?: AiProviders;
  tier?: 'free' | 'standard' | 'local';
  onSearchAction?: (entry: SearchEntry) => void;
  onAiChat?: (provider: 'ollama' | 'openai' | 'anthropic', query: string) => Promise<string>;
}

let {
  pageTitle,
  pageSubtitle,
  dashboardName = 'My Dashboard',
  brandingLabel,
  weather,
  notificationCount,
  updateAvailable = false,
  updateBadge,
  userMenu,
  unreadCount = 0,
  onBellClick,
  onAddWidgetClick,
  addWidgetLabel = 'Add widget',
  searchIndex = [],
  searchEngineUrl,
  aiProviders,
  tier = 'free',
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

const displayTitle = $derived(pageTitle ?? dashboardName);
const effectiveUnread = $derived(notificationCount ?? unreadCount);

const formattedTime = $derived(
  time.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }),
);
</script>

<header class="header">
  <!-- Search / Command palette -->
  <div class="header-search-area">
    <HeaderSearch
      {searchIndex}
      {searchEngineUrl}
      {aiProviders}
      {tier}
      onAction={onSearchAction}
      {onAiChat}
    />
  </div>

  <!-- Right side: clock, weather, notifications, user -->
  <div class="header-right">
    <div class="header-time-weather">
      <span class="header-clock mono">{formattedTime}</span>
      {#if weather}
        <span class="header-weather">{weather.temp}°C, {weather.condition}</span>
      {/if}
    </div>

    {#if updateBadge}
      {@render updateBadge()}
    {/if}

    {#if onAddWidgetClick}
      <button class="add-widget-btn" onclick={onAddWidgetClick} aria-label={addWidgetLabel}>
        <Icon name="plus" size={16} />
        <span class="add-widget-text">{addWidgetLabel}</span>
      </button>
    {/if}

    <!-- Notification bell -->
    <button
      class="bell-btn"
      onclick={onBellClick}
      aria-label="Notifications{effectiveUnread > 0 ? ` (${effectiveUnread} unread)` : ''}"
    >
      <Icon name="bell" size={18} />
      {#if effectiveUnread > 0}
        <span class="bell-badge" aria-hidden="true">
          {effectiveUnread > 99 ? '99+' : effectiveUnread}
        </span>
      {/if}
    </button>

    {#if userMenu}
      {@render userMenu()}
    {/if}
  </div>
</header>

<!-- Page title section (below header bar) -->
{#if displayTitle}
  <section class="page-title-section">
    <h1 class="page-title">{displayTitle}</h1>
    {#if pageSubtitle}
      <p class="page-subtitle">{pageSubtitle}</p>
    {/if}
  </section>
{/if}

<style>
  .header {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    padding: var(--space-6) var(--space-8);
    gap: var(--space-6);
  }

  /* ── Search area ─────────────────────────────────────────────────────── */
  .header-search-area {
    flex: 1;
    max-width: 480px;
    margin-right: auto;
  }

  /* ── Right section ───────────────────────────────────────────────────── */
  .header-right {
    display: flex;
    align-items: center;
    gap: var(--space-4);
    flex-shrink: 0;
  }

  .header-time-weather {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
  }

  .header-clock {
    font-size: 14px;
    font-weight: 700;
    color: var(--color-text-primary);
  }

  .header-weather {
    font-size: var(--font-size-xs);
    color: var(--color-text-muted);
    text-transform: uppercase;
    letter-spacing: -0.02em;
  }

  /* ── Add widget button ───────────────────────────────────────────────── */
  .add-widget-btn {
    display: flex;
    align-items: center;
    gap: var(--space-1);
    padding: var(--space-1) var(--space-3);
    font-size: var(--font-size-md);
    font-weight: 500;
    font-family: var(--font-ui);
    color: var(--color-text-inverse);
    background: var(--color-accent);
    border: none;
    border-radius: var(--radius-sm);
    cursor: pointer;
    transition: opacity 0.15s;
  }

  .add-widget-btn:hover {
    opacity: 0.9;
  }

  .add-widget-text {
    white-space: nowrap;
  }

  /* ── Bell button ─────────────────────────────────────────────────────── */
  .bell-btn {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    background: none;
    border: none;
    border-radius: var(--radius-sm);
    color: var(--color-text-secondary);
    cursor: pointer;
    transition: color 0.15s, background 0.15s;
    flex-shrink: 0;
  }

  .bell-btn:hover {
    color: var(--color-accent);
    background: var(--color-bg-hover);
  }

  .bell-badge {
    position: absolute;
    top: 2px;
    right: 2px;
    min-width: 16px;
    height: 16px;
    padding: 0 4px;
    background: var(--color-accent);
    color: var(--color-text-inverse);
    font-size: 9px;
    font-weight: 700;
    line-height: 16px;
    border-radius: 9999px;
    text-align: center;
    pointer-events: none;
  }

  /* ── Page title section ──────────────────────────────────────────────── */
  .page-title-section {
    padding: 0 var(--space-8) var(--space-6);
  }

  .page-title {
    font-size: 36px;
    font-weight: 800;
    letter-spacing: -0.03em;
    color: var(--color-text-primary);
    font-family: var(--font-ui);
    line-height: 1.1;
  }

  .page-subtitle {
    font-size: var(--font-size-sm);
    color: var(--color-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.15em;
    margin-top: var(--space-2);
  }

  /* ── Responsive ──────────────────────────────────────────────────────── */
  @media (max-width: 639px) {
    .header {
      padding: var(--space-4);
      gap: var(--space-3);
    }

    .header-search-area {
      max-width: none;
    }

    .add-widget-text {
      display: none;
    }

    .header-time-weather {
      display: none;
    }

    .page-title-section {
      padding: 0 var(--space-4) var(--space-4);
    }

    .page-title {
      font-size: 28px;
    }
  }
</style>
