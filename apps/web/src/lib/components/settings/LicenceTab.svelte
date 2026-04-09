<script lang="ts">
  import { Badge, Button, Icon, Input } from '@phavo/ui';
  import en from '$lib/i18n/en.json';
  import { fetchWithCsrf } from '$lib/utils/api';

  type Tier = 'stellar' | 'celestial';
  type AuthMode = 'phavo-net' | 'local' | null;

  interface Props {
    tier: Tier;
    authMode: AuthMode;
    licenseKeyMasked: string | null;
    manageUrl: string;
  }

  let { tier, authMode, licenseKeyMasked, manageUrl }: Props = $props();

  let licenseKey = $state('');
  let activating = $state(false);
  let deactivating = $state(false);
  let errorMessage = $state('');
  let successMessage = $state('');

  function tierVariant(value: Tier) {
    if (value === 'celestial') return 'accent';
    return 'default';
  }

  function tierLabel(value: Tier) {
    if (value === 'celestial') return en.settings.tierStandard;
    return en.settings.tierFree;
  }

  async function activateLicense(): Promise<void> {
    if (licenseKey.trim().length === 0) {
      errorMessage = en.settings.licenseKeyRequired;
      successMessage = '';
      return;
    }

    activating = true;
    errorMessage = '';
    successMessage = '';

    try {
      const response = await fetchWithCsrf('/api/v1/license/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ licenseKey: licenseKey.trim() }),
      });

      const payload = (await response.json()) as {
        ok: boolean;
        data?: { reload?: boolean };
        error?: string;
      };

      if (!payload.ok) {
        throw new Error(payload.error ?? en.settings.licenseActivateFailed);
      }

      if (payload.data?.reload) {
        window.location.reload();
        return;
      }

      successMessage = en.settings.licenseActivated;
      licenseKey = '';
    } catch (error) {
      errorMessage =
        error instanceof Error ? error.message : en.settings.licenseActivateFailed;
    } finally {
      activating = false;
    }
  }

  async function deactivateLicense(): Promise<void> {
    deactivating = true;
    errorMessage = '';
    successMessage = '';

    try {
      const response = await fetchWithCsrf('/api/v1/license/deactivate', { method: 'POST' });
      const payload = (await response.json()) as {
        ok: boolean;
        data?: { reload?: boolean };
        error?: string;
      };

      if (!payload.ok) {
        throw new Error(payload.error ?? en.settings.licenseDeactivateFailed);
      }

      if (payload.data?.reload) {
        window.location.reload();
        return;
      }

      successMessage = en.settings.licenseDeactivated;
    } catch (error) {
      errorMessage =
        error instanceof Error ? error.message : en.settings.licenseDeactivateFailed;
    } finally {
      deactivating = false;
    }
  }
</script>

<div class="licence-layout">
  <div class="settings-hero-card">
    <span class="settings-card-label">LICENCE TIER</span>
    <h2 class="settings-hero-value">{tierLabel(tier)}</h2>
    <p class="settings-hero-sub">{tier === 'celestial' ? 'Full access to all widgets and features' : 'Base tier — upgrade to unlock all widgets'}</p>
    <div class="licence-badge-row">
      <Badge variant={tierVariant(tier)}>{tierLabel(tier)}</Badge>
    </div>
  </div>

  <div class="settings-form-card">
    <h3 class="settings-form-title">Current Entitlement</h3>
    <div class="licence-meta-grid">
      <div class="licence-meta-item">
        <span class="settings-field-label">{en.settings.tier}</span>
        <Badge variant={tierVariant(tier)}>{tierLabel(tier)}</Badge>
      </div>
      <div class="licence-meta-item">
        <span class="settings-field-label">{en.settings.licenseKey}</span>
        <p class="licence-key-value" class:licence-key-mono={!!licenseKeyMasked}>
          {licenseKeyMasked ?? en.settings.noLicense}
        </p>
      </div>
    </div>

    {#if authMode === 'phavo-net'}
      <div class="licence-info-panel">
        <p>{en.settings.manageLicenseHosted}</p>
        <a class="settings-help-link" href={manageUrl} target="_blank" rel="noreferrer">
          {en.settings.manageLicense}
          <Icon name="external-link" size={14} />
        </a>
      </div>
    {/if}
  </div>

  {#if authMode !== 'local'}
    <div class="settings-form-card">
      <h3 class="settings-form-title">{en.settings.activateLicense}</h3>
      <p class="licence-hint">{en.settings.licenseActivationHint}</p>
      <div>
        <label class="settings-field-label">{en.settings.enterLicenseKey}</label>
        <Input
          placeholder={en.settings.licenseKeyPlaceholder}
          bind:value={licenseKey}
        />
      </div>
      <div class="settings-form-actions">
        <span></span>
        <button class="settings-btn-primary" type="button" onclick={activateLicense} disabled={activating}>
          {activating ? en.settings.activatingLicense : en.settings.activateLicense}
        </button>
      </div>
    </div>
  {:else}
    <div class="settings-form-card">
      <h3 class="settings-form-title">{en.settings.localLicenseActive}</h3>
      <p class="licence-hint">{en.settings.licenseDeactivateHint}</p>
      <div class="settings-form-actions">
        <span></span>
        <button class="settings-btn-danger" type="button" onclick={deactivateLicense} disabled={deactivating}>
          <Icon name="shield-off" size={14} />
          {deactivating ? en.settings.deactivatingLicense : en.settings.deactivateLicense}
        </button>
      </div>
    </div>
  {/if}

  {#if successMessage}
    <div class="licence-msg licence-msg-success">{successMessage}</div>
  {/if}

  {#if errorMessage}
    <div class="licence-msg licence-msg-error">{errorMessage}</div>
  {/if}
</div>

<style>
  .licence-layout {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }

  .licence-badge-row {
    margin-top: var(--space-2);
  }

  .licence-meta-grid {
    display: grid;
    gap: var(--space-4);
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .licence-meta-item {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .licence-key-value {
    margin: 0;
    font-size: 14px;
    font-weight: 500;
    color: var(--color-on-surface);
  }

  .licence-key-mono {
    font-family: var(--font-mono);
  }

  .licence-info-panel {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    padding: var(--space-4);
    border-radius: 1.5rem;
    border: 1px solid color-mix(in srgb, var(--color-outline-variant) 10%, transparent);
    background: color-mix(in srgb, var(--color-surface-dim) 60%, transparent);
    color: var(--color-on-surface-variant);
  }

  .licence-info-panel p {
    margin: 0;
    line-height: 1.6;
    font-size: 13px;
  }

  .licence-hint {
    font-size: 13px;
    color: var(--color-on-surface-variant);
    margin: 0;
    line-height: 1.5;
  }

  .licence-msg {
    padding: var(--space-3) var(--space-4);
    border-radius: 1.5rem;
    border: 1px solid transparent;
    font-size: 13px;
  }

  .licence-msg-success {
    color: var(--color-secondary);
    border-color: color-mix(in srgb, var(--color-secondary) 28%, transparent);
    background: color-mix(in srgb, var(--color-secondary) 8%, transparent);
  }

  .licence-msg-error {
    color: var(--color-error);
    border-color: color-mix(in srgb, var(--color-error) 28%, transparent);
    background: color-mix(in srgb, var(--color-error) 8%, transparent);
  }

  @media (max-width: 639px) {
    .licence-meta-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
