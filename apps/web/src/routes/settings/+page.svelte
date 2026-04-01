<script lang="ts">
import { goto } from '$app/navigation';
import { onMount } from 'svelte';
import { Badge, Button, Icon, Input, Select, Switch, Tooltip } from '@phavo/ui';
import en from '$lib/i18n/en.json';
import ImportExportTab from '$lib/components/settings/ImportExportTab.svelte';
import LicenceTab from '$lib/components/settings/LicenceTab.svelte';
import WidgetsTab from '$lib/components/settings/WidgetsTab.svelte';
import type { AiStatusResponseData } from '$lib/stores/ai.svelte';
import { updateAiStatusFromPayload } from '$lib/stores/ai.svelte';
import { setConfig, updateConfig } from '$lib/stores/config.svelte';
import { fetchWithCsrf } from '$lib/utils/api';

type TabId = 'general' | 'tabs' | 'widgets' | 'import-export' | 'license' | 'account' | 'plugins' | 'about';
type SaveState = 'idle' | 'saving' | 'saved';
type GeoResult = {
  id: number;
  name: string;
  country: string;
  latitude: number;
  longitude: number;
};
type SessionInfo = {
  userId: string;
  tier: 'free' | 'standard' | 'local';
  authMode: 'phavo-net' | 'local';
  validatedAt: number;
  email: string | null;
} | null;
type AboutInfo = {
  version: string;
  tier: 'free' | 'standard' | 'local';
  licenseKeyMasked: string | null;
};
type UpdateInfo = {
  updateAvailable: boolean;
  currentVersion: string;
  latestVersion: string;
  changelog: string;
  publishedAt: string;
  updateCommand: string;
};

type ConfigResponse = {
  setupComplete: boolean;
  dashboardName: string;
  tabs: Array<{ id: string; label: string; order: number }>;
  sessionTimeout: '1d' | '7d' | '30d' | 'never';
  location?: {
    name: string;
    latitude: number;
    longitude: number;
  };
};

type AiSettingsResponseData = AiStatusResponseData & {
  searchEngine: string;
  customSearchUrl: string;
  ollamaUrl: string;
  ollamaModel: string;
  hasOpenaiKey: boolean;
  hasAnthropicKey: boolean;
};

const settingsTabs: Array<{ id: TabId; label: string; icon: string }> = [
  { id: 'general', label: 'General', icon: 'settings-2' },
  { id: 'tabs', label: 'Tabs', icon: 'layout-template' },
  { id: 'widgets', label: 'Widgets', icon: 'puzzle' },
  { id: 'import-export', label: 'Backup & Export', icon: 'archive' },
  { id: 'license', label: 'Licence', icon: 'shield-check' },
  { id: 'account', label: 'Account', icon: 'user' },
  { id: 'plugins', label: 'Plugins', icon: 'plug' },
  { id: 'about', label: 'About', icon: 'info' },
];

const sessionTimeoutOptions = [
  { value: '1d', label: en.settings.sessionTimeout1d },
  { value: '7d', label: en.settings.sessionTimeout7d },
  { value: '30d', label: en.settings.sessionTimeout30d },
  { value: 'never', label: en.settings.sessionTimeoutNever },
];

const DOCS_URL = 'https://docs.phavo.net';
const GITHUB_URL = 'https://github.com/getphavo/phavo';
const DISCORD_URL = 'https://discord.gg/phavo';
const PHAVO_ACCOUNT_URL = 'https://phavo.net/account';
const PHAVO_LICENSE_URL = 'https://phavo.net/account/license';

let activeTab = $state<TabId>('general');
let loading = $state(true);
let loadError = $state('');

let dashboardName = $state('My Dashboard');
let locationName = $state('');
let locationLatitude = $state<number | null>(null);
let locationLongitude = $state<number | null>(null);
let suggestions = $state<GeoResult[]>([]);
let showSuggestions = $state(false);
let geocoding = $state(false);
let geoTimer: ReturnType<typeof setTimeout> | null = null;

let sessionTimeout = $state<'1d' | '7d' | '30d' | 'never'>('7d');
let sessionInfo = $state<SessionInfo>(null);
let aboutInfo = $state<AboutInfo>({ version: '1.0.0', tier: 'free', licenseKeyMasked: null });
let updateInfo = $state<UpdateInfo | null>(null);
let checkingUpdates = $state(false);
let applying = $state(false);
let applyResult = $state<{ started: boolean; reason?: string } | null>(null);
let cmdCopied = $state(false);

let newPassword = $state('');
let confirmPassword = $state('');
let passwordError = $state('');

// ─── Search & AI ──────────────────────────────────────────────────────
const searchEngineOptions = [
  { value: 'duckduckgo', label: 'DuckDuckGo' },
  { value: 'google', label: 'Google' },
  { value: 'brave', label: 'Brave Search' },
  { value: 'custom', label: 'Custom' },
];
let searchEngine = $state('duckduckgo');
let customSearchUrl = $state('');
let ollamaUrl = $state('');
let ollamaModel = $state('');
let openaiKey = $state('');
let anthropicKey = $state('');
let ollamaTestResult = $state<'idle' | 'testing' | 'ok' | 'fail'>('idle');
let aiSettingsLoaded = $state(false);

let aiInitial = $state({
  searchEngine: 'duckduckgo',
  customSearchUrl: '',
  ollamaUrl: '',
  ollamaModel: '',
  openaiKey: '',
  anthropicKey: '',
});

const aiDirty = $derived(
  searchEngine !== aiInitial.searchEngine ||
    customSearchUrl.trim() !== aiInitial.customSearchUrl ||
    ollamaUrl.trim() !== aiInitial.ollamaUrl ||
    ollamaModel.trim() !== aiInitial.ollamaModel ||
    openaiKey !== aiInitial.openaiKey ||
    anthropicKey !== aiInitial.anthropicKey,
);

let generalInitial = $state({
  dashboardName: 'My Dashboard',
  locationName: '',
  locationLatitude: null as number | null,
  locationLongitude: null as number | null,
});
let securityInitial = $state<'1d' | '7d' | '30d' | 'never'>('7d');

let saveStates = $state<Record<TabId, SaveState>>({
  general: 'idle',
  tabs: 'idle',
  account: 'idle',
  widgets: 'idle',
  license: 'idle',
  'import-export': 'idle',
  plugins: 'idle',
  about: 'idle',
});
let tabErrors = $state<Record<TabId, string>>({
  general: '',
  tabs: '',
  account: '',
  widgets: '',
  license: '',
  'import-export': '',
  plugins: '',
  about: '',
});

const generalDirty = $derived(
  dashboardName.trim() !== generalInitial.dashboardName ||
    locationName.trim() !== generalInitial.locationName ||
    locationLatitude !== generalInitial.locationLatitude ||
    locationLongitude !== generalInitial.locationLongitude ||
    aiDirty,
);
const securityDirty = $derived(sessionTimeout !== securityInitial);
const canChangePassword = $derived(sessionInfo?.tier === 'local');
const accountDirty = $derived(canChangePassword && (newPassword.length > 0 || confirmPassword.length > 0));
const accountValid = $derived(
  !canChangePassword ||
    (newPassword.length >= 8 && confirmPassword.length >= 8 && newPassword === confirmPassword),
);
const canSaveCurrentTab = $derived.by(() => {
  if (loading) return false;
  if (activeTab === 'general') return generalDirty;
  if (activeTab === 'account') return (!!accountDirty && !!accountValid) || securityDirty;
  return false;
});
const currentSaveLabel = $derived(
  saveStates[activeTab] === 'saved' ? en.settings.saved : en.settings.saveChanges,
);

let didLoad = false;
onMount(() => {
  if (!didLoad) {
    didLoad = true;
    void loadSettings();
  }

  syncTabFromHash();
  const handleHashChange = () => syncTabFromHash();
  window.addEventListener('hashchange', handleHashChange);

  return () => {
    window.removeEventListener('hashchange', handleHashChange);
  };
});

onMount(() => {
  $effect.root(() => {
    $effect(() => {
      if (typeof window === 'undefined') return;
      const nextHash = `#${activeTab}`;
      if (window.location.hash === nextHash || window.location.hash.startsWith(`${nextHash}/`)) {
        if (activeTab === 'about' && !updateInfo && !checkingUpdates) {
          void checkForUpdates();
        }
        return;
      }

      history.replaceState(history.state, '', `${window.location.pathname}${nextHash}`);
    });
  });
});

function syncTabFromHash(): void {
  if (typeof window === 'undefined') return;
  const rawHash = window.location.hash.replace(/^#/, '');
  const [tabId] = rawHash.split('/');
  if (tabId && settingsTabs.some((tab) => tab.id === tabId)) {
    activeTab = tabId as TabId;
  }
}

function tierVariant(tier: 'free' | 'standard' | 'local') {
  if (tier === 'standard') return 'accent';
  if (tier === 'local') return 'success';
  return 'default';
}

function tierLabel(tier: 'free' | 'standard' | 'local') {
  if (tier === 'standard') return en.settings.tierStandard;
  if (tier === 'local') return en.settings.tierLocal;
  return en.settings.tierFree;
}

function formatTimestamp(value?: number | null) {
  if (!value) return '—';
  return new Date(value).toLocaleString();
}

function setSavedState(tab: TabId) {
  saveStates = { ...saveStates, [tab]: 'saved' };
  setTimeout(() => {
    saveStates = { ...saveStates, [tab]: 'idle' };
  }, 2000);
}

async function loadSettings() {
  loading = true;
  loadError = '';
  try {
    const [configResp, sessionResp, aboutResp] = await Promise.all([
      fetchWithCsrf('/api/v1/config'),
      fetchWithCsrf('/api/v1/auth/session'),
      fetchWithCsrf('/api/v1/about'),
    ]);

    const configJson = (await configResp.json()) as { ok: boolean; data?: ConfigResponse; error?: string };
    const sessionJson = (await sessionResp.json()) as { ok: boolean; data?: SessionInfo; error?: string };
    const aboutJson = (await aboutResp.json()) as { ok: boolean; data?: AboutInfo; error?: string };

    if (!configJson.ok || !configJson.data) {
      throw new Error(configJson.error ?? en.errors.generic);
    }

    setConfig(configJson.data);
    dashboardName = configJson.data.dashboardName;
    locationName = configJson.data.location?.name ?? '';
    locationLatitude = configJson.data.location?.latitude ?? null;
    locationLongitude = configJson.data.location?.longitude ?? null;
    sessionTimeout = configJson.data.sessionTimeout;
    generalInitial = {
      dashboardName: configJson.data.dashboardName,
      locationName: configJson.data.location?.name ?? '',
      locationLatitude: configJson.data.location?.latitude ?? null,
      locationLongitude: configJson.data.location?.longitude ?? null,
    };
    securityInitial = configJson.data.sessionTimeout;

    sessionInfo = sessionJson.ok ? (sessionJson.data ?? null) : null;
    if (aboutJson.ok && aboutJson.data) {
      aboutInfo = aboutJson.data;
    }

    // Load AI settings
    void loadAiSettings();
  } catch (error) {
    loadError = error instanceof Error ? error.message : en.errors.generic;
  } finally {
    loading = false;
  }
}

async function loadAiSettings() {
  try {
    const resp = await fetchWithCsrf('/api/v1/ai/status');
    const json = (await resp.json()) as {
      ok: boolean;
      data?: AiSettingsResponseData;
    };
    if (json.ok && json.data) {
      updateAiStatusFromPayload(json.data);
      searchEngine = json.data.searchEngine || 'duckduckgo';
      customSearchUrl = json.data.customSearchUrl || '';
      ollamaUrl = json.data.ollamaUrl || '';
      ollamaModel = json.data.ollamaModel || '';
      openaiKey = json.data.hasOpenaiKey ? '••••••••' : '';
      anthropicKey = json.data.hasAnthropicKey ? '••••••••' : '';
      aiInitial = {
        searchEngine: searchEngine,
        customSearchUrl: customSearchUrl,
        ollamaUrl: ollamaUrl,
        ollamaModel: ollamaModel,
        openaiKey: openaiKey,
        anthropicKey: anthropicKey,
      };
      aiSettingsLoaded = true;
    }
  } catch {
    // AI settings are optional — silently ignore
  }
}

async function saveAiSettings() {
  try {
    const payload: Record<string, string> = {
      searchEngine,
      customSearchUrl: customSearchUrl.trim(),
      ollamaUrl: ollamaUrl.trim(),
      ollamaModel: ollamaModel.trim(),
    };
    // Only send keys if they were actually changed (not the mask)
    if (openaiKey && openaiKey !== '••••••••') {
      payload.openaiKey = openaiKey;
    }
    if (anthropicKey && anthropicKey !== '••••••••') {
      payload.anthropicKey = anthropicKey;
    }
    const resp = await fetchWithCsrf('/api/v1/ai/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const json = (await resp.json()) as { ok: boolean; error?: string };
    if (!json.ok) throw new Error(json.error ?? 'Failed to save AI settings');
    await loadAiSettings();
  } catch (error) {
    throw error;
  }
}

async function testOllamaConnection() {
  if (!ollamaUrl.trim()) return;
  ollamaTestResult = 'testing';
  try {
    let tagUrl: URL;
    try {
      tagUrl = new URL('/api/tags', ollamaUrl.trim());
    } catch {
      ollamaTestResult = 'fail';
      return;
    }
    if (tagUrl.protocol !== 'http:' && tagUrl.protocol !== 'https:') {
      ollamaTestResult = 'fail';
      return;
    }
    // Proxy through our API to avoid CORS issues
    const resp = await fetchWithCsrf('/api/v1/ai/test-ollama', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: ollamaUrl.trim() }),
    });
    const json = (await resp.json()) as { ok: boolean };
    ollamaTestResult = json.ok ? 'ok' : 'fail';
  } catch {
    ollamaTestResult = 'fail';
  }
  setTimeout(() => (ollamaTestResult = 'idle'), 3000);
}

async function saveGeneral() {
  saveStates = { ...saveStates, general: 'saving' };
  tabErrors = { ...tabErrors, general: '' };
  try {
    const payload = {
      dashboardName: dashboardName.trim() || 'My Dashboard',
      location:
        locationName.trim() && locationLatitude !== null && locationLongitude !== null
          ? {
              name: locationName.trim(),
              latitude: locationLatitude,
              longitude: locationLongitude,
            }
          : null,
    };
    const resp = await fetchWithCsrf('/api/v1/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const json = (await resp.json()) as { ok: boolean; data?: ConfigResponse; error?: string };
    if (!json.ok || !json.data) {
      throw new Error(json.error ?? en.settings.saveFailed);
    }
    updateConfig(json.data);
    generalInitial = {
      dashboardName: json.data.dashboardName,
      locationName: json.data.location?.name ?? '',
      locationLatitude: json.data.location?.latitude ?? null,
      locationLongitude: json.data.location?.longitude ?? null,
    };

    // Also save AI settings if changed
    if (aiDirty) {
      await saveAiSettings();
    }

    setSavedState('general');
  } catch (error) {
    tabErrors = {
      ...tabErrors,
      general: error instanceof Error ? error.message : en.settings.saveFailed,
    };
    saveStates = { ...saveStates, general: 'idle' };
  }
}

async function saveAccount() {
  if (!accountValid) {
    passwordError = newPassword !== confirmPassword ? en.settings.passwordsDoNotMatch : en.settings.passwordTooShort;
    return;
  }
  saveStates = { ...saveStates, account: 'saving' };
  tabErrors = { ...tabErrors, account: '' };
  try {
    const resp = await fetchWithCsrf('/api/v1/auth/password', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newPassword }),
    });
    const json = (await resp.json()) as { ok: boolean; error?: string };
    if (!json.ok) {
      throw new Error(json.error ?? en.settings.saveFailed);
    }
    newPassword = '';
    confirmPassword = '';
    passwordError = '';
    setSavedState('account');
  } catch (error) {
    tabErrors = {
      ...tabErrors,
      account: error instanceof Error ? error.message : en.settings.saveFailed,
    };
    saveStates = { ...saveStates, account: 'idle' };
  }
}

async function saveSecurity() {
  saveStates = { ...saveStates, account: 'saving' };
  tabErrors = { ...tabErrors, account: '' };
  try {
    const resp = await fetchWithCsrf('/api/v1/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionTimeout }),
    });
    const json = (await resp.json()) as { ok: boolean; data?: ConfigResponse; error?: string };
    if (!json.ok || !json.data) {
      throw new Error(json.error ?? en.settings.saveFailed);
    }
    updateConfig(json.data);
    securityInitial = json.data.sessionTimeout;
    setSavedState('account');
  } catch (error) {
    tabErrors = {
      ...tabErrors,
      account: error instanceof Error ? error.message : en.settings.saveFailed,
    };
    saveStates = { ...saveStates, account: 'idle' };
  }
}

async function saveCurrentTab() {
  if (activeTab === 'general') return saveGeneral();
  if (activeTab === 'account') {
    if (accountDirty && accountValid) await saveAccount();
    if (securityDirty) await saveSecurity();
    return;
  }
}

async function reRunSetup() {
  try {
    const resp = await fetchWithCsrf('/api/v1/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ setupComplete: false }),
    });
    const json = (await resp.json()) as { ok: boolean };
    if (json.ok) {
      goto('/setup');
    }
  } catch {
    tabErrors = { ...tabErrors, general: en.settings.saveFailed };
  }
}

function onLocationInput() {
  locationLatitude = null;
  locationLongitude = null;
  if (geoTimer) clearTimeout(geoTimer);
  if (locationName.trim().length < 2) {
    suggestions = [];
    showSuggestions = false;
    geocoding = false;
    return;
  }
  const query = locationName.trim();
  geocoding = true;
  geoTimer = setTimeout(async () => {
    try {
      const resp = await fetch(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=5&language=en&format=json`,
      );
      const data = (await resp.json()) as { results?: GeoResult[] };
      suggestions = data.results ?? [];
      showSuggestions = true;
    } catch {
      suggestions = [];
      showSuggestions = false;
    } finally {
      geocoding = false;
    }
  }, 300);
}

function selectSuggestion(result: GeoResult) {
  locationName = `${result.name}, ${result.country}`;
  locationLatitude = result.latitude;
  locationLongitude = result.longitude;
  suggestions = [];
  showSuggestions = false;
}

async function signOutAllSessions() {
  const resp = await fetchWithCsrf('/api/v1/auth/logout-all', { method: 'POST' });
  const json = (await resp.json()) as { ok: boolean; error?: string };
  if (json.ok) {
    goto('/auth/login');
  } else {
    tabErrors = { ...tabErrors, account: json.error ?? en.settings.saveFailed };
  }
}

async function checkForUpdates() {
  checkingUpdates = true;
  applyResult = null;
  tabErrors = { ...tabErrors, about: '' };
  try {
    const resp = await fetchWithCsrf('/api/v1/update/check');
    const json = (await resp.json()) as { ok: boolean; data?: UpdateInfo; error?: string };
    if (!json.ok || !json.data) {
      throw new Error(json.error ?? en.errors.generic);
    }
    updateInfo = json.data;
  } catch (error) {
    tabErrors = { ...tabErrors, about: error instanceof Error ? error.message : en.errors.generic };
  } finally {
    checkingUpdates = false;
  }
}

async function applyUpdate() {
  applying = true;
  applyResult = null;
  tabErrors = { ...tabErrors, about: '' };
  try {
    const resp = await fetchWithCsrf('/api/v1/update/apply', { method: 'POST' });
    const json = (await resp.json()) as {
      ok: boolean;
      data?: { started: boolean; reason?: string };
      error?: string;
    };
    if (!json.ok) throw new Error(json.error ?? en.errors.generic);
    applyResult = json.data ?? { started: false };
  } catch (error) {
    tabErrors = { ...tabErrors, about: error instanceof Error ? error.message : en.errors.generic };
  } finally {
    applying = false;
  }
}

async function copyUpdateCommand() {
  const cmd = updateInfo?.updateCommand ?? 'docker compose pull && docker compose up -d';
  try {
    await navigator.clipboard.writeText(cmd);
    cmdCopied = true;
    setTimeout(() => (cmdCopied = false), 2000);
  } catch { /* clipboard unavailable */ }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function renderMarkdown(md: string): string {
  const escaped = escapeHtml(md);

  return escaped
    .replace(/^## (.+)$/gm, '<strong>$1</strong>')
    .replace(/^# (.+)$/gm, '<strong>$1</strong>')
    .replace(/^[-*] (.+)$/gm, '<span class="cl-item">• $1</span>')
    .replace(/\n/g, '<br>');
}

function formatReleaseDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return iso;
  }
}
</script>

<div class="flex flex-col lg:flex-row gap-6 max-w-[1100px] mx-auto w-full p-6">
  <!-- Left vertical tab list -->
  <nav class="flex flex-row lg:flex-col gap-1 lg:w-56 shrink-0 overflow-x-auto lg:overflow-x-visible">
    {#each settingsTabs as tab (tab.id)}
      <button
        type="button"
        class="flex items-center gap-3 px-4 py-2.5 text-sm rounded-lg whitespace-nowrap transition-colors
          {activeTab === tab.id
            ? 'bg-elevated text-text border-l-2 border-accent'
            : 'text-text-muted hover:bg-hover'}"
        onclick={() => { activeTab = tab.id; }}
      >
        <Icon name={tab.icon} size={16} />
        <span>{tab.label}</span>
      </button>
    {/each}
  </nav>

  <!-- Right content area -->
  <div class="flex-1 min-w-0">
    {#if loadError}
      <p class="text-sm text-red-400 mb-4">{loadError}</p>
    {/if}

    {#if activeTab === 'general'}
      <div class="flex flex-col gap-5">
        <div class="p-5 bg-surface border border-border rounded-lg">
          <div class="flex flex-col gap-4">
            <Input label="Dashboard Name" bind:value={dashboardName} />

            <div class="relative">
              <Input
                label="Weather Location"
                placeholder="Search for a city…"
                bind:value={locationName}
                oninput={onLocationInput}
              />
              {#if showSuggestions}
                <ul class="absolute top-full left-0 right-0 mt-1 bg-elevated border border-border rounded-md shadow-lg z-10 py-1 list-none" role="listbox">
                  {#if suggestions.length === 0 && !geocoding}
                    <li class="px-3 py-2 text-sm text-text-muted">No results</li>
                  {:else}
                    {#each suggestions as result (result.id)}
                      <li role="option" aria-selected="false">
                        <button class="w-full text-left px-3 py-2 text-sm text-text hover:bg-hover bg-transparent border-none cursor-pointer" type="button" onclick={() => selectSuggestion(result)}>
                          {result.name}, {result.country}
                        </button>
                      </li>
                    {/each}
                  {/if}
                </ul>
              {/if}
              <p class="text-xs text-text-muted mt-1">Used for weather widget display.</p>
            </div>

            <Select label="Search Engine" options={searchEngineOptions} bind:value={searchEngine} />
            {#if searchEngine === 'custom'}
              <Input
                label="Custom Search URL"
                placeholder="https://example.com/search?q=&#123;query&#125;"
                bind:value={customSearchUrl}
              />
            {/if}

            <div class="flex items-center gap-3">
              <Input label="Ollama URL" placeholder="http://localhost:11434" bind:value={ollamaUrl} />
              <div class="shrink-0 pt-5">
                <Button variant="secondary" onclick={testOllamaConnection} disabled={!ollamaUrl.trim() || ollamaTestResult === 'testing'}>
                  {ollamaTestResult === 'testing' ? 'Testing…' : ollamaTestResult === 'ok' ? '✓ Connected' : ollamaTestResult === 'fail' ? '✗ Failed' : 'Test'}
                </Button>
              </div>
            </div>

            <Input label="Ollama Model" placeholder="llama3.2" bind:value={ollamaModel} />
            <Input label="OpenAI API Key" type="password" placeholder="sk-…" bind:value={openaiKey} />
            <Input label="Anthropic API Key" type="password" placeholder="sk-ant-…" bind:value={anthropicKey} />
          </div>
        </div>

        <div class="p-5 bg-surface border border-border rounded-lg">
          <Button variant="ghost" onclick={reRunSetup}>Re-run Setup</Button>
        </div>

        {#if tabErrors.general}
          <p class="text-sm text-red-400">{tabErrors.general}</p>
        {/if}

        <div class="flex justify-end">
          <Button onclick={saveCurrentTab} disabled={!canSaveCurrentTab || saveStates.general === 'saving'}>
            {currentSaveLabel}
          </Button>
        </div>
      </div>

    {:else if activeTab === 'tabs'}
      <div class="p-5 bg-surface border border-border rounded-lg">
        <p class="text-xs text-text-muted uppercase tracking-widest mb-3">Tab Management</p>
        <p class="text-sm text-text-muted mb-4">Drag to reorder, click to rename, or delete tabs.</p>
        <p class="text-sm text-text-muted italic">Coming soon — manage tabs from the dashboard header.</p>
      </div>

    {:else if activeTab === 'widgets'}
      <WidgetsTab />

    {:else if activeTab === 'import-export'}
      <ImportExportTab />

    {:else if activeTab === 'license'}
      <LicenceTab
        tier={sessionInfo?.tier ?? aboutInfo.tier}
        authMode={sessionInfo?.authMode ?? null}
        licenseKeyMasked={aboutInfo.licenseKeyMasked}
        manageUrl={PHAVO_LICENSE_URL}
      />

    {:else if activeTab === 'account'}
      <div class="flex flex-col gap-5">
        <div class="p-5 bg-surface border border-border rounded-lg">
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
            <div>
              <span class="text-xs text-text-muted uppercase tracking-widest">Auth Mode</span>
              <p class="text-sm text-text mt-1">
                {#if sessionInfo}
                  {sessionInfo.authMode === 'phavo-net' ? 'phavo.net' : 'Local'}
                {:else}
                  —
                {/if}
              </p>
            </div>
            <div>
              <span class="text-xs text-text-muted uppercase tracking-widest">Email</span>
              <p class="text-sm text-text mt-1">{sessionInfo?.email ?? '—'}</p>
            </div>
            <div>
              <span class="text-xs text-text-muted uppercase tracking-widest">Tier</span>
              <div class="mt-1">
                <Badge variant={tierVariant(sessionInfo?.tier ?? aboutInfo.tier)}>
                  {tierLabel(sessionInfo?.tier ?? aboutInfo.tier)}
                </Badge>
              </div>
            </div>
          </div>

          {#if sessionInfo?.authMode === 'phavo-net'}
            <a class="inline-flex items-center gap-2 text-sm text-text hover:text-accent-text transition-colors" href={PHAVO_ACCOUNT_URL} target="_blank" rel="noreferrer">
              Manage account on phavo.net
              <Icon name="external-link" size={14} />
            </a>
          {/if}
        </div>

        {#if canChangePassword}
          <div class="p-5 bg-surface border border-border rounded-lg">
            <p class="text-xs text-text-muted uppercase tracking-widest mb-3">Change Password</p>
            <div class="flex flex-col gap-3">
              <Input label="New Password" type="password" bind:value={newPassword} />
              <Input label="Confirm Password" type="password" bind:value={confirmPassword} />
            </div>
            {#if passwordError}
              <p class="text-sm text-red-400 mt-2">{passwordError}</p>
            {/if}
          </div>
        {/if}

        <div class="p-5 bg-surface border border-border rounded-lg">
          <p class="text-xs text-text-muted uppercase tracking-widest mb-3">2FA (TOTP)</p>
          <div class="flex items-center justify-between">
            <p class="text-sm text-text-muted">Not configured</p>
            <Tooltip text="Coming soon">
              <span>
                <Button variant="secondary" disabled>Enable 2FA</Button>
              </span>
            </Tooltip>
          </div>
        </div>

        <div class="p-5 bg-surface border border-border rounded-lg">
          <p class="text-xs text-text-muted uppercase tracking-widest mb-3">Session</p>
          <Select label="Session Timeout" options={sessionTimeoutOptions} bind:value={sessionTimeout} />
          <div class="flex items-center justify-between mt-4 pt-4 border-t border-border-subtle">
            <div>
              <p class="text-sm font-medium text-text">Current Session</p>
              <p class="text-xs text-text-muted">Signed in: {formatTimestamp(sessionInfo?.validatedAt)}</p>
            </div>
            <Button variant="ghost" onclick={signOutAllSessions}>Sign out all sessions</Button>
          </div>
        </div>

        {#if tabErrors.account}
          <p class="text-sm text-red-400">{tabErrors.account}</p>
        {/if}

        <div class="flex justify-end">
          <Button onclick={saveCurrentTab} disabled={!canSaveCurrentTab || saveStates.account === 'saving'}>
            {currentSaveLabel}
          </Button>
        </div>
      </div>

    {:else if activeTab === 'plugins'}
      <div class="p-5 bg-surface border border-border rounded-lg">
        <p class="text-xs text-text-muted uppercase tracking-widest mb-3">Plugins</p>
        <p class="text-sm text-text-muted mb-4">Upload <code class="font-mono text-xs bg-elevated px-1.5 py-0.5 rounded">.phwidget</code> or <code class="font-mono text-xs bg-elevated px-1.5 py-0.5 rounded">.phtheme</code> files to install plugins.</p>
        <div class="border-2 border-dashed border-border rounded-lg p-8 text-center">
          <Icon name="upload" size={32} class="mx-auto mb-2 text-text-muted" />
          <p class="text-sm text-text-muted">Drag & drop plugin files here</p>
          <p class="text-xs text-text-dim mt-1">Plugin support coming in v1.1</p>
        </div>
      </div>

    {:else if activeTab === 'about'}
      <div class="flex flex-col gap-5">
        <div class="p-5 bg-surface border border-border rounded-lg">
          <div class="flex items-center justify-between mb-4">
            <div>
              <span class="text-xs text-text-muted uppercase tracking-widest">Version</span>
              <p class="text-sm font-mono text-text mt-1">v{aboutInfo.version}</p>
            </div>
            <Button
              variant="secondary"
              onclick={checkForUpdates}
              disabled={checkingUpdates}
            >
              {checkingUpdates ? 'Checking…' : 'Check for updates'}
            </Button>
          </div>

          {#if updateInfo !== null}
            {#if updateInfo.updateAvailable}
              <div class="p-3 bg-accent-subtle border border-accent/20 rounded-md mb-3">
                <p class="font-semibold text-text">{en.settings.updateBanner.replace('{version}', updateInfo.latestVersion)}</p>
                {#if updateInfo.publishedAt}
                  <p class="text-xs text-text-muted mt-1">Released {formatReleaseDate(updateInfo.publishedAt)}</p>
                {/if}
              </div>

              {#if updateInfo.changelog}
                <div class="p-3 bg-base border border-border-subtle rounded-md text-sm max-h-64 overflow-auto mb-3">
                  {@html renderMarkdown(updateInfo.changelog)}
                </div>
              {/if}

              {#if applyResult?.started}
                <p class="text-sm text-primary font-medium">{en.settings.updateStarted}</p>
              {:else if applyResult && !applyResult.started}
                <p class="text-sm text-text-muted mb-2">{en.settings.updateRunManually}</p>
                <div class="flex items-center gap-2 p-2 bg-base border border-border-subtle rounded-md">
                  <code class="flex-1 text-xs font-mono text-text-muted overflow-x-auto">{updateInfo.updateCommand}</code>
                  <Button variant="ghost" size="sm" onclick={copyUpdateCommand}>
                    {cmdCopied ? 'Copied' : 'Copy'}
                  </Button>
                </div>
              {:else}
                <div class="flex items-center gap-3 flex-wrap">
                  <Button onclick={applyUpdate} disabled={applying}>{en.settings.updateNow}</Button>
                  <Button variant="secondary" onclick={copyUpdateCommand}>{cmdCopied ? 'Copied' : 'Copy command'}</Button>
                </div>
              {/if}
            {:else}
              <p class="flex items-center gap-2 text-sm text-primary font-medium">
                <Icon name="check" size={16} />
                Up to date
              </p>
            {/if}
          {:else}
            <p class="text-sm text-text-muted">Up to date</p>
          {/if}
        </div>

        <div class="p-5 bg-surface border border-border rounded-lg flex flex-wrap gap-4">
          <a class="inline-flex items-center gap-2 text-sm text-text hover:text-accent-text transition-colors" href={DOCS_URL} target="_blank" rel="noreferrer">
            Documentation <Icon name="external-link" size={14} />
          </a>
          <a class="inline-flex items-center gap-2 text-sm text-text hover:text-accent-text transition-colors" href={GITHUB_URL} target="_blank" rel="noreferrer">
            GitHub <Icon name="external-link" size={14} />
          </a>
          <a class="inline-flex items-center gap-2 text-sm text-text hover:text-accent-text transition-colors" href={DISCORD_URL} target="_blank" rel="noreferrer">
            Discord <Icon name="external-link" size={14} />
          </a>
        </div>

        {#if tabErrors.about}
          <p class="text-sm text-red-400">{tabErrors.about}</p>
        {/if}
      </div>
    {/if}
  </div>
</div>
