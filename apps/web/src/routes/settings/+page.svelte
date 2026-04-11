<script lang="ts">
import { goto } from '$app/navigation';
import { page } from '$app/state';
import { onMount } from 'svelte';
import { fade } from 'svelte/transition';
  import { Badge, Button, Icon, Input, Select, Tooltip } from '@phavo/ui';
import en from '$lib/i18n/en.json';
import ImportExportTab from '$lib/components/settings/ImportExportTab.svelte';
import LicenceTab from '$lib/components/settings/LicenceTab.svelte';
import SettingsLayout from '$lib/components/settings/SettingsLayout.svelte';
import WidgetsTab from '$lib/components/settings/WidgetsTab.svelte';
import type { AiStatusResponseData } from '$lib/stores/ai.svelte';
import { updateAiStatusFromPayload } from '$lib/stores/ai.svelte';
import { setConfig, updateConfig } from '$lib/stores/config.svelte';
import { fetchWithCsrf } from '$lib/utils/api';

type TabId = 'general' | 'widgets' | 'import-export' | 'license' | 'account' | 'ai' | 'plugins' | 'about';
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
  tier: 'stellar' | 'celestial';
  authMode: 'local';
  validatedAt: number;
  email: string | null;
} | null;
type AboutInfo = {
  version: string;
  tier: 'stellar' | 'celestial';
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
  openaiModel: string;
  anthropicModel: string;
  googleModel: string;
  customAiUrl: string;
  customModel: string;
  hasOpenaiKey: boolean;
  hasAnthropicKey: boolean;
  hasGoogleKey: boolean;
  hasCustomKey: boolean;
};

const settingsTabs: Array<{ id: TabId; label: string; icon: string; statusLabel: string; status: 'active' | 'inactive' | 'warning' | 'error'; celestialOnly?: boolean }> = [
  { id: 'general', label: 'General', icon: 'settings-2', statusLabel: 'Configured', status: 'active' },
  { id: 'widgets', label: 'Widgets', icon: 'puzzle', statusLabel: 'Active', status: 'active' },
  { id: 'import-export', label: 'Backup & Export', icon: 'archive', statusLabel: 'Ready', status: 'active' },
  { id: 'license', label: 'Licence', icon: 'shield-check', statusLabel: 'Active', status: 'active' },
  { id: 'account', label: 'Account', icon: 'user', statusLabel: 'Secured', status: 'active' },
  { id: 'ai', label: 'AI', icon: 'sparkles', statusLabel: 'Not configured', status: 'inactive', celestialOnly: true },
  { id: 'plugins', label: 'Plugins', icon: 'plug', statusLabel: 'Coming soon', status: 'inactive' },
  { id: 'about', label: 'About', icon: 'info', statusLabel: 'Up to date', status: 'active' },
];

const tabMeta: Record<TabId, { title: string; description: string }> = {
  general: {
    title: 'General',
    description: 'Update your dashboard identity, location, and search defaults.',
  },
  widgets: {
    title: 'Widgets',
    description: 'Review live previews, configure installed widgets, and keep every board component ready.',
  },
  'import-export': {
    title: 'Backup & Export',
    description: 'Create portable backups, restore previous exports, and manage credential-protected bundles.',
  },
  license: {
    title: 'Licence',
    description: 'Check the active tier on this installation and manage licence activation where applicable.',
  },
  account: {
    title: 'Account',
    description: 'Manage session security, local password changes, and account details for this dashboard.',
  },
  ai: {
    title: 'AI',
    description: 'Configure an AI provider to enable natural language search and dashboard assistance.',
  },
  plugins: {
    title: 'Plugins',
    description: 'Track the plugin pipeline and prepare for first-party or uploaded widget extensions.',
  },
  about: {
    title: 'About',
    description: 'See version details, update status, and the core PHAVO resources for this install.',
  },
};

const sessionTimeoutOptions = [
  { value: '1d', label: en.settings.sessionTimeout1d },
  { value: '7d', label: en.settings.sessionTimeout7d },
  { value: '30d', label: en.settings.sessionTimeout30d },
  { value: 'never', label: en.settings.sessionTimeoutNever },
];

const DOCS_URL = 'https://docs.phavo.net';
const GITHUB_URL = 'https://github.com/getphavo/phavo';
const dashboardNameInputId = 'settings-dashboard-name';
const weatherLocationInputId = 'settings-weather-location';
const searchEngineSelectId = 'settings-search-engine';
const customSearchUrlInputId = 'settings-custom-search-url';
const ollamaUrlInputId = 'settings-ollama-url';
const ollamaModelInputId = 'settings-ollama-model';
const openAiKeyInputId = 'settings-openai-key';
const anthropicKeyInputId = 'settings-anthropic-key';
const newPasswordInputId = 'settings-new-password';
const confirmPasswordInputId = 'settings-confirm-password';
const sessionTimeoutSelectId = 'settings-session-timeout';

const validTabs = new Set<TabId>(['general', 'widgets', 'import-export', 'license', 'account', 'ai', 'plugins', 'about']);
const activeTab = $derived.by(() => {
  const tab = page.url.searchParams.get('tab') as TabId | null;
  return tab && validTabs.has(tab) ? tab : 'general';
});
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
let aboutInfo = $state<AboutInfo>({ version: '0.8.0', tier: 'stellar', licenseKeyMasked: null });
let updateInfo = $state<UpdateInfo | null>(null);
let checkingUpdates = $state(false);
let applying = $state(false);
let applyResult = $state<{ started: boolean; reason?: string } | null>(null);
let cmdCopied = $state(false);

let newPassword = $state('');
let confirmPassword = $state('');
let passwordError = $state('');

// ─── Search & AI ──────────────────────────────────────────────────────
import type { AiProvider } from '$lib/stores/ai.svelte';
const searchEngineOptions = [
  { value: 'duckduckgo', label: 'DuckDuckGo' },
  { value: 'google', label: 'Google' },
  { value: 'brave', label: 'Brave Search' },
  { value: 'custom', label: 'Custom' },
];
let searchEngine = $state('duckduckgo');
let customSearchUrl = $state('');
let aiProvider = $state<AiProvider>(null);
let ollamaUrl = $state('');
let ollamaModel = $state('');
let openaiKey = $state('');
let openaiModel = $state('');
let anthropicKey = $state('');
let anthropicModel = $state('');
let googleKey = $state('');
let googleModel = $state('');
let customAiUrl = $state('');
let customKey = $state('');
let customModel = $state('');
let ollamaTestResult = $state<'idle' | 'testing' | 'ok' | 'fail' | 'empty'>('idle');
let aiSettingsLoaded = $state(false);

let aiInitial = $state({
  searchEngine: 'duckduckgo',
  customSearchUrl: '',
  aiProvider: null as AiProvider,
  ollamaUrl: '',
  ollamaModel: '',
  openaiKey: '',
  openaiModel: '',
  anthropicKey: '',
  anthropicModel: '',
  googleKey: '',
  googleModel: '',
  customAiUrl: '',
  customKey: '',
  customModel: '',
});

const searchDirty = $derived(
  searchEngine !== aiInitial.searchEngine ||
    customSearchUrl.trim() !== aiInitial.customSearchUrl,
);

const aiDirty = $derived(
  aiProvider !== aiInitial.aiProvider ||
    ollamaUrl.trim() !== aiInitial.ollamaUrl ||
    ollamaModel.trim() !== aiInitial.ollamaModel ||
    openaiKey !== aiInitial.openaiKey ||
    openaiModel.trim() !== aiInitial.openaiModel ||
    anthropicKey !== aiInitial.anthropicKey ||
    anthropicModel.trim() !== aiInitial.anthropicModel ||
    googleKey !== aiInitial.googleKey ||
    googleModel.trim() !== aiInitial.googleModel ||
    customAiUrl.trim() !== aiInitial.customAiUrl ||
    customKey !== aiInitial.customKey ||
    customModel.trim() !== aiInitial.customModel,
);

function providerDisplayName(p: string) {
  const names: Record<string, string> = {
    ollama: 'Ollama', openai: 'OpenAI',
    anthropic: 'Anthropic', google: 'Google Gemini',
    custom: 'Custom Provider',
  };
  return names[p] ?? p;
}

// String proxy for aiProvider in Select (null ↔ empty string)
let aiProviderString = $state('');

function onAiProviderChange(v: string) {
  const validProviders = ['ollama', 'openai', 'anthropic', 'google', 'custom'];
  aiProvider = validProviders.includes(v) ? v as AiProvider : null;
  aiProviderString = v;
}

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
  widgets: 'idle',
  license: 'idle',
  'import-export': 'idle',
  ai: 'idle',
  plugins: 'idle',
  about: 'idle',
});
let tabErrors = $state<Record<TabId, string>>({
  general: '',
  account: '',
  widgets: '',
  license: '',
  'import-export': '',
  ai: '',
  plugins: '',
  about: '',
});

const generalDirty = $derived(
  dashboardName.trim() !== generalInitial.dashboardName ||
    locationName.trim() !== generalInitial.locationName ||
    locationLatitude !== generalInitial.locationLatitude ||
    locationLongitude !== generalInitial.locationLongitude ||
    searchDirty,
);
const securityDirty = $derived(sessionTimeout !== securityInitial);
const canChangePassword = $derived(sessionInfo?.authMode === 'local');
const accountDirty = $derived(canChangePassword && (newPassword.length > 0 || confirmPassword.length > 0));
const accountValid = $derived(
  !canChangePassword ||
    (newPassword.length >= 8 && confirmPassword.length >= 8 && newPassword === confirmPassword),
);
const canSaveCurrentTab = $derived.by(() => {
  if (loading) return false;
  if (activeTab === 'general') return generalDirty;
  if (activeTab === 'account') return (!!accountDirty && !!accountValid) || securityDirty;
  if (activeTab === 'ai') return aiDirty;
  return false;
});
const currentSaveLabel = $derived(
  saveStates[activeTab] === 'saved' ? en.settings.saved : en.settings.saveChanges,
);
const activeTabMeta = $derived(tabMeta[activeTab]);

let didLoad = false;
onMount(() => {
  if (!didLoad) {
    didLoad = true;
    void loadSettings();
  }

  return () => {};
});

onMount(() => {
  $effect.root(() => {
    $effect(() => {
      if (activeTab === 'about' && !updateInfo && !checkingUpdates) {
        void checkForUpdates();
      }
    });
  });
});

function tierVariant(tier: 'stellar' | 'celestial') {
  if (tier === 'celestial') return 'accent';
  return 'default';
}

function tierLabel(tier: 'stellar' | 'celestial') {
  if (tier === 'celestial') return en.settings.tierStandard;
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
      aiProvider = (json.data.aiProvider ?? null) as AiProvider;
      aiProviderString = aiProvider ?? '';
      ollamaUrl = json.data.ollamaUrl || '';
      ollamaModel = json.data.ollamaModel || '';
      openaiKey = json.data.hasOpenaiKey ? '••••••••' : '';
      openaiModel = json.data.openaiModel || '';
      anthropicKey = json.data.hasAnthropicKey ? '••••••••' : '';
      anthropicModel = json.data.anthropicModel || '';
      googleKey = json.data.hasGoogleKey ? '••••••••' : '';
      googleModel = json.data.googleModel || '';
      customAiUrl = json.data.customAiUrl || '';
      customKey = json.data.hasCustomKey ? '••••••••' : '';
      customModel = json.data.customModel || '';
      aiInitial = {
        searchEngine,
        customSearchUrl,
        aiProvider,
        ollamaUrl,
        ollamaModel,
        openaiKey,
        openaiModel,
        anthropicKey,
        anthropicModel,
        googleKey,
        googleModel,
        customAiUrl,
        customKey,
        customModel,
      };
      aiSettingsLoaded = true;
    }
  } catch {
    // AI settings are optional — silently ignore
  }
}

async function saveAiSettings() {
  try {
    const payload: Record<string, string | null> = {
      aiProvider: aiProvider,
      searchEngine,
      customSearchUrl: customSearchUrl.trim(),
      ollamaUrl: ollamaUrl.trim(),
      ollamaModel: ollamaModel.trim(),
      openaiModel: openaiModel.trim(),
      anthropicModel: anthropicModel.trim(),
      googleModel: googleModel.trim(),
      customUrl: customAiUrl.trim(),
      customModel: customModel.trim(),
    };
    // Only send keys if they were actually changed (not the mask)
    if (openaiKey && openaiKey !== '••••••••') {
      payload.openaiKey = openaiKey;
    }
    if (anthropicKey && anthropicKey !== '••••••••') {
      payload.anthropicKey = anthropicKey;
    }
    if (googleKey && googleKey !== '••••••••') {
      payload.googleKey = googleKey;
    }
    if (customKey && customKey !== '••••••••') {
      payload.customKey = customKey;
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
  if (!ollamaUrl.trim()) {
    ollamaTestResult = 'empty';
    setTimeout(() => (ollamaTestResult = 'idle'), 3000);
    return;
  }
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

    // Also save search engine settings if changed
    if (searchDirty) {
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
  if (activeTab === 'ai') return saveAiTab();
}

async function saveAiTab() {
  saveStates = { ...saveStates, ai: 'saving' };
  tabErrors = { ...tabErrors, ai: '' };
  try {
    await saveAiSettings();
    setSavedState('ai');
  } catch (error) {
    tabErrors = {
      ...tabErrors,
      ai: error instanceof Error ? error.message : 'Failed to save AI settings',
    };
    saveStates = { ...saveStates, ai: 'idle' };
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

<SettingsLayout title={activeTabMeta.title} subtitle={activeTabMeta.description}>
  {#if loadError}
    <div class="settings-alert settings-alert-danger">{loadError}</div>
  {/if}

  {#key activeTab}
  <div class="settings-tab-content" in:fade={{ duration: 150 }}>
  {#if activeTab === 'general'}
    <div class="settings-cards-grid">
    <div class="settings-hero-card settings-card-full">
      <span class="settings-card-label">DASHBOARD</span>
      <h2 class="settings-hero-value">{dashboardName || 'My Dashboard'}</h2>
      <p class="settings-hero-sub">{locationName || 'No location set'}</p>
    </div>

    <div class="settings-form-card">
      <h3 class="settings-form-title">Configuration</h3>
      <div class="settings-form-fields">
        <div>
          <label class="settings-field-label" for={dashboardNameInputId}>Dashboard Name</label>
          <Input id={dashboardNameInputId} bind:value={dashboardName} />
        </div>

        <div>
          <label class="settings-field-label" for={weatherLocationInputId}>Weather Location</label>
          <div class="settings-location-wrap">
            <Input
              id={weatherLocationInputId}
              placeholder="Search for a city…"
              bind:value={locationName}
              oninput={onLocationInput}
            />
            {#if showSuggestions}
              <ul class="settings-suggestions" role="listbox">
                {#if suggestions.length === 0 && !geocoding}
                  <li class="settings-suggestion-empty">No results</li>
                {:else}
                  {#each suggestions as result (result.id)}
                    <li role="option" aria-selected="false">
                      <button class="settings-suggestion-btn" type="button" onclick={() => selectSuggestion(result)}>
                        {result.name}, {result.country}
                      </button>
                    </li>
                  {/each}
                {/if}
              </ul>
            {/if}
          </div>
          <p class="settings-field-hint">Used for weather widget display.</p>
        </div>

        <div>
          <label class="settings-field-label" for={searchEngineSelectId}>Search Engine</label>
          <Select id={searchEngineSelectId} options={searchEngineOptions} bind:value={searchEngine} />
        </div>
        {#if searchEngine === 'custom'}
          <div>
            <label class="settings-field-label" for={customSearchUrlInputId}>Custom Search URL</label>
            <Input
              id={customSearchUrlInputId}
              placeholder="https://example.com/search?q=&#123;query&#125;"
              bind:value={customSearchUrl}
            />
          </div>
        {/if}
      </div>
    </div>

    <div class="settings-form-card">
      <h3 class="settings-form-title">Setup Tools</h3>
      <p class="settings-hero-sub" style="color: var(--color-on-surface-variant);">
        Re-open guided setup to rebuild the onboarding baseline.
      </p>
      <Button variant="secondary" onclick={reRunSetup}>Re-run Setup</Button>
    </div>
    </div>

    {#if tabErrors.general}
      <div class="settings-alert settings-alert-danger">{tabErrors.general}</div>
    {/if}

    <div class="settings-form-actions">
      <span></span>
      <Button variant="primary" onclick={saveCurrentTab} disabled={!canSaveCurrentTab || saveStates.general === 'saving'}>
        {currentSaveLabel}
      </Button>
    </div>

  {:else if activeTab === 'widgets'}
    <WidgetsTab />

  {:else if activeTab === 'import-export'}
    <ImportExportTab />

  {:else if activeTab === 'license'}
    <LicenceTab
      tier={sessionInfo?.tier ?? aboutInfo.tier}
      licenseKeyMasked={aboutInfo.licenseKeyMasked}
    />

  {:else if activeTab === 'account'}
    <div class="settings-cards-grid">
    <div class="settings-hero-card settings-card-full">
      <span class="settings-card-label">ACCOUNT</span>
      <h2 class="settings-hero-value">Local</h2>
      <p class="settings-hero-sub">
        Local authentication mode
      </p>
    </div>

    <div class="settings-form-card">
      <h3 class="settings-form-title">Access Overview</h3>
      <div class="settings-meta-grid">
        <div class="settings-meta-item">
          <span class="settings-field-label">Auth Mode</span>
          <span class="settings-meta-value">Local</span>
        </div>
        <div class="settings-meta-item">
          <span class="settings-field-label">Tier</span>
          <div>
            <Badge variant={tierVariant(sessionInfo?.tier ?? aboutInfo.tier)}>
              {tierLabel(sessionInfo?.tier ?? aboutInfo.tier)}
            </Badge>
          </div>
        </div>
      </div>
    </div>

    {#if canChangePassword}
      <div class="settings-form-card">
        <h3 class="settings-form-title">Password</h3>
        <div class="settings-form-fields">
          <div>
            <label class="settings-field-label" for={newPasswordInputId}>New Password</label>
            <Input id={newPasswordInputId} type="password" bind:value={newPassword} />
          </div>
          <div>
            <label class="settings-field-label" for={confirmPasswordInputId}>Confirm Password</label>
            <Input id={confirmPasswordInputId} type="password" bind:value={confirmPassword} />
          </div>
        </div>
        {#if passwordError}
          <div class="settings-alert settings-alert-danger">{passwordError}</div>
        {/if}
      </div>
    {/if}

    <div class="settings-form-card">
      <h3 class="settings-form-title">Two-Factor Authentication</h3>
      <div class="settings-meta-grid">
        <div class="settings-meta-item">
          <span class="settings-field-label">2FA (TOTP)</span>
          <span class="settings-meta-value">Not configured</span>
        </div>
      </div>
      <Tooltip text="Coming soon">
        <span>
          <Button variant="ghost" disabled>Enable 2FA</Button>
        </span>
      </Tooltip>
    </div>

    <div class="settings-form-card">
      <h3 class="settings-form-title">Session Security</h3>
      <div class="settings-form-fields">
        <div>
          <label class="settings-field-label" for={sessionTimeoutSelectId}>Session Timeout</label>
          <Select id={sessionTimeoutSelectId} options={sessionTimeoutOptions} bind:value={sessionTimeout} />
        </div>
      </div>
      <div class="settings-form-actions">
        <div class="settings-session-info">
          <span class="settings-meta-value">Current Session</span>
          <span class="settings-field-hint">Signed in: {formatTimestamp(sessionInfo?.validatedAt)}</span>
        </div>
        <Button variant="ghost" onclick={signOutAllSessions}>Sign out all sessions</Button>
      </div>
    </div>
    </div>

    {#if tabErrors.account}
      <div class="settings-alert settings-alert-danger">{tabErrors.account}</div>
    {/if}

    <div class="settings-form-actions">
      <span></span>
      <Button variant="primary" onclick={saveCurrentTab} disabled={!canSaveCurrentTab || saveStates.account === 'saving'}>
        {currentSaveLabel}
      </Button>
    </div>

  {:else if activeTab === 'ai'}
    {#if (sessionInfo?.tier ?? aboutInfo.tier) !== 'celestial'}
      <div class="settings-cards-grid">
        <div class="settings-hero-card settings-card-full">
          <span class="settings-card-label">AI ASSISTANT</span>
          <h2 class="settings-hero-value">Celestial Only</h2>
          <p class="settings-hero-sub">AI features require the Celestial tier.</p>
        </div>
      </div>
    {:else}
      <div class="settings-cards-grid">
        <div class="settings-hero-card settings-card-full">
          <span class="settings-card-label">AI ASSISTANT</span>
          <h2 class="settings-hero-value">
            {#if aiProvider}
              {providerDisplayName(aiProvider)} Connected
            {:else}
              Not Configured
            {/if}
          </h2>
          <p class="settings-hero-sub">
            Configure an AI provider to enable natural language search
            and dashboard assistance in the search bar ({#if typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.userAgent)}⌘K{:else}Ctrl+K{/if}).
          </p>
        </div>

        <div class="settings-form-card">
          <h3 class="settings-form-title">Active Provider</h3>
          <div class="settings-form-fields">
            <div>
              <label class="settings-field-label" for="ai-provider">Provider</label>
              <Select
                id="ai-provider"
                options={[
                  { value: '', label: 'None (AI disabled)' },
                  { value: 'ollama', label: 'Ollama (Local)' },
                  { value: 'openai', label: 'OpenAI' },
                  { value: 'anthropic', label: 'Anthropic' },
                  { value: 'google', label: 'Google Gemini' },
                  { value: 'custom', label: 'Custom (OpenAI-compatible)' },
                ]}
                value={aiProviderString}
                onchange={onAiProviderChange}
              />
              <p class="settings-field-hint">
                The active provider is used for all AI features in PHAVO.
              </p>
            </div>
          </div>
        </div>

        <div class="settings-form-card">
          <h3 class="settings-form-title">
            <Icon name="server" size={14} />
            Ollama — Local LLM
          </h3>
          <div class="settings-form-fields">
            <div>
              <label class="settings-field-label" for="ai-ollama-url">URL</label>
              <div class="settings-inline-action">
                <Input id="ai-ollama-url" type="url" placeholder="http://localhost:11434" bind:value={ollamaUrl} />
                <Button variant="ghost" onclick={testOllamaConnection} disabled={ollamaTestResult === 'testing'}>
                  {ollamaTestResult === 'testing' ? 'Testing…' : ollamaTestResult === 'ok' ? '✓ OK' : ollamaTestResult === 'fail' ? '✗ Fail' : ollamaTestResult === 'empty' ? '✗ Enter URL' : 'Test'}
                </Button>
              </div>
            </div>
            <div>
              <label class="settings-field-label" for="ai-ollama-model">Model</label>
              <Input id="ai-ollama-model" placeholder="llama3.2" bind:value={ollamaModel} />
            </div>
          </div>
        </div>

        <div class="settings-form-card">
          <h3 class="settings-form-title">
            <Icon name="zap" size={14} />
            OpenAI
          </h3>
          <div class="settings-form-fields">
            <div>
              <label class="settings-field-label" for="ai-openai-key">API Key</label>
              <Input id="ai-openai-key" type="password" placeholder="sk-…" bind:value={openaiKey} />
            </div>
            <div>
              <label class="settings-field-label" for="ai-openai-model">Model</label>
              <Input id="ai-openai-model" placeholder="gpt-4o-mini" bind:value={openaiModel} />
            </div>
          </div>
        </div>

        <div class="settings-form-card">
          <h3 class="settings-form-title">
            <Icon name="cpu" size={14} />
            Anthropic
          </h3>
          <div class="settings-form-fields">
            <div>
              <label class="settings-field-label" for="ai-anthropic-key">API Key</label>
              <Input id="ai-anthropic-key" type="password" placeholder="sk-ant-…" bind:value={anthropicKey} />
            </div>
            <div>
              <label class="settings-field-label" for="ai-anthropic-model">Model</label>
              <Input id="ai-anthropic-model" placeholder="claude-haiku-4-5-20251001" bind:value={anthropicModel} />
            </div>
          </div>
        </div>

        <div class="settings-form-card">
          <h3 class="settings-form-title">
            <Icon name="globe" size={14} />
            Google Gemini
          </h3>
          <div class="settings-form-fields">
            <div>
              <label class="settings-field-label" for="ai-google-key">API Key</label>
              <Input id="ai-google-key" type="password" placeholder="AIza…" bind:value={googleKey} />
            </div>
            <div>
              <label class="settings-field-label" for="ai-google-model">Model</label>
              <Input id="ai-google-model" placeholder="gemini-2.0-flash" bind:value={googleModel} />
            </div>
          </div>
        </div>

        <div class="settings-form-card">
          <h3 class="settings-form-title">
            <Icon name="settings-2" size={14} />
            Custom (OpenAI-compatible)
          </h3>
          <p class="settings-field-hint">
            Compatible with LM Studio, Jan, Mistral, and any OpenAI-compatible endpoint.
          </p>
          <div class="settings-form-fields">
            <div>
              <label class="settings-field-label" for="ai-custom-url">Base URL</label>
              <Input id="ai-custom-url" type="url" placeholder="http://localhost:1234/v1" bind:value={customAiUrl} />
            </div>
            <div>
              <label class="settings-field-label" for="ai-custom-key">API Key</label>
              <Input id="ai-custom-key" type="password" placeholder="optional" bind:value={customKey} />
            </div>
            <div>
              <label class="settings-field-label" for="ai-custom-model">Model ID</label>
              <Input id="ai-custom-model" placeholder="model name" bind:value={customModel} />
            </div>
          </div>
        </div>
      </div>

      {#if tabErrors.ai}
        <div class="settings-alert settings-alert-danger">{tabErrors.ai}</div>
      {/if}

      <div class="settings-form-actions">
        <span></span>
        <Button variant="primary" onclick={saveCurrentTab} disabled={!canSaveCurrentTab || saveStates.ai === 'saving'}>
          {currentSaveLabel}
        </Button>
      </div>
    {/if}

  {:else if activeTab === 'plugins'}
    <div class="settings-cards-grid">
    <div class="settings-hero-card settings-card-full">
      <span class="settings-card-label">PLUGIN PIPELINE</span>
      <h2 class="settings-hero-value">Coming Soon</h2>
      <p class="settings-hero-sub">Plugin support is coming in a future release.</p>
    </div>

    <div class="settings-form-card">
      <h3 class="settings-form-title">Plugin Upload</h3>
      <p class="settings-hero-sub" style="color: var(--color-on-surface-variant);">
        Upload <code class="settings-code">.phwidget</code> files to install plugins.
      </p>
      <div class="settings-dropzone">
        <Icon name="upload" size={32} />
        <p class="settings-dropzone-text">Drag & drop plugin files here</p>
        <p class="settings-dropzone-hint">Plugin support coming in a future release</p>
      </div>
    </div>
    </div>

  {:else if activeTab === 'about'}
    <div class="settings-cards-grid">
    <div class="settings-hero-card">
      <span class="settings-card-label">VERSION</span>
      <h2 class="settings-hero-value">v{aboutInfo.version}</h2>
      <p class="settings-hero-sub">
        {aboutInfo.tier === 'celestial' ? 'Celestial Edition' : 'Stellar Edition'}
      </p>
    </div>

    <div class="settings-form-card">
      <span class="settings-card-label">UPDATES</span>
      {#if updateInfo !== null && !updateInfo.updateAvailable}
        <div class="settings-update-ok-row">
          <Icon name="check" size={16} />
          <span>Up to date</span>
        </div>
      {:else if updateInfo !== null && updateInfo.updateAvailable}
        <h3 class="settings-form-title">Update Available</h3>
        <p class="settings-meta-value">{en.settings.updateBanner.replace('{version}', updateInfo.latestVersion)}</p>
        {#if updateInfo.publishedAt}
          <p class="settings-field-hint">Released {formatReleaseDate(updateInfo.publishedAt)}</p>
        {/if}
      {:else}
        <p class="settings-hero-sub" style="color: var(--color-on-surface-variant);">
          Check for the latest version.
        </p>
      {/if}
      <Button variant="secondary" onclick={checkForUpdates} disabled={checkingUpdates}>
        <Icon name="refresh-cw" size={14} />
        {checkingUpdates ? 'Checking…' : 'Check Updates'}
      </Button>
    </div>

    {#if updateInfo !== null && updateInfo.updateAvailable}
      <div class="settings-form-card settings-card-full">
        {#if updateInfo.changelog}
          <div class="settings-changelog">
            {@html renderMarkdown(updateInfo.changelog)}
          </div>
        {/if}

        {#if applyResult?.started}
          <p class="settings-update-ok">{en.settings.updateStarted}</p>
        {:else if applyResult && !applyResult.started}
          <p class="settings-field-hint">{en.settings.updateRunManually}</p>
          <div class="settings-cmd-row">
            <code class="settings-code settings-code-block">{updateInfo.updateCommand}</code>
            <Button variant="ghost" onclick={copyUpdateCommand}>
              {cmdCopied ? 'Copied' : 'Copy'}
            </Button>
          </div>
        {:else}
          <div class="settings-actions-row">
            <Button variant="primary" onclick={applyUpdate} disabled={applying}>{en.settings.updateNow}</Button>
            <Button variant="ghost" onclick={copyUpdateCommand}>{cmdCopied ? 'Copied' : 'Copy command'}</Button>
          </div>
        {/if}
      </div>
    {/if}

    <div class="settings-help-card">
      <div class="settings-help-icon">
        <Icon name="book-open" size={20} />
      </div>
      <div class="settings-help-text">
        <span class="settings-help-title">Documentation</span>
        <p class="settings-help-description">Official PHAVO docs and guides</p>
      </div>
      <a class="settings-help-link" href={DOCS_URL} target="_blank" rel="noreferrer">Open</a>
    </div>

    <div class="settings-help-card">
      <div class="settings-help-icon">
        <Icon name="github" size={20} />
      </div>
      <div class="settings-help-text">
        <span class="settings-help-title">GitHub</span>
        <p class="settings-help-description">Source code and issue tracker</p>
      </div>
      <a class="settings-help-link" href={GITHUB_URL} target="_blank" rel="noreferrer">Open</a>
    </div>
    </div>

    {#if tabErrors.about}
      <div class="settings-alert settings-alert-danger">{tabErrors.about}</div>
    {/if}
  {/if}
  </div>
  {/key}
</SettingsLayout>

<style>
  .settings-alert {
    padding: var(--space-3) var(--space-4);
    border-radius: 1.5rem;
    border: 1px solid transparent;
    font-size: var(--font-size-sm);
    line-height: 1.5;
  }

  .settings-alert-danger {
    color: var(--color-error);
    border-color: color-mix(in srgb, var(--color-error) 36%, transparent);
    background: color-mix(in srgb, var(--color-error) 8%, transparent);
  }

  .settings-form-fields {
    display: flex;
    flex-direction: column;
    gap: var(--space-5);
  }

  .settings-location-wrap {
    position: relative;
  }

  .settings-suggestions {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    margin-top: var(--space-1);
    background: var(--color-surface-high);
    border: 1px solid color-mix(in srgb, var(--color-outline-variant) 20%, transparent);
    border-radius: 1rem;
    padding: var(--space-1);
    z-index: 10;
    list-style: none;
    box-shadow: var(--shadow-lg);
  }

  .settings-suggestion-empty {
    padding: var(--space-3);
    font-size: 13px;
    color: var(--color-on-surface-variant);
  }

  .settings-suggestion-btn {
    width: 100%;
    text-align: left;
    padding: var(--space-3);
    font-size: 13px;
    color: var(--color-on-surface);
    background: none;
    border: none;
    border-radius: 0.75rem;
    cursor: pointer;
    transition: background 0.15s;
  }
  .settings-suggestion-btn:hover {
    background: var(--color-surface-highest);
  }

  .settings-field-hint {
    font-size: var(--font-size-xs);
    color: var(--color-on-surface-variant);
    margin: var(--space-1) 0 0;
  }

  .settings-inline-action {
    display: flex;
    align-items: center;
    gap: var(--space-3);
  }

  .settings-meta-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: var(--space-4);
  }

  .settings-meta-item {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .settings-meta-value {
    font-size: 14px;
    font-weight: 500;
    color: var(--color-on-surface);
  }

  .settings-session-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .settings-code {
    font-family: var(--font-mono);
    font-size: var(--font-size-xs);
    background: var(--color-surface-highest);
    padding: 2px var(--space-2);
    border-radius: var(--radius-sm);
  }

  .settings-code-block {
    display: block;
    flex: 1;
    overflow-x: auto;
    padding: var(--space-3);
  }

  .settings-dropzone {
    border: 1px dashed color-mix(in srgb, var(--color-primary-fixed) 26%, var(--color-outline-variant));
    border-radius: 1.5rem;
    padding: var(--space-8);
    text-align: center;
    background: color-mix(in srgb, var(--color-surface-dim) 60%, transparent);
    color: var(--color-on-surface-variant);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-2);
  }

  .settings-dropzone-text {
    font-size: 13px;
    color: var(--color-on-surface-variant);
    margin: 0;
  }

  .settings-dropzone-hint {
    font-size: var(--font-size-xs);
    color: var(--color-outline);
    margin: 0;
  }

  .settings-changelog {
    padding: var(--space-4);
    border-radius: 1rem;
    background: var(--color-surface-dim);
    border: 1px solid color-mix(in srgb, var(--color-outline-variant) 10%, transparent);
    font-size: 13px;
    max-height: 256px;
    overflow-y: auto;
    color: var(--color-on-surface-variant);
  }

  .settings-cmd-row {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-2);
    border-radius: 1rem;
    background: var(--color-surface-dim);
    border: 1px solid color-mix(in srgb, var(--color-outline-variant) 10%, transparent);
  }

  .settings-actions-row {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    flex-wrap: wrap;
  }

  .settings-update-ok {
    font-size: 13px;
    font-weight: 600;
    color: var(--color-secondary);
    margin: 0;
  }

  .settings-update-ok-row {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    font-size: 14px;
    font-weight: 600;
    color: var(--color-secondary);
  }
</style>
