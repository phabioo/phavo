<script lang="ts">
import { onMount } from 'svelte';
import type { Snippet } from 'svelte';
import Icon from './Icon.svelte';
import HeaderSearch from './HeaderSearch.svelte';
import type { SearchEntry, AiProviders } from './HeaderSearch.svelte';

interface Props {
  pageTitle?: string | undefined;
  pageSubtitle?: string | undefined;
  dashboardName?: string;
  brandingLabel?: string | undefined;
  weather?: { temp: number; condition: string } | undefined;
  notificationCount?: number;
  updateAvailable?: boolean;
  updateBadge?: Snippet;
  userMenu?: Snippet;
  unreadCount?: number;
  onBellClick?: () => void;
  onAddWidgetClick?: (() => void) | undefined;
  addWidgetLabel?: string;
  searchIndex?: SearchEntry[];
  searchEngineUrl?: string;
  aiProviders?: AiProviders;
  tier?: 'free' | 'standard' | 'pro' | 'local';
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
  <div class="header-shell">
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

    <div class="header-control-rail">
      <div class="status-cluster" role="group" aria-label="Current status">
        <div class="status-segment status-segment-time">
          <span class="status-label">Time</span>
          <span class="header-clock mono">{formattedTime}</span>
        </div>

        {#if weather}
          <span class="status-divider" aria-hidden="true"></span>
          <div class="status-segment status-segment-weather">
            <span class="status-label">Weather</span>
            <span class="header-weather">{weather.temp}&deg;C &middot; {weather.condition}</span>
          </div>
        {/if}
      </div>

      <div class="header-action-group">
        {#if onAddWidgetClick}
          <button class="control-btn add-widget-btn" onclick={onAddWidgetClick} aria-label={addWidgetLabel}>
            <Icon name="plus" size={15} />
            <span class="add-widget-text">{addWidgetLabel}</span>
          </button>
        {/if}

        <button
          class="control-btn bell-btn"
          onclick={onBellClick}
          aria-label="Notifications{effectiveUnread > 0 ? ` (${effectiveUnread} unread)` : ''}"
        >
          <Icon name="bell" size={17} />
          <span class="bell-label">Alerts</span>
          {#if effectiveUnread > 0}
            <span class="bell-badge" aria-hidden="true">
              {effectiveUnread > 99 ? '99+' : effectiveUnread}
            </span>
          {/if}
        </button>
      </div>
    </div>

    {#if (updateAvailable && updateBadge) || userMenu}
      <div class="header-meta-rail">
        {#if updateAvailable && updateBadge}
          <div class="header-update-slot">
            {@render updateBadge()}
          </div>
        {/if}

        {#if userMenu}
          <div class="header-user-slot">
            {@render userMenu()}
          </div>
        {/if}
      </div>
    {/if}
  </div>
</header>

{#if displayTitle}
  <section class="page-title-section">
    <div class="page-title-copy">
      {#if brandingLabel}
        <span class="page-branding">{brandingLabel}</span>
      {/if}
      <h1 class="page-title">{displayTitle}</h1>
      {#if pageSubtitle}
        <p class="page-subtitle">{pageSubtitle}</p>
      {/if}
    </div>
  </section>
{/if}

<style>
  .header {
    position: sticky;
    top: 0;
    z-index: 40;
    isolation: isolate;
    padding: var(--space-5) var(--space-8) var(--space-5);
  }

  .header::before {
    content: '';
    position: absolute;
    inset: -28px 0 -44px;
    z-index: -2;
    background:
      linear-gradient(
        180deg,
        color-mix(in srgb, var(--color-bg-base) 82%, transparent) 0%,
        color-mix(in srgb, var(--color-bg-base) 52%, transparent) 42%,
        transparent 100%
      );
    backdrop-filter: blur(22px) saturate(122%);
    -webkit-backdrop-filter: blur(22px) saturate(122%);
    mask-image: linear-gradient(180deg, black 0%, black 58%, transparent 100%);
  }

  .header::after {
    content: '';
    position: absolute;
    inset: 0;
    z-index: -1;
    pointer-events: none;
    background:
      radial-gradient(
        ellipse 56% 92% at 14% 0%,
        color-mix(in srgb, var(--color-accent-t) 22%, transparent),
        transparent 74%
      ),
      linear-gradient(
        180deg,
        color-mix(in srgb, var(--color-bg-elevated) 12%, transparent),
        transparent 100%
      );
  }

  .header-shell {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto auto;
    align-items: center;
    gap: var(--space-3);
    width: 100%;
  }

  .header-search-area {
    min-width: 0;
    max-width: 520px;
  }

  .header-meta-rail {
    display: inline-flex;
    align-items: center;
    justify-self: end;
    gap: var(--space-2);
  }

  .header-update-slot,
  .header-user-slot {
    display: inline-flex;
    align-items: center;
  }

  .header-control-rail {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    gap: var(--space-2);
    min-width: 0;
  }

  .status-cluster,
  .control-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 40px;
    padding: 0 var(--space-4);
    border-radius: 999px;
    border: 1px solid color-mix(in srgb, var(--color-accent) 18%, var(--color-border-subtle));
    background: color-mix(in srgb, var(--color-bg-elevated) 94%, transparent);
    box-shadow: 0 8px 22px rgba(0, 0, 0, 0.16);
  }

  .status-cluster {
    display: inline-flex;
    align-items: center;
    gap: var(--space-3);
    min-width: 0;
    max-width: min(100%, 30rem);
    color: var(--color-text-primary);
  }

  .header-action-group {
    display: inline-flex;
    align-items: stretch;
    justify-content: flex-end;
    gap: var(--space-2);
    flex-shrink: 0;
  }

  .status-segment {
    display: inline-flex;
    align-items: center;
    gap: var(--space-3);
    min-width: 0;
  }

  .status-segment-weather {
    flex: 1 1 auto;
  }

  .status-divider {
    width: 1px;
    align-self: stretch;
    background: color-mix(in srgb, var(--color-border-subtle) 82%, var(--color-accent-t));
    opacity: 0.9;
    flex-shrink: 0;
  }

  .status-label {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: var(--color-text-muted);
  }

  .header-clock {
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 0.03em;
    color: var(--color-text-primary);
  }

  .header-weather {
    font-size: 12px;
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    color: var(--color-text-secondary);
  }

  .control-btn {
    gap: var(--space-2);
    cursor: pointer;
    color: var(--color-text-primary);
    font-family: var(--font-ui);
    font-size: var(--font-size-sm);
    font-weight: 600;
    transition:
      color 0.15s ease,
      border-color 0.15s ease,
      background 0.15s ease,
      transform 0.15s ease;
  }

  .control-btn:hover {
    color: var(--color-accent-text);
    border-color: color-mix(in srgb, var(--color-accent) 28%, var(--color-border-subtle));
    background: color-mix(in srgb, var(--color-bg-hover) 88%, transparent);
    transform: translateY(-1px);
  }

  .add-widget-btn {
    min-width: 0;
  }

  .add-widget-text {
    white-space: nowrap;
  }

  .bell-btn {
    position: relative;
    padding-right: calc(var(--space-4) + 2px);
  }

  .bell-label {
    font-size: 12px;
    font-weight: 600;
    white-space: nowrap;
  }

  .bell-badge {
    position: absolute;
    top: 4px;
    right: 4px;
    min-width: 16px;
    height: 16px;
    padding: 0 4px;
    border-radius: 999px;
    background: var(--color-accent);
    color: var(--color-text-inverse);
    font-size: 9px;
    font-weight: 700;
    line-height: 16px;
    text-align: center;
    pointer-events: none;
  }

  .page-title-section {
    width: 100%;
    padding: 0 var(--space-8) var(--space-7);
  }

  .page-title-copy {
    width: min(100%, 1080px);
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .page-branding {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    color: var(--color-accent-text);
  }

  .page-title {
    margin: 0;
    font-size: clamp(2.35rem, 5vw, 3.15rem);
    font-weight: 800;
    letter-spacing: -0.04em;
    line-height: 1.02;
    color: var(--color-text-primary);
  }

  .page-subtitle {
    margin: 0;
    font-size: var(--font-size-sm);
    color: var(--color-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.22em;
  }

  @media (max-width: 1180px) {
    .header-shell {
      grid-template-columns: minmax(0, 1fr) auto;
      align-items: end;
    }

    .header-search-area {
      grid-column: 1 / -1;
      max-width: none;
    }

    .header-control-rail {
      grid-column: 1 / 2;
      width: 100%;
    }

    .status-cluster {
      max-width: none;
    }

    .header-meta-rail {
      justify-self: end;
      align-self: center;
    }
  }

  @media (max-width: 960px) {
    .header-shell {
      grid-template-columns: 1fr;
    }

    .header-control-rail,
    .header-meta-rail {
      grid-column: 1 / -1;
      justify-self: start;
    }

    .header-control-rail {
      grid-template-columns: 1fr;
      align-items: stretch;
    }

    .header-action-group {
      justify-content: flex-start;
    }

    .status-cluster,
    .control-btn {
      min-height: 38px;
    }

    .status-cluster {
      padding-inline: var(--space-3);
    }

    .control-btn {
      padding-inline: var(--space-3);
    }
  }

  @media (max-width: 639px) {
    .header {
      padding: var(--space-4);
    }

    .header-control-rail {
      gap: var(--space-2);
    }

    .status-label,
    .add-widget-text,
    .bell-label {
      display: none;
    }

    .status-cluster {
      gap: var(--space-2);
    }

    .status-segment {
      gap: var(--space-2);
    }

    .header-action-group {
      width: 100%;
      justify-content: flex-start;
    }

    .header-weather {
      max-width: 12ch;
    }

    .page-title-section {
      padding: 0 var(--space-4) var(--space-4);
    }

    .page-title {
      font-size: 28px;
    }
  }
</style>
