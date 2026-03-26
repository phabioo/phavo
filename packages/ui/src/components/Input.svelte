<script lang="ts">
interface Props {
  label?: string;
  placeholder?: string;
  error?: string | undefined;
  type?: 'text' | 'password' | 'email' | 'url' | 'number';
  value?: string;
  oninput?: (e: Event) => void;
}

let {
  label,
  placeholder = '',
  error,
  type = 'text',
  value = $bindable(''),
  oninput,
}: Props = $props();
</script>

<div class="input-wrapper">
  {#if label}
    <label class="input-label">{label}</label>
  {/if}
  <input
    class="input"
    class:has-error={!!error}
    {type}
    {placeholder}
    bind:value
    {oninput}
  />
  {#if error}
    <span class="input-error">{error}</span>
  {/if}
</div>

<style>
  .input-wrapper {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .input-label {
    font-size: 13px;
    font-weight: 500;
    color: var(--color-text-secondary);
  }

  .input {
    padding: var(--space-2) var(--space-3);
    background: var(--color-bg-base);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    color: var(--color-text-primary);
    font-family: var(--font-ui);
    font-size: 14px;
    outline: none;
    transition: border-color 0.15s;
  }

  .input:focus {
    border-color: var(--color-accent);
  }

  .input.has-error {
    border-color: var(--color-danger);
  }

  .input::placeholder {
    color: var(--color-text-muted);
  }

  .input-error {
    font-size: 12px;
    color: var(--color-danger);
  }
</style>
