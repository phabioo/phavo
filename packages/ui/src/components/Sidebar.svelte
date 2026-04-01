<script lang="ts">
import type { Snippet } from 'svelte';
import Icon from './Icon.svelte';

interface NavItem {
  id: string;
  label: string;
  icon?: string;
}

interface TabItem {
  id: string;
  label: string;
}

interface Props {
  collapsed?: boolean;
  tier?: 'free' | 'standard' | 'pro' | 'local';
  deviceName?: string;
  items?: NavItem[];
  bottomItems?: NavItem[];
  tabs?: TabItem[];
  activeTab?: string;
  activeItem?: string;
  ontoggle?: () => void;
  onnavigate?: (id: string) => void;
  onTabSelect?: (id: string) => void;
  onNewTab?: () => void;
  children?: Snippet;
}

let {
  collapsed = $bindable(false),
  tier = 'free',
  deviceName = '',
  items = [],
  bottomItems = [],
  tabs = [],
  activeTab = '',
  activeItem = '',
  ontoggle,
  onnavigate,
  onTabSelect,
  onNewTab,
  children,
}: Props = $props();

let dashExpanded = $state(true);

const tierLabel = $derived(tier.toUpperCase());
const showUpgrade = $derived(tier === 'free');
</script>

<aside class="sidebar" class:collapsed>
  <div class="sidebar-top">
    <!-- Logo + collapse toggle -->
    <div class="sidebar-header">
      <div class="logo-area">
        {#if !collapsed}
          <span class="sidebar-logo">PHAVO</span>
        {/if}
        <button class="sidebar-toggle" onclick={ontoggle} type="button" aria-label="Toggle sidebar">
          <Icon name={collapsed ? 'menu' : 'panel-left'} size={18} />
        </button>
      </div>
      {#if !collapsed}
        <span class="tier-badge">{tierLabel}</span>
        {#if deviceName}
          <span class="device-pill">{deviceName}</span>
        {/if}
      {/if}
    </div>

    <!-- Navigation -->
    <nav class="sidebar-nav sidebar-nav-top">
      <!-- Dashboard section (collapsible) -->
      <button
        class="nav-item"
        class:active={activeItem === 'home'}
        onclick={() => {
          if (collapsed) {
            onnavigate?.('home');
          } else {
            dashExpanded = !dashExpanded;
            onnavigate?.('home');
          }
        }}
        type="button"
      >
        <span class="nav-icon"><Icon name="layout-dashboard" size={18} /></span>
        {#if !collapsed}
          <span class="nav-label">Dashboard</span>
          <span class="nav-chevron">
            <Icon name={dashExpanded ? 'chevron-down' : 'chevron-right'} size={14} />
          </span>
        {/if}
      </button>

      <!-- Tab sub-items (visible when dashboard expanded) -->
      {#if !collapsed && dashExpanded}
        <div class="sub-nav">
          {#each tabs as tab}
            <button
              class="sub-nav-item"
              class:sub-nav-active={activeTab === tab.id}
              onclick={() => onTabSelect?.(tab.id)}
              type="button"
            >
              <span class="sub-nav-dot"></span>
              <span class="sub-nav-label">{tab.label}</span>
            </button>
          {/each}
          {#if onNewTab}
            <button
              class="sub-nav-item sub-nav-add"
              onclick={() => onNewTab?.()}
              type="button"
            >
              <Icon name="plus" size={12} />
              <span class="sub-nav-label">New Page</span>
            </button>
          {/if}
        </div>
      {/if}

      <!-- Standard nav items -->
      {#each items as item}
        <button
          class="nav-item"
          class:active={activeItem === item.id}
          onclick={() => onnavigate?.(item.id)}
          type="button"
        >
          {#if item.icon}
            <span class="nav-icon"><Icon name={item.icon} size={18} /></span>
          {/if}
          {#if !collapsed}
            <span class="nav-label">{item.label}</span>
          {/if}
        </button>
      {/each}
    </nav>

    <div class="sidebar-spacer"></div>

    {#if bottomItems.length > 0}
      <nav class="sidebar-nav sidebar-nav-bottom">
        {#each bottomItems as item}
          <button
            class="nav-item"
            class:active={activeItem === item.id}
            onclick={() => onnavigate?.(item.id)}
            type="button"
          >
            {#if item.icon}
              <span class="nav-icon"><Icon name={item.icon} size={18} /></span>
            {/if}
            {#if !collapsed}
              <span class="nav-label">{item.label}</span>
            {/if}
          </button>
        {/each}
      </nav>
    {/if}
  </div>

  <!-- Bottom section: upgrade card or children -->
  <div class="sidebar-bottom-section" class:sidebar-bottom-hidden={collapsed}>
    {#if children}
      <div class="sidebar-footer">
        {@render children()}
      </div>
    {:else if showUpgrade}
      <div class="upgrade-card">
        <p class="upgrade-kicker">Free</p>
        <p class="upgrade-text">More widgets. More pages. Fewer limits.</p>
        <button class="upgrade-btn" onclick={() => onnavigate?.('license')} type="button">
          Upgrade to Standard
        </button>
      </div>
    {/if}
  </div>
</aside>

<!-- Mobile bottom navigation bar (visible only <640px) -->
<nav class="bottom-nav" aria-label="Main navigation">
  <button
    class="bottom-nav-item"
    class:bottom-nav-active={activeItem === 'home'}
    onclick={() => onnavigate?.('home')}
    type="button"
    aria-label="Dashboard"
  >
    <span class="bottom-nav-icon"><Icon name="layout-dashboard" size={20} /></span>
    <span class="bottom-nav-label">Dashboard</span>
  </button>
  {#each [...items, ...bottomItems].slice(0, 3) as item}
    <button
      class="bottom-nav-item"
      class:bottom-nav-active={activeItem === item.id}
      onclick={() => onnavigate?.(item.id)}
      type="button"
      aria-label={item.label}
    >
      {#if item.icon}
        <span class="bottom-nav-icon"><Icon name={item.icon} size={20} /></span>
      {/if}
      <span class="bottom-nav-label">{item.label}</span>
    </button>
  {/each}
</nav>

<style>
  .sidebar {
    position: fixed;
    top: 0;
    left: 0;
    bottom: 0;
    width: var(--sidebar-width);
    background: var(--color-bg-surface);
    border-right: 1px solid var(--color-border-subtle);
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    transition: width 0.3s ease;
    z-index: 100;
    overflow: hidden;
    box-shadow: 0 0 0 1px var(--color-border-subtle);
  }

  .sidebar.collapsed {
    width: var(--sidebar-collapsed-width);
  }

  .sidebar-top {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    scrollbar-width: none;
  }

  .sidebar-top::-webkit-scrollbar {
    display: none;
  }

  /* ── Header ──────────────────────────────────────────────────────────── */
  .sidebar-header {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    padding: var(--space-6);
  }

  .logo-area {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .collapsed .logo-area {
    justify-content: center;
  }

  .sidebar-logo {
    font-size: 1.75rem;
    font-weight: 800;
    letter-spacing: -0.05em;
    color: var(--color-accent);
    text-transform: uppercase;
    font-family: var(--font-ui);
  }

  .sidebar-toggle {
    background: none;
    border: none;
    color: var(--color-text-muted);
    cursor: pointer;
    padding: var(--space-1);
    border-radius: var(--radius-sm);
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 44px;
    min-width: 44px;
    transition: color 0.15s;
  }

  .sidebar-toggle:hover {
    color: var(--color-accent);
  }

  .tier-badge {
    font-size: var(--font-size-xs);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.28em;
    color: var(--color-text-muted);
    font-family: var(--font-ui);
  }

  .device-pill {
    display: inline-flex;
    align-items: center;
    padding: 2px var(--space-2);
    border-radius: var(--radius-sm);
    background: var(--color-bg-hover);
    color: var(--color-text-secondary);
    font-size: var(--font-size-xs);
    font-weight: 700;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    width: fit-content;
    margin-top: var(--space-2);
  }

  /* ── Navigation ──────────────────────────────────────────────────────── */
  .sidebar-nav {
    padding: 0 var(--space-2);
  }

  .sidebar-nav-bottom {
    border-top: 1px solid var(--color-border-subtle);
    padding-top: var(--space-3);
    padding-bottom: var(--space-4);
  }

  .sidebar-spacer {
    flex: 1;
  }

  .nav-item {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    width: 100%;
    padding: var(--space-3);
    background: none;
    border: none;
    border-radius: var(--radius-lg);
    color: var(--color-text-muted);
    font-family: var(--font-ui);
    font-size: var(--font-size-sm);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    cursor: pointer;
    transition: background 0.15s, color 0.15s, border-color 0.15s;
    text-align: left;
    min-height: 44px;
    border: 1px solid transparent;
  }

  .nav-item:hover {
    color: var(--color-text-primary);
    background: color-mix(in srgb, var(--color-bg-hover) 70%, transparent);
  }

  .nav-item.active {
    background: color-mix(in srgb, var(--color-accent-t) 60%, var(--color-bg-hover));
    color: var(--color-accent-text);
    border-color: color-mix(in srgb, var(--color-accent) 28%, transparent);
  }

  .collapsed .nav-item {
    justify-content: center;
    padding: var(--space-2);
  }

  .nav-icon {
    display: flex;
    align-items: center;
    flex-shrink: 0;
  }

  .nav-label {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    flex: 1;
  }

  .nav-chevron {
    display: flex;
    align-items: center;
    color: var(--color-text-muted);
    margin-left: auto;
  }

  /* ── Sub-nav (tabs) ──────────────────────────────────────────────────── */
  .sub-nav {
    padding: var(--space-1) 0 var(--space-3) calc(var(--space-6) + var(--space-4));
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .sub-nav-item {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    background: none;
    border: none;
    color: var(--color-text-muted);
    font-family: var(--font-ui);
    font-size: var(--font-size-xs);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    cursor: pointer;
    transition: color 0.15s;
    padding: var(--space-2) 0;
    text-align: left;
  }

  .sub-nav-item:hover {
    color: var(--color-accent);
  }

  .sub-nav-active {
    color: var(--color-accent-text);
  }

  .sub-nav-dot {
    width: 4px;
    height: 4px;
    border-radius: 50%;
    background: currentColor;
    flex-shrink: 0;
  }

  .sub-nav-label {
    white-space: nowrap;
  }

  .sub-nav-add {
    color: var(--color-text-muted);
  }

  /* ── Footer / Upgrade card ───────────────────────────────────────────── */
  .sidebar-bottom-section {
    overflow: hidden;
    opacity: 1;
    max-height: 200px;
    transition: opacity 0.2s ease, max-height 0.3s ease;
  }

  .sidebar-bottom-hidden {
    opacity: 0;
    max-height: 0;
    pointer-events: none;
  }

  .sidebar-footer {
    padding: var(--space-4) var(--space-6);
    border-top: 1px solid var(--color-border-subtle);
  }

  .upgrade-card {
    margin: var(--space-4) var(--space-6) var(--space-6);
    padding: var(--space-4);
    background: color-mix(in srgb, var(--color-bg-elevated) 92%, transparent);
    border-radius: var(--radius-xl);
    border: 1px solid var(--color-border-subtle);
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .upgrade-kicker {
    color: var(--color-text-muted);
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.18em;
    margin: 0;
    text-transform: uppercase;
  }

  .upgrade-text {
    font-size: var(--font-size-xs);
    color: var(--color-text-secondary);
    line-height: 1.5;
    margin: 0;
  }

  .upgrade-btn {
    width: 100%;
    padding: var(--space-2) var(--space-4);
    background: linear-gradient(
      135deg,
      color-mix(in srgb, var(--color-accent-hover) 88%, transparent),
      color-mix(in srgb, var(--color-accent) 96%, transparent)
    );
    color: var(--color-text-inverse);
    font-family: var(--font-ui);
    font-size: var(--font-size-sm);
    font-weight: 700;
    border: none;
    border-radius: var(--radius-lg);
    cursor: pointer;
    transition: opacity 0.15s, transform 0.15s;
    letter-spacing: 0.01em;
  }

  .upgrade-btn:hover {
    opacity: 0.9;
    transform: translateY(-1px);
  }

  /* ── TABLET (640px–1023px): icon-only rail ────────────────────────────── */
  @media (min-width: 640px) and (max-width: 1023px) {
    .sidebar {
      width: var(--sidebar-collapsed-width);
    }

    .sidebar-logo,
    .tier-badge,
    .device-pill,
    .sub-nav,
    .nav-label,
    .nav-chevron,
    .sidebar-bottom-section {
      display: none;
    }

    .logo-area {
      justify-content: center;
    }

    .sidebar-toggle {
      display: none;
    }

    .nav-item {
      justify-content: center;
      padding: var(--space-2);
    }
  }

  /* ── MOBILE (<640px): hide sidebar ───────────────────────────────────── */
  @media (max-width: 639px) {
    .sidebar {
      display: none;
    }
  }

  /* ── Bottom nav (mobile only) ────────────────────────────────────────── */
  .bottom-nav {
    display: none;
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    background: var(--color-bg-surface);
    border-top: 1px solid var(--color-border-subtle);
    z-index: 100;
    padding-bottom: env(safe-area-inset-bottom);
  }

  .bottom-nav-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 3px;
    flex: 1;
    min-height: 56px;
    padding: var(--space-1) var(--space-2);
    background: none;
    border: none;
    color: var(--color-text-secondary);
    font-family: var(--font-ui);
    font-size: 10px;
    cursor: pointer;
    transition: color 0.15s;
  }

  .bottom-nav-item:hover {
    color: var(--color-text-primary);
  }

  .bottom-nav-active {
    color: var(--color-accent-text);
  }

  .bottom-nav-icon {
    display: flex;
    align-items: center;
  }

  .bottom-nav-label {
    white-space: nowrap;
  }

  @media (max-width: 639px) {
    .bottom-nav {
      display: flex;
    }
  }
</style>
