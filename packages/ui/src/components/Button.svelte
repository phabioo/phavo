<script lang="ts">
import type { Snippet } from 'svelte';

interface Props {
  variant?: 'primary' | 'secondary' | 'tertiary' | 'ghost' | 'danger' | 'destructive';
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

const sizeClasses: Record<string, string> = {
  sm: 'btn-sm',
  md: 'btn-md',
  lg: 'btn-lg',
};

const variantClasses: Record<string, string> = {
  primary: 'btn-primary',
  secondary: 'btn-secondary',
  tertiary: 'btn-tertiary',
  ghost: 'btn-ghost',
  destructive: 'btn-destructive',
  danger: 'btn-danger',
};
</script>

<button
  class="phavo-btn inline-flex items-center justify-center gap-2 font-[var(--font-ui)] tracking-wide cursor-pointer
    disabled:opacity-50 disabled:cursor-not-allowed
    {sizeClasses[size] ?? sizeClasses.md}
    {variantClasses[variant] ?? variantClasses.primary}"
  {type}
  {disabled}
  {onclick}
>
  {@render children()}
</button>

<style>
  .phavo-btn {
    border-radius: var(--radius-full);
    border: 1px solid transparent;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    transition:
      background var(--motion-micro),
      color var(--motion-micro),
      border-color var(--motion-micro),
      transform var(--motion-micro);
  }

  .phavo-btn:active:not(:disabled) {
    transform: scale(0.98);
  }

  /* Pi 3/4 performance fallback */
  @media (prefers-reduced-motion: reduce), (max-resolution: 1.5dppx) {
    .phavo-btn:active:not(:disabled) {
      transform: none;
    }
  }

  .phavo-btn:focus-visible {
    outline: 2px solid var(--color-secondary);
    outline-offset: 2px;
  }

  .btn-sm {
    padding: var(--space-2) var(--space-3);
    font-size: var(--font-size-xs);
  }

  .btn-md {
    padding: var(--space-2) var(--space-5);
    font-size: var(--font-size-sm);
  }

  .btn-lg {
    padding: var(--space-3) var(--space-6);
    font-size: var(--font-size-md);
  }

  .btn-primary {
    background: linear-gradient(135deg, var(--color-primary-fixed), var(--color-primary-fixed-dim));
    color: var(--color-on-primary-fixed);
    border-color: color-mix(in srgb, var(--color-primary-fixed) 24%, transparent);
    box-shadow: 0 8px 20px color-mix(in srgb, var(--color-surface-dim) 28%, transparent);
  }

  .btn-primary:hover:not(:disabled) {
    opacity: 0.92;
  }

  .btn-secondary {
    background: color-mix(in srgb, var(--color-surface-highest) 64%, transparent);
    color: var(--color-on-surface-variant);
    border-color: color-mix(in srgb, var(--color-outline-variant) 28%, transparent);
  }

  .btn-secondary:hover:not(:disabled) {
    background: color-mix(in srgb, var(--color-surface-high) 76%, transparent);
    color: var(--color-on-surface);
  }

  .btn-tertiary {
    background: transparent;
    color: var(--color-on-surface-variant);
    border-color: transparent;
    border-radius: var(--radius-md);
    letter-spacing: 0.06em;
  }

  .btn-tertiary:hover:not(:disabled) {
    color: var(--color-primary-fixed);
    background: color-mix(in srgb, var(--color-primary-fixed) 8%, transparent);
  }

  .btn-destructive {
    background: color-mix(in srgb, var(--color-error) 12%, transparent);
    color: var(--color-error);
    border-color: color-mix(in srgb, var(--color-error) 28%, transparent);
  }

  .btn-destructive:hover:not(:disabled) {
    background: color-mix(in srgb, var(--color-error) 18%, transparent);
  }

  /* Ghost — outlined */
  .btn-ghost {
    background: transparent;
    color: var(--color-on-surface-variant);
    border: 1px solid color-mix(in srgb, var(--color-outline-variant) 30%, transparent);
  }

  .btn-ghost:hover:not(:disabled) {
    background: color-mix(in srgb, var(--color-surface-high) 60%, transparent);
    color: var(--color-on-surface);
  }

  /* Danger — text-only, red on hover */
  .btn-danger {
    background: transparent;
    color: var(--color-outline);
    border: none;
  }

  .btn-danger:hover:not(:disabled) {
    color: var(--color-error);
  }
</style>
