<script lang="ts">
import '@phavo/ui/src/theme.css';
import { onMount, type Snippet } from 'svelte';
import { goto } from '$app/navigation';
import { Sidebar, Header, NotificationPanel, Modal, Button, Icon } from '@phavo/ui';
import type { SearchEntry } from '@phavo/ui';
import type { DashboardConfig, Notification, Session } from '@phavo/types';
import en from '$lib/i18n/en.json';
import { getAiStatus, updateAiStatusFromPayload } from '$lib/stores/ai.svelte';
import { getConfig, setConfig } from '$lib/stores/config.svelte';
import { getSession, setSession } from '$lib/stores/session.svelte';
import {
  getNotifications,
  getUnreadCount,
  markAllRead,
  markRead,
  clearHistory,
  syncFromServer,
} from '$lib/stores/notifications.svelte';
import {
  createTab,
  getCurrentTabId,
  getIsDrawerOpen,
  getTabs,
  getWidgetData,
  getWidgetManifest,
  loadTabs,
  loadWidgetManifest,
  setActiveTab,
  setDrawerOpen,
} from '$lib/stores/widgets.svelte';
import type { WeatherMetrics } from '@phavo/types';
import { fetchWithCsrf } from '$lib/utils/api';

interface Props {
  data: {
    config?: DashboardConfig;
    dashboardName?: string;
    setupComplete?: boolean;
    session?: Session | null;
  };
  children: Snippet;
}

let { data, children }: Props = $props();

let sidebarCollapsed = $state(false);
let panelOpen = $state(false);
let updateAvailable = $state(false);
let latestUpdateVersion = $state('');
let currentPathname = $state('/');
let currentHash = $state('');
let tabLimitModalOpen = $state(false);
let headerWeatherFallback = $state<{ temp: number; condition: string } | undefined>(undefined);

const sidebarItems = [
  { id: 'general', label: 'General', icon: 'settings-2' },
  { id: 'widgets', label: 'Widgets', icon: 'puzzle' },
  { id: 'import-export', label: 'Backup & Export', icon: 'archive' },
  { id: 'license', label: 'Licence', icon: 'shield-check' },
  { id: 'account', label: 'Account', icon: 'user' },
  { id: 'plugins', label: 'Plugins', icon: 'plug' },
  { id: 'about', label: 'About', icon: 'info' },
];

/**
 * Show the sidebar/header shell on any route that isn't setup or auth.
 * /setup and /auth are full-screen standalone pages.
 */
const isDashboard = $derived(
  Boolean(data.setupComplete && data.session),
);

const SETTINGS_TAB_IDS = new Set(sidebarItems.map((i) => i.id));

const activeSidebarItem = $derived.by(() => {
  if (currentPathname !== '/settings') return 'home';
  const hashTab = currentHash.replace(/^#/, '').split('/')[0] ?? '';
  return SETTINGS_TAB_IDS.has(hashTab) ? hashTab : 'general';
});

const headerTitle = $derived(
  data.dashboardName || getConfig().dashboardName || en.dashboard.brandName,
);

const shellTier = $derived(data.session?.tier ?? 'free');

const headerBrandingLabel = $derived(
  getSession()?.tier === 'free' ? en.dashboard.poweredBy : undefined,
);

const aiStatus = $derived(getAiStatus());

const WMO_SHORT: Record<number, string> = {
  0: 'Clear', 1: 'Clear', 2: 'Partly Cloudy', 3: 'Overcast',
  45: 'Fog', 48: 'Fog', 51: 'Drizzle', 53: 'Drizzle', 55: 'Drizzle',
  61: 'Rain', 63: 'Rain', 65: 'Heavy Rain',
  71: 'Snow', 73: 'Snow', 75: 'Heavy Snow',
  80: 'Showers', 81: 'Showers', 82: 'Showers',
  95: 'Storm', 96: 'Storm', 99: 'Storm',
};

function toHeaderWeather(weather: WeatherMetrics | undefined): { temp: number; condition: string } | undefined {
  if (!weather) return undefined;
  return {
    temp: Math.round(weather.currentTemp),
    condition: WMO_SHORT[weather.conditionCode] ?? 'Unknown',
  };
}

const headerWeather = $derived.by(() => {
  const widgetWeather = toHeaderWeather(getWidgetData('weather') as WeatherMetrics | undefined);
  return widgetWeather ?? headerWeatherFallback;
});

async function refreshHeaderWeather(): Promise<void> {
  try {
    const response = await fetchWithCsrf('/api/v1/weather');
    const payload = (await response.json()) as {
      ok: boolean;
      data?: WeatherMetrics;
    };

    if (payload.ok && payload.data) {
      headerWeatherFallback = toHeaderWeather(payload.data);
    }
  } catch {
    // Header weather is additive; keep the last successful value.
  }
}

function navigate(id: string) {
  panelOpen = false;
  setDrawerOpen(false);

  if (id === 'home') {
    void goto('/');
    return;
  }

  // All sidebar items except 'home' are settings tabs
  if (SETTINGS_TAB_IDS.has(id)) {
    navigateToSettings(id);
    return;
  }

  void goto(`/${id}`);
}

function navigateToSettings(hash?: string) {
  panelOpen = false;
  setDrawerOpen(false);

  if (typeof window !== 'undefined' && window.location.pathname === '/settings') {
    const nextHash = hash ?? 'general';
    window.location.hash = nextHash;
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    return;
  }

  void goto(hash ? `/settings#${hash}` : '/settings');
}

async function handleDashboardTabSelect(tabId: string): Promise<void> {
  panelOpen = false;
  setDrawerOpen(false);

  if (currentPathname !== '/') {
    await goto('/');
  }
  await setActiveTab(tabId);
}

async function handleSidebarNewTab(): Promise<void> {
  if (shellTier === 'free' && getTabs().length >= 1) {
    tabLimitModalOpen = true;
    return;
  }

  const nextLabel = getTabs().length === 0 ? 'Home' : `Page ${getTabs().length + 1}`;
  const previousCount = getTabs().length;
  const result = await createTab(nextLabel);

  if (!result.ok) {
    if (result.error?.includes('Tab limit')) {
      tabLimitModalOpen = true;
    }
    return;
  }

  const nextTab = getTabs()[previousCount];
  if (nextTab) {
    await handleDashboardTabSelect(nextTab.id);
  }
}

// ─── Command Palette helpers ──────────────────────────────────────────

const COMMAND_SETTINGS_TABS = [
  { id: 'general', label: 'General' },
  { id: 'widgets', label: 'Widgets' },
  { id: 'license', label: 'Licence' },
  { id: 'account', label: 'Account' },
  { id: 'plugins', label: 'Plugins' },
  { id: 'import-export', label: 'Import / Export' },
  { id: 'about', label: 'About' },
];

const searchIndex = $derived.by((): SearchEntry[] => {
  const entries: SearchEntry[] = [];

  // Widgets from manifest
  for (const w of getWidgetManifest()) {
    entries.push({
      id: `widget:${w.id}`,
      label: w.name,
      subtitle: w.description,
      category: 'widget',
      action: () => {
        setDrawerOpen(true);
      },
    });
  }

  // Settings tabs
  for (const tab of COMMAND_SETTINGS_TABS) {
    entries.push({
      id: `settings:${tab.id}`,
      label: tab.label,
      subtitle: 'Settings',
      category: 'settings',
      action: () => {
        navigateToSettings(tab.id);
      },
    });
  }

  // Dashboard tabs
  for (const tab of getTabs()) {
    entries.push({
      id: `tab:${tab.id}`,
      label: tab.label,
      subtitle: 'Dashboard page',
      category: 'tab',
      action: () => {
        void handleDashboardTabSelect(tab.id);
      },
    });
  }

  // Static actions
  entries.push({
    id: 'action:add-widget',
    label: 'Add Widget',
    subtitle: 'Open widget drawer',
    category: 'action',
    action: () => {
      void goto('/');
      setDrawerOpen(true);
    },
  });

  entries.push({
    id: 'action:settings',
    label: 'Open Settings',
    category: 'action',
    action: () => {
      goto('/settings');
    },
  });

  entries.push({
    id: 'action:notifications',
    label: 'View Notifications',
    category: 'action',
    action: () => {
      panelOpen = true;
    },
  });

  return entries;
});

async function loadAiStatus() {
  try {
    const resp = await fetchWithCsrf('/api/v1/ai/status');
    const json = (await resp.json()) as {
      ok: boolean;
      data?: {
        ollama: boolean;
        openai: boolean;
        anthropic: boolean;
        searchEngineUrl: string;
        searchEngineName: string;
      };
    };
    if (json.ok && json.data) {
      updateAiStatusFromPayload(json.data);
    }
  } catch { /* AI status is optional — degrade gracefully */ }
}

async function handleAiChat(provider: 'ollama' | 'openai' | 'anthropic', query: string): Promise<string> {
  const resp = await fetchWithCsrf('/api/v1/ai/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ provider, query }),
  });
  const json = (await resp.json()) as { ok: boolean; data?: { text: string }; error?: string };
  if (!json.ok || !json.data) {
    throw new Error(json.error ?? 'AI request failed');
  }
  return json.data.text;
}

onMount(() => {
  const syncLocation = () => {
    currentPathname = window.location.pathname;
    currentHash = window.location.hash;
  };

  syncLocation();

  const originalPushState = window.history.pushState.bind(window.history);
  const originalReplaceState = window.history.replaceState.bind(window.history);

  window.history.pushState = ((...args) => {
    originalPushState(...args);
    syncLocation();
  }) as History['pushState'];

  window.history.replaceState = ((...args) => {
    originalReplaceState(...args);
    syncLocation();
  }) as History['replaceState'];

  window.addEventListener('popstate', syncLocation);
  window.addEventListener('hashchange', syncLocation);


  const cleanupEffects = $effect.root(() => {
    $effect(() => {
      if (data.config) {
        setConfig(data.config);
      }
    });

    $effect(() => {
      setSession(data.session ?? null);
    });

    $effect(() => {
      if (!isDashboard) return;
      void loadWidgetManifest();
      void loadTabs();
    });

    $effect(() => {
      if (currentPathname !== '/') {
        setDrawerOpen(false);
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

    $effect(() => {
      if (!isDashboard) return;
      void loadAiStatus();
    });

    $effect(() => {
      if (!isDashboard) return;
      void refreshHeaderWeather();
      const interval = setInterval(() => void refreshHeaderWeather(), 300_000);
      return () => clearInterval(interval);
    });
  });

  return () => {
    window.history.pushState = originalPushState;
    window.history.replaceState = originalReplaceState;
    window.removeEventListener('popstate', syncLocation);
    window.removeEventListener('hashchange', syncLocation);
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
    navigateToSettings(n.settingsTab);
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
      tier={shellTier}
      tabs={getTabs()}
      activeTab={getCurrentTabId()}
      items={sidebarItems}
      activeItem={activeSidebarItem}
      onTabSelect={(tabId) => void handleDashboardTabSelect(tabId)}
      onNewTab={() => void handleSidebarNewTab()}
      ontoggle={() => (sidebarCollapsed = !sidebarCollapsed)}
      onnavigate={navigate}
    />
    <main class="main-content" class:sidebar-collapsed={sidebarCollapsed}>
      {#snippet updateBadge()}
        {#if updateAvailable}
          <button
            class="update-badge"
            onclick={() => navigateToSettings('about')}
            aria-label="Update available: {latestUpdateVersion}"
          >
            Update
          </button>
        {/if}
      {/snippet}
      <Header
        dashboardName={currentPathname === '/' || currentPathname === '/settings' ? '' : headerTitle}
        brandingLabel={headerBrandingLabel}
        weather={headerWeather}
        unreadCount={getUnreadCount()}
        onBellClick={() => {
          setDrawerOpen(false);
          panelOpen = !panelOpen;
        }}
        onAddWidgetClick={currentPathname === '/' ? () => {
          panelOpen = false;
          setDrawerOpen(!getIsDrawerOpen());
        } : undefined}
        addWidgetLabel={en.dashboard.addWidget}
        {updateAvailable}
        {updateBadge}
        {searchIndex}
        searchEngineUrl={aiStatus.searchEngineUrl}
        aiProviders={aiStatus.providers}
        tier={shellTier}
        onAiChat={handleAiChat}
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
    <Modal bind:open={tabLimitModalOpen}>
      <div class="flex flex-col items-center gap-4 text-center p-4">
        <Icon name="lock" size={32} class="text-accent" />
        <h2 class="text-lg font-bold text-text">Page limit reached</h2>
        <p class="text-sm text-text-secondary max-w-[36ch] leading-relaxed">
          Free tier supports 1 dashboard page. Upgrade to Standard to create unlimited pages.
        </p>
        <div class="flex gap-3 mt-2">
          <Button variant="secondary" onclick={() => (tabLimitModalOpen = false)}>
            Close
          </Button>
          <Button onclick={() => { tabLimitModalOpen = false; navigateToSettings('license'); }}>
            View Licence
          </Button>
        </div>
      </div>
    </Modal>
  </div>
{:else}
  {@render children()}
{/if}

<style>
  .dashboard-layout {
    display: flex;
    min-height: 100dvh;
    width: 100%;
  }

  .main-content {
    --shell-sidebar-offset: var(--sidebar-width);
    flex: 1 1 auto;
    display: flex;
    flex-direction: column;
    min-height: 100dvh;
    max-height: 100dvh;
    overflow-y: auto;
    min-width: 0;
    width: 100%;
    padding-left: var(--shell-sidebar-offset);
    box-sizing: border-box;
    transition: padding-left 0.3s ease;
    background:
      radial-gradient(
        ellipse 60% 40% at 80% 0%,
        color-mix(in srgb, var(--color-accent-t) 50%, transparent) 0%,
        transparent 100%
      ),
      var(--color-bg-base);
  }

  .main-content.sidebar-collapsed {
    --shell-sidebar-offset: var(--sidebar-collapsed-width);
  }

  .update-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 34px;
    padding: 0 var(--space-4);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    background: color-mix(in srgb, var(--color-bg-elevated) 94%, transparent);
    color: var(--color-accent-text);
    border: 1px solid color-mix(in srgb, var(--color-accent) 24%, var(--color-border-subtle));
    border-radius: 999px;
    cursor: pointer;
    transition:
      color 0.15s ease,
      border-color 0.15s ease,
      background 0.15s ease,
      transform 0.15s ease;
  }

  .update-badge:hover {
    border-color: color-mix(in srgb, var(--color-accent) 34%, var(--color-border-subtle));
    background: color-mix(in srgb, var(--color-bg-hover) 88%, transparent);
    transform: translateY(-1px);
  }

  /* ── TABLET (640px–1023px): fixed icon-only rail, no collapse toggle ── */
  @media (min-width: 640px) and (max-width: 1023px) {
    .main-content,
    .main-content.sidebar-collapsed {
      --shell-sidebar-offset: var(--sidebar-collapsed-width);
    }
  }

  /* ── MOBILE (<640px): bottom nav, no left margin ─────────────────────── */
  @media (max-width: 639px) {
    .main-content,
    .main-content.sidebar-collapsed {
      --shell-sidebar-offset: 0px;
      padding-bottom: calc(56px + env(safe-area-inset-bottom));
    }
  }
</style>
