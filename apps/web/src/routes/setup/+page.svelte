<script lang="ts">
import {
  isWidgetDefinition,
  isWidgetTeaserDefinition,
  type Tab,
  type WeatherMetrics,
  type WidgetInstance,
  type WidgetManifestEntry,
  type WidgetSize,
} from '@phavo/types';
import { Button, Icon, Input, ProgressBar, Select } from '@phavo/ui';
import { onMount } from 'svelte';
import { goto } from '$app/navigation';
import en from '$lib/i18n/en.json';

interface Props {
  data: {
    devMode?: boolean;
  };
}

let { data }: Props = $props();

// ── TYPES ──────────────────────────────────────────────────────────────────
type SetupMode = 'welcome' | 'quick' | 'full';
type QuickStep = 'auth' | 'location' | 'done';
type FullStep =
  | 'tier'
  | 'auth'
  | 'name'
  | 'location'
  | 'tabs'
  | 'widgets'
  | 'assign'
  | 'config'
  | 'done';
type Tier = 'free' | 'standard' | 'local';
type AuthMode = 'phavo-net' | 'local';
type ApiResponse<T> = { ok: true; data: T } | { ok: false; error: string };
type SessionInfo = { authMode: AuthMode; validatedAt: number; graceUntil: number | null };
type LoginSuccess = { tier?: Tier; requiresTotp?: boolean; partialToken?: string };
type GeoResult = { id: number; name: string; country: string; latitude: number; longitude: number };
type SetupLocation = { name: string; latitude: number; longitude: number };
type RssFeedDraft = {
  id: string;
  url: string;
  label: string | undefined;
  authType: 'none' | 'basic' | 'bearer';
  username: string | undefined;
  password: string | undefined;
  token: string | undefined;
};
type LinksDraft = {
  groups: Array<{ label: string; links: Array<{ title: string; url: string }> }>;
};
// Only field data is persisted — never mode or step
type PersistedFieldData = {
  locationQuery: string;
  selectedLocation: SetupLocation | null;
  dashboardName: string;
  tabs: string[];
  selectedWidgets: string[];
  widgetAssignments: Record<string, string>;
  widgetConfigs: Record<string, unknown>;
};

// ── CONSTANTS ──────────────────────────────────────────────────────────────
const SETUP_KEY = 'phavo_setup_state';
const PHAVO_IO_URL = 'https://phavo.net';
const QUICK_STEPS: QuickStep[] = ['auth', 'location', 'done'];
const FULL_STEPS: FullStep[] = [
  'tier', 'auth', 'name', 'location', 'tabs', 'widgets', 'assign', 'config', 'done',
];
const CONFIGURABLE_WIDGET_IDS = new Set(['pihole', 'rss', 'links', 'weather']);

// ── NAVIGATION STATE ───────────────────────────────────────────────────────
// mode is ALWAYS initialised to 'welcome'. onMount reads the URL to override.
// Mode and step are NEVER read from sessionStorage.
let mode = $state<SetupMode>('welcome');
let quickStep = $state<QuickStep>('auth');
let fullStep = $state<FullStep>('tier');

// ── AUTH STATE ─────────────────────────────────────────────────────────────
let quickAuthMethod = $state<'choice' | 'phavo-net' | 'local'>('choice');
let selectedTier = $state<Tier>('free');
let sessionTier = $state<Tier | null>(null);
let currentAuthMode = $state<AuthMode | null>(null);
let authUsername = $state('');
let authPassword = $state('');
let authLicenseKey = $state('');
let authError = $state('');
let authLoading = $state(false);

// ── FIELD DATA ─────────────────────────────────────────────────────────────
let dashboardName = $state('My Dashboard');
let locationQuery = $state('');
let selectedLocation = $state<SetupLocation | null>(null);
let suggestions = $state<GeoResult[]>([]);
let showSuggestions = $state(false);
let locationLoading = $state(false);
let locationError = $state('');
let weatherPreview = $state<WeatherMetrics | null>(null);
let weatherPreviewLoading = $state(false);
let geoTimer: ReturnType<typeof setTimeout> | null = null;

let tabs = $state<string[]>(['Home']);
let newTabName = $state('');
let tabError = $state('');

let widgetManifest = $state<WidgetManifestEntry[]>([]);
let widgetManifestLoading = $state(false);
let widgetManifestError = $state('');
let selectedWidgets = $state<string[]>([]);
let widgetAssignments = $state<Record<string, string>>({});
let widgetConfigs = $state<Record<string, unknown>>({});

let piholeTestState = $state<'idle' | 'loading' | 'success' | 'error'>('idle');
let piholeTestMessage = $state('');
let setupSaving = $state(false);
let setupError = $state('');

// Guard: only write to sessionStorage after client mount
let hydrated = $state(false);

// ── DERIVED ────────────────────────────────────────────────────────────────
const quickStepIndex = $derived(QUICK_STEPS.indexOf(quickStep));
const fullStepIndex = $derived(FULL_STEPS.indexOf(fullStep));
const effectiveTier = $derived(sessionTier ?? selectedTier);
const freeTabLimitReached = $derived(effectiveTier === 'free' && tabs.length >= 1);
const configurableSelections = $derived(
  selectedWidgets.filter((id) => CONFIGURABLE_WIDGET_IDS.has(id)),
);

// ── UTILITIES ──────────────────────────────────────────────────────────────
function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const pair = document.cookie.split('; ').find((p) => p.startsWith(name + '='));
  if (!pair) return null;
  return decodeURIComponent(pair.slice(name.length + 1));
}

async function apiRequest<T>(
  url: string,
  init: Omit<RequestInit, 'body'> & { body?: unknown } = {},
): Promise<ApiResponse<T>> {
  const method = (init.method ?? 'GET').toUpperCase();
  const headers = new Headers(init.headers);
  let body: BodyInit | null = null;
  if (init.body !== undefined) {
    headers.set('Content-Type', 'application/json');
    body = JSON.stringify(init.body);
  }
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    const csrfToken = getCookie('phavo_csrf');
    if (csrfToken) headers.set('X-CSRF-Token', csrfToken);
  }
  const response = await fetch(url, { ...init, method, headers, body, credentials: 'same-origin' });
  const json = (await response.json().catch(() => null)) as ApiResponse<T> | null;
  if (json && typeof json === 'object' && 'ok' in json) return json;
  return { ok: false, error: response.ok ? 'Unexpected response' : 'Request failed' };
}

// ── SESSION STORAGE — FIELD DATA ONLY ─────────────────────────────────────
// Mode and step are NEVER stored in or read from sessionStorage.

function persistFieldData() {
  if (!hydrated) return;
  try {
    if (typeof sessionStorage === 'undefined') return;
    const data: PersistedFieldData = {
      locationQuery,
      selectedLocation,
      dashboardName,
      tabs: [...tabs],
      selectedWidgets: [...selectedWidgets],
      widgetAssignments: { ...widgetAssignments },
      widgetConfigs: { ...widgetConfigs },
    };
    sessionStorage.setItem(SETUP_KEY, JSON.stringify(data));
  } catch { /* ignore storage failures */ }
}

function restoreFieldData() {
  try {
    if (typeof sessionStorage === 'undefined') return;
    const raw = sessionStorage.getItem(SETUP_KEY);
    if (!raw) return;
    const data = JSON.parse(raw) as Partial<PersistedFieldData>;
    if (typeof data.locationQuery === 'string') locationQuery = data.locationQuery;
    if (data.selectedLocation) selectedLocation = data.selectedLocation;
    if (typeof data.dashboardName === 'string' && data.dashboardName) dashboardName = data.dashboardName;
    if (Array.isArray(data.tabs) && data.tabs.length > 0) tabs = data.tabs;
    if (Array.isArray(data.selectedWidgets)) selectedWidgets = data.selectedWidgets;
    if (data.widgetAssignments && typeof data.widgetAssignments === 'object') widgetAssignments = data.widgetAssignments;
    if (data.widgetConfigs && typeof data.widgetConfigs === 'object') widgetConfigs = data.widgetConfigs;
  } catch { /* ignore parse errors */ }
}

function clearFieldData() {
  try {
    if (typeof sessionStorage !== 'undefined') sessionStorage.removeItem(SETUP_KEY);
  } catch { /* ignore */ }
}

// ── NAVIGATION ─────────────────────────────────────────────────────────────
// setMode() is the only place that mutates mode. URL is updated via
// history.replaceState so SvelteKit does not remount the component.

function setMode(newMode: 'quick' | 'full') {
  mode = newMode;
  quickStep = 'auth';
  fullStep = 'tier';
  quickAuthMethod = 'choice';
  authError = '';
  window.history.replaceState({}, '', `/setup?mode=${newMode}`);
}

function backToWelcome() {
  mode = 'welcome';
  window.history.replaceState({}, '', '/setup');
}

function prevQuickStep() {
  const idx = QUICK_STEPS.indexOf(quickStep);
  if (idx === 0) { backToWelcome(); return; }
  quickStep = QUICK_STEPS[idx - 1] as QuickStep;
}

function nextQuickStep() {
  const idx = QUICK_STEPS.indexOf(quickStep);
  if (idx < QUICK_STEPS.length - 1) quickStep = QUICK_STEPS[idx + 1] as QuickStep;
}

function goToFullStep(step: FullStep) {
  fullStep = step;
}

function prevFullStep() {
  const idx = FULL_STEPS.indexOf(fullStep);
  if (idx === 0) { backToWelcome(); return; }
  fullStep = FULL_STEPS[idx - 1] as FullStep;
}

function nextFullStep() {
  const idx = FULL_STEPS.indexOf(fullStep);
  if (idx < FULL_STEPS.length - 1) fullStep = FULL_STEPS[idx + 1] as FullStep;
}

// ── AUTH ───────────────────────────────────────────────────────────────────
function encodeOauthState(nextMode: 'quick' | 'full'): string {
  return btoa(JSON.stringify({ source: 'setup', mode: nextMode }));
}

async function startPhavoOauth(nextMode: 'quick' | 'full') {
  authError = '';

  if (data.devMode) {
    authLoading = true;
    try {
      const resp = await apiRequest<LoginSuccess>('/api/v1/auth/login', {
        method: 'POST',
        body: { authMode: 'phavo-net', code: 'dev-mock' },
      });
      if (!resp.ok) {
        authError = resp.error;
        return;
      }
      const ok = await syncSessionContext();
      if (!ok) return;
      if (nextMode === 'quick') {
        quickStep = 'location';
        return;
      }
      fullStep = 'name';
      return;
    } catch {
      authError = en.errors.networkError;
      return;
    } finally {
      authLoading = false;
    }
  }

  const redirectUri = `${window.location.origin}/auth/callback`;
  const authorizeUrl = new URL(`${PHAVO_IO_URL}/oauth/authorize`);
  authorizeUrl.searchParams.set('response_type', 'code');
  authorizeUrl.searchParams.set('redirect_uri', redirectUri);
  authorizeUrl.searchParams.set('state', encodeOauthState(nextMode));
  window.location.assign(authorizeUrl.toString());
}

async function syncSessionContext(): Promise<boolean> {
  const resp = await apiRequest<SessionInfo>('/api/v1/auth/session');
  if (!resp.ok) { authError = resp.error; return false; }
  currentAuthMode = resp.data.authMode;
  await loadWidgetManifest();
  return true;
}

async function submitLocalAuth(nextMode: 'quick' | 'full') {
  authLoading = true;
  authError = '';
  try {
    const resp = await apiRequest<LoginSuccess>('/api/v1/auth/login', {
      method: 'POST',
      body: {
        authMode: 'local',
        username: authUsername,
        password: authPassword,
        licenseKey: authLicenseKey.trim() || undefined,
      },
    });
    if (!resp.ok) { authError = resp.error; return; }
    if (resp.data.requiresTotp) {
      authError = 'Two-factor login is not available in setup yet. Sign in from the login page.';
      return;
    }
    sessionTier = resp.data.tier ?? sessionTier;
    currentAuthMode = 'local';
    const ok = await syncSessionContext();
    if (!ok) return;
    if (nextMode === 'quick') { quickStep = 'location'; return; }
    fullStep = 'name';
  } catch {
    authError = en.errors.networkError;
  } finally {
    authLoading = false;
  }
}

async function handleOauthReturn(
  status: string | null,
  modeParam: string | null,
  message: string | null,
) {
  if (!status) return;
  const oauthMode: 'quick' | 'full' = modeParam === 'quick' ? 'quick' : 'full';
  mode = oauthMode;
  if (status === 'error') { authError = message ?? 'Authentication failed'; return; }
  const ok = await syncSessionContext();
  if (!ok) return;
  if (oauthMode === 'quick') { quickStep = 'location'; return; }
  fullStep = 'name';
}

// ── GEOCODING ──────────────────────────────────────────────────────────────
function onLocationInput() {
  selectedLocation = null;
  weatherPreview = null;
  locationError = '';
  if (geoTimer) clearTimeout(geoTimer);
  if (locationQuery.trim().length < 2) {
    suggestions = [];
    showSuggestions = false;
    locationLoading = false;
    return;
  }
  const query = locationQuery.trim();
  locationLoading = true;
  geoTimer = setTimeout(async () => {
    try {
      const url = new URL('https://geocoding-api.open-meteo.com/v1/search');
      url.searchParams.set('name', query);
      url.searchParams.set('count', '5');
      const response = await fetch(url.toString());
      const data = (await response.json()) as { results?: GeoResult[] };
      suggestions = data.results ?? [];
      showSuggestions = suggestions.length > 0;
      if (suggestions.length === 0) locationError = en.settings.locationSuggestionsEmpty;
    } catch {
      suggestions = [];
      showSuggestions = false;
      locationError = en.errors.networkError;
    } finally {
      locationLoading = false;
    }
  }, 500);
}

async function loadWeatherPreview(location: SetupLocation) {
  weatherPreviewLoading = true;
  locationError = '';
  try {
    const params = new URLSearchParams({
      latitude: String(location.latitude),
      longitude: String(location.longitude),
    });
    const resp = await apiRequest<WeatherMetrics>(`/api/v1/weather?${params.toString()}`);
    if (!resp.ok) { locationError = resp.error; weatherPreview = null; return; }
    weatherPreview = resp.data;
    widgetConfigs = { ...widgetConfigs, weather: location };
  } catch {
    locationError = en.errors.networkError;
    weatherPreview = null;
  } finally {
    weatherPreviewLoading = false;
  }
}

function selectSuggestion(result: GeoResult) {
  selectedLocation = {
    name: `${result.name}, ${result.country}`,
    latitude: result.latitude,
    longitude: result.longitude,
  };
  locationQuery = selectedLocation.name;
  suggestions = [];
  showSuggestions = false;
  void loadWeatherPreview(selectedLocation);
}

// ── WIDGETS ────────────────────────────────────────────────────────────────
async function loadWidgetManifest() {
  widgetManifestLoading = true;
  widgetManifestError = '';
  try {
    const resp = await apiRequest<WidgetManifestEntry[]>('/api/v1/widgets');
    if (!resp.ok) { widgetManifestError = resp.error; return; }
    widgetManifest = resp.data;
    if (currentAuthMode === 'local') { sessionTier = 'local'; return; }
    sessionTier = widgetManifest.some((e) => isWidgetTeaserDefinition(e)) ? 'free' : 'standard';
  } catch {
    widgetManifestError = en.errors.networkError;
  } finally {
    widgetManifestLoading = false;
  }
}

function getWidgetName(widgetId: string): string {
  return widgetManifest.find((e) => e.id === widgetId)?.name ?? widgetId;
}

function getDefaultWidgetSize(widgetId: string): WidgetSize {
  const widget = widgetManifest.find(
    (e): e is Extract<WidgetManifestEntry, { sizes: WidgetSize[] }> =>
      e.id === widgetId && isWidgetDefinition(e),
  );
  return widget?.sizes[0] ?? 'M';
}

function toggleWidgetSelection(entry: WidgetManifestEntry) {
  if (!isWidgetDefinition(entry)) return;
  if (selectedWidgets.includes(entry.id)) {
    selectedWidgets = selectedWidgets.filter((id) => id !== entry.id);
    const nextAssign = { ...widgetAssignments };
    delete nextAssign[entry.id];
    widgetAssignments = nextAssign;
    const nextCfg = { ...widgetConfigs };
    delete nextCfg[entry.id];
    widgetConfigs = nextCfg;
    return;
  }
  selectedWidgets = [...selectedWidgets, entry.id];
  widgetAssignments = { ...widgetAssignments, [entry.id]: tabs[0] ?? 'Home' };
  ensureWidgetConfigDefaults(entry.id);
}

function updateWidgetAssignment(widgetId: string, tabLabel: string) {
  widgetAssignments = { ...widgetAssignments, [widgetId]: tabLabel };
}

// ── TABS ───────────────────────────────────────────────────────────────────
function addTab() {
  tabError = '';
  if (freeTabLimitReached) { tabError = en.upgrade.tabLimit; return; }
  const label = newTabName.trim() || `Tab ${tabs.length + 1}`;
  tabs = [...tabs, label];
  newTabName = '';
}

function updateTabName(index: number, value: string) {
  const prev = tabs[index] ?? '';
  tabs = tabs.map((t, i) => (i === index ? value : t));
  widgetAssignments = Object.fromEntries(
    Object.entries(widgetAssignments).map(([id, tab]) => [id, tab === prev ? value : tab]),
  );
}

function removeTab(index: number) {
  if (tabs.length === 1) return;
  const removed = tabs[index];
  tabs = tabs.filter((_, i) => i !== index);
  const fallback = tabs[0] ?? 'Home';
  widgetAssignments = Object.fromEntries(
    Object.entries(widgetAssignments).map(([id, tab]) => [id, tab === removed ? fallback : tab]),
  );
}

// ── WIDGET CONFIG ──────────────────────────────────────────────────────────
function createDefaultRssFeed(): RssFeedDraft {
  return { id: crypto.randomUUID(), url: '', label: undefined, authType: 'none', username: undefined, password: undefined, token: undefined };
}

function ensureWidgetConfigDefaults(widgetId: string) {
  if (widgetId === 'pihole' && !widgetConfigs.pihole) {
    widgetConfigs = { ...widgetConfigs, pihole: { url: '', token: '' } };
  }
  if (widgetId === 'rss' && !widgetConfigs.rss) {
    widgetConfigs = { ...widgetConfigs, rss: { feeds: [createDefaultRssFeed()] } };
  }
  if (widgetId === 'links' && !widgetConfigs.links) {
    widgetConfigs = {
      ...widgetConfigs,
      links: {
        groups: [{ label: 'Quick Links', links: [{ title: '', url: '' }, { title: '', url: '' }, { title: '', url: '' }] }],
      } satisfies LinksDraft,
    };
  }
  if (widgetId === 'weather' && selectedLocation) {
    widgetConfigs = { ...widgetConfigs, weather: selectedLocation };
  }
}

function getSelectedRssConfig(): { feeds: RssFeedDraft[] } {
  const config = widgetConfigs.rss as { feeds?: RssFeedDraft[] } | undefined;
  return { feeds: config?.feeds ? [...config.feeds] : [createDefaultRssFeed()] };
}

function getSelectedLinksConfig(): LinksDraft {
  const config = widgetConfigs.links as LinksDraft | undefined;
  return config ?? {
    groups: [{ label: 'Quick Links', links: [{ title: '', url: '' }, { title: '', url: '' }, { title: '', url: '' }] }],
  };
}

function updatePiholeField(field: 'url' | 'token', value: string) {
  const current = (widgetConfigs.pihole as { url?: string; token?: string } | undefined) ?? { url: '', token: '' };
  widgetConfigs = { ...widgetConfigs, pihole: { ...current, [field]: value } };
}

async function testPiholeConnection() {
  const config = (widgetConfigs.pihole as { url?: string; token?: string } | undefined) ?? {};
  piholeTestState = 'loading';
  piholeTestMessage = '';
  try {
    const resp = await apiRequest<unknown>('/api/v1/pihole/test', {
      method: 'POST',
      body: { url: config.url ?? '', token: config.token ?? '' },
    });
    if (!resp.ok) { piholeTestState = 'error'; piholeTestMessage = resp.error; return; }
    piholeTestState = 'success';
    piholeTestMessage = 'Connection successful.';
  } catch {
    piholeTestState = 'error';
    piholeTestMessage = en.errors.networkError;
  }
}

function updateRssFeed(index: number, patch: Partial<RssFeedDraft>) {
  const config = getSelectedRssConfig();
  const current = config.feeds[index];
  if (!current) return;
  config.feeds[index] = {
    id: patch.id ?? current.id,
    url: patch.url ?? current.url,
    label: patch.label ?? current.label,
    authType: patch.authType ?? current.authType,
    username: patch.username ?? current.username,
    password: patch.password ?? current.password,
    token: patch.token ?? current.token,
  };
  widgetConfigs = { ...widgetConfigs, rss: config };
}

function addRssFeed() {
  const config = getSelectedRssConfig();
  config.feeds = [...config.feeds, createDefaultRssFeed()];
  widgetConfigs = { ...widgetConfigs, rss: config };
}

function removeRssFeed(index: number) {
  const config = getSelectedRssConfig();
  config.feeds = config.feeds.filter((_, i) => i !== index);
  if (config.feeds.length === 0) config.feeds = [createDefaultRssFeed()];
  widgetConfigs = { ...widgetConfigs, rss: config };
}

function updateLinksGroupLabel(value: string) {
  const config = getSelectedLinksConfig();
  const group = config.groups[0];
  if (!group) return;
  group.label = value;
  widgetConfigs = { ...widgetConfigs, links: config };
}

function updateLink(index: number, field: 'title' | 'url', value: string) {
  const config = getSelectedLinksConfig();
  const group = config.groups[0];
  if (!group) return;
  const current = group.links[index];
  if (!current) return;
  group.links[index] = {
    title: field === 'title' ? value : current.title,
    url: field === 'url' ? value : current.url,
  };
  widgetConfigs = { ...widgetConfigs, links: config };
}

// ── SETUP SAVE ─────────────────────────────────────────────────────────────
async function reconcileTabs(): Promise<Tab[]> {
  const labels = tabs.map((l) => l.trim()).filter(Boolean);
  const normalized = labels.length > 0 ? labels : ['Home'];

  const existingResp = await apiRequest<Tab[]>('/api/v1/tabs');
  if (!existingResp.ok) throw new Error(existingResp.error);
  const existing = [...existingResp.data].sort((a, b) => a.order - b.order);

  // Remove all existing widget instances first
  for (const tab of existing) {
    const wiResp = await apiRequest<WidgetInstance[]>(`/api/v1/tabs/${encodeURIComponent(tab.id)}/widgets`);
    if (!wiResp.ok) throw new Error(wiResp.error);
    for (const wi of wiResp.data) {
      const del = await apiRequest<null>(`/api/v1/widget-instances/${encodeURIComponent(wi.id)}`, { method: 'DELETE' });
      if (!del.ok) throw new Error(del.error);
    }
  }

  const resolved: Tab[] = [];
  for (const [i, label] of normalized.entries()) {
    const ex = existing[i];
    if (ex) {
      const upd = await apiRequest<Tab>(`/api/v1/tabs/${encodeURIComponent(ex.id)}`, { method: 'PATCH', body: { label, order: i } });
      if (!upd.ok) throw new Error(upd.error);
      resolved.push(upd.data);
    } else {
      const created = await apiRequest<Tab>('/api/v1/tabs', { method: 'POST', body: { label } });
      if (!created.ok) throw new Error(created.error);
      const reordered = await apiRequest<Tab>(`/api/v1/tabs/${encodeURIComponent(created.data.id)}`, { method: 'PATCH', body: { order: i } });
      if (!reordered.ok) throw new Error(reordered.error);
      resolved.push(reordered.data);
    }
  }

  // Delete surplus tabs
  for (let i = existing.length - 1; i >= normalized.length; i -= 1) {
    const tab = existing[i];
    if (!tab) continue;
    const del = await apiRequest<null>(`/api/v1/tabs/${encodeURIComponent(tab.id)}`, { method: 'DELETE' });
    if (!del.ok) throw new Error(del.error);
  }

  return resolved;
}

async function createWidgetInstances(resolvedTabs: Tab[]): Promise<WidgetInstance[]> {
  const tabByLabel = new Map(resolvedTabs.map((t) => [t.label, t.id]));
  const instances: WidgetInstance[] = [];

  for (const widgetId of selectedWidgets) {
    const tabLabel = widgetAssignments[widgetId] ?? resolvedTabs[0]?.label;
    const tabId = tabLabel ? tabByLabel.get(tabLabel) : resolvedTabs[0]?.id;
    if (!tabId) continue;

    const created = await apiRequest<WidgetInstance>('/api/v1/widget-instances', {
      method: 'POST',
      body: { widgetId, tabId, size: getDefaultWidgetSize(widgetId) },
    });
    if (!created.ok) throw new Error(created.error);
    instances.push(created.data);

    if (CONFIGURABLE_WIDGET_IDS.has(widgetId) && widgetId !== 'weather') {
      const cfg = await apiRequest<{ saved: boolean }>(
        `/api/v1/widgets/${encodeURIComponent(created.data.id)}/config`,
        { method: 'POST', body: { config: widgetConfigs[widgetId] ?? {} } },
      );
      if (!cfg.ok) throw new Error(cfg.error);
    }
  }

  return instances;
}

async function finishSetup() {
  setupSaving = true;
  setupError = '';
  try {
    if (mode === 'full') {
      const resolvedTabs = await reconcileTabs();
      await createWidgetInstances(resolvedTabs);
    }
    const configResp = await apiRequest<unknown>('/api/v1/config', {
      method: 'POST',
      body: {
        setupComplete: true,
        dashboardName: dashboardName.trim() || 'My Dashboard',
        location: selectedLocation ?? undefined,
      },
    });
    if (!configResp.ok) { setupError = configResp.error; return; }
    clearFieldData();
    await goto('/');
  } catch (error) {
    setupError = error instanceof Error ? error.message : 'Could not save settings — please try again.';
  } finally {
    setupSaving = false;
  }
}

function shouldSkipConfigStep(): boolean {
  return configurableSelections.length === 0;
}

function handleFullTabsNext() {
  fullStep = 'widgets';
  if (widgetManifest.length === 0) void loadWidgetManifest();
}

function handleFullAssignNext() {
  fullStep = shouldSkipConfigStep() ? 'done' : 'config';
}

// ── MOUNT — URL determines mode, sessionStorage restores field data only ────
onMount(() => {
  // Restore FIELD DATA only — mode and step never come from sessionStorage
  restoreFieldData();

  // Mode comes from the URL — the sole source of truth for navigation state
  const params = new URLSearchParams(window.location.search);
  const urlMode = params.get('mode');
  if (urlMode === 'quick') {
    mode = 'quick';
    quickStep = 'auth';
  } else if (urlMode === 'full') {
    mode = 'full';
    fullStep = 'tier';
  }
  // else: mode stays 'welcome'

  hydrated = true;

  // Handle phavo.net OAuth callback return
  const oauthStatus = params.get('oauth');
  if (oauthStatus) {
    void handleOauthReturn(oauthStatus, urlMode, params.get('message'));
    try {
      const cleanUrl = new URL(window.location.href);
      cleanUrl.searchParams.delete('oauth');
      cleanUrl.searchParams.delete('message');
      history.replaceState(history.state, '', cleanUrl.toString());
    } catch { /* cosmetic only */ }
  }

  // Persist field data whenever it changes — moved into $effect.root inside onMount
  // so the effect is created AFTER _hydrate completes, avoiding effect_orphan and
  // the "Cannot access 'component' before initialization" TDZ error.
  return $effect.root(() => {
    $effect(() => {
      locationQuery;
      selectedLocation;
      dashboardName;
      tabs;
      selectedWidgets;
      widgetAssignments;
      widgetConfigs;
      persistFieldData();
    });
  });
});
</script>

<div class="min-h-screen flex items-center justify-center p-6">

<div class="w-full">
  {#if mode === 'welcome'}
    <!-- ── WELCOME ────────────────────────────────────────────────────────── -->
    <div class="max-w-[680px] w-full mx-auto text-center">
      <h1 class="text-3xl font-bold text-text mb-2">{en.setup.welcome.title}</h1>
      <p class="text-text-muted mb-8">{en.setup.welcome.subtitle}</p>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <button type="button" class="flex flex-col gap-2 p-6 border border-border-subtle rounded-lg bg-surface text-left cursor-pointer text-text transition-colors hover:border-border focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2" onclick={() => setMode('quick')}>
          <h2 class="text-lg font-semibold">{en.setup.quickSetup}</h2>
          <p class="text-sm text-text-muted">{en.setup.quickSetupDescription}</p>
        </button>

        <button type="button" class="flex flex-col gap-2 p-6 border border-border-subtle rounded-lg bg-surface text-left cursor-pointer text-text transition-colors hover:border-border focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2" onclick={() => setMode('full')}>
          <h2 class="text-lg font-semibold">{en.setup.fullSetup}</h2>
          <p class="text-sm text-text-muted">{en.setup.fullSetupDescription}</p>
        </button>
      </div>
    </div>

  {:else if mode === 'quick'}
    <!-- ── QUICK WIZARD ───────────────────────────────────────────────────── -->
    <div class="max-w-[560px] w-full mx-auto flex flex-col gap-4">
      <div class="flex items-center gap-3">
        <span class="text-xs text-text-dim tabular-nums shrink-0">Step {quickStepIndex + 1} / {QUICK_STEPS.length}</span>
        <ProgressBar value={(quickStepIndex + 1) / QUICK_STEPS.length * 100} />
      </div>

      {#if quickStep === 'auth'}
        <h2 class="text-xl font-semibold text-text">{en.setup.steps.auth}</h2>

        {#if quickAuthMethod === 'choice'}
          <div class="flex flex-col gap-3">
            <button type="button" class="flex flex-col gap-2 p-6 border border-border-subtle rounded-lg bg-surface text-left cursor-pointer text-text transition-colors hover:border-border" onclick={() => (quickAuthMethod = 'phavo-net')}>
              <h3 class="text-lg font-semibold">{en.setup.auth.phavoIo}</h3>
              <p class="text-sm text-text-muted">Continue with phavo.net to create or validate your account.</p>
            </button>
            <button type="button" class="flex flex-col gap-2 p-6 border border-border-subtle rounded-lg bg-surface text-left cursor-pointer text-text transition-colors hover:border-border" onclick={() => (quickAuthMethod = 'local')}>
              <h3 class="text-lg font-semibold">{en.setup.auth.localAccount}</h3>
              <p class="text-sm text-text-muted">Sign in with a local account stored only on this device.</p>
            </button>
          </div>
          <div class="flex justify-end gap-3 flex-wrap mt-2">
            <Button variant="ghost" onclick={backToWelcome}>{en.common.back}</Button>
          </div>

        {:else if quickAuthMethod === 'phavo-net'}
          <div class="flex flex-col gap-3">
            <p class="text-text-muted">
              You'll be redirected to phavo.net to authenticate, then returned here automatically.
            </p>
            {#if authError}<p class="text-red-400 text-sm">{authError}</p>{/if}
            <div class="flex justify-end gap-3 flex-wrap mt-2">
              <Button variant="ghost" onclick={() => { quickAuthMethod = 'choice'; authError = ''; }}>{en.common.back}</Button>
              <Button onclick={() => startPhavoOauth('quick')}>{en.setup.auth.phavoIo}</Button>
            </div>
          </div>

        {:else}
          <div class="flex flex-col gap-3">
            <Input label={en.setup.auth.username} placeholder={en.setup.auth.username} bind:value={authUsername} />
            <Input label={en.setup.auth.password} type="password" placeholder={en.auth.passwordPlaceholder} bind:value={authPassword} />
            <Input label={en.setup.auth.enterLicenseKey} placeholder={en.setup.auth.enterLicenseKey} bind:value={authLicenseKey} />
            {#if authError}<p class="text-red-400 text-sm">{authError}</p>{/if}
            <div class="flex justify-end gap-3 flex-wrap mt-2">
              <Button variant="ghost" onclick={() => { quickAuthMethod = 'choice'; authError = ''; }}>{en.common.back}</Button>
              <Button onclick={() => submitLocalAuth('quick')} disabled={authLoading}>
                {authLoading ? en.common.loading : en.auth.login}
              </Button>
            </div>
          </div>
        {/if}

      {:else if quickStep === 'location'}
        <h2 class="text-xl font-semibold text-text">{en.setup.steps.location}</h2>
        <p class="text-text-muted">{en.setup.location.subtitle}</p>

        <div class="relative">
          <Input
            label={en.setup.location.title}
            placeholder={en.setup.location.placeholder}
            bind:value={locationQuery}
            oninput={onLocationInput}
          />
          {#if showSuggestions}
            <ul class="absolute top-full left-0 right-0 mt-1 py-1 list-none border border-border rounded-md bg-elevated z-10" role="listbox">
              {#each suggestions as result (result.id)}
                <li role="option" aria-selected="false">
                  <button type="button" class="w-full py-2 px-3 border-none bg-transparent text-left text-text cursor-pointer hover:bg-hover" onclick={() => selectSuggestion(result)}>
                    {result.name}, {result.country}
                  </button>
                </li>
              {/each}
            </ul>
          {/if}
        </div>

        {#if locationLoading}<p class="text-text-muted text-sm">{en.common.loading}</p>{/if}

        {#if weatherPreview && selectedLocation}
          <div class="p-4 border border-border rounded-lg bg-elevated">
            <strong class="text-text">{selectedLocation.name}</strong>
            <p class="text-sm text-text-muted mt-1">{Math.round(weatherPreview.currentTemp)}°C · {weatherPreview.humidity}% humidity · {Math.round(weatherPreview.windSpeed)} km/h</p>
          </div>
        {/if}

        {#if locationError}<p class="text-red-400 text-sm">{locationError}</p>{/if}

        <div class="flex justify-end gap-3 flex-wrap mt-2">
          <Button variant="ghost" onclick={prevQuickStep}>{en.common.back}</Button>
          <Button variant="ghost" onclick={nextQuickStep}>{en.setup.location.skip}</Button>
          <Button onclick={nextQuickStep} disabled={!selectedLocation}>{en.common.next}</Button>
        </div>

      {:else}
        <!-- done -->
        <h2 class="text-xl font-semibold text-text">{en.setup.done.title}</h2>
        <p class="text-text-muted">{en.setup.done.subtitle}</p>
        {#if setupError}<p class="text-red-400 text-sm">{setupError}</p>{/if}
        <div class="flex justify-end gap-3 flex-wrap mt-2">
          <Button variant="ghost" onclick={prevQuickStep}>{en.common.back}</Button>
          <Button onclick={finishSetup} disabled={setupSaving}>
            {setupSaving ? en.common.loading : en.setup.done.launch}
          </Button>
        </div>
      {/if}
    </div>

  {:else}
    <!-- ── FULL WIZARD ─────────────────────────────────────────────────────── -->
    <div class="max-w-[760px] w-full mx-auto flex flex-col gap-4">
      <div class="flex items-center gap-3">
        <span class="text-xs text-text-dim tabular-nums shrink-0">Step {fullStepIndex + 1} / {FULL_STEPS.length}</span>
        <ProgressBar value={(fullStepIndex + 1) / FULL_STEPS.length * 100} />
      </div>

      {#if fullStep === 'tier'}
        <h2 class="text-xl font-semibold text-text">{en.setup.steps.tierSelect}</h2>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            type="button"
            class="flex flex-col gap-2 p-6 border rounded-lg bg-surface text-left cursor-pointer text-text transition-colors hover:border-border focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2
              {selectedTier === 'free' || selectedTier === 'standard' ? 'border-accent shadow-[0_0_0_1px_var(--color-accent)]' : 'border-border-subtle'}"
            onclick={() => { selectedTier = 'free'; nextFullStep(); }}
          >
            <h3 class="text-lg font-semibold">{en.setup.auth.phavoIo}</h3>
            <p class="text-sm text-text-muted">Sign in with phavo.net. Free to start — Standard unlocks all widgets.</p>
          </button>
          <button
            type="button"
            class="flex flex-col gap-2 p-6 border rounded-lg bg-surface text-left cursor-pointer text-text transition-colors hover:border-border focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2
              {selectedTier === 'local' ? 'border-accent shadow-[0_0_0_1px_var(--color-accent)]' : 'border-border-subtle'}"
            onclick={() => { selectedTier = 'local'; nextFullStep(); }}
          >
            <h3 class="text-lg font-semibold">{en.setup.auth.localAccount}</h3>
            <p class="text-sm text-text-muted">Offline-capable — requires a Local licence key.</p>
          </button>
        </div>
        <div class="flex justify-end gap-3 flex-wrap mt-2">
          <Button variant="ghost" onclick={backToWelcome}>{en.common.back}</Button>
        </div>

      {:else if fullStep === 'auth'}
        <h2 class="text-xl font-semibold text-text">{en.setup.steps.auth}</h2>
        <div class="flex flex-col gap-3">
          {#if selectedTier === 'free' || selectedTier === 'standard'}
            <p class="text-text-muted">
              You'll be redirected to phavo.net to authenticate, then returned here automatically.
            </p>
            {#if authError}<p class="text-red-400 text-sm">{authError}</p>{/if}
            <div class="flex justify-end gap-3 flex-wrap mt-2">
              <Button variant="ghost" onclick={prevFullStep}>{en.common.back}</Button>
              <Button onclick={() => startPhavoOauth('full')}>{en.setup.auth.phavoIo}</Button>
            </div>
          {:else}
            <Input label={en.setup.auth.username} placeholder={en.setup.auth.username} bind:value={authUsername} />
            <Input label={en.setup.auth.password} type="password" placeholder={en.auth.passwordPlaceholder} bind:value={authPassword} />
            <Input label={en.setup.auth.enterLicenseKey} placeholder={en.setup.auth.enterLicenseKey} bind:value={authLicenseKey} />
            {#if authError}<p class="text-red-400 text-sm">{authError}</p>{/if}
            <div class="flex justify-end gap-3 flex-wrap mt-2">
              <Button variant="ghost" onclick={prevFullStep}>{en.common.back}</Button>
              <Button onclick={() => submitLocalAuth('full')} disabled={authLoading}>
                {authLoading ? en.common.loading : en.auth.login}
              </Button>
            </div>
          {/if}
        </div>

      {:else if fullStep === 'name'}
        <h2 class="text-xl font-semibold text-text">{en.setup.steps.dashboardName}</h2>
        <div class="flex flex-col gap-3">
          <Input label={en.settings.dashboardName} placeholder={en.setup.name.placeholder} bind:value={dashboardName} />
          <div class="flex justify-end gap-3 flex-wrap mt-2">
            <Button variant="ghost" onclick={prevFullStep}>{en.common.back}</Button>
            <Button onclick={nextFullStep}>{en.common.next}</Button>
          </div>
        </div>

      {:else if fullStep === 'location'}
        <h2 class="text-xl font-semibold text-text">{en.setup.steps.location}</h2>
        <p class="text-text-muted">{en.setup.location.subtitle}</p>

        <div class="relative">
          <Input
            label={en.settings.weatherLocation}
            placeholder={en.setup.location.placeholder}
            bind:value={locationQuery}
            oninput={onLocationInput}
          />
          {#if showSuggestions}
            <ul class="absolute top-full left-0 right-0 mt-1 py-1 list-none border border-border rounded-md bg-elevated z-10" role="listbox">
              {#each suggestions as result (result.id)}
                <li role="option" aria-selected="false">
                  <button type="button" class="w-full py-2 px-3 border-none bg-transparent text-left text-text cursor-pointer hover:bg-hover" onclick={() => selectSuggestion(result)}>
                    {result.name}, {result.country}
                  </button>
                </li>
              {/each}
            </ul>
          {/if}
        </div>

        {#if locationLoading}<p class="text-text-muted text-sm">{en.common.loading}</p>{/if}

        {#if weatherPreview && selectedLocation}
          <div class="p-4 border border-border rounded-lg bg-elevated">
            <strong class="text-text">{selectedLocation.name}</strong>
            <p class="text-sm text-text-muted mt-1">{Math.round(weatherPreview.currentTemp)}°C · {weatherPreview.humidity}% humidity · {Math.round(weatherPreview.windSpeed)} km/h</p>
          </div>
        {/if}

        {#if locationError}<p class="text-red-400 text-sm">{locationError}</p>{/if}

        <div class="flex justify-end gap-3 flex-wrap mt-2">
          <Button variant="ghost" onclick={prevFullStep}>{en.common.back}</Button>
          <Button variant="ghost" onclick={nextFullStep}>{en.setup.location.skip}</Button>
          <Button onclick={nextFullStep} disabled={!selectedLocation}>{en.common.next}</Button>
        </div>

      {:else if fullStep === 'tabs'}
        <h2 class="text-xl font-semibold text-text">{en.setup.steps.tabBuilder}</h2>
        <div class="flex flex-col gap-3">
          {#each tabs as tab, index}
            <div class="grid grid-cols-[minmax(0,1fr)_auto] gap-3 items-end">
              <input
                class="w-full py-2 px-3 border border-border rounded-md bg-elevated text-text text-sm focus:border-accent focus:ring-1 focus:ring-accent/30 outline-none"
                type="text"
                value={tab}
                oninput={(e) => updateTabName(index, (e.currentTarget as HTMLInputElement).value)}
              />
              <Button variant="ghost" onclick={() => removeTab(index)} disabled={tabs.length === 1}>
                {en.common.delete}
              </Button>
            </div>
          {/each}

          <div class="grid grid-cols-[minmax(0,1fr)_auto] gap-3 items-end">
            <input
              class="w-full py-2 px-3 border border-border rounded-md bg-elevated text-text text-sm focus:border-accent focus:ring-1 focus:ring-accent/30 outline-none"
              type="text"
              placeholder={en.setup.tabs.defaultTabName}
              bind:value={newTabName}
            />
            <Button onclick={addTab} disabled={freeTabLimitReached}>{en.setup.tabs.addTab}</Button>
          </div>

          {#if tabError}<p class="text-red-400 text-sm">{tabError}</p>{/if}
          {#if freeTabLimitReached}
            <p class="text-text-muted text-sm">{en.upgrade.tabLimit}</p>
          {/if}
        </div>

        <div class="flex justify-end gap-3 flex-wrap mt-2">
          <Button variant="ghost" onclick={prevFullStep}>{en.common.back}</Button>
          <Button onclick={handleFullTabsNext}>{en.common.next}</Button>
        </div>

      {:else if fullStep === 'widgets'}
        <h2 class="text-xl font-semibold text-text">{en.setup.steps.widgetSelect}</h2>
        <p class="text-text-muted">{en.setup.widgets.subtitle}</p>

        {#if widgetManifestLoading}
          <p class="text-text-muted text-sm">{en.common.loading}</p>
        {:else if widgetManifestError}
          <p class="text-red-400 text-sm">{widgetManifestError}</p>
          <Button onclick={() => void loadWidgetManifest()}>{en.settings.checkForUpdates}</Button>
        {:else}
          <div class="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-3">
            {#each widgetManifest as entry (entry.id)}
              {#if isWidgetDefinition(entry)}
                <button
                  type="button"
                  class="flex flex-col gap-2 p-4 border rounded-lg bg-elevated text-left text-text cursor-pointer transition-colors
                    {selectedWidgets.includes(entry.id) ? 'border-accent shadow-[0_0_0_1px_var(--color-accent)]' : 'border-border hover:border-border-strong'}"
                  onclick={() => toggleWidgetSelection(entry)}
                >
                  <span class="text-[11px] px-2 py-0.5 rounded-full bg-base text-text-muted w-fit">{entry.tier === 'free' ? 'Free' : 'Standard'}</span>
                  <strong>{entry.name}</strong>
                  <p class="text-sm text-text-muted">{entry.description}</p>
                </button>
              {:else}
                <div class="flex flex-col gap-2 p-4 border border-border rounded-lg bg-elevated text-left opacity-75">
                  <span class="text-[11px] px-2 py-0.5 rounded-full bg-base text-text-muted w-fit">LOCKED</span>
                  <strong class="text-text">{entry.name}</strong>
                  <p class="text-sm text-text-muted">{entry.description}</p>
                  <span class="text-sm" aria-hidden="true">🔒</span>
                </div>
              {/if}
            {/each}
          </div>
        {/if}

        <div class="flex justify-end gap-3 flex-wrap mt-2">
          <Button variant="ghost" onclick={prevFullStep}>{en.common.back}</Button>
          <Button onclick={() => goToFullStep('assign')}>{en.common.next}</Button>
        </div>

      {:else if fullStep === 'assign'}
        <h2 class="text-xl font-semibold text-text">{en.setup.steps.widgetAssign}</h2>
        <div class="flex flex-col gap-3">
          {#if selectedWidgets.length === 0}
            <p class="text-text-muted">No widgets selected. You can add them later from the dashboard.</p>
          {:else}
            {#each selectedWidgets as widgetId (widgetId)}
              <div class="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_220px] gap-4 items-center p-3 px-4 border border-border rounded-lg bg-elevated">
                <strong class="text-text">{getWidgetName(widgetId)}</strong>
                <Select
                  options={tabs.map((t) => ({ value: t, label: t }))}
                  value={widgetAssignments[widgetId] ?? tabs[0] ?? 'Home'}
                  onchange={(value) => updateWidgetAssignment(widgetId, value)}
                />
              </div>
            {/each}
          {/if}
        </div>
        <div class="flex justify-end gap-3 flex-wrap mt-2">
          <Button variant="ghost" onclick={prevFullStep}>{en.common.back}</Button>
          <Button onclick={handleFullAssignNext}>{en.common.next}</Button>
        </div>

      {:else if fullStep === 'config'}
        <h2 class="text-xl font-semibold text-text">{en.setup.steps.widgetConfig}</h2>
        <p class="text-text-muted">{en.setup.config.subtitle}</p>

        <div class="flex flex-col gap-3">
          {#each configurableSelections as widgetId (widgetId)}
            <div class="flex flex-col gap-3 p-4 border border-border rounded-lg bg-elevated">
              <h3 class="text-base font-semibold text-text">{getWidgetName(widgetId)}</h3>

              {#if widgetId === 'pihole'}
                <Input
                  label="Pi-hole URL"
                  type="url"
                  placeholder="https://pi-hole.local/admin/api.php"
                  value={(widgetConfigs.pihole as { url?: string } | undefined)?.url ?? ''}
                  oninput={(e) => updatePiholeField('url', (e.currentTarget as HTMLInputElement).value)}
                />
                <Input
                  label="API token"
                  placeholder="Token"
                  value={(widgetConfigs.pihole as { token?: string } | undefined)?.token ?? ''}
                  oninput={(e) => updatePiholeField('token', (e.currentTarget as HTMLInputElement).value)}
                />
                <div class="flex items-center gap-3">
                  <Button onclick={() => void testPiholeConnection()} disabled={piholeTestState === 'loading'}>
                    {piholeTestState === 'loading' ? en.common.loading : 'Test connection'}
                  </Button>
                  {#if piholeTestMessage}
                    <span class="{piholeTestState === 'success' ? 'text-green-400' : 'text-red-400'} text-sm">
                      {piholeTestMessage}
                    </span>
                  {/if}
                </div>

              {:else if widgetId === 'rss'}
                {#each getSelectedRssConfig().feeds as feed, index (feed.id)}
                  <div class="flex flex-col gap-3 p-3 border border-border-subtle rounded-md">
                    <Input label="Feed URL" type="url" placeholder="https://example.com/feed.xml"
                      value={feed.url}
                      oninput={(e) => updateRssFeed(index, { url: (e.currentTarget as HTMLInputElement).value })}
                    />
                    <Input label="Label (optional)" placeholder="My feed"
                      value={feed.label ?? ''}
                      oninput={(e) => updateRssFeed(index, { label: (e.currentTarget as HTMLInputElement).value })}
                    />
                    <Select
                      label="Auth"
                      options={[
                        { value: 'none', label: 'None' },
                        { value: 'basic', label: 'Basic' },
                        { value: 'bearer', label: 'Bearer' },
                      ]}
                      value={feed.authType}
                      onchange={(value) => updateRssFeed(index, { authType: value as RssFeedDraft['authType'] })}
                    />
                    {#if feed.authType === 'basic'}
                      <Input label="Username" value={feed.username ?? ''}
                        oninput={(e) => updateRssFeed(index, { username: (e.currentTarget as HTMLInputElement).value })}
                      />
                      <Input label="Password" type="password" value={feed.password ?? ''}
                        oninput={(e) => updateRssFeed(index, { password: (e.currentTarget as HTMLInputElement).value })}
                      />
                    {:else if feed.authType === 'bearer'}
                      <Input label="Bearer token" value={feed.token ?? ''}
                        oninput={(e) => updateRssFeed(index, { token: (e.currentTarget as HTMLInputElement).value })}
                      />
                    {/if}
                    <Button variant="ghost" onclick={() => removeRssFeed(index)}>{en.common.delete}</Button>
                  </div>
                {/each}
                <Button variant="secondary" onclick={addRssFeed}>{en.common.add}</Button>

              {:else if widgetId === 'links'}
                <Input
                  label="Group label"
                  value={getSelectedLinksConfig().groups[0]?.label ?? 'Quick Links'}
                  oninput={(e) => updateLinksGroupLabel((e.currentTarget as HTMLInputElement).value)}
                />
                {#each getSelectedLinksConfig().groups[0]?.links ?? [] as link, index}
                  <div class="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3">
                    <Input label="Label" value={link.title}
                      oninput={(e) => updateLink(index, 'title', (e.currentTarget as HTMLInputElement).value)}
                    />
                    <Input label="URL" type="url" value={link.url}
                      oninput={(e) => updateLink(index, 'url', (e.currentTarget as HTMLInputElement).value)}
                    />
                  </div>
                {/each}

              {:else if widgetId === 'weather'}
                {#if selectedLocation}
                  <p class="text-text-muted text-sm">Weather will use <strong>{selectedLocation.name}</strong> from the location step.</p>
                {:else}
                  <p class="text-text-muted text-sm">No location selected — configure in Settings after launch.</p>
                {/if}

              {:else}
                <p class="text-text-muted text-sm">Configure in Settings after launch.</p>
              {/if}
            </div>
          {/each}
        </div>

        <div class="flex justify-end gap-3 flex-wrap mt-2">
          <Button variant="ghost" onclick={prevFullStep}>{en.common.back}</Button>
          <Button onclick={nextFullStep}>{en.common.next}</Button>
        </div>

      {:else}
        <!-- done -->
        <h2 class="text-xl font-semibold text-text">{en.setup.done.title}</h2>
        <p class="text-text-muted">{en.setup.done.subtitle}</p>
        {#if setupError}<p class="text-red-400 text-sm">{setupError}</p>{/if}
        <div class="flex justify-end gap-3 flex-wrap mt-2">
          <Button variant="ghost" onclick={() => goToFullStep(shouldSkipConfigStep() ? 'assign' : 'config')}>{en.common.back}</Button>
          <Button onclick={finishSetup} disabled={setupSaving}>
            {setupSaving ? en.common.loading : en.setup.done.launch}
          </Button>
        </div>
      {/if}
    </div>
  {/if}
</div>

</div>
