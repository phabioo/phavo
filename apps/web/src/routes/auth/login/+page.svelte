<script lang="ts">
import { Button, Icon, Input } from '@phavo/ui';
import en from '$lib/i18n/en.json';
import { fetchWithCsrf } from '$lib/utils/api';

type AuthStep = 'choice' | 'local' | 'totp';

const PHAVO_IO_URL = 'https://phavo.net';

let step = $state<AuthStep>('choice');
let email = $state('');
let password = $state('');
let totpCode = $state('');
let partialToken = $state<string | null>(null);
let error = $state<string | null>(null);
let loading = $state(false);

function startPhavoOauth() {
  const redirectUri = `${window.location.origin}/auth/callback`;
  const authorizeUrl = new URL(`${PHAVO_IO_URL}/oauth/authorize`);
  authorizeUrl.searchParams.set('response_type', 'code');
  authorizeUrl.searchParams.set('redirect_uri', redirectUri);
  authorizeUrl.searchParams.set('state', btoa(JSON.stringify({ source: 'login' })));
  window.location.assign(authorizeUrl.toString());
}

async function handleLocalLogin() {
  loading = true;
  error = null;

  try {
    const res = await fetchWithCsrf('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ authMode: 'local', username: email, password }),
    });

    const json = (await res.json()) as { ok: boolean; data?: { requiresTotp?: boolean; partialToken?: string }; error?: string };

    if (!json.ok) {
      error = json.error ?? en.auth.invalidCredentials;
      return;
    }

    if (json.data?.requiresTotp) {
      partialToken = json.data.partialToken ?? null;
      step = 'totp';
      return;
    }

    window.location.href = '/';
  } catch {
    error = en.errors.networkError;
  } finally {
    loading = false;
  }
}

async function handleTotpVerify() {
  loading = true;
  error = null;

  try {
    const res = await fetchWithCsrf('/api/v1/auth/totp', {
      method: 'POST',
      body: JSON.stringify({ code: totpCode, partialToken }),
    });

    const json = (await res.json()) as { ok: boolean; error?: string };

    if (json.ok) {
      window.location.href = '/';
    } else {
      error = json.error ?? 'Invalid code. Please try again.';
    }
  } catch {
    error = en.errors.networkError;
  } finally {
    loading = false;
  }
}
</script>

<div class="min-h-screen flex items-center justify-center p-6">
  <div class="w-full max-w-[400px]">
    <div class="p-6 bg-surface border border-border rounded-xl">

      {#if step === 'choice'}
        <h1 class="text-2xl font-bold text-text mb-1">{en.auth.loginTitle}</h1>
        <p class="text-sm text-text-muted mb-6">{en.auth.loginSubtitle}</p>

        <div class="flex flex-col gap-3">
          <button
            type="button"
            class="flex items-center gap-3 w-full px-4 py-3 bg-elevated border border-border rounded-lg text-left text-text transition-colors hover:border-accent cursor-pointer"
            onclick={startPhavoOauth}
          >
            <Icon name="globe" size={20} />
            <div>
              <span class="font-semibold text-sm">Continue with phavo.net</span>
              <p class="text-xs text-text-muted mt-0.5">Sign in or create an account</p>
            </div>
          </button>

          <div class="flex items-center gap-3 my-1">
            <div class="flex-1 h-px bg-border"></div>
            <span class="text-xs text-text-dim">or</span>
            <div class="flex-1 h-px bg-border"></div>
          </div>

          <button
            type="button"
            class="flex items-center gap-3 w-full px-4 py-3 bg-elevated border border-border rounded-lg text-left text-text transition-colors hover:border-accent cursor-pointer"
            onclick={() => { step = 'local'; error = null; }}
          >
            <Icon name="hard-drive" size={20} />
            <div>
              <span class="font-semibold text-sm">Local account</span>
              <p class="text-xs text-text-muted mt-0.5">Sign in with credentials on this device</p>
            </div>
          </button>
        </div>

      {:else if step === 'local'}
        <button type="button" class="flex items-center gap-1 text-xs text-text-muted hover:text-text mb-4 bg-transparent border-none cursor-pointer" onclick={() => { step = 'choice'; error = null; }}>
          <Icon name="arrow-left" size={14} />
          Back
        </button>

        <h1 class="text-2xl font-bold text-text mb-1">{en.auth.loginTitle}</h1>
        <p class="text-sm text-text-muted mb-6">Sign in with your local credentials</p>

        <form class="flex flex-col gap-4" onsubmit={(e) => { e.preventDefault(); handleLocalLogin(); }}>
          <Input
            label={en.setup.auth.email}
            type="email"
            placeholder={en.auth.emailPlaceholder}
            bind:value={email}
          />
          <Input
            label={en.setup.auth.password}
            type="password"
            placeholder={en.auth.passwordPlaceholder}
            bind:value={password}
          />

          {#if error}
            <p class="text-sm text-red-400">{error}</p>
          {/if}

          <Button type="submit" disabled={loading}>
            {loading ? en.common.loading : en.auth.login}
          </Button>
        </form>

      {:else if step === 'totp'}
        <button type="button" class="flex items-center gap-1 text-xs text-text-muted hover:text-text mb-4 bg-transparent border-none cursor-pointer" onclick={() => { step = 'local'; error = null; totpCode = ''; }}>
          <Icon name="arrow-left" size={14} />
          Back
        </button>

        <h1 class="text-2xl font-bold text-text mb-1">Two-Factor Authentication</h1>
        <p class="text-sm text-text-muted mb-6">Enter the 6-digit code from your authenticator app</p>

        <form class="flex flex-col gap-4" onsubmit={(e) => { e.preventDefault(); handleTotpVerify(); }}>
          <Input
            label="Verification Code"
            placeholder="000000"
            bind:value={totpCode}
          />

          {#if error}
            <p class="text-sm text-red-400">{error}</p>
          {/if}

          <Button type="submit" disabled={loading || totpCode.length < 6}>
            {loading ? en.common.loading : 'Verify'}
          </Button>
        </form>
      {/if}
    </div>
  </div>
</div>
