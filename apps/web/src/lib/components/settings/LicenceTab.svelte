<script lang="ts">
  import { Badge, Button, Input, icons } from '@phavo/ui';
  import en from '$lib/i18n/en.json';
  import { fetchWithCsrf } from '$lib/utils/api';
  import SettingsSection from './SettingsSection.svelte';

  type Tier = 'free' | 'standard' | 'local';
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
    if (value === 'standard') return 'accent';
    if (value === 'local') return 'success';
    return 'default';
  }

  function tierLabel(value: Tier) {
    if (value === 'standard') return en.settings.tierStandard;
    if (value === 'local') return en.settings.tierLocal;
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

<div class="licence-stack">
  <SettingsSection
    eyebrow="Licence"
    title="Current entitlement"
    description="Review the active tier and the masked key attached to this installation."
  >
    <div class="licence-summary">
      <div class="licence-card">
        <span class="setting-label">{en.settings.tier}</span>
        <Badge variant={tierVariant(tier)}>{tierLabel(tier)}</Badge>
      </div>
      <div class="licence-card">
        <span class="setting-label">{en.settings.licenseKey}</span>
        <p class="licence-key" class:mono={!!licenseKeyMasked}>
          {licenseKeyMasked ?? en.settings.noLicense}
        </p>
      </div>
    </div>

    {#if authMode === 'phavo-net' && tier !== 'local'}
      <div class="info-panel">
        <p>{en.settings.manageLicenseHosted}</p>
        <a class="external-link" href={manageUrl} target="_blank" rel="noreferrer">
          <span>{en.settings.manageLicense}</span>
          <span class="external-icon">{@html icons.external()}</span>
        </a>
      </div>
    {/if}
  </SettingsSection>

  {#if tier !== 'local'}
    <SettingsSection
      title={en.settings.activateLicense}
      description={en.settings.licenseActivationHint}
      tone="accent"
    >
      <div class="form-panel">
        <Input
          label={en.settings.enterLicenseKey}
          placeholder={en.settings.licenseKeyPlaceholder}
          bind:value={licenseKey}
        />
      </div>

      {#snippet footer()}
        <Button onclick={activateLicense} disabled={activating}>
          {activating ? en.settings.activatingLicense : en.settings.activateLicense}
        </Button>
      {/snippet}
    </SettingsSection>
  {:else}
    <SettingsSection
      title={en.settings.localLicenseActive}
      description={en.settings.licenseDeactivateHint}
      tone="danger"
    >
      <div class="info-panel">
        <p>{en.settings.licenseDeactivateHint}</p>
      </div>

      {#snippet footer()}
        <Button variant="danger" onclick={deactivateLicense} disabled={deactivating}>
          {deactivating ? en.settings.deactivatingLicense : en.settings.deactivateLicense}
        </Button>
      {/snippet}
    </SettingsSection>
  {/if}

  {#if successMessage}
    <p class="status-message status-success">{successMessage}</p>
  {/if}

  {#if errorMessage}
    <p class="status-message status-error">{errorMessage}</p>
  {/if}
</div>

<style>
  .licence-stack {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }

  .licence-summary {
    display: grid;
    gap: var(--space-4);
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .licence-card {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    padding: var(--space-4);
    border-radius: calc(var(--radius-xl) - 4px);
    border: 1px solid var(--color-border-subtle);
    background: color-mix(in srgb, var(--color-bg-base) 24%, transparent);
  }

  .setting-label {
    color: var(--color-text-muted);
    display: block;
    font-size: 0.8rem;
    text-transform: uppercase;
    letter-spacing: 0.16em;
  }

  .licence-key {
    margin: 0;
    color: var(--color-text-primary);
    font-family: var(--font-ui);
  }

  .form-panel,
  .info-panel {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .info-panel {
    padding: var(--space-4);
    border-radius: calc(var(--radius-xl) - 4px);
    border: 1px solid var(--color-border-subtle);
    background: color-mix(in srgb, var(--color-bg-base) 24%, transparent);
    color: var(--color-text-secondary);
  }

  .info-panel p {
    margin: 0;
    line-height: 1.6;
  }

  .external-link {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    color: var(--color-accent-text);
    text-decoration: none;
    font-weight: 600;
  }

  .external-icon {
    display: inline-flex;
  }

  .status-message {
    margin: 0;
    padding: var(--space-3) var(--space-4);
    border-radius: calc(var(--radius-xl) - 4px);
    border: 1px solid transparent;
    font-size: 13px;
  }

  .status-success {
    color: var(--color-success);
    border-color: color-mix(in srgb, var(--color-success) 28%, transparent);
    background: color-mix(in srgb, var(--color-accent-t) 62%, transparent);
  }

  .status-error {
    color: var(--color-danger);
    border-color: color-mix(in srgb, var(--color-danger) 28%, transparent);
    background: color-mix(in srgb, var(--color-danger-subtle) 78%, transparent);
  }

  @media (max-width: 639px) {
    .licence-summary {
      grid-template-columns: 1fr;
    }
  }
</style>
