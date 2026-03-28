<script lang="ts">
import { goto } from '$app/navigation';
import { onMount } from 'svelte';
import { Badge, Button, Card, Input, Select, Tabs, Tooltip, icons } from '@phavo/ui';
import en from '$lib/i18n/en.json';
import ImportExportTab from '$lib/components/settings/ImportExportTab.svelte';
import LicenceTab from '$lib/components/settings/LicenceTab.svelte';
import WidgetsTab from '$lib/components/settings/WidgetsTab.svelte';
import { setConfig, updateConfig } from '$lib/stores/config.svelte';
import { fetchWithCsrf } from '$lib/utils/api';

type TabId = 'general' | 'account' | 'security' | 'widgets' | 'license' | 'import-export' | 'about';
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
  authMode: 'phavo-io' | 'local';
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

const settingsTabs = [
  { id: 'general', label: en.settings.general },
  { id: 'account', label: en.settings.account },
  { id: 'security', label: en.settings.security },
  { id: 'widgets', label: en.settings.widgetsTab },
  { id: 'license', label: en.settings.license },
  { id: 'import-export', label: en.settings.importExport },
  { id: 'about', label: en.settings.about },
] satisfies Array<{ id: TabId; label: string }>;

const sessionTimeoutOptions = [
  { value: '1d', label: en.settings.sessionTimeout1d },
  { value: '7d', label: en.settings.sessionTimeout7d },
  { value: '30d', label: en.settings.sessionTimeout30d },
  { value: 'never', label: en.settings.sessionTimeoutNever },
];

const DOCS_URL = 'https://docs.phavo.net';
const GITHUB_URL = 'https://github.com/phabioo/phavo';
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
  account: 'idle',
  security: 'idle',
  widgets: 'idle',
  license: 'idle',
  'import-export': 'idle',
  about: 'idle',
});
let tabErrors = $state<Record<TabId, string>>({
  general: '',
  account: '',
  security: '',
  widgets: '',
  license: '',
  'import-export': '',
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
  if (activeTab === 'account') return !!accountDirty && !!accountValid;
  if (activeTab === 'security') return securityDirty;
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
      data?: {
        searchEngine: string;
        customSearchUrl: string;
        ollamaUrl: string;
        ollamaModel: string;
        hasOpenaiKey: boolean;
        hasAnthropicKey: boolean;
      };
    };
    if (json.ok && json.data) {
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
    // Update the initial state so dirty check resets
    aiInitial = {
      searchEngine,
      customSearchUrl: customSearchUrl.trim(),
      ollamaUrl: ollamaUrl.trim(),
      ollamaModel: ollamaModel.trim(),
      openaiKey: openaiKey === '••••••••' ? openaiKey : (openaiKey ? '••••••••' : ''),
      anthropicKey: anthropicKey === '••••••••' ? anthropicKey : (anthropicKey ? '••••••••' : ''),
    };
    if (openaiKey && openaiKey !== '••••••••') openaiKey = '••••••••';
    if (anthropicKey && anthropicKey !== '••••••••') anthropicKey = '••••••••';
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
  saveStates = { ...saveStates, security: 'saving' };
  tabErrors = { ...tabErrors, security: '' };
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
    setSavedState('security');
  } catch (error) {
    tabErrors = {
      ...tabErrors,
      security: error instanceof Error ? error.message : en.settings.saveFailed,
    };
    saveStates = { ...saveStates, security: 'idle' };
  }
}

async function saveCurrentTab() {
  if (activeTab === 'general') return saveGeneral();
  if (activeTab === 'account') return saveAccount();
  if (activeTab === 'security') return saveSecurity();
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
    tabErrors = { ...tabErrors, security: json.error ?? en.settings.saveFailed };
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

<div class="settings-page">
  <h1 class="settings-title">{en.settings.title}</h1>

  <Tabs tabs={settingsTabs} bind:activeTab />

  {#if loadError}
    <p class="settings-error">{loadError}</p>
  {/if}

  <div class="settings-content">
    {#if activeTab === 'general'}
      <Card padding="none">
        <div class="settings-card-content">
          <div class="setting-group">
            <Input label={en.settings.dashboardName} bind:value={dashboardName} />
          </div>

          <div class="setting-group location-group">
            <Input
              label={en.settings.weatherLocation}
              placeholder={en.settings.weatherLocationPlaceholder}
              bind:value={locationName}
              oninput={onLocationInput}
            />
            <p class="setting-description">{en.settings.weatherLocationHint}</p>
            {#if showSuggestions}
              <ul class="suggestions" role="listbox">
                {#if suggestions.length === 0 && !geocoding}
                  <li class="suggestion-empty">{en.settings.locationSuggestionsEmpty}</li>
                {:else}
                  {#each suggestions as result (result.id)}
                    <li role="option" aria-selected="false">
                      <button class="suggestion-btn" type="button" onclick={() => selectSuggestion(result)}>
                        {result.name}, {result.country}
                      </button>
                    </li>
                  {/each}
                {/if}
              </ul>
            {/if}
          </div>

          <div class="setting-group rerun-group">
            <button class="btn-secondary" type="button" onclick={reRunSetup}>{en.settings.reRunSetup}</button>
          </div>
        </div>
      </Card>

      <Card padding="none">
        <div class="settings-card-content">
          <h3 class="settings-section-heading">Search & AI</h3>

          <div class="setting-group">
            <Select label="Search Engine" options={searchEngineOptions} bind:value={searchEngine} />
            {#if searchEngine === 'custom'}
              <div class="stack-sm" style="margin-top: var(--space-2)">
                <Input
                  label="Custom Search URL"
                  placeholder="https://example.com/search?q=&#123;query&#125;"
                  bind:value={customSearchUrl}
                />
                <p class="setting-description">Use <code>{'{query}'}</code> as a placeholder for the search term.</p>
              </div>
            {/if}
          </div>

          <div class="setting-group">
            <div class="setting-row">
              <Input
                label="Ollama URL"
                placeholder="http://localhost:11434"
                bind:value={ollamaUrl}
              />
              <div class="test-btn-wrap">
                <button class="btn-secondary" type="button" onclick={testOllamaConnection} disabled={!ollamaUrl.trim() || ollamaTestResult === 'testing'}>
                  {ollamaTestResult === 'testing' ? 'Testing…' : ollamaTestResult === 'ok' ? 'Connected' : ollamaTestResult === 'fail' ? 'Failed' : 'Test'}
                </button>
              </div>
            </div>
            <Input
              label="Ollama Model"
              placeholder="llama3.2"
              bind:value={ollamaModel}
            />
            <p class="setting-description">Leave empty to use the default model (llama3.2).</p>
          </div>

          <div class="setting-group">
            <Input
              label="OpenAI API Key"
              type="password"
              placeholder="sk-…"
              bind:value={openaiKey}
            />
          </div>

          <div class="setting-group">
            <Input
              label="Anthropic API Key"
              type="password"
              placeholder="sk-ant-…"
              bind:value={anthropicKey}
            />
          </div>
        </div>
      </Card>

      <Card padding="none">
        <div class="settings-card-content">
          {#if tabErrors.general}
            <p class="tab-error">{tabErrors.general}</p>
          {/if}

          <div class="tab-save-row">
            <Button onclick={saveCurrentTab} disabled={!canSaveCurrentTab || saveStates.general === 'saving'}>
              {currentSaveLabel}
            </Button>
          </div>
        </div>
      </Card>

    {:else if activeTab === 'account'}
      <Card padding="none">
        <div class="settings-card-content">
          <div class="setting-group setting-grid">
            <div>
              <span class="setting-label">{en.settings.authMode}</span>
              <p>
                {#if sessionInfo}
                  {sessionInfo.authMode === 'phavo-io' ? en.settings.authModePhavoIo : en.settings.authModeLocal}
                {:else}
                  —
                {/if}
              </p>
            </div>
            <div>
              <span class="setting-label">{en.settings.emailAddress}</span>
              <p>{sessionInfo?.email ?? '—'}</p>
            </div>
            <div>
              <span class="setting-label">{en.settings.tier}</span>
              <Badge variant={tierVariant(sessionInfo?.tier ?? aboutInfo.tier)}>
                {tierLabel(sessionInfo?.tier ?? aboutInfo.tier)}
              </Badge>
            </div>
          </div>

          {#if sessionInfo?.authMode === 'phavo-io'}
            <div class="setting-group">
              <a class="external-link" href={PHAVO_ACCOUNT_URL} target="_blank" rel="noreferrer">
                <span>{en.settings.manageAccount}</span>
                <span class="external-icon">{@html icons.external()}</span>
              </a>
            </div>
          {/if}

          {#if canChangePassword}
            <div class="setting-group">
              <h3>{en.settings.changePassword}</h3>
              <div class="stack-sm">
                <Input label={en.settings.newPassword} type="password" bind:value={newPassword} />
                <Input label={en.settings.confirmPassword} type="password" bind:value={confirmPassword} />
              </div>
              {#if passwordError}
                <p class="tab-error">{passwordError}</p>
              {/if}
            </div>
          {/if}

          {#if tabErrors.account}
            <p class="tab-error">{tabErrors.account}</p>
          {/if}
        </div>
      </Card>

    {:else if activeTab === 'security'}
      <Card padding="none">
        <div class="settings-card-content">
          <div class="setting-group setting-grid security-row">
            <div>
              <span class="setting-label">{en.settings.twoFactorStatus}</span>
              <p>{en.settings.twoFactorNotConfigured}</p>
            </div>
            <Tooltip text={en.settings.comingSoon}>
              <span>
                <button class="btn-secondary" type="button">{en.settings.enable2FA}</button>
              </span>
            </Tooltip>
          </div>

          <div class="setting-group">
            <Select label={en.settings.sessionTimeout} options={sessionTimeoutOptions} bind:value={sessionTimeout} />
          </div>

          <div class="setting-group">
            <h3>{en.settings.activeSessions}</h3>
            <div class="session-item">
              <div>
                <p class="session-title">{en.settings.currentSession}</p>
                <p class="setting-description">{en.settings.signedInAt}: {formatTimestamp(sessionInfo?.validatedAt)}</p>
              </div>
              <button class="btn-secondary" type="button" onclick={signOutAllSessions}>{en.settings.signOutAllSessions}</button>
            </div>
          </div>

          {#if tabErrors.security}
            <p class="tab-error">{tabErrors.security}</p>
          {/if}

          <div class="tab-save-row">
            <Button onclick={saveCurrentTab} disabled={!canSaveCurrentTab || saveStates.security === 'saving'}>
              {currentSaveLabel}
            </Button>
          </div>
        </div>
      </Card>

    {:else if activeTab === 'widgets'}
      <WidgetsTab />

    {:else if activeTab === 'license'}
      <LicenceTab
        tier={sessionInfo?.tier ?? aboutInfo.tier}
        authMode={sessionInfo?.authMode ?? null}
        licenseKeyMasked={aboutInfo.licenseKeyMasked}
        manageUrl={PHAVO_LICENSE_URL}
      />

    {:else if activeTab === 'import-export'}
      <ImportExportTab />

    {:else if activeTab === 'about'}
      <Card padding="none">
        <div class="settings-card-content">

          <div class="setting-group about-version-row">
            <div>
              <div class="about-label">{en.settings.currentVersion}</div>
              <div class="about-version mono">v{aboutInfo.version}</div>
            </div>
            <button
              class="btn-secondary about-update-btn"
              type="button"
              onclick={checkForUpdates}
              disabled={checkingUpdates}
            >
              {checkingUpdates ? en.settings.checkingForUpdates : en.settings.checkForUpdates}
            </button>
          </div>

          <div class="setting-group">
            {#if updateInfo !== null}
              {#if updateInfo.updateAvailable}
                <div class="update-banner">
                  <span class="update-banner-title">
                    {en.settings.updateBanner.replace('{version}', updateInfo.latestVersion)}
                  </span>
                  {#if updateInfo.publishedAt}
                    <span class="update-banner-date">
                      {en.settings.releasedOn} {formatReleaseDate(updateInfo.publishedAt)}
                    </span>
                  {/if}
                </div>

                {#if updateInfo.changelog}
                  <div class="changelog-panel">
                    {@html renderMarkdown(updateInfo.changelog)}
                  </div>
                {/if}

                {#if applyResult?.started}
                  <p class="update-started">{en.settings.updateStarted}</p>
                {:else if applyResult && !applyResult.started}
                  <p class="setting-description">{en.settings.updateRunManually}</p>
                  <div class="command-box">
                    <code class="mono command-text">{updateInfo.updateCommand}</code>
                    <Button variant="ghost" size="sm" onclick={copyUpdateCommand}>
                      {cmdCopied ? en.settings.copied : en.settings.copyUpdateCommand}
                    </Button>
                  </div>
                {:else}
                  <div class="update-actions-row">
                    <Button onclick={applyUpdate} disabled={applying}>
                      {en.settings.updateNow}
                    </Button>
                    <Button variant="secondary" onclick={copyUpdateCommand}>
                      {cmdCopied ? en.settings.copied : en.settings.copyUpdateCommand}
                    </Button>
                  </div>
                {/if}
              {:else}
                <p class="update-ok">
                  <span class="update-ok-icon">{@html icons.check()}</span>
                  {en.settings.upToDate}
                </p>
              {/if}
            {:else}
              <p class="setting-description">{en.settings.upToDate}</p>
            {/if}
          </div>

          <div class="setting-group links-row">
            <a class="external-link" href={DOCS_URL} target="_blank" rel="noreferrer">
              <span>{en.settings.documentation}</span>
              <span class="external-icon">{@html icons.external()}</span>
            </a>
            <a class="external-link" href={GITHUB_URL} target="_blank" rel="noreferrer">
              <span>{en.settings.github}</span>
              <span class="external-icon">{@html icons.external()}</span>
            </a>
            <a class="external-link" href={DISCORD_URL} target="_blank" rel="noreferrer">
              <span>{en.settings.discord}</span>
              <span class="external-icon">{@html icons.external()}</span>
            </a>
          </div>

          {#if tabErrors.about}
            <p class="tab-error">{tabErrors.about}</p>
          {/if}
        </div>
      </Card>
    {/if}
  </div>
</div>

<style>
  .settings-page {
    display: flex;
    flex-direction: column;
    gap: var(--space-6);
    max-width: 860px;
    margin: 0 auto;
    padding: var(--space-6);
    width: 100%;
  }

  .settings-title {
    font-size: 24px;
    font-weight: 700;
    color: var(--color-text-primary);
  }

  .settings-content {
    min-width: 0;
  }

  .settings-card-content {
    padding: var(--space-4) var(--space-6);
  }

  .setting-group {
    padding: var(--space-4) 0;
    border-bottom: 1px solid var(--color-border-subtle);
  }

  .setting-group:first-child {
    padding-top: 0;
  }

  .setting-group:last-of-type {
    border-bottom: none;
  }

  .setting-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: var(--space-4);
    align-items: start;
  }

  .setting-label {
    display: block;
    font-size: 13px;
    font-weight: 500;
    color: var(--color-text-secondary);
    margin-bottom: var(--space-1);
  }

  .setting-description {
    font-size: 13px;
    color: var(--color-text-secondary);
    margin-top: var(--space-2);
  }

  .tab-save-row {
    display: flex;
    justify-content: flex-end;
    padding-top: var(--space-4);
  }

  .settings-error,
  .tab-error {
    color: var(--color-danger);
    font-size: 13px;
  }

  .location-group {
    position: relative;
  }

  .suggestions {
    list-style: none;
    margin: var(--space-2) 0 0;
    padding: var(--space-1);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    background: var(--color-bg-elevated);
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .suggestion-btn {
    width: 100%;
    text-align: left;
    padding: var(--space-2) var(--space-3);
    background: transparent;
    border: none;
    border-radius: var(--radius-sm);
    color: var(--color-text-primary);
    cursor: pointer;
  }

  .suggestion-btn:hover {
    background: var(--color-bg-hover);
  }

  .suggestion-empty {
    padding: var(--space-2) var(--space-3);
    color: var(--color-text-secondary);
    font-size: 13px;
  }

  .rerun-group {
    display: flex;
    justify-content: flex-start;
  }

  .stack-sm {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .security-row {
    align-items: center;
  }

  .session-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-4);
  }

  .session-title {
    font-weight: 600;
    color: var(--color-text-primary);
  }

  .about-version-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-4);
  }

  .about-label {
    display: block;
    font-size: 13px;
    font-weight: 500;
    color: var(--color-text-secondary);
    margin-bottom: var(--space-1);
  }

  .about-version {
    color: var(--color-text-primary);
  }

  .about-update-btn {
    flex-shrink: 0;
  }

  .update-banner {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    padding: var(--space-3) var(--space-4);
    border-radius: var(--radius-sm);
    background: var(--color-accent-subtle);
    border: 1px solid var(--color-accent-border);
    margin-bottom: var(--space-3);
  }

  .update-banner-title {
    font-weight: 600;
    color: var(--color-text-primary);
  }

  .update-banner-date {
    font-size: 12px;
    color: var(--color-text-muted);
  }

  .changelog-panel {
    margin-top: var(--space-1);
    margin-bottom: var(--space-3);
    padding: var(--space-3);
    border-radius: var(--radius-sm);
    border: 1px solid var(--color-border-subtle);
    background: var(--color-bg-base);
    font-size: 13px;
    max-height: 260px;
    overflow: auto;
  }

  .changelog-panel :global(h1),
  .changelog-panel :global(h2),
  .changelog-panel :global(h3) {
    font-size: 13px;
    font-weight: 600;
    margin: var(--space-2) 0 var(--space-1);
    color: var(--color-text-primary);
  }

  .changelog-panel :global(ul) {
    padding-left: var(--space-4);
    margin: var(--space-1) 0;
  }

  .changelog-panel :global(li) {
    margin-bottom: var(--space-1);
    color: var(--color-text-secondary);
  }

  .changelog-panel :global(p) {
    margin: var(--space-1) 0;
    color: var(--color-text-secondary);
  }

  .changelog-panel :global(code) {
    font-family: var(--font-mono, monospace);
    font-size: 12px;
    background: var(--color-bg-elevated);
    padding: 1px 4px;
    border-radius: 3px;
  }

  .update-actions-row {
    display: flex;
    gap: var(--space-3);
    flex-wrap: wrap;
    align-items: center;
  }

  .command-box {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-2) var(--space-3);
    border-radius: var(--radius-sm);
    border: 1px solid var(--color-border-subtle);
    background: var(--color-bg-base);
    margin-top: var(--space-2);
  }

  .command-text {
    flex: 1;
    font-size: 12px;
    color: var(--color-text-secondary);
    overflow-x: auto;
  }

  .update-ok {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    color: var(--color-success);
    font-weight: 500;
  }

  .update-ok-icon {
    display: flex;
    width: 16px;
    height: 16px;
    flex-shrink: 0;
  }

  .update-started {
    color: var(--color-success);
    font-weight: 500;
    margin-top: var(--space-2);
  }

  .links-row {
    display: flex;
    gap: var(--space-4);
    flex-wrap: wrap;
  }

  .external-link {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    color: var(--color-text-primary);
    text-decoration: none;
  }

  .external-link:hover {
    color: var(--color-accent-text);
  }

  .external-icon {
    display: inline-flex;
    color: var(--color-text-secondary);
  }

  .settings-section-heading {
    font-size: 15px;
    font-weight: 600;
    color: var(--color-text-primary);
    padding-bottom: var(--space-3);
    border-bottom: 1px solid var(--color-border-subtle);
    margin-bottom: var(--space-2);
  }

  .setting-row {
    display: flex;
    align-items: flex-end;
    gap: var(--space-3);
  }

  .setting-row :global(.input-wrapper) {
    flex: 1;
  }

  .test-btn-wrap {
    flex-shrink: 0;
    padding-bottom: 2px;
  }

  .settings-content > :global(.card) + :global(.card) {
    margin-top: var(--space-4);
  }

  .btn-secondary {
    padding: 6px 14px;
    background: transparent;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    color: var(--color-text-primary);
    font-family: var(--font-ui);
    font-size: 13px;
    cursor: pointer;
    transition: border-color 0.15s, background 0.15s;
    white-space: nowrap;
  }

  .btn-secondary:hover {
    border-color: var(--color-text-muted);
    background: var(--color-bg-elevated);
  }

  .btn-secondary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  @media (max-width: 639px) {
    .settings-page {
      padding: var(--space-3);
      gap: var(--space-4);
    }

    .settings-card-content {
      padding: var(--space-3);
    }

    .setting-grid {
      grid-template-columns: 1fr;
    }

    .session-item {
      flex-direction: column;
      align-items: flex-start;
    }

    .about-version-row {
      align-items: flex-start;
      flex-direction: column;
    }

    /* Tabs: horizontal scroll on mobile (7 tabs too many to stack cleanly) */
    :global(.tabs) {
      overflow-x: auto;
      padding: 0 var(--space-3);
      scrollbar-width: none;
    }

    :global(.tabs::-webkit-scrollbar) {
      display: none;
    }

    :global(.tab) {
      white-space: nowrap;
      flex-shrink: 0;
      min-height: 44px;
    }
  }
</style>
