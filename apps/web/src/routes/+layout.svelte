<script lang="ts">
import '@phavo/ui/src/theme.css';
import { onMount, type Snippet } from 'svelte';
import { fade } from 'svelte/transition';
import { goto } from '$app/navigation';
import { page } from '$app/state';
import { Sidebar, Header, NotificationPanel, Icon } from '@phavo/ui';
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
  clearAll,
  clearHistory,
  dismiss,
  togglePanel,
  getPanelOpen,
  setPanelOpen,
  getMuted,
  toggleMute,
  syncFromServer,
} from '$lib/stores/notifications.svelte';
import {
  createTab,
  deleteTab,
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
    hostname?: string;
    username?: string;
  };
  children: Snippet;
}

let { data, children }: Props = $props();

let sidebarCollapsed = $state(false);
let currentPathname = $state('/');
let headerWeatherFallback = $state<{ temp: number; condition: string } | undefined>(undefined);
let systemOnline = $state<boolean | null>(null);
let headerScrolled = $state(false);

const sidebarItems = [
  { id: 'general', label: 'General', icon: 'settings-2', status: { type: 'active' as const, label: 'Configured' } },
  { id: 'widgets', label: 'Widgets', icon: 'puzzle', status: { type: 'active' as const, label: 'Active' } },
  { id: 'import-export', label: 'Backup & Export', icon: 'archive', status: { type: 'active' as const, label: 'Ready' } },
  { id: 'account', label: 'Account', icon: 'user', status: { type: 'active' as const, label: 'Secured' } },
  { id: 'ai', label: 'AI', icon: 'sparkles', status: { type: 'inactive' as const, label: 'Not Configured' } },
  { id: 'plugins', label: 'Plugins', icon: 'plug', status: { type: 'inactive' as const, label: 'Coming Soon' } },
  { id: 'about', label: 'About', icon: 'info', status: { type: 'active' as const, label: 'Up to Date' } },
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
  const path = page.url.pathname;
  const tab = page.url.searchParams.get('tab');
  if (!path.startsWith('/settings')) return 'home';
  return tab && SETTINGS_TAB_IDS.has(tab) ? tab : 'general';
});

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

async function checkSystemHealth(): Promise<void> {
  try {
    const resp = await fetch('/api/v1/system/health');
    const json = (await resp.json()) as { ok: boolean };
    systemOnline = json.ok === true;
  } catch {
    systemOnline = false;
  }
}

function navigate(id: string) {
  setPanelOpen(false);
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

function navigateToSettings(tab?: string) {
  setPanelOpen(false);
  setDrawerOpen(false);

  void goto(`/settings?tab=${tab ?? 'general'}`, { replaceState: true, noScroll: true });
}

async function handleDashboardTabSelect(tabId: string): Promise<void> {
  setPanelOpen(false);
  setDrawerOpen(false);

  if (currentPathname !== '/') {
    await goto('/');
  }
  await setActiveTab(tabId);
}

async function handleSidebarNewTab(): Promise<void> {
  const nextLabel = getTabs().length === 0 ? 'Home' : `Page ${getTabs().length + 1}`;
  const previousCount = getTabs().length;
  const result = await createTab(nextLabel);

  if (!result.ok) {
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
  { id: 'account', label: 'Account' },
  { id: 'plugins', label: 'Plugins' },
  { id: 'import-export', label: 'Backup & Export' },
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
      setPanelOpen(true);
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
        aiProvider: import('$lib/stores/ai.svelte.js').AiProvider;
        ollama: boolean;
        openai: boolean;
        anthropic: boolean;
        google: boolean;
        custom: boolean;
        searchEngineUrl: string;
        searchEngineName: string;
      };
    };
    if (json.ok && json.data) {
      updateAiStatusFromPayload(json.data);
    }
  } catch { /* AI status is optional — degrade gracefully */ }
}

async function handleAiChat(provider: 'ollama' | 'openai' | 'anthropic' | 'google' | 'custom', query: string): Promise<string> {
  const resp = await fetchWithCsrf('/api/v1/ai/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: query }),
  });

  if (!resp.ok || !resp.body) {
    const json = (await resp.json().catch(() => null)) as { error?: string } | null;
    throw new Error(json?.error ?? 'AI request failed');
  }

  // Read SSE stream and accumulate text
  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let result = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const lines = decoder.decode(value).split('\n');
    for (const line of lines) {
      if (line.startsWith('data:')) {
        try {
          const data = JSON.parse(line.slice(5)) as { text?: string; done?: boolean; error?: string };
          if (data.text) result += data.text;
          if (data.done) return result;
          if (data.error) throw new Error(data.error);
        } catch (e) {
          if (e instanceof Error && e.message === 'stream_failed') throw e;
        }
      }
    }
  }

  return result;
}

onMount(() => {
  const syncLocation = () => {
    currentPathname = window.location.pathname;
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

  let headerScrollObserver: IntersectionObserver | undefined;
  let headerScrollSentinel: HTMLDivElement | undefined;

  const observeHeaderScroll = () => {
    const scrollRoot = document.querySelector<HTMLElement>(
      '.dashboard-grid, .dashboard-content, .page-content, main',
    );
    if (!scrollRoot || typeof IntersectionObserver === 'undefined') return;

    headerScrollSentinel = document.createElement('div');
    headerScrollSentinel.setAttribute('aria-hidden', 'true');
    Object.assign(headerScrollSentinel.style, {
      position: 'absolute',
      top: '0',
      left: '0',
      width: '1px',
      height: '1px',
      pointerEvents: 'none',
    });

    if (window.getComputedStyle(scrollRoot).position === 'static') {
      scrollRoot.style.position = 'relative';
    }

    scrollRoot.prepend(headerScrollSentinel);

    headerScrollObserver = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;
        headerScrolled = !entry.isIntersecting;
      },
      {
        root: null,
        rootMargin: '-64px 0px 0px 0px',
        threshold: 0,
      },
    );

    headerScrollObserver.observe(headerScrollSentinel);
  };

  observeHeaderScroll();


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

    $effect(() => {
      if (!isDashboard) return;
      void checkSystemHealth();
      const interval = setInterval(() => void checkSystemHealth(), 60_000);
      return () => clearInterval(interval);
    });
  });

  return () => {
    headerScrollObserver?.disconnect();
    headerScrollSentinel?.remove();
    window.history.pushState = originalPushState;
    window.history.replaceState = originalReplaceState;
    window.removeEventListener('popstate', syncLocation);
    window.removeEventListener('hashchange', syncLocation);
    cleanupEffects();
  };
});

function handleNotificationClick(n: Notification) {
  markRead(n.id);
  setPanelOpen(false);
  if (n.type === 'widget-error' && n.widgetId) {
    goto(`/settings?tab=widgets#widgets/${encodeURIComponent(n.widgetId)}`);
    return;
  }

  if (n.actionUrl) {
    goto(n.actionUrl);
  }
}
</script>

<svelte:head>
  <meta name="theme-color" content="#0a0e1a" />
</svelte:head>

{#if isDashboard}
  <div class="dashboard-layout">
    <!-- Fixed ambient cosmic glows — z:0, behind all content -->
    <div class="ambient-glow ambient-glow-purple" style="position: fixed; pointer-events: none; z-index: 0;"></div>
    <div class="ambient-glow ambient-glow-teal" style="position: fixed; pointer-events: none; z-index: 0;"></div>
    <Sidebar
      bind:collapsed={sidebarCollapsed}
      deviceName={data.hostname ?? ''}
      tabs={getTabs()}
      activeTab={getCurrentTabId()}
      items={sidebarItems}
      activeItem={activeSidebarItem}
      onsettingsnav={(tab) => navigateToSettings(tab)}
      onTabSelect={(tabId) => void handleDashboardTabSelect(tabId)}
      onNewTab={() => void handleSidebarNewTab()}
      ondeletepage={(id) => void deleteTab(id)}
      ontoggle={() => (sidebarCollapsed = !sidebarCollapsed)}
      onnavigate={navigate}
    />
    <main class="main-content" class:sidebar-collapsed={sidebarCollapsed}>
      <Header
        dashboardName={getConfig().dashboardName ?? data.dashboardName ?? 'PHAVO'}
        weather={headerWeather}
        scrolled={headerScrolled}
        unreadCount={getUnreadCount()}
        {systemOnline}
        onBellClick={() => {
          setDrawerOpen(false);
          togglePanel();
        }}
        onAddWidgetClick={currentPathname === '/' ? () => {
          setPanelOpen(false);
          setDrawerOpen(!getIsDrawerOpen());
        } : undefined}
        addWidgetLabel={en.dashboard.addWidget}
        {searchIndex}
        searchEngineUrl={aiStatus.searchEngineUrl}
        aiProviders={aiStatus.providers}
        onAiChat={handleAiChat}
      />
      {#key currentPathname}
        <div class="page-content" in:fade={{ duration: 150, delay: 50 }} out:fade={{ duration: 100 }}>
          {@render children()}
        </div>
      {/key}
    </main>
    <NotificationPanel
      open={getPanelOpen()}
      notifications={getNotifications()}
      muted={getMuted()}
      onclose={() => setPanelOpen(false)}
      onclearall={() => clearAll()}
      ondismiss={(id) => dismiss(id)}
      onaction={(n) => handleNotificationClick(n)}
      onmuteall={() => toggleMute()}
    />
  </div>
{:else}
  {@render children()}
{/if}

<style>
  .dashboard-layout {
    display: flex;
    min-height: 100dvh;
    width: 100%;
    position: relative;
    background: transparent;
  }

  .main-content {
    --shell-sidebar-offset: var(--sidebar-width);
    flex: 1 1 auto;
    display: flex;
    flex-direction: column;
    min-height: 100dvh;
    overflow: visible;
    min-width: 0;
    width: 100%;
    padding-left: var(--shell-sidebar-offset);
    box-sizing: border-box;
    transition: padding-left var(--motion-component);
    position: relative;
    z-index: 10;
    background: transparent;
  }

  .page-content {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
  }

  .main-content.sidebar-collapsed {
    --shell-sidebar-offset: var(--sidebar-collapsed-width);
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
