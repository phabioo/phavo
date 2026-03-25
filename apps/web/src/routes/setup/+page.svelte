<script lang="ts">
import { Card, Button, Input } from '@phavo/ui';
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

type GeoResult = {
  id: number;
  name: string;
  country: string;
  latitude: number;
  longitude: number;
};

let mode = $state<SetupMode>('select');
let quickStep = $state<QuickStep>('auth');
let fullStep = $state<FullStep>('tier');

// Bug 1 — auth form state
let quickAuthMethod = $state<'choice' | 'phavio-io' | 'local'>('choice');
let authEmail = $state('');
let authPassword = $state('');
let authError = $state('');
let authLoading = $state(false);

// Dashboard / tier state
let dashboardName = $state('My Dashboard');
let selectedTier = $state<'free' | 'standard' | 'local'>('free');

// Bug 2 — geocoding state
let locationName = $state('');
let selectedLat = $state(0);
let selectedLon = $state(0);
let suggestions = $state<GeoResult[]>([]);
let showSuggestions = $state(false);
let geoTimer: ReturnType<typeof setTimeout> | null = null;

// Bug 3 — save error state
let setupError = $state('');

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

const quickStepIndex = $derived(quickSteps.indexOf(quickStep));
const fullStepIndex = $derived(fullSteps.indexOf(fullStep));

function nextQuickStep() {
  const idx = quickStepIndex;
  if (idx < quickSteps.length - 1) {
    quickStep = quickSteps[idx + 1] as QuickStep;
  }
}

function nextFullStep() {
  const idx = fullStepIndex;
  if (idx < fullSteps.length - 1) {
    fullStep = fullSteps[idx + 1] as FullStep;
  }
}

function prevFullStep() {
  const idx = fullStepIndex;
  if (idx > 0) {
    fullStep = fullSteps[idx - 1] as FullStep;
  }
}

// Bug 1 — submit the auth form; in dev mode the API returns 200 immediately
async function submitAuth() {
  authLoading = true;
  authError = '';
  try {
    const resp = await fetch('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: authEmail, password: authPassword }),
    });
    if (!resp.ok) {
      const d = await resp.json().catch(() => ({})) as { error?: string };
      authError = d.error ?? 'Authentication failed';
      return;
    }
    nextQuickStep();
  } catch {
    authError = 'Network error — please try again';
  } finally {
    authLoading = false;
  }
}

// Bug 2 — geocoding autocomplete, debounced 300 ms
function onLocationInput() {
  selectedLat = 0;
  selectedLon = 0;
  if (geoTimer !== null) clearTimeout(geoTimer);
  if (!locationName || locationName.length < 2) {
    suggestions = [];
    showSuggestions = false;
    return;
  }
  const query = locationName;
  geoTimer = setTimeout(async () => {
    try {
      const resp = await fetch(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=5&language=en&format=json`,
      );
      const data = await resp.json() as { results?: GeoResult[] };
      suggestions = data.results ?? [];
      showSuggestions = suggestions.length > 0;
    } catch {
      suggestions = [];
      showSuggestions = false;
    }
  }, 300);
}

function selectSuggestion(result: GeoResult) {
  locationName = `${result.name}, ${result.country}`;
  selectedLat = result.latitude;
  selectedLon = result.longitude;
  suggestions = [];
  showSuggestions = false;
}

// Bug 3 — only navigate after a confirmed 200; show error on failure
async function finishSetup() {
  setupError = '';
  try {
    const resp = await fetch('/api/v1/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        setupComplete: true,
        dashboardName,
        tier: selectedTier,
        tabs: [{ id: crypto.randomUUID(), label: 'Home', order: 0 }],
        location:
          selectedLat !== 0
            ? { name: locationName, latitude: selectedLat, longitude: selectedLon }
            : undefined,
      }),
    });
    if (!resp.ok) {
      setupError = 'Could not save settings — please try again.';
      return;
    }
    window.location.href = '/';
  } catch {
    setupError = 'Network error — please try again.';
  }
}
</script>

<div class="setup-container">
  {#if mode === 'select'}
    <div class="setup-welcome">
      <h1 class="setup-title">{en.setup.welcome.title}</h1>
      <p class="setup-subtitle">{en.setup.welcome.subtitle}</p>

      <div class="setup-options">
        <Card>
          <button class="setup-option" onclick={() => (mode = 'quick')} type="button">
            <h2>{en.setup.quickSetup}</h2>
            <p>{en.setup.quickSetupDescription}</p>
          </button>
        </Card>
        <Card>
          <button class="setup-option" onclick={() => (mode = 'full')} type="button">
            <h2>{en.setup.fullSetup}</h2>
            <p>{en.setup.fullSetupDescription}</p>
          </button>
        </Card>
      </div>
    </div>

  {:else if mode === 'quick'}
    <div class="setup-wizard">
      <div class="step-indicator">
        {#each quickSteps as step, i}
          <span class="step-dot" class:active={i <= quickStepIndex}></span>
        {/each}
      </div>

      {#if quickStep === 'auth'}
        <h2>{en.setup.steps.auth}</h2>
        {#if quickAuthMethod === 'choice'}
          <div class="step-content">
            <Button onclick={() => (quickAuthMethod = 'phavio-io')}>{en.setup.auth.phavoIo}</Button>
            <Button variant="secondary" onclick={() => (quickAuthMethod = 'local')}>{en.setup.auth.localAccount}</Button>
          </div>
        {:else}
          <div class="step-content">
            <Input label={en.setup.auth.email} type="email" placeholder={en.auth.emailPlaceholder} bind:value={authEmail} />
            <Input label={en.setup.auth.password} type="password" placeholder={en.auth.passwordPlaceholder} bind:value={authPassword} />
            {#if authError}
              <p class="form-error">{authError}</p>
            {/if}
            <div class="step-actions">
              <Button variant="ghost" onclick={() => (quickAuthMethod = 'choice')}>{en.common.back}</Button>
              <Button onclick={submitAuth}>{authLoading ? en.common.loading : en.auth.login}</Button>
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
            bind:value={locationName}
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
        <div class="step-actions">
          <Button variant="ghost" onclick={() => nextQuickStep()}>{en.setup.location.skip}</Button>
          <Button onclick={() => nextQuickStep()}>{en.common.next}</Button>
        </div>
      {:else if quickStep === 'done'}
        <h2>{en.setup.done.title}</h2>
        <p>{en.setup.done.subtitle}</p>
        {#if setupError}
          <p class="form-error">{setupError}</p>
        {/if}
        <Button onclick={finishSetup}>{en.setup.done.launch}</Button>
      {/if}
    </div>

  {:else if mode === 'full'}
    <div class="setup-wizard">
      <div class="step-indicator">
        {#each fullSteps as step, i}
          <span class="step-dot" class:active={i <= fullStepIndex}></span>
        {/each}
      </div>

      {#if fullStep === 'tier'}
        <h2>{en.setup.steps.tierSelect}</h2>
        <div class="step-content">
          <Button variant={selectedTier === 'free' ? 'primary' : 'secondary'} onclick={() => { selectedTier = 'free'; }}>{en.setup.auth.phavoIo} (Free)</Button>
          <Button variant={selectedTier === 'standard' ? 'primary' : 'secondary'} onclick={() => { selectedTier = 'standard'; }}>{en.setup.auth.phavoIo} (Standard)</Button>
          <Button variant={selectedTier === 'local' ? 'primary' : 'secondary'} onclick={() => { selectedTier = 'local'; }}>{en.setup.auth.localAccount} (Local)</Button>
        </div>
        <div class="step-actions">
          <Button onclick={nextFullStep}>{en.common.next}</Button>
        </div>

      {:else if fullStep === 'auth'}
        <h2>{en.setup.steps.auth}</h2>
        <div class="step-content">
          {#if selectedTier === 'local'}
            <Input label={en.setup.auth.username} placeholder={en.setup.auth.username} />
            <Input label={en.setup.auth.password} type="password" placeholder={en.setup.auth.password} />
            <Input label={en.setup.auth.enterLicenseKey} placeholder={en.setup.auth.enterLicenseKey} />
          {:else}
            <Input label={en.setup.auth.email} type="email" placeholder={en.auth.emailPlaceholder} />
            <Input label={en.setup.auth.password} type="password" placeholder={en.auth.passwordPlaceholder} />
          {/if}
        </div>
        <div class="step-actions">
          <Button variant="ghost" onclick={prevFullStep}>{en.common.back}</Button>
          <Button onclick={nextFullStep}>{en.common.next}</Button>
        </div>

      {:else if fullStep === 'name'}
        <h2>{en.setup.name.title}</h2>
        <Input label={en.settings.dashboardName} placeholder={en.setup.name.placeholder} bind:value={dashboardName} />
        <div class="step-actions">
          <Button variant="ghost" onclick={prevFullStep}>{en.common.back}</Button>
          <Button onclick={nextFullStep}>{en.common.next}</Button>
        </div>

      {:else if fullStep === 'location'}
        <h2>{en.setup.location.title}</h2>
        <p>{en.setup.location.subtitle}</p>
        <div class="location-field">
          <Input
            label={en.settings.weatherLocation}
            placeholder={en.setup.location.placeholder}
            bind:value={locationName}
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
        <div class="step-actions">
          <Button variant="ghost" onclick={prevFullStep}>{en.common.back}</Button>
          <Button variant="ghost" onclick={nextFullStep}>{en.common.skip}</Button>
          <Button onclick={nextFullStep}>{en.common.next}</Button>
        </div>

      {:else if fullStep === 'tabs'}
        <h2>{en.setup.tabs.title}</h2>
        <p>{en.setup.tabs.addTab}</p>
        <div class="step-actions">
          <Button variant="ghost" onclick={prevFullStep}>{en.common.back}</Button>
          <Button onclick={nextFullStep}>{en.common.next}</Button>
        </div>

      {:else if fullStep === 'widgets'}
        <h2>{en.setup.widgets.title}</h2>
        <p>{en.setup.widgets.subtitle}</p>
        <div class="step-actions">
          <Button variant="ghost" onclick={prevFullStep}>{en.common.back}</Button>
          <Button onclick={nextFullStep}>{en.common.next}</Button>
        </div>

      {:else if fullStep === 'assign'}
        <h2>{en.setup.assign.title}</h2>
        <p>{en.setup.assign.subtitle}</p>
        <div class="step-actions">
          <Button variant="ghost" onclick={prevFullStep}>{en.common.back}</Button>
          <Button onclick={nextFullStep}>{en.common.next}</Button>
        </div>

      {:else if fullStep === 'config'}
        <h2>{en.setup.config.title}</h2>
        <p>{en.setup.config.subtitle}</p>
        <div class="step-actions">
          <Button variant="ghost" onclick={prevFullStep}>{en.common.back}</Button>
          <Button onclick={nextFullStep}>{en.common.next}</Button>
        </div>

      {:else if fullStep === 'done'}
        <h2>{en.setup.done.title}</h2>
        <p>{en.setup.done.subtitle}</p>
        {#if setupError}
          <p class="form-error">{setupError}</p>
        {/if}
        <Button onclick={finishSetup}>{en.setup.done.launch}</Button>
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
    text-align: center;
    max-width: 600px;
  }

  .setup-title {
    font-size: 32px;
    font-weight: 700;
    color: var(--color-text-primary);
    margin-bottom: var(--space-2);
  }

  .setup-subtitle {
    font-size: 16px;
    color: var(--color-text-secondary);
    margin-bottom: var(--space-8);
  }

  .setup-options {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-4);
  }

  .setup-option {
    background: none;
    border: none;
    text-align: left;
    cursor: pointer;
    padding: var(--space-4);
    color: var(--color-text-primary);
    font-family: var(--font-ui);
  }

  .setup-option h2 {
    font-size: 18px;
    font-weight: 600;
    margin-bottom: var(--space-2);
  }

  .setup-option p {
    font-size: 14px;
    color: var(--color-text-secondary);
  }

  .setup-wizard {
    max-width: 480px;
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }

  .step-indicator {
    display: flex;
    gap: var(--space-2);
    justify-content: center;
    margin-bottom: var(--space-4);
  }

  .step-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--color-bg-hover);
    transition: background 0.2s;
  }

  .step-dot.active {
    background: var(--color-accent);
  }

  .step-content {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .step-actions {
    display: flex;
    gap: var(--space-3);
    justify-content: flex-end;
    margin-top: var(--space-4);
  }

  h2 {
    font-size: 22px;
    font-weight: 600;
    color: var(--color-text-primary);
  }

  p {
    font-size: 14px;
    color: var(--color-text-secondary);
  }

  /* Location geocoding autocomplete */
  .location-field {
    position: relative;
  }

  .suggestions {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    background: var(--color-bg-elevated, var(--color-bg-base));
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    list-style: none;
    margin: 2px 0 0;
    padding: var(--space-1) 0;
    z-index: 100;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  }

  .suggestions li {
    display: block;
  }

  .suggestions li button {
    width: 100%;
    padding: var(--space-2) var(--space-3);
    text-align: left;
    background: none;
    border: none;
    cursor: pointer;
    color: var(--color-text-primary);
    font-family: var(--font-ui);
    font-size: 14px;
  }

  .suggestions li button:hover {
    background: var(--color-bg-hover, rgba(255, 255, 255, 0.06));
  }

  /* Inline error messages */
  .form-error {
    font-size: 13px;
    color: var(--color-error, #ef4444);
    margin: 0;
  }
</style>
