<script lang="ts">
import type { Snippet } from 'svelte';

interface Props {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'destructive';
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
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2 text-sm',
  lg: 'px-6 py-3 text-base',
};

// 'danger' is kept for backward compat, maps to same style as 'destructive'
const variantClasses: Record<string, string> = {
  primary: 'bg-accent text-black font-semibold hover:bg-accent-subtle',
  secondary: 'bg-elevated border border-border text-text hover:bg-hover',
  destructive: 'bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20',
  danger: 'bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20',
  ghost: 'text-text-muted hover:text-text hover:bg-hover',
};
</script>

<button
  class="inline-flex items-center justify-center gap-2 rounded-md transition-colors cursor-pointer
    disabled:opacity-50 disabled:cursor-not-allowed
    {sizeClasses[size] ?? sizeClasses.md}
    {variantClasses[variant] ?? variantClasses.primary}"
  {type}
  {disabled}
  {onclick}
>
  {@render children()}
</button>
