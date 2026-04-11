<script lang="ts">
import type { Snippet } from 'svelte';
import Icon from './Icon.svelte';

interface NavStatus {
  type: 'active' | 'error' | 'warning' | 'inactive';
  label: string;
}

interface NavItem {
  id: string;
  label: string;
  icon?: string;
  status?: NavStatus;
}

interface TabItem {
  id: string;
  label: string;
}

interface Props {
  collapsed?: boolean;
  deviceName?: string;
  items?: NavItem[];
  bottomItems?: NavItem[];
  tabs?: TabItem[];
  activeTab?: string;
  activeItem?: string;
  ontoggle?: () => void;
  onnavigate?: (id: string) => void;
  onsettingsnav?: (tab: string) => void;
  onTabSelect?: (id: string) => void;
  onNewTab?: () => void;
  ondeletepage?: ((id: string) => void) | undefined;
  children?: Snippet;
}

let {
  collapsed = $bindable(false),
  deviceName = '',
  items = [],
  bottomItems = [],
  tabs = [],
  activeTab = '',
  activeItem = '',
  ontoggle,
  onnavigate,
  onsettingsnav = undefined as ((tab: string) => void) | undefined,
  onTabSelect,
  onNewTab,
  ondeletepage = undefined as ((id: string) => void) | undefined,
  children,
}: Props = $props();

let dashExpanded = $state(true);

const mobileNavItems = $derived([{ id: 'home', label: 'Dashboard', icon: 'layout-dashboard' }, ...items, ...bottomItems]);
</script>

<aside class="sidebar" class:sidebar-collapsed={collapsed}>
  <div class="sidebar-top">
    <!-- Header: wordmark + toggle -->
    <div class="sidebar-header">
      {#if !collapsed}
        <span class="sidebar-wordmark">PHAVO</span>
      {/if}
      <button class="sidebar-toggle" onclick={ontoggle} type="button" aria-label="Toggle sidebar">
        <Icon name={collapsed ? 'menu' : 'panel-left'} size={18} />
      </button>
    </div>

    <!-- Navigation -->
    <nav class="sidebar-nav">
      <!-- Dashboard card -->
      <button
        class="nav-card"
        class:nav-card-active={activeItem === 'home'}
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
        <div class="nav-card-icon">
          <Icon name="layout-dashboard" size={18} />
        </div>
        {#if !collapsed}
          <div class="nav-card-info">
            <span class="nav-card-label">Dashboard</span>
          </div>
          {#if tabs.length > 0}
            <span class="nav-card-chevron-toggle" class:nav-card-chevron-expanded={dashExpanded}>
              <Icon name="chevron-down" size={14} />
            </span>
          {/if}
        {/if}
      </button>

      <!-- Dashboard sub-items (tabs) -->
      {#if !collapsed && dashExpanded}
        <div class="nav-sub-items">
          {#each tabs as tab}
            <div
              class="nav-sub-item"
              class:nav-sub-item-active={activeTab === tab.id}
            >
              <button class="nav-sub-main" onclick={() => onTabSelect?.(tab.id)} type="button">
                <span class="nav-sub-dot"></span>
                <span class="nav-sub-label">{tab.label}</span>
              </button>
              {#if tab.id !== 'home' && tab.id !== tabs[0]?.id}
                <button
                  class="nav-sub-delete"
                  onclick={() => ondeletepage?.(tab.id)}
                  aria-label="Delete page"
                  type="button"
                >
                  <Icon name="x" size={10} />
                </button>
              {/if}
            </div>
          {/each}
          {#if onNewTab}
            <button class="nav-sub-add" onclick={() => onNewTab?.()} type="button">
              <Icon name="plus" size={10} />
              <span>New Page</span>
            </button>
          {/if}
        </div>
      {/if}

      <!-- Standard nav items as cards -->
      {#each items as item}
        <button
          class="nav-card"
          class:nav-card-active={activeItem === item.id}
          onclick={() => onsettingsnav ? onsettingsnav(item.id) : onnavigate?.(item.id)}
          type="button"
        >
          <div class="nav-card-icon">
            {#if item.icon}
              <Icon name={item.icon} size={18} />
            {/if}
          </div>
          {#if !collapsed}
            <div class="nav-card-info">
              <span class="nav-card-label">{item.label}</span>
              {#if item.status}
                <div class="nav-card-status">
                  <span class="nav-status-dot nav-status-{item.status.type}"></span>
                  <span class="nav-status-label">{item.status.label}</span>
                </div>
              {/if}
            </div>
            <span class="nav-card-chevron">
              <Icon name="chevron-right" size={12} />
            </span>
          {/if}
        </button>
      {/each}
    </nav>

    <div class="sidebar-spacer"></div>

    <!-- Bottom nav items -->
    {#if bottomItems.length > 0}
      <nav class="sidebar-nav sidebar-nav-bottom">
        {#each bottomItems as item}
          <button
            class="nav-card"
            class:nav-card-active={activeItem === item.id}
            onclick={() => onnavigate?.(item.id)}
            type="button"
          >
            <div class="nav-card-icon">
              {#if item.icon}
                <Icon name={item.icon} size={18} />
              {/if}
            </div>
            {#if !collapsed}
              <div class="nav-card-info">
                <span class="nav-card-label">{item.label}</span>
                {#if item.status}
                  <div class="nav-card-status">
                    <span class="nav-status-dot nav-status-{item.status.type}"></span>
                    <span class="nav-status-label">{item.status.label}</span>
                  </div>
                {/if}
              </div>
            {/if}
          </button>
        {/each}
      </nav>
    {/if}
  </div>

  <!-- Footer -->
  <div class="sidebar-upgrade">
    {#if children}
      <div class="sidebar-footer">
        {@render children()}
      </div>
    {/if}
  </div>
</aside>

<!-- Mobile bottom navigation bar (visible only <640px) -->
<nav class="bottom-nav" aria-label="Main navigation">
  {#each mobileNavItems as item (item.id)}
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
  /* ── Sidebar shell ─────────────────────────────────────────────────── */
  .sidebar {
    position: fixed;
    top: 0;
    left: 0;
    bottom: 0;
    width: var(--sidebar-width);
    background: var(--color-surface);
    border-right: 1px solid color-mix(in srgb, var(--color-outline-variant) 12%, transparent);
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    transition: width var(--motion-component);
    z-index: 100;
    overflow: hidden;
  }

  .sidebar.sidebar-collapsed {
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
    align-items: center;
    justify-content: space-between;
    padding: var(--space-4) var(--space-3) var(--space-6);
  }

  .sidebar-wordmark {
    font-size: 18px;
    font-weight: 700;
    letter-spacing: -0.02em;
    color: var(--color-primary-fixed);
    font-family: var(--font-ui);
  }

  .sidebar-toggle {
    width: 28px;
    height: 28px;
    border-radius: var(--radius-sm);
    background: none;
    border: none;
    color: var(--color-outline);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: color var(--motion-micro), background var(--motion-micro);
  }

  .sidebar-toggle:hover {
    color: var(--color-on-surface-variant);
    background: color-mix(in srgb, var(--color-surface-high) 60%, transparent);
  }

  .sidebar-collapsed .sidebar-header {
    justify-content: center;
  }

  .sidebar-collapsed .sidebar-wordmark {
    display: none;
  }

  /* ── Navigation ──────────────────────────────────────────────────────── */
  .sidebar-nav {
    padding: 0 var(--space-3);
  }

  .sidebar-nav-bottom {
    padding-top: var(--space-8);
    padding-bottom: var(--space-4);
  }

  .sidebar-spacer {
    flex: 1;
  }

  /* ── Nav card — top-level item ─────────────────────────────────────── */
  .nav-card {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-3);
    border-radius: 1rem;
    background: transparent;
    border: 1px solid transparent;
    cursor: pointer;
    transition: background var(--motion-micro), border-color var(--motion-micro);
    text-decoration: none;
    width: 100%;
    margin-bottom: var(--space-1);
    font-family: var(--font-ui);
    font-size: var(--font-size-sm);
    text-align: left;
    color: inherit;
  }

  .nav-card:hover {
    background: var(--color-surface-card);
    border-color: color-mix(in srgb, var(--color-outline-variant) 12%, transparent);
  }

  .nav-card:active {
    transform: scale(0.98);
  }

  .nav-card:focus-visible {
    outline: 2px solid var(--color-primary-fixed);
    outline-offset: 2px;
  }

  .nav-card-active {
    background: var(--color-surface-card);
    border-color: color-mix(in srgb, var(--color-primary-fixed) 25%, transparent);
  }

  /* ── Icon container ──────────────────────────────────────────────────── */
  .nav-card-icon {
    width: 36px;
    height: 36px;
    border-radius: var(--radius-lg);
    border: none;
    background: var(--color-surface-high);
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--color-on-surface-variant);
    flex-shrink: 0;
    transition: background var(--motion-micro), color var(--motion-micro);
  }

  .nav-card-active .nav-card-icon {
    border: none;
    background: color-mix(in srgb, var(--color-primary-fixed) 12%, transparent);
    color: var(--color-primary-fixed);
  }

  .nav-card:hover .nav-card-icon {
    border: none;
  }

  /* ── Text area ───────────────────────────────────────────────────────── */
  .nav-card-info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 1px;
  }

  /* Text labels fade out when collapsing */
  .nav-card-info,
  .nav-card-chevron,
  .sidebar-wordmark,
  .sidebar-upgrade-text {
    transition: opacity var(--motion-micro), width var(--motion-micro);
    overflow: hidden;
    white-space: nowrap;
  }

  .sidebar-collapsed .nav-card-info,
  .sidebar-collapsed .nav-card-chevron,
  .sidebar-collapsed .sidebar-wordmark,
  .sidebar-collapsed .sidebar-upgrade-text {
    opacity: 0;
    width: 0;
  }

  .nav-card-label {
    font-size: 13px;
    font-weight: 600;
    color: var(--color-on-surface-variant);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    transition: color var(--motion-micro);
  }

  .nav-card-active .nav-card-label {
    color: var(--color-on-surface);
  }

  /* ── Status dot + label ──────────────────────────────────────────────── */
  .nav-card-status {
    display: flex;
    align-items: center;
    gap: var(--space-1);
  }

  .nav-status-dot {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .nav-status-active   { background: var(--color-secondary); }
  .nav-status-error    { background: var(--color-error); }
  .nav-status-warning  { background: var(--color-primary-fixed); }
  .nav-status-inactive { background: var(--color-outline); }

  .nav-status-label {
    font-size: 9px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--color-outline);
    font-family: var(--font-mono);
  }

  /* ── Chevron ─────────────────────────────────────────────────────────── */
  .nav-card-chevron {
    color: var(--color-outline);
    flex-shrink: 0;
    transition: color var(--motion-micro), transform var(--motion-micro);
    opacity: 0;
    display: flex;
    align-items: center;
  }

  .nav-card:hover .nav-card-chevron,
  .nav-card-active .nav-card-chevron {
    opacity: 1;
  }

  .nav-card-active .nav-card-chevron {
    color: var(--color-primary-fixed);
    transform: translateX(2px);
  }

  /* Dashboard chevron toggle (expand/collapse) */
  .nav-card-chevron-toggle {
    color: var(--color-on-surface-variant);
    flex-shrink: 0;
    transition: transform 0.2s ease;
    transform: rotate(-90deg);
    display: flex;
    align-items: center;
  }

  .nav-card-chevron-expanded {
    transform: rotate(0deg);
  }

  /* ── Collapsed mode — icon only ──────────────────────────────────────── */
  .sidebar-collapsed .nav-card {
    padding: 0;
    justify-content: center;
    border: none;
    background: transparent;
    width: 44px;
    height: 44px;
    margin: 0 auto var(--space-1);
    display: flex;
    align-items: center;
    cursor: pointer;
  }

  .sidebar-collapsed .nav-card:hover {
    background: transparent;
    border: none;
  }

  .sidebar-collapsed .nav-card-active {
    background: transparent;
    border: none;
  }

  .sidebar-collapsed .nav-card-icon {
    border: none;
    width: 40px;
    height: 40px;
    background: var(--color-surface-card);
    color: var(--color-on-surface-variant);
    transition: background var(--motion-micro), color var(--motion-micro);
  }

  .sidebar-collapsed .nav-card-active .nav-card-icon {
    border: none;
    background: color-mix(in srgb, var(--color-primary-fixed) 15%, transparent);
    color: var(--color-primary-fixed);
  }

  .sidebar-collapsed .nav-card:hover .nav-card-icon {
    border: none;
    background: var(--color-surface-high);
    color: var(--color-on-surface-variant);
  }

  /* ── Sub-items ───────────────────────────────────────────────────────── */
  .nav-sub-items {
    padding-left: 0;
    margin: 0 0 var(--space-2) 0;
    border-left: none;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .nav-sub-item {
    display: flex;
    align-items: center;
    border-radius: var(--radius-sm);
    color: var(--color-on-surface-variant);
    transition: color var(--motion-micro), background var(--motion-micro);
    width: 100%;
  }

  .nav-sub-main {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-1) var(--space-2);
    font-size: 12px;
    text-decoration: none;
    background: none;
    border: none;
    cursor: pointer;
    font-family: var(--font-ui);
    text-align: left;
    width: 100%;
    color: inherit;
    border-radius: var(--radius-sm);
    min-width: 0;
  }

  .nav-sub-main:focus-visible {
    outline: 2px solid var(--color-primary-fixed);
    outline-offset: 2px;
  }

  .nav-sub-item:hover {
    color: var(--color-on-surface);
    background: color-mix(in srgb, var(--color-surface-high) 60%, transparent);
  }

  .nav-sub-item-active {
    color: var(--color-secondary);
  }

  .nav-sub-dot {
    width: 4px;
    height: 4px;
    border-radius: 50%;
    background: var(--color-outline);
    flex-shrink: 0;
  }

  .nav-sub-item-active .nav-sub-dot {
    background: var(--color-secondary);
  }

  .nav-sub-label {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .nav-sub-delete {
    margin-left: auto;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: none;
    border: none;
    color: var(--color-outline);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0;
    transition: opacity var(--motion-micro), background var(--motion-micro), color var(--motion-micro);
    flex-shrink: 0;
    padding: 0;
  }

  .nav-sub-item:hover .nav-sub-delete {
    opacity: 1;
  }

  .nav-sub-delete:hover {
    background: color-mix(in srgb, var(--color-error) 15%, transparent);
    color: var(--color-error);
  }

  .nav-sub-add {
    display: flex;
    align-items: center;
    gap: 2px;
    padding: var(--space-1) var(--space-2);
    border-radius: var(--radius-sm);
    font-size: 12px;
    color: var(--color-outline);
    background: none;
    border: none;
    cursor: pointer;
    transition: color var(--motion-micro);
    font-family: var(--font-ui);
    width: 100%;
    text-align: left;
  }

  .nav-sub-add:hover {
    color: var(--color-on-surface-variant);
  }

  /* ── Upgrade card ────────────────────────────────────────────────────── */
  .sidebar-upgrade {
    margin-top: auto;
    padding: var(--space-3);
  }

  .sidebar-upgrade-card {
    background: var(--color-surface-card);
    border-radius: 1rem;
    padding: var(--space-4);
    border: 1px solid color-mix(in srgb, var(--color-outline-variant) 12%, transparent);
  }

  .sidebar-collapsed .sidebar-upgrade-card {
    padding: var(--space-2);
    display: flex;
    justify-content: center;
    background: transparent;
    border-color: transparent;
  }

  .sidebar-collapsed .sidebar-upgrade-text {
    display: none;
  }

  .sidebar-collapsed .upgrade-btn {
    width: 40px;
    height: 40px;
    padding: 0;
    border-radius: 50%;
  }

  .sidebar-footer {
    padding: var(--space-4) var(--space-3);
  }

  .upgrade-kicker {
    color: var(--color-on-surface);
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.1em;
    margin: 0 0 var(--space-2);
    text-transform: uppercase;
    font-family: var(--font-ui);
  }

  .upgrade-desc {
    font-size: 12px;
    color: var(--color-on-surface-variant);
    line-height: 1.5;
    margin: 0 0 var(--space-4);
  }

  .upgrade-btn {
    width: 100%;
    padding: var(--space-2) var(--space-4);
    background: linear-gradient(
      135deg,
      var(--color-primary-fixed),
      var(--color-primary-fixed-dim)
    );
    color: var(--color-on-primary-fixed);
    font-family: var(--font-ui);
    font-size: var(--font-size-sm);
    font-weight: 700;
    border: none;
    border-radius: var(--radius-full);
    cursor: pointer;
    transition: opacity var(--motion-micro), transform var(--motion-micro);
    letter-spacing: 0.01em;
    display: flex;
    align-items: center;
    justify-content: center;
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

    .sidebar .sidebar-wordmark,
    .sidebar .nav-sub-items,
    .sidebar .nav-card-info,
    .sidebar .nav-card-chevron,
    .sidebar .nav-card-chevron-toggle,
    .sidebar .sidebar-upgrade-text {
      display: none;
    }

    .sidebar .sidebar-header {
      justify-content: center;
    }

    .sidebar .sidebar-toggle {
      display: none;
    }

    .sidebar .nav-card {
      justify-content: center;
      padding: var(--space-2);
      border: none;
      background: transparent;
    }

    .sidebar .nav-card:hover {
      background: transparent;
      border: none;
    }

    .sidebar .nav-card-active {
      background: transparent;
      border: none;
    }

    .sidebar .nav-card-active .nav-card-icon {
      background: color-mix(in srgb, var(--color-primary-fixed) 15%, transparent);
      color: var(--color-primary-fixed);
    }

    .sidebar .nav-card:hover .nav-card-icon {
      background: var(--color-surface-high);
      color: var(--color-on-surface-variant);
    }

    .sidebar .nav-card-icon {
      width: 40px;
      height: 40px;
    }

    .sidebar .sidebar-upgrade-card {
      padding: var(--space-2);
      display: flex;
      justify-content: center;
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
    align-items: stretch;
    gap: var(--space-2);
    overflow-x: auto;
    overscroll-behavior-x: contain;
    scrollbar-width: none;
    background:
      linear-gradient(
        180deg,
        color-mix(in srgb, var(--color-surface-card) 94%, transparent),
        color-mix(in srgb, var(--color-surface-low) 98%, transparent)
      );
    z-index: 100;
    padding: var(--space-2) var(--space-3) calc(var(--space-2) + env(safe-area-inset-bottom));
    backdrop-filter: blur(18px);
    -webkit-backdrop-filter: blur(18px);
  }

  .bottom-nav::-webkit-scrollbar {
    display: none;
  }

  .bottom-nav-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 3px;
    min-width: 78px;
    min-height: 52px;
    padding: var(--space-2) var(--space-3);
    background: none;
    border: 1px solid transparent;
    border-radius: var(--radius-xl);
    color: var(--color-on-surface-variant);
    font-family: var(--font-ui);
    font-size: 10px;
    cursor: pointer;
    flex: 0 0 auto;
    scroll-snap-align: start;
    transition: color var(--motion-micro), background var(--motion-micro), border-color var(--motion-micro);
  }

  .bottom-nav-item:hover {
    color: var(--color-on-surface);
    background: color-mix(in srgb, var(--color-surface-bright) 82%, transparent);
  }

  .bottom-nav-active {
    color: var(--color-primary);
    border-color: color-mix(in srgb, var(--color-primary) 26%, transparent);
    background: color-mix(in srgb, var(--color-primary) 8%, transparent);
  }

  .bottom-nav-icon {
    display: flex;
    align-items: center;
  }

  .bottom-nav-label {
    white-space: nowrap;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    font-weight: 500;
  }

  @media (max-width: 639px) {
    .bottom-nav {
      display: flex;
      scroll-snap-type: x proximity;
    }
  }

  /* Pi 3/4 performance fallback */
  @media (prefers-reduced-motion: reduce), (max-resolution: 1.5dppx) {
    .bottom-nav {
      backdrop-filter: none;
      -webkit-backdrop-filter: none;
      background: var(--color-surface-card);
    }
  }
</style>
