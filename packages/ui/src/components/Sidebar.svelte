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
    color: var(--color-accent-text);
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
</style>
