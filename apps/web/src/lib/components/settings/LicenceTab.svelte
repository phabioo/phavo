<script lang="ts">
  import { Badge, Button, Card, Input, icons } from '@phavo/ui';
  import en from '$lib/i18n/en.json';
  import { fetchWithCsrf } from '$lib/utils/api';

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
      errorMessage = error instanceof Error ? error.message : en.settings.licenseActivateFailed;
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
      errorMessage = error instanceof Error ? error.message : en.settings.licenseDeactivateFailed;
    } finally {
      deactivating = false;
    }
  }
</script>

<Card padding="none">
  <div class="licence-tab">
    <div class="licence-summary">
      <div>
        <span class="setting-label">{en.settings.tier}</span>
        <Badge variant={tierVariant(tier)}>{tierLabel(tier)}</Badge>
      </div>
      <div>
        <span class="setting-label">{en.settings.licenseKey}</span>
        <p class="licence-key" class:mono={!!licenseKeyMasked}>{licenseKeyMasked ?? en.settings.noLicense}</p>
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

    {#if tier !== 'local'}
      <div class="form-panel">
        <h3>{en.settings.activateLicense}</h3>
        <Input
          label={en.settings.enterLicenseKey}
          placeholder={en.settings.licenseKeyPlaceholder}
          bind:value={licenseKey}
        />
        <p class="setting-description">{en.settings.licenseActivationHint}</p>
        <div class="btn-wrap">
          <Button onclick={activateLicense} disabled={activating}>
            {activating ? en.settings.activatingLicense : en.settings.activateLicense}
          </Button>
        </div>
      </div>
    {:else}
      <div class="form-panel danger-panel">
        <h3>{en.settings.localLicenseActive}</h3>
        <p class="setting-description">{en.settings.licenseDeactivateHint}</p>
        <Button variant="danger" onclick={deactivateLicense} disabled={deactivating}>
          {deactivating ? en.settings.deactivatingLicense : en.settings.deactivateLicense}
        </Button>
      </div>
    {/if}

    {#if successMessage}
      <p class="status-message status-success">{successMessage}</p>
    {/if}

    {#if errorMessage}
      <p class="status-message status-error">{errorMessage}</p>
    {/if}
  </div>
</Card>

<style>
  .licence-tab {
    display: flex;
    flex-direction: column;
    gap: var(--space-5);
    padding: var(--space-5);
  }

  .licence-summary {
    display: grid;
    gap: var(--space-4);
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .setting-label {
    color: var(--color-text-muted);
    display: block;
    font-size: 0.8rem;
    margin-bottom: var(--space-2);
    text-transform: uppercase;
  }

  .licence-key {
    margin: 0;
    font-family: var(--font-ui);
  }

  .btn-wrap {
    align-self: flex-start;
  }

  .info-panel,
  .form-panel {
    border: 1px solid var(--color-border-subtle);
    border-radius: var(--radius-md);
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    padding: var(--space-4);
  }

  .danger-panel {
    border-color: var(--color-danger);
  }

  .setting-description {
    color: var(--color-text-secondary);
    margin: 0;
  }

  .external-link {
    align-items: center;
    color: var(--color-accent-text);
    display: inline-flex;
    gap: var(--space-2);
    text-decoration: none;
  }

  .external-icon {
    display: inline-flex;
  }

  .status-message {
    margin: 0;
  }

  .status-success {
    color: var(--color-success);
  }

  .status-error {
    color: var(--color-danger);
  }

  @media (max-width: 640px) {
    .licence-summary {
      grid-template-columns: 1fr;
    }
  }
</style>