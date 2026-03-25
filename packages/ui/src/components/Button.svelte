<script lang="ts">
import type { Snippet } from 'svelte';

interface Props {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  type?: 'button' | 'submit' | 'reset';
  onclick?: () => void;
  children: Snippet;
}

let {
  variant = 'primary',
  size = 'md',
  disabled = false,
  type = 'button',
  onclick,
  children,
}: Props = $props();
</script>

<button
  class="btn btn-{variant} btn-{size}"
  {type}
  {disabled}
  {onclick}
>
  {@render children()}
</button>

<style>
  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-2);
    font-family: var(--font-ui);
    font-weight: 500;
    border: 1px solid transparent;
    border-radius: var(--radius-sm);
    cursor: pointer;
    transition: background 0.15s, border-color 0.15s;
    line-height: 1;
  }

  .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* Sizes */
  .btn-sm { padding: var(--space-1) var(--space-3); font-size: 12px; }
  .btn-md { padding: var(--space-2) var(--space-4); font-size: 14px; }
  .btn-lg { padding: var(--space-3) var(--space-6); font-size: 16px; }

  /* Variants */
  .btn-primary {
    background: var(--color-accent);
    color: var(--color-text-primary);
    border-color: var(--color-accent);
  }
  .btn-primary:hover:not(:disabled) {
    background: var(--color-accent-hover);
  }

  .btn-secondary {
    background: var(--color-bg-elevated);
    color: var(--color-text-primary);
    border-color: var(--color-border);
  }
  .btn-secondary:hover:not(:disabled) {
    background: var(--color-bg-hover);
  }

  .btn-ghost {
    background: transparent;
    color: var(--color-text-secondary);
    border-color: transparent;
  }
  .btn-ghost:hover:not(:disabled) {
    background: var(--color-bg-hover);
    color: var(--color-text-primary);
  }

  .btn-danger {
    background: var(--color-danger);
    color: var(--color-text-primary);
    border-color: var(--color-danger);
  }
  .btn-danger:hover:not(:disabled) {
    background: var(--color-danger-subtle);
  }
</style>
