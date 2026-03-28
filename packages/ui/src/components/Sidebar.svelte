<script lang="ts">
import type { Snippet } from 'svelte';

interface NavItem {
  id: string;
  label: string;
  icon?: string;
}

interface Props {
  collapsed?: boolean;
  items?: NavItem[];
  bottomItems?: NavItem[];
  activeItem?: string;
  ontoggle?: () => void;
  onnavigate?: (id: string) => void;
  children?: Snippet;
}

let {
  collapsed = $bindable(false),
  items = [],
  bottomItems = [],
  activeItem = '',
  ontoggle,
  onnavigate,
  children,
}: Props = $props();
</script>

<aside class="sidebar" class:collapsed>
  <div class="sidebar-header">
    {#if !collapsed}
      <span class="sidebar-logo">Phavo</span>
    {/if}
    <button class="sidebar-toggle" onclick={ontoggle} type="button" aria-label="Toggle sidebar">
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M3 4h10M3 8h10M3 12h10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      </svg>
    </button>
  </div>

  <div class="sidebar-nav-shell">
    <nav class="sidebar-nav sidebar-nav-top">
      {#each items as item}
        <button
          class="nav-item"
          class:active={activeItem === item.id}
          onclick={() => onnavigate?.(item.id)}
          type="button"
        >
          {#if item.icon}
            <span class="nav-icon">{@html item.icon}</span>
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
              <span class="nav-icon">{@html item.icon}</span>
            {/if}
            {#if !collapsed}
              <span class="nav-label">{item.label}</span>
            {/if}
          </button>
        {/each}
      </nav>
    {/if}
  </div>

  {#if children}
    <div class="sidebar-footer">
      {@render children()}
    </div>
  {/if}
</aside>

<!-- Mobile bottom navigation bar (visible only <640px) -->
<nav class="bottom-nav" aria-label="Main navigation">
  {#each [...items, ...bottomItems].slice(0, 4) as item}
    <button
      class="bottom-nav-item"
      class:bottom-nav-active={activeItem === item.id}
      onclick={() => onnavigate?.(item.id)}
      type="button"
      aria-label={item.label}
    >
      {#if item.icon}
        <span class="bottom-nav-icon">{@html item.icon}</span>
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
    transition: width 0.2s;
    z-index: 100;
  }

  .sidebar.collapsed {
    width: var(--sidebar-collapsed-width);
  }

  .sidebar-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-4);
    border-bottom: 1px solid var(--color-border-subtle);
  }

  .sidebar.collapsed .sidebar-header {
    justify-content: center;
    padding-inline: var(--space-2);
  }

  .sidebar-logo {
    font-size: 18px;
    font-weight: 700;
    color: var(--color-accent-text);
  }

  .sidebar-toggle {
    background: none;
    border: none;
    color: var(--color-text-secondary);
    cursor: pointer;
    padding: var(--space-1);
    border-radius: var(--radius-sm);
  }

  .sidebar-toggle:hover {
    background: var(--color-bg-hover);
    color: var(--color-text-primary);
  }

  .sidebar.collapsed .sidebar-toggle {
    width: 100%;
    padding: 0;
  }

  .sidebar-nav-shell {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }

  .sidebar-nav {
    padding: var(--space-2);
  }

  .sidebar-nav-top {
    overflow-y: auto;
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
    padding: var(--space-2) var(--space-3);
    background: none;
    border: none;
    border-radius: var(--radius-sm);
    color: var(--color-text-secondary);
    font-family: var(--font-ui);
    font-size: 14px;
    cursor: pointer;
    transition: background 0.15s, color 0.15s;
    text-align: left;
  }

  .nav-item:hover {
    background: var(--color-bg-hover);
    color: var(--color-text-primary);
  }

  .nav-item.active {
    background: var(--color-accent-subtle);
    color: var(--color-bg);
  }

  .sidebar.collapsed .nav-item {
    justify-content: center;
    padding: var(--space-2);
  }

  .nav-icon {
    display: flex;
    align-items: center;
    width: 16px;
    height: 16px;
    flex-shrink: 0;
  }

  .nav-label {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .sidebar-footer {
    padding: var(--space-4);
    border-top: 1px solid var(--color-border-subtle);
  }

  /* ── TABLET (640px–1023px): icon-only rail, no toggle ─────────────────── */
  @media (min-width: 640px) and (max-width: 1023px) {
    .sidebar {
      width: var(--sidebar-collapsed-width);
    }

    .sidebar-logo {
      display: none;
    }

    .sidebar-toggle {
      display: none;
    }

    .sidebar-header {
      justify-content: center;
      padding: var(--space-4) var(--space-2);
    }

    .nav-label {
      display: none;
    }

    .nav-item {
      justify-content: center;
      padding: var(--space-2);
      min-height: 44px;
    }
  }

  /* ── MOBILE (<640px): hide sidebar, show bottom nav ───────────────────── */
  @media (max-width: 639px) {
    .sidebar {
      display: none;
    }
  }

  /* ── BOTTOM NAV (mobile only) ─────────────────────────────────────────── */
  .bottom-nav {
    display: none; /* hidden on tablet and desktop */
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
    width: 20px;
    height: 20px;
  }

  .bottom-nav-label {
    white-space: nowrap;
  }

  @media (max-width: 639px) {
    .bottom-nav {
      display: flex;
    }
  }

  /* ── TOUCH TARGETS (all screen sizes) ────────────────────────────────── */
  .nav-item {
    min-height: 44px;
  }

  .sidebar-toggle {
    min-height: 44px;
    min-width: 44px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
</style>
