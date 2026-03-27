<script lang="ts">
import '@phavo/ui/src/theme.css';
import { onMount, type Snippet } from 'svelte';
import { goto } from '$app/navigation';
import { icons, Sidebar, Header, NotificationPanel } from '@phavo/ui';
import type { DashboardConfig, Notification } from '@phavo/types';
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
  data: {
    config?: DashboardConfig;
    dashboardName?: string;
    setupComplete?: boolean;
    session?: object | null;
  };
  children: Snippet;
}

let { data, children }: Props = $props();

let sidebarCollapsed = $state(false);
let panelOpen = $state(false);
let updateAvailable = $state(false);
let latestUpdateVersion = $state('');
let currentPathname = $state('/');

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
  Boolean(data.setupComplete && data.session),
);

/**
 * Derive which sidebar item is active from the current URL.
 * '/' → 'home', '/settings' → 'settings', etc.
 */
const activeSidebarItem = $derived(
  currentPathname === '/' ? 'home' : (currentPathname.replace(/^\//, '').split('/')[0] || 'home'),
);

const headerTitle = $derived(
  data.dashboardName || getConfig().dashboardName || en.dashboard.brandName,
);

const headerBrandingLabel = $derived(
  getConfig().tier === 'free' ? en.dashboard.poweredBy : undefined,
);

function navigate(id: string) {
  goto(id === 'home' ? '/' : `/${id}`);
}

onMount(() => {
  const syncPathname = () => {
    currentPathname = window.location.pathname;
  };

  syncPathname();

  const originalPushState = window.history.pushState.bind(window.history);
  const originalReplaceState = window.history.replaceState.bind(window.history);

  window.history.pushState = ((...args) => {
    originalPushState(...args);
    syncPathname();
  }) as History['pushState'];

  window.history.replaceState = ((...args) => {
    originalReplaceState(...args);
    syncPathname();
  }) as History['replaceState'];

  window.addEventListener('popstate', syncPathname);

  const cleanupEffects = $effect.root(() => {
    $effect(() => {
      if (data.config) {
        setConfig(data.config);
      }
    });

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
  });

  return () => {
    window.history.pushState = originalPushState;
    window.history.replaceState = originalReplaceState;
    window.removeEventListener('popstate', syncPathname);
    cleanupEffects();
  };
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
