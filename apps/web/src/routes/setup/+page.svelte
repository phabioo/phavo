<script lang="ts">
import type { WeatherMetrics } from '@phavo/agent';
import {
  isWidgetDefinition,
  isWidgetTeaserDefinition,
  type Tab,
  type WidgetInstance,
  type WidgetManifestEntry,
  type WidgetSize,
} from '@phavo/types';
import { Button, Card, Input, Select } from '@phavo/ui';
import { onMount } from 'svelte';
import { goto } from '$app/navigation';
import { page } from '$app/state';
import en from '$lib/i18n/en.json';

type SetupMode = 'select' | 'quick' | 'full';
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
type AuthMode = 'phavo-io' | 'local';
type QuickAuthMethod = 'choice' | 'phavo-io' | 'local';
type ApiResponse<T> = { ok: true; data: T } | { ok: false; error: string };
type SessionInfo = {
  authMode: AuthMode;
  validatedAt: number;
  graceUntil: number | null;
};
type LoginSuccess = {
  tier?: Tier;
  requiresTotp?: boolean;
  partialToken?: string;
};
type GeoResult = {
  id: number;
  name: string;
  country: string;
  latitude: number;
  longitude: number;
};
type SetupLocation = {
  name: string;
  latitude: number;
  longitude: number;
};
type RssFeedDraft = {
  id: string;
  url: string;
  label?: string | undefined;
  authType: 'none' | 'basic' | 'bearer';
  username?: string | undefined;
  password?: string | undefined;
  token?: string | undefined;
};
type LinksDraft = {
  groups: Array<{
    label: string;
    links: Array<{
      title: string;
      url: string;
    }>;
  }>;
};
type PersistedSetupState = {
  setupComplete: false;
  mode: SetupMode;
  quickStep: QuickStep;
  fullStep: FullStep;
  quickAuthMethod: QuickAuthMethod;
  selectedTier: Tier;
  sessionTier: Tier | null;
  currentAuthMode: AuthMode | null;
  authUsername: string;
  dashboardName: string;
  locationQuery: string;
  selectedLocation: SetupLocation | null;
  tabs: string[];
  selectedWidgets: string[];
  widgetAssignments: Record<string, string>;
  widgetConfigs: Record<string, unknown>;
};

const SETUP_KEY = 'phavo_setup_state';
const PHAVO_IO_URL = 'https://phavo.io';
const quickSteps: QuickStep[] = ['auth', 'location', 'done'];
const fullSteps: FullStep[] = [
  'tier',
  'auth',
  'name',
  'location',
  'tabs',
  'widgets',
  'assign',
  'config',
  'done',
];
const configurableWidgetIds = new Set(['pihole', 'rss', 'links', 'weather']);

function resolveSetupModeFromUrl(): SetupMode {
  const requestedMode = page.url.searchParams.get('mode');
  return requestedMode === 'quick' || requestedMode === 'full' ? requestedMode : 'select';
}

let mode = $state<SetupMode>(resolveSetupModeFromUrl());
let quickStep = $state<QuickStep>('auth');
let fullStep = $state<FullStep>('tier');
let quickAuthMethod = $state<QuickAuthMethod>('choice');

let selectedTier = $state<Tier>('free');
let sessionTier = $state<Tier | null>(null);
let currentAuthMode = $state<AuthMode | null>(null);
let dashboardName = $state('My Dashboard');

let authUsername = $state('');
let authPassword = $state('');
let authLicenseKey = $state('');
let authError = $state('');
let authLoading = $state(false);

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
let hydrated = $state(false);

const quickStepIndex = $derived(quickSteps.indexOf(quickStep));
const fullStepIndex = $derived(fullSteps.indexOf(fullStep));
const effectiveTier = $derived(sessionTier ?? selectedTier);
const freeTabLimitReached = $derived(effectiveTier === 'free' && tabs.length >= 1);
const configurableSelections = $derived(
  selectedWidgets.filter((widgetId) => configurableWidgetIds.has(widgetId)),
);

function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;

  const match = document.cookie.match(
    new RegExp(`(?:^|; )${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}=([^;]*)`),
  );

  const value = match?.[1];
  return value ? decodeURIComponent(value) : null;
}

function encodeOauthState(nextMode: 'quick' | 'full'): string {
  return btoa(JSON.stringify({ source: 'setup', mode: nextMode }));
}

function cloneConfig<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function makePersistableWidgetConfigs(): Record<string, unknown> {
  const persisted: Record<string, unknown> = {};

  for (const [widgetId, value] of Object.entries(widgetConfigs)) {
    if (widgetId === 'pihole') {
      const config = value as { url?: string };
      persisted[widgetId] = { url: config.url ?? '' };
      continue;
    }

    if (widgetId === 'rss') {
      const config = value as { feeds?: RssFeedDraft[] };
      persisted[widgetId] = {
        feeds: (config.feeds ?? []).map((feed) => ({
          id: feed.id,
          url: feed.url,
          label: feed.label,
          authType: feed.authType,
        })),
      };
      continue;
    }

    persisted[widgetId] = cloneConfig(value);
  }

  return persisted;
}

function buildPersistedState(): PersistedSetupState {
  return {
    setupComplete: false,
    mode,
    quickStep,
    fullStep,
    quickAuthMethod,
    selectedTier,
    sessionTier,
    currentAuthMode,
    authUsername,
    dashboardName,
    locationQuery,
    selectedLocation,
    tabs: [...tabs],
    selectedWidgets: [...selectedWidgets],
    widgetAssignments: { ...widgetAssignments },
    widgetConfigs: makePersistableWidgetConfigs(),
  };
}

function persistSetupState() {
  if (!hydrated || typeof sessionStorage === 'undefined') return;
  sessionStorage.setItem(SETUP_KEY, JSON.stringify(buildPersistedState()));
}

function clearPersistedSetupState() {
  if (typeof sessionStorage === 'undefined') return;
  sessionStorage.removeItem(SETUP_KEY);
}

function restorePersistedState(raw: string) {
  const parsed = JSON.parse(raw) as Partial<PersistedSetupState>;

  mode = parsed.mode === 'quick' || parsed.mode === 'full' ? parsed.mode : 'select';
  quickStep = quickSteps.includes(parsed.quickStep as QuickStep)
    ? (parsed.quickStep as QuickStep)
    : 'auth';
  fullStep = fullSteps.includes(parsed.fullStep as FullStep)
    ? (parsed.fullStep as FullStep)
    : 'tier';
  quickAuthMethod =
    parsed.quickAuthMethod === 'phavo-io' || parsed.quickAuthMethod === 'local'
      ? parsed.quickAuthMethod
      : 'choice';
  selectedTier =
    parsed.selectedTier === 'standard' || parsed.selectedTier === 'local'
      ? parsed.selectedTier
      : 'free';
  sessionTier =
    parsed.sessionTier === 'free' ||
    parsed.sessionTier === 'standard' ||
    parsed.sessionTier === 'local'
      ? parsed.sessionTier
      : null;
  currentAuthMode =
    parsed.currentAuthMode === 'phavo-io' || parsed.currentAuthMode === 'local'
      ? parsed.currentAuthMode
      : null;
  authUsername = typeof parsed.authUsername === 'string' ? parsed.authUsername : '';
  dashboardName = typeof parsed.dashboardName === 'string' ? parsed.dashboardName : 'My Dashboard';
  locationQuery = typeof parsed.locationQuery === 'string' ? parsed.locationQuery : '';
  selectedLocation = parsed.selectedLocation ?? null;
  tabs = Array.isArray(parsed.tabs) && parsed.tabs.length > 0 ? parsed.tabs : ['Home'];
  selectedWidgets = Array.isArray(parsed.selectedWidgets) ? parsed.selectedWidgets : [];
  widgetAssignments =
    parsed.widgetAssignments && typeof parsed.widgetAssignments === 'object'
      ? parsed.widgetAssignments
      : {};
  widgetConfigs =
    parsed.widgetConfigs && typeof parsed.widgetConfigs === 'object' ? parsed.widgetConfigs : {};
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

  const response = await fetch(url, {
    ...init,
    method,
    headers,
    body,
    credentials: 'same-origin',
  });

  const json = (await response.json().catch(() => null)) as ApiResponse<T> | null;

  if (json && typeof json === 'object' && 'ok' in json) {
    return json;
  }

  return { ok: false, error: response.ok ? 'Unexpected response' : 'Request failed' };
}

function createDefaultRssFeed(): RssFeedDraft {
  return {
    id: crypto.randomUUID(),
    url: '',
    label: '',
    authType: 'none',
    username: '',
    password: '',
    token: '',
  };
}

function ensureWidgetConfigDefaults(widgetId: string) {
  if (widgetId === 'pihole' && !widgetConfigs.pihole) {
    widgetConfigs = { ...widgetConfigs, pihole: { url: '', token: '' } };
  }

  if (widgetId === 'rss' && !widgetConfigs.rss) {
    widgetConfigs = {
      ...widgetConfigs,
      rss: { feeds: [createDefaultRssFeed()] },
    };
  }

  if (widgetId === 'links' && !widgetConfigs.links) {
    widgetConfigs = {
      ...widgetConfigs,
      links: {
        groups: [
          {
            label: 'Quick Links',
            links: [
              { title: '', url: '' },
              { title: '', url: '' },
              { title: '', url: '' },
            ],
          },
        ],
      } satisfies LinksDraft,
    };
  }

  if (widgetId === 'weather' && selectedLocation) {
    widgetConfigs = { ...widgetConfigs, weather: selectedLocation };
  }
}

function getDefaultWidgetSize(widgetId: string): WidgetSize {
  const widget = widgetManifest.find(
    (entry): entry is Extract<WidgetManifestEntry, { sizes: WidgetSize[] }> =>
      entry.id === widgetId && isWidgetDefinition(entry),
  );

  if (widget && widget.sizes.length > 0) {
    return widget.sizes[0] ?? 'M';
  }

  return 'M';
}

function getWidgetName(widgetId: string): string {
  return widgetManifest.find((entry) => entry.id === widgetId)?.name ?? widgetId;
}

function getSelectedRssConfig(): { feeds: RssFeedDraft[] } {
  const config = widgetConfigs.rss as { feeds?: RssFeedDraft[] } | undefined;
  return { feeds: config?.feeds ? [...config.feeds] : [createDefaultRssFeed()] };
}

function getSelectedLinksConfig(): LinksDraft {
  const config = widgetConfigs.links as LinksDraft | undefined;
  return (
    config ?? {
      groups: [
        {
          label: 'Quick Links',
          links: [
            { title: '', url: '' },
            { title: '', url: '' },
            { title: '', url: '' },
          ],
        },
      ],
    }
  );
}

function updateQuickStep(nextStep: QuickStep) {
  quickStep = nextStep;
  persistSetupState();
}

function updateFullStep(nextStep: FullStep) {
  fullStep = nextStep;
  persistSetupState();
}

function setMode(nextMode: SetupMode) {
  mode = nextMode;

  if (typeof window !== 'undefined') {
    const nextUrl = new URL(window.location.href);

    if (nextMode === 'quick' || nextMode === 'full') {
      nextUrl.searchParams.set('mode', nextMode);
    } else {
      nextUrl.searchParams.delete('mode');
    }

    window.history.replaceState({}, '', `${nextUrl.pathname}${nextUrl.search}`);
  }

  persistSetupState();
}

function resetSetupError() {
  setupError = '';
}

async function loadWidgetManifest() {
  widgetManifestLoading = true;
  widgetManifestError = '';

  try {
    const response = await apiRequest<WidgetManifestEntry[]>('/api/v1/widgets');
    if (!response.ok) {
      widgetManifestError = response.error;
      return;
    }

    widgetManifest = response.data;

    if (currentAuthMode === 'local') {
      sessionTier = 'local';
      return;
    }

    sessionTier = widgetManifest.some((entry) => isWidgetTeaserDefinition(entry))
      ? 'free'
      : 'standard';
  } catch {
    widgetManifestError = en.errors.networkError;
  } finally {
    widgetManifestLoading = false;
  }
}

async function syncSessionContext() {
  const sessionResponse = await apiRequest<SessionInfo>('/api/v1/auth/session');

  if (!sessionResponse.ok) {
    authError = sessionResponse.error;
    return false;
  }

  currentAuthMode = sessionResponse.data.authMode;
  await loadWidgetManifest();
  return true;
}

function startPhavoOauth(nextMode: 'quick' | 'full') {
  authError = '';
  currentAuthMode = 'phavo-io';
  quickAuthMethod = 'phavo-io';
  persistSetupState();

  const redirectUri = `${window.location.origin}/auth/callback`;
  const authorizeUrl = new URL(`${PHAVO_IO_URL}/oauth/authorize`);
  authorizeUrl.searchParams.set('response_type', 'code');
  authorizeUrl.searchParams.set('redirect_uri', redirectUri);
  authorizeUrl.searchParams.set('state', encodeOauthState(nextMode));

  window.location.assign(authorizeUrl.toString());
}

async function submitLocalAuth(nextMode: 'quick' | 'full') {
  authLoading = true;
  authError = '';

  try {
    const response = await apiRequest<LoginSuccess>('/api/v1/auth/login', {
      method: 'POST',
      body: {
        authMode: 'local',
        username: authUsername,
        password: authPassword,
        licenseKey: authLicenseKey.trim() || undefined,
      },
    });

    if (!response.ok) {
      authError = response.error;
      return;
    }

    if (response.data.requiresTotp) {
      authError = 'Two-factor login is not available in setup yet. Sign in from the login page.';
      return;
    }

    sessionTier = response.data.tier ?? sessionTier;
    currentAuthMode = 'local';

    const sessionOk = await syncSessionContext();
    if (!sessionOk) return;

    if (nextMode === 'quick') {
      updateQuickStep('location');
      return;
    }

    updateFullStep('name');
  } catch {
    authError = en.errors.networkError;
  } finally {
    authLoading = false;
  }
}

async function handleOauthReturn(status: string | null, modeParam: string | null, message: string | null) {
  if (!status) return;

  const oauthMode: 'quick' | 'full' = modeParam === 'quick' ? 'quick' : 'full';
  mode = oauthMode;

  if (oauthMode === 'quick') {
    quickAuthMethod = 'phavo-io';
  }

  if (status === 'error') {
    authError = message ?? 'Authentication failed';
    return;
  }

  const sessionOk = await syncSessionContext();
  if (!sessionOk) return;

  if (oauthMode === 'quick') {
    updateQuickStep('location');
    return;
  }

  updateFullStep('name');
}

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

      if (suggestions.length === 0) {
        locationError = en.settings.locationSuggestionsEmpty;
      }
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
    const response = await apiRequest<WeatherMetrics>(`/api/v1/weather?${params.toString()}`);

    if (!response.ok) {
      locationError = response.error;
      weatherPreview = null;
      return;
    }

    weatherPreview = response.data;
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

function advanceQuickFromLocation() {
  updateQuickStep('done');
}

function advanceFullFromLocation() {
  updateFullStep('tabs');
}

function addTab() {
  tabError = '';

  if (freeTabLimitReached) {
    tabError = en.upgrade.tabLimit;
    return;
  }

  const label = newTabName.trim() || `Tab ${tabs.length + 1}`;
  tabs = [...tabs, label];
  newTabName = '';

  for (const widgetId of selectedWidgets) {
    if (!widgetAssignments[widgetId]) {
      widgetAssignments = { ...widgetAssignments, [widgetId]: tabs[0] ?? label };
    }
  }
}

function updateTabName(index: number, value: string) {
  const previousLabel = tabs[index] ?? '';
  tabs = tabs.map((tab, currentIndex) => (currentIndex === index ? value : tab));

  const updatedAssignments = { ...widgetAssignments };
  for (const [widgetId, tabLabel] of Object.entries(updatedAssignments)) {
    if (tabLabel === previousLabel) {
      updatedAssignments[widgetId] = value;
    }
  }
  widgetAssignments = updatedAssignments;
}

function removeTab(index: number) {
  if (tabs.length === 1) return;

  const removed = tabs[index];
  tabs = tabs.filter((_, currentIndex) => currentIndex !== index);

  const fallbackTab = tabs[0] ?? 'Home';
  widgetAssignments = Object.fromEntries(
    Object.entries(widgetAssignments).map(([widgetId, tabLabel]) => [
      widgetId,
      tabLabel === removed ? fallbackTab : tabLabel,
    ]),
  );
}

function toggleWidgetSelection(entry: WidgetManifestEntry) {
  if (!isWidgetDefinition(entry)) return;

  const alreadySelected = selectedWidgets.includes(entry.id);
  if (alreadySelected) {
    selectedWidgets = selectedWidgets.filter((widgetId) => widgetId !== entry.id);

    const nextAssignments = { ...widgetAssignments };
    delete nextAssignments[entry.id];
    widgetAssignments = nextAssignments;

    const nextConfigs = { ...widgetConfigs };
    delete nextConfigs[entry.id];
    widgetConfigs = nextConfigs;
    return;
  }

  selectedWidgets = [...selectedWidgets, entry.id];
  widgetAssignments = { ...widgetAssignments, [entry.id]: tabs[0] ?? 'Home' };
  ensureWidgetConfigDefaults(entry.id);
}

function updateWidgetAssignment(widgetId: string, tabLabel: string) {
  widgetAssignments = { ...widgetAssignments, [widgetId]: tabLabel };
}

function updatePiholeField(field: 'url' | 'token', value: string) {
  const current = (widgetConfigs.pihole as { url?: string; token?: string } | undefined) ?? {
    url: '',
    token: '',
  };
  widgetConfigs = {
    ...widgetConfigs,
    pihole: { ...current, [field]: value },
  };
}

async function testPiholeConnection() {
  const config = (widgetConfigs.pihole as { url?: string; token?: string } | undefined) ?? {};

  piholeTestState = 'loading';
  piholeTestMessage = '';

  try {
    const response = await apiRequest<unknown>('/api/v1/pihole/test', {
      method: 'POST',
      body: {
        url: config.url ?? '',
        token: config.token ?? '',
      },
    });

    if (!response.ok) {
      piholeTestState = 'error';
      piholeTestMessage = response.error;
      return;
    }

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
  config.feeds = config.feeds.filter((_, currentIndex) => currentIndex !== index);
  widgetConfigs = { ...widgetConfigs, rss: config.feeds.length > 0 ? config : { feeds: [createDefaultRssFeed()] } };
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

function shouldSkipConfigStep(): boolean {
  return configurableSelections.length === 0;
}

async function reconcileTabs(): Promise<Tab[]> {
  const desiredLabels = tabs.map((label) => label.trim()).filter(Boolean);
  const normalizedLabels = desiredLabels.length > 0 ? desiredLabels : ['Home'];

  const existingTabsResponse = await apiRequest<Tab[]>('/api/v1/tabs');
  if (!existingTabsResponse.ok) {
    throw new Error(existingTabsResponse.error);
  }

  const existingTabs = [...existingTabsResponse.data].sort((left, right) => left.order - right.order);

  for (const tab of existingTabs) {
    const widgetResponse = await apiRequest<WidgetInstance[]>(
      `/api/v1/tabs/${encodeURIComponent(tab.id)}/widgets`,
    );

    if (!widgetResponse.ok) {
      throw new Error(widgetResponse.error);
    }

    for (const widgetInstance of widgetResponse.data) {
      const deleteResponse = await apiRequest<null>(
        `/api/v1/widget-instances/${encodeURIComponent(widgetInstance.id)}`,
        { method: 'DELETE' },
      );

      if (!deleteResponse.ok) {
        throw new Error(deleteResponse.error);
      }
    }
  }

  const resolvedTabs: Tab[] = [];

  for (const [index, label] of normalizedLabels.entries()) {
    const existing = existingTabs[index];

    if (existing) {
      const updateResponse = await apiRequest<Tab>(`/api/v1/tabs/${encodeURIComponent(existing.id)}`, {
        method: 'PATCH',
        body: { label, order: index },
      });

      if (!updateResponse.ok) {
        throw new Error(updateResponse.error);
      }

      resolvedTabs.push(updateResponse.data);
      continue;
    }

    const createResponse = await apiRequest<Tab>('/api/v1/tabs', {
      method: 'POST',
      body: { label },
    });

    if (!createResponse.ok) {
      throw new Error(createResponse.error);
    }

    const created = createResponse.data;
    const reorderResponse = await apiRequest<Tab>(`/api/v1/tabs/${encodeURIComponent(created.id)}`, {
      method: 'PATCH',
      body: { order: index },
    });

    if (!reorderResponse.ok) {
      throw new Error(reorderResponse.error);
    }

    resolvedTabs.push(reorderResponse.data);
  }

  for (let index = existingTabs.length - 1; index >= normalizedLabels.length; index -= 1) {
    const tab = existingTabs[index];
    if (!tab) continue;

    const deleteResponse = await apiRequest<null>(`/api/v1/tabs/${encodeURIComponent(tab.id)}`, {
      method: 'DELETE',
    });

    if (!deleteResponse.ok) {
      throw new Error(deleteResponse.error);
    }
  }

  return resolvedTabs;
}

async function createWidgetInstances(resolvedTabs: Tab[]): Promise<WidgetInstance[]> {
  const tabByLabel = new Map(resolvedTabs.map((tab) => [tab.label, tab.id]));
  const instances: WidgetInstance[] = [];

  for (const widgetId of selectedWidgets) {
    const tabLabel = widgetAssignments[widgetId] ?? resolvedTabs[0]?.label;
    const tabId = tabLabel ? tabByLabel.get(tabLabel) : resolvedTabs[0]?.id;

    if (!tabId) continue;

    const createResponse = await apiRequest<WidgetInstance>('/api/v1/widget-instances', {
      method: 'POST',
      body: {
        widgetId,
        tabId,
        size: getDefaultWidgetSize(widgetId),
      },
    });

    if (!createResponse.ok) {
      throw new Error(createResponse.error);
    }

    const instance = createResponse.data;
    instances.push(instance);

    if (widgetId === 'pihole' || widgetId === 'rss' || widgetId === 'links') {
      const configResponse = await apiRequest<{ saved: boolean }>(
        `/api/v1/widgets/${encodeURIComponent(instance.id)}/config`,
        {
          method: 'POST',
          body: { config: widgetConfigs[widgetId] ?? {} },
        },
      );

      if (!configResponse.ok) {
        throw new Error(configResponse.error);
      }
    }
  }

  return instances;
}

async function finishSetup() {
  setupSaving = true;
  setupError = '';

  try {
    const resolvedTabs = await reconcileTabs();
    const createdInstances = await createWidgetInstances(resolvedTabs);

    const configResponse = await apiRequest<unknown>('/api/v1/config', {
      method: 'POST',
      body: {
        dashboardName,
        location: selectedLocation,
        tabs: resolvedTabs,
        widgetInstances: createdInstances,
        setupComplete: true,
      },
    });

    if (!configResponse.ok) {
      setupError = configResponse.error;
      return;
    }

    clearPersistedSetupState();
    await goto('/');
  } catch (error) {
    setupError = error instanceof Error ? error.message : 'Could not save settings — please try again.';
  } finally {
    setupSaving = false;
  }
}

function handleFullTabsNext() {
  updateFullStep('widgets');
  if (widgetManifest.length === 0) {
    void loadWidgetManifest();
  }
}

function handleFullAssignNext() {
  if (shouldSkipConfigStep()) {
    updateFullStep('done');
    return;
  }

  updateFullStep('config');
}

function handleFullConfigNext() {
  updateFullStep('done');
}

onMount(() => {
  const stored = sessionStorage.getItem(SETUP_KEY);
  if (stored) {
    try {
      restorePersistedState(stored);
    } catch {
      clearPersistedSetupState();
    }
  }

  hydrated = true;

  const url = new URL(window.location.href);
  const oauth = url.searchParams.get('oauth');
  const oauthMode = url.searchParams.get('mode');
  const message = url.searchParams.get('message');

  if (oauth) {
    void handleOauthReturn(oauth, oauthMode, message);
    window.history.replaceState({}, '', '/setup');
  }
});

$effect(() => {
  mode;
  quickStep;
  fullStep;
  quickAuthMethod;
  selectedTier;
  sessionTier;
  currentAuthMode;
  authUsername;
  dashboardName;
  locationQuery;
  selectedLocation;
  tabs;
  selectedWidgets;
  widgetAssignments;
  widgetConfigs;
  persistSetupState();
});
</script>

<div class="setup-container">
  {#if mode === 'select'}
    <div class="setup-welcome">
      <h1 class="setup-title">{en.setup.welcome.title}</h1>
      <p class="setup-subtitle">{en.setup.welcome.subtitle}</p>

      <div class="setup-options">
        <Card>
          <a class="setup-option" href="/setup?mode=quick">
            <h2>{en.setup.quickSetup}</h2>
            <p>{en.setup.quickSetupDescription}</p>
          </a>
        </Card>

        <Card>
          <a class="setup-option" href="/setup?mode=full">
            <h2>{en.setup.fullSetup}</h2>
            <p>{en.setup.fullSetupDescription}</p>
          </a>
        </Card>
      </div>
    </div>
  {:else if mode === 'quick'}
    <div class="setup-wizard">
      <div class="step-indicator">
        {#each quickSteps as _, index}
          <span class="step-dot" class:active={index <= quickStepIndex}></span>
        {/each}
      </div>

      {#if quickStep === 'auth'}
        <h2>{en.setup.steps.auth}</h2>

        {#if quickAuthMethod === 'choice'}
          <div class="step-content compact-grid">
            <Button onclick={() => (quickAuthMethod = 'phavo-io')}>{en.setup.auth.phavoIo}</Button>
            <Button variant="secondary" onclick={() => (quickAuthMethod = 'local')}>{en.setup.auth.localAccount}</Button>
          </div>
        {:else if quickAuthMethod === 'phavo-io'}
          <div class="step-content">
            <p>Continue in phavo.io to create or validate your account, then return here automatically.</p>

            {#if authError}
              <p class="form-error">{authError}</p>
            {/if}

            <div class="step-actions">
              <Button variant="ghost" onclick={() => (quickAuthMethod = 'choice')}>{en.common.back}</Button>
              <Button onclick={() => startPhavoOauth('quick')}>{en.setup.auth.phavoIo}</Button>
            </div>
          </div>
        {:else}
          <div class="step-content">
            <Input label={en.setup.auth.username} placeholder={en.setup.auth.username} bind:value={authUsername} />
            <Input label={en.setup.auth.password} type="password" placeholder={en.auth.passwordPlaceholder} bind:value={authPassword} />
            <Input label={en.setup.auth.enterLicenseKey} placeholder={en.setup.auth.enterLicenseKey} bind:value={authLicenseKey} />

            {#if authError}
              <p class="form-error">{authError}</p>
            {/if}

            <div class="step-actions">
              <Button variant="ghost" onclick={() => (quickAuthMethod = 'choice')}>{en.common.back}</Button>
              <Button onclick={() => submitLocalAuth('quick')} disabled={authLoading}>
                {authLoading ? en.common.loading : en.auth.login}
              </Button>
            </div>
          </div>
        {/if}
      {:else if quickStep === 'location'}
        <h2>{en.setup.location.title}</h2>
        <p>{en.setup.location.subtitle}</p>

        <div class="location-field">
          <Input
            label={en.setup.location.title}
            placeholder={en.setup.location.placeholder}
            bind:value={locationQuery}
            oninput={onLocationInput}
          />

          {#if showSuggestions}
            <ul class="suggestions" role="listbox">
              {#each suggestions as result (result.id)}
                <li role="option" aria-selected="false">
                  <button type="button" onclick={() => selectSuggestion(result)}>
                    {result.name}, {result.country}
                  </button>
                </li>
              {/each}
            </ul>
          {/if}
        </div>

        {#if locationLoading}
          <p>{en.common.loading}</p>
        {/if}

        {#if weatherPreview}
          <div class="preview-card">
            <strong>{selectedLocation?.name}</strong>
            <p>{Math.round(weatherPreview.currentTemp)}°C · {weatherPreview.humidity}% humidity · {Math.round(weatherPreview.windSpeed)} km/h wind</p>
          </div>
        {/if}

        {#if locationError}
          <p class="form-error">{locationError}</p>
        {/if}

        <div class="step-actions">
          <Button variant="ghost" onclick={advanceQuickFromLocation}>{en.common.skip}</Button>
          <Button onclick={advanceQuickFromLocation}>{en.common.next}</Button>
        </div>
      {:else}
        <h2>{en.setup.done.title}</h2>
        <p>{en.setup.done.subtitle}</p>

        {#if setupError}
          <p class="form-error">{setupError}</p>
        {/if}

        <Button onclick={finishSetup} disabled={setupSaving}>
          {setupSaving ? en.common.loading : en.setup.done.launch}
        </Button>
      {/if}
    </div>
  {:else}
    <div class="setup-wizard wide">
      <div class="step-indicator">
        {#each fullSteps as _, index}
          <span class="step-dot" class:active={index <= fullStepIndex}></span>
        {/each}
      </div>

      {#if fullStep === 'tier'}
        <h2>{en.setup.steps.tierSelect}</h2>
        <div class="step-content compact-grid">
          <button class:selected-card={selectedTier === 'free'} class="tier-card" type="button" onclick={() => (selectedTier = 'free')}>
            <strong>Free</strong>
            <span>Core system widgets and one tab.</span>
          </button>
          <button class:selected-card={selectedTier === 'standard'} class="tier-card" type="button" onclick={() => (selectedTier = 'standard')}>
            <strong>Standard</strong>
            <span>Unlock Pi-hole, RSS, Links, and unlimited tabs.</span>
          </button>
          <button class:selected-card={selectedTier === 'local'} class="tier-card" type="button" onclick={() => (selectedTier = 'local')}>
            <strong>Local</strong>
            <span>Offline-capable local licence activation.</span>
          </button>
        </div>

        <div class="step-actions">
          <Button variant="ghost" onclick={() => setMode('select')}>{en.common.back}</Button>
          <Button onclick={() => updateFullStep('auth')}>{en.common.next}</Button>
        </div>
      {:else if fullStep === 'auth'}
        <h2>{en.setup.steps.auth}</h2>

        <div class="step-content">
          {#if selectedTier === 'local'}
            <Input label={en.setup.auth.username} placeholder={en.setup.auth.username} bind:value={authUsername} />
            <Input label={en.setup.auth.password} type="password" placeholder={en.auth.passwordPlaceholder} bind:value={authPassword} />
            <Input label={en.setup.auth.enterLicenseKey} placeholder={en.setup.auth.enterLicenseKey} bind:value={authLicenseKey} />
          {:else}
            <p>{selectedTier === 'standard' ? 'Use phavo.io to validate your Standard licence and return here.' : 'Continue with phavo.io to sign in and return to setup.'}</p>
          {/if}

          {#if authError}
            <p class="form-error">{authError}</p>
          {/if}
        </div>

        <div class="step-actions">
          <Button variant="ghost" onclick={() => updateFullStep('tier')}>{en.common.back}</Button>
          {#if selectedTier === 'local'}
            <Button onclick={() => submitLocalAuth('full')} disabled={authLoading}>
              {authLoading ? en.common.loading : en.auth.login}
            </Button>
          {:else}
            <Button onclick={() => startPhavoOauth('full')}>{en.setup.auth.phavoIo}</Button>
          {/if}
        </div>
      {:else if fullStep === 'name'}
        <h2>{en.setup.name.title}</h2>
        <Input label={en.settings.dashboardName} placeholder={en.setup.name.placeholder} bind:value={dashboardName} />

        <div class="step-actions">
          <Button variant="ghost" onclick={() => updateFullStep('auth')}>{en.common.back}</Button>
          <Button onclick={() => updateFullStep('location')}>{en.common.next}</Button>
        </div>
      {:else if fullStep === 'location'}
        <h2>{en.setup.location.title}</h2>
        <p>{en.setup.location.subtitle}</p>

        <div class="location-field">
          <Input
            label={en.settings.weatherLocation}
            placeholder={en.setup.location.placeholder}
            bind:value={locationQuery}
            oninput={onLocationInput}
          />

          {#if showSuggestions}
            <ul class="suggestions" role="listbox">
              {#each suggestions as result (result.id)}
                <li role="option" aria-selected="false">
                  <button type="button" onclick={() => selectSuggestion(result)}>
                    {result.name}, {result.country}
                  </button>
                </li>
              {/each}
            </ul>
          {/if}
        </div>

        {#if locationLoading}
          <p>{en.common.loading}</p>
        {/if}

        {#if weatherPreview}
          <div class="preview-card">
            <strong>{selectedLocation?.name}</strong>
            <p>{Math.round(weatherPreview.currentTemp)}°C · {weatherPreview.humidity}% humidity · {Math.round(weatherPreview.windSpeed)} km/h wind</p>
          </div>
        {/if}

        {#if locationError}
          <p class="form-error">{locationError}</p>
        {/if}

        <div class="step-actions">
          <Button variant="ghost" onclick={() => updateFullStep('name')}>{en.common.back}</Button>
          <Button variant="ghost" onclick={advanceFullFromLocation}>{en.common.skip}</Button>
          <Button onclick={advanceFullFromLocation}>{en.common.next}</Button>
        </div>
      {:else if fullStep === 'tabs'}
        <h2>{en.setup.tabs.title}</h2>
        <p>Free accounts can keep one tab. Standard and Local can add more.</p>

        <div class="step-content">
          {#each tabs as tab, index}
            <div class="row-field">
              <input class="text-input" type="text" value={tab} oninput={(event) => updateTabName(index, (event.currentTarget as HTMLInputElement).value)} />
              <Button variant="ghost" onclick={() => removeTab(index)} disabled={tabs.length === 1}>{en.common.delete}</Button>
            </div>
          {/each}

          <div class="row-field">
            <input class="text-input" type="text" placeholder={en.setup.tabs.defaultTabName} bind:value={newTabName} />
            <Button onclick={addTab} disabled={freeTabLimitReached}>{en.setup.tabs.addTab}</Button>
          </div>

          {#if tabError}
            <p class="form-error">{tabError}</p>
          {/if}
        </div>

        <div class="step-actions">
          <Button variant="ghost" onclick={() => updateFullStep('location')}>{en.common.back}</Button>
          <Button onclick={handleFullTabsNext}>{en.common.next}</Button>
        </div>
      {:else if fullStep === 'widgets'}
        <h2>{en.setup.widgets.title}</h2>
        <p>{en.setup.widgets.subtitle}</p>

        {#if widgetManifestLoading}
          <p>{en.common.loading}</p>
        {:else if widgetManifestError}
          <p class="form-error">{widgetManifestError}</p>
        {:else}
          <div class="widget-grid">
            {#each widgetManifest as entry (entry.id)}
              {#if isWidgetDefinition(entry)}
                <button
                  type="button"
                  class="widget-card"
                  class:selected-card={selectedWidgets.includes(entry.id)}
                  onclick={() => toggleWidgetSelection(entry)}
                >
                  <span class="widget-tier">{entry.tier === 'free' ? 'Free' : 'Standard'}</span>
                  <strong>{entry.name}</strong>
                  <p>{entry.description}</p>
                </button>
              {:else}
                <div class="widget-card locked">
                  <div class="locked-header">
                    <span class="lock-icon">🔒</span>
                    <span class="widget-tier">Standard</span>
                  </div>
                  <strong>{entry.name}</strong>
                  <p>{entry.description}</p>
                </div>
              {/if}
            {/each}
          </div>
        {/if}

        <div class="step-actions">
          <Button variant="ghost" onclick={() => updateFullStep('tabs')}>{en.common.back}</Button>
          <Button onclick={() => updateFullStep('assign')}>{en.common.next}</Button>
        </div>
      {:else if fullStep === 'assign'}
        <h2>{en.setup.assign.title}</h2>
        <p>{en.setup.assign.subtitle}</p>

        <div class="step-content">
          {#if selectedWidgets.length === 0}
            <p>No widgets selected. You can continue and add them later.</p>
          {:else}
            {#each selectedWidgets as widgetId (widgetId)}
              <div class="assign-row">
                <strong>{getWidgetName(widgetId)}</strong>
                <Select
                  options={tabs.map((tab) => ({ value: tab, label: tab }))}
                  value={widgetAssignments[widgetId] ?? tabs[0] ?? 'Home'}
                  onchange={(value) => updateWidgetAssignment(widgetId, value)}
                />
              </div>
            {/each}
          {/if}
        </div>

        <div class="step-actions">
          <Button variant="ghost" onclick={() => updateFullStep('widgets')}>{en.common.back}</Button>
          <Button onclick={handleFullAssignNext}>{en.common.next}</Button>
        </div>
      {:else if fullStep === 'config'}
        <h2>{en.setup.config.title}</h2>
        <p>{en.setup.config.subtitle}</p>

        <div class="step-content">
          {#each configurableSelections as widgetId (widgetId)}
            <div class="config-panel">
              <h3>{getWidgetName(widgetId)}</h3>

              {#if widgetId === 'pihole'}
                <Input
                  label="Pi-hole URL"
                  type="url"
                  placeholder="https://pi-hole.local/admin/api.php"
                  value={((widgetConfigs.pihole as { url?: string } | undefined)?.url ?? '')}
                  oninput={(event) => updatePiholeField('url', (event.currentTarget as HTMLInputElement).value)}
                />
                <Input
                  label="API token"
                  placeholder="Token"
                  value={((widgetConfigs.pihole as { token?: string } | undefined)?.token ?? '')}
                  oninput={(event) => updatePiholeField('token', (event.currentTarget as HTMLInputElement).value)}
                />
                <div class="row-field align-start">
                  <Button onclick={testPiholeConnection} disabled={piholeTestState === 'loading'}>
                    {piholeTestState === 'loading' ? en.common.loading : 'Test connection'}
                  </Button>
                  {#if piholeTestMessage}
                    <span class:pihole-ok={piholeTestState === 'success'} class:form-error={piholeTestState === 'error'}>
                      {piholeTestMessage}
                    </span>
                  {/if}
                </div>
              {:else if widgetId === 'rss'}
                {#each getSelectedRssConfig().feeds as feed, index (feed.id)}
                  <div class="config-subpanel">
                    <Input
                      label="Feed URL"
                      type="url"
                      placeholder="https://example.com/feed.xml"
                      value={feed.url}
                      oninput={(event) => updateRssFeed(index, { url: (event.currentTarget as HTMLInputElement).value })}
                    />
                    <Input
                      label="Label"
                      placeholder="Optional label"
                      value={feed.label ?? ''}
                      oninput={(event) => updateRssFeed(index, { label: (event.currentTarget as HTMLInputElement).value })}
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
                      <Input
                        label="Username"
                        value={feed.username ?? ''}
                        oninput={(event) => updateRssFeed(index, { username: (event.currentTarget as HTMLInputElement).value })}
                      />
                      <Input
                        label="Password"
                        type="password"
                        value={feed.password ?? ''}
                        oninput={(event) => updateRssFeed(index, { password: (event.currentTarget as HTMLInputElement).value })}
                      />
                    {:else if feed.authType === 'bearer'}
                      <Input
                        label="Bearer token"
                        value={feed.token ?? ''}
                        oninput={(event) => updateRssFeed(index, { token: (event.currentTarget as HTMLInputElement).value })}
                      />
                    {/if}
                    <Button variant="ghost" onclick={() => removeRssFeed(index)}>{en.common.delete}</Button>
                  </div>
                {/each}
                <Button variant="secondary" onclick={addRssFeed}>{en.common.add}</Button>
              {:else if widgetId === 'links'}
                <Input
                  label="Group"
                  value={getSelectedLinksConfig().groups[0]?.label ?? 'Quick Links'}
                  oninput={(event) => updateLinksGroupLabel((event.currentTarget as HTMLInputElement).value)}
                />
                {#each getSelectedLinksConfig().groups[0]?.links ?? [] as link, index}
                  <div class="row-field">
                    <Input
                      label="Label"
                      value={link.title}
                      oninput={(event) => updateLink(index, 'title', (event.currentTarget as HTMLInputElement).value)}
                    />
                    <Input
                      label="URL"
                      type="url"
                      value={link.url}
                      oninput={(event) => updateLink(index, 'url', (event.currentTarget as HTMLInputElement).value)}
                    />
                  </div>
                {/each}
              {:else if widgetId === 'weather'}
                {#if selectedLocation}
                  <p>Weather will use {selectedLocation.name} from step 5.</p>
                {:else}
                  <p>Weather will stay unconfigured until you choose a location in Settings.</p>
                {/if}
              {:else}
                <p>Ready — configure later in Settings.</p>
              {/if}
            </div>
          {/each}
        </div>

        <div class="step-actions">
          <Button variant="ghost" onclick={() => updateFullStep('assign')}>{en.common.back}</Button>
          <Button onclick={handleFullConfigNext}>{en.common.next}</Button>
        </div>
      {:else}
        <h2>{en.setup.done.title}</h2>
        <p>{en.setup.done.subtitle}</p>

        {#if setupError}
          <p class="form-error">{setupError}</p>
        {/if}

        <div class="step-actions">
          <Button variant="ghost" onclick={() => updateFullStep(shouldSkipConfigStep() ? 'assign' : 'config')}>{en.common.back}</Button>
          <Button onclick={finishSetup} disabled={setupSaving}>
            {setupSaving ? en.common.loading : en.setup.done.launch}
          </Button>
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .setup-container {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--space-6);
  }

  .setup-welcome {
    max-width: 700px;
    text-align: center;
  }

  .setup-title {
    margin-bottom: var(--space-2);
    font-size: 32px;
    font-weight: 700;
    color: var(--color-text-primary);
  }

  .setup-subtitle {
    margin-bottom: var(--space-8);
    color: var(--color-text-secondary);
  }

  .setup-options {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--space-4);
  }

  .setup-option {
    width: 100%;
    padding: var(--space-4);
    border: none;
    background: transparent;
    display: block;
    text-align: left;
    cursor: pointer;
    font-family: var(--font-ui);
    color: var(--color-text-primary);
    text-decoration: none;
  }

  .setup-option h2 {
    margin-bottom: var(--space-2);
    font-size: 20px;
  }

  .setup-option p {
    color: var(--color-text-secondary);
  }

  .setup-wizard {
    width: min(100%, 560px);
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }

  .setup-wizard.wide {
    width: min(100%, 760px);
  }

  .step-indicator {
    display: flex;
    justify-content: center;
    gap: var(--space-2);
  }

  .step-dot {
    width: 8px;
    height: 8px;
    border-radius: 999px;
    background: var(--color-bg-hover);
  }

  .step-dot.active {
    background: var(--color-accent);
  }

  .step-content {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .compact-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  }

  .step-actions {
    display: flex;
    justify-content: flex-end;
    gap: var(--space-3);
    margin-top: var(--space-4);
    flex-wrap: wrap;
  }

  .location-field {
    position: relative;
  }

  .suggestions {
    position: absolute;
    top: calc(100% + 4px);
    right: 0;
    left: 0;
    margin: 0;
    padding: var(--space-1) 0;
    list-style: none;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    background: var(--color-bg-elevated);
    z-index: 10;
  }

  .suggestions button {
    width: 100%;
    padding: var(--space-2) var(--space-3);
    border: none;
    background: transparent;
    text-align: left;
    font-family: var(--font-ui);
    color: var(--color-text-primary);
    cursor: pointer;
  }

  .suggestions button:hover {
    background: var(--color-bg-hover);
  }

  .preview-card,
  .config-panel,
  .config-subpanel,
  .assign-row,
  .tier-card,
  .widget-card {
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    background: var(--color-bg-elevated);
  }

  .preview-card,
  .config-panel,
  .config-subpanel,
  .assign-row {
    padding: var(--space-4);
  }

  .tier-card,
  .widget-card {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    padding: var(--space-4);
    text-align: left;
    font-family: var(--font-ui);
    color: var(--color-text-primary);
  }

  .tier-card,
  .widget-card:not(.locked) {
    cursor: pointer;
  }

  .tier-card,
  .widget-card {
    border: 1px solid var(--color-border);
  }

  .selected-card {
    border-color: var(--color-accent);
    box-shadow: 0 0 0 1px var(--color-accent);
  }

  .widget-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: var(--space-3);
  }

  .widget-tier {
    display: inline-flex;
    align-items: center;
    width: fit-content;
    border-radius: 999px;
    padding: 4px 10px;
    background: var(--color-bg-base);
    color: var(--color-text-secondary);
    font-size: 12px;
  }

  .locked {
    opacity: 0.8;
  }

  .locked-header {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  .row-field {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: var(--space-3);
    align-items: end;
  }

  .row-field.align-start {
    align-items: center;
  }

  .assign-row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 220px;
    gap: var(--space-4);
    align-items: center;
  }

  .config-subpanel {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .text-input {
    width: 100%;
    padding: var(--space-2) var(--space-3);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    background: var(--color-bg-base);
    color: var(--color-text-primary);
    font-family: var(--font-ui);
    font-size: 14px;
  }

  .form-error {
    margin: 0;
    color: var(--color-danger);
    font-size: 13px;
  }

  .pihole-ok {
    color: var(--color-success);
    font-size: 13px;
  }

  @media (max-width: 640px) {
    .setup-options,
    .compact-grid,
    .widget-grid {
      grid-template-columns: 1fr;
    }

    .assign-row,
    .row-field {
      grid-template-columns: 1fr;
    }
  }
</style>
