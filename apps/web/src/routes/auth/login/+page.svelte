<script lang="ts">
import { Card, Input, Button } from '@phavo/ui';
import en from '$lib/i18n/en.json';

let email = $state('');
let password = $state('');
let error = $state<string | null>(null);
let loading = $state(false);

async function handleLogin() {
  loading = true;
  error = null;

  try {
    const res = await fetch('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ authMode: 'local', username: email, password }),
    });

    const json = (await res.json()) as { ok: boolean; error?: string };

    if (json.ok) {
      window.location.href = '/';
    } else {
      error = json.error ?? en.auth.invalidCredentials;
    }
  } catch {
    error = en.errors.networkError;
  } finally {
    loading = false;
  }
}
</script>

<div class="login-container">
  <Card>
    <div class="login-content">
      <h1 class="login-title">{en.auth.loginTitle}</h1>
      <p class="login-subtitle">{en.auth.loginSubtitle}</p>

      <form class="login-form" onsubmit={(e) => { e.preventDefault(); handleLogin(); }}>
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
          <p class="login-error">{error}</p>
        {/if}

        <Button type="submit" disabled={loading}>
          {loading ? en.common.loading : en.auth.login}
        </Button>
      </form>
    </div>
  </Card>
</div>

<style>
  .login-container {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--space-6);
  }

  .login-content {
    width: 360px;
    max-width: 100%;
  }

  .login-title {
    font-size: 24px;
    font-weight: 700;
    color: var(--color-text-primary);
    margin-bottom: var(--space-2);
  }

  .login-subtitle {
    font-size: 14px;
    color: var(--color-text-secondary);
    margin-bottom: var(--space-6);
  }

  .login-form {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }

  .login-error {
    font-size: 13px;
    color: var(--color-danger);
  }
</style>
