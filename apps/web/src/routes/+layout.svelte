<script lang="ts">
import '@phavo/ui/src/theme.css';
import type { Snippet } from 'svelte';
import { page } from '$app/state';
import { goto } from '$app/navigation';
import { icons, Sidebar, Header, NotificationPanel } from '@phavo/ui';
import type { Notification } from '@phavo/types';
import en from '$lib/i18n/en.json';
import { getConfig, setConfig } from '$lib/stores/config.svelte';
import {
  getNotifications,
  getUnreadCount,
  markAllRead,
  markRead,
  clearHistory,
  syncFromServer,
} from '$lib/stores/notifications.svelte';
import { getIsDrawerOpen, setDrawerOpen } from '$lib/stores/widgets.svelte';

interface Props {
  children: Snippet;
}

let { children }: Props = $props();

let sidebarCollapsed = $state(false);
let panelOpen = $state(false);
let updateAvailable = $state(false);
let latestUpdateVersion = $state('');

const sidebarItems = [
  { id: 'home', label: 'Dashboard', icon: icons.cpu() },
];

const sidebarBottomItems = [
  { id: 'settings', label: en.settings.title, icon: icons.settings() },
];

/**
 * Show the sidebar/header shell on any route that isn't setup or auth.
 * /setup and /auth are full-screen standalone pages.
 */
const isDashboard = $derived(
  !page.url.pathname.startsWith('/setup') &&
  !page.url.pathname.startsWith('/auth'),
);

/**
 * Derive which sidebar item is active from the current URL.
 * '/' → 'home', '/settings' → 'settings', etc.
 */
const activeSidebarItem = $derived(
  page.url.pathname === '/' ? 'home' : (page.url.pathname.replace(/^\//, '').split('/')[0] || 'home'),
);

const headerTitle = $derived(
  getConfig().tier === 'free'
    ? en.dashboard.brandName
    : (getConfig().dashboardName || en.dashboard.brandName),
);

const headerBrandingLabel = $derived(
  getConfig().tier === 'free' ? en.dashboard.poweredBy : undefined,
);

function navigate(id: string) {
  goto(id === 'home' ? '/' : `/${id}`);
}

/** Poll server for notifications every 60 s while the dashboard is active. */
$effect(() => {
  if (page.data.config) {
    setConfig(page.data.config);
  }
});

async function checkForUpdate() {
  try {
    const resp = await fetch('/api/v1/update/check');
    const json = (await resp.json()) as {
      ok: boolean;
      data?: { updateAvailable: boolean; latestVersion: string };
    };
    if (json.ok && json.data) {
      updateAvailable = json.data.updateAvailable;
      if (json.data.latestVersion) latestUpdateVersion = json.data.latestVersion;
    }
  } catch { /* ignore, runs silently in the background */ }
}

$effect(() => {
  if (!isDashboard) return;
  void checkForUpdate();
  const updateInterval = setInterval(checkForUpdate, 60 * 60 * 1000);
  return () => clearInterval(updateInterval);
});

$effect(() => {
  if (!isDashboard) return;
  syncFromServer();
  const interval = setInterval(syncFromServer, 60_000);
  return () => clearInterval(interval);
});

function handleNotificationClick(n: Notification) {
  markRead(n.id);
  panelOpen = false;
  if (n.settingsTab) {
    goto(`/settings?tab=${n.settingsTab}`);
  } else if (n.widgetId) {
    // Navigate to dashboard and scroll to widget by id
    goto('/');
    setTimeout(() => {
      document.getElementById(`widget-${n.widgetId}`)?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  }
}
</script>

<svelte:head>
  <meta name="theme-color" content="#000000" />
</svelte:head>

{#if isDashboard}
  <div class="dashboard-layout">
    <Sidebar
      bind:collapsed={sidebarCollapsed}
      items={sidebarItems}
      bottomItems={sidebarBottomItems}
      activeItem={activeSidebarItem}
      ontoggle={() => (sidebarCollapsed = !sidebarCollapsed)}
      onnavigate={navigate}
    />
    <main class="main-content" class:sidebar-collapsed={sidebarCollapsed}>
      {#snippet updateBadge()}
        {#if updateAvailable}
          <button
            class="update-badge"
            onclick={() => goto('/settings?tab=about')}
            aria-label="Update available: {latestUpdateVersion}"
          >
            Update
          </button>
        {/if}
      {/snippet}
      <Header
        dashboardName={headerTitle}
        brandingLabel={headerBrandingLabel}
        unreadCount={getUnreadCount()}
        onBellClick={() => (panelOpen = !panelOpen)}
        onAddWidgetClick={() => setDrawerOpen(!getIsDrawerOpen())}
        addWidgetLabel={en.dashboard.addWidget}
        {updateBadge}
      />
      {@render children()}
    </main>
    <NotificationPanel
      open={panelOpen}
      notifications={getNotifications()}
      onClose={() => (panelOpen = false)}
      onMarkAllRead={markAllRead}
      onClear={clearHistory}
      onNotificationClick={handleNotificationClick}
    />
  </div>
{:else}
  {@render children()}
{/if}

<style>
  .dashboard-layout {
    display: flex;
    min-height: 100vh;
  }

  .main-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
    margin-left: var(--sidebar-width);
    transition: margin-left 0.2s;
    min-width: 0;
  }

  .main-content.sidebar-collapsed {
    margin-left: var(--sidebar-collapsed-width);
  }

  .update-badge {
    display: inline-flex;
    align-items: center;
    padding: 2px var(--space-2);
    font-size: 11px;
    font-weight: 600;
    background: var(--color-accent);
    color: var(--color-accent-text);
    border: none;
    border-radius: var(--radius-sm);
    cursor: pointer;
    transition: opacity 0.15s;
  }

  .update-badge:hover {
    opacity: 0.8;
  }

  @media (max-width: 768px) {
    .main-content {
      margin-left: 0;
    }
  }
</style>
