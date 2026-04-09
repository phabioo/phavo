<script lang="ts">
interface Props {
  label?: string;
  ariaLabel?: string;
  placeholder?: string;
  error?: string | undefined;
  type?: 'text' | 'password' | 'email' | 'url' | 'number';
  value?: string;
  disabled?: boolean;
  oninput?: (e: Event) => void;
}

let {
  label,
  ariaLabel,
  placeholder = '',
  error,
  type = 'text',
  value = $bindable(''),
  disabled = false,
  oninput,
}: Props = $props();

const inputId = `input-${Math.random().toString(36).slice(2, 9)}`;
</script>

<div class="flex flex-col gap-1">
  {#if label}
    <label class="text-xs text-text-muted uppercase tracking-widest mb-1" for={inputId}>{label}</label>
  {/if}
  <input
    id={inputId}
    class="phavo-input bg-surface-card border rounded-md px-3 py-2 text-sm font-mono outline-none transition-colors text-text placeholder:text-text-dim
      hover:bg-surface-high hover:border-outline-variant/40
      {error ? 'border-red-500 ring-1 ring-red-500/20' : 'border-border focus:border-accent focus:ring-1 focus:ring-accent/30'}
      {disabled ? 'opacity-50 cursor-not-allowed' : ''}"
    aria-label={ariaLabel ?? (label ? undefined : (placeholder || undefined))}
    aria-invalid={error ? 'true' : undefined}
    aria-describedby={error ? `${inputId}-error` : undefined}
    {type}
    {placeholder}
    {disabled}
    bind:value
    {oninput}
  />
  {#if error}
    <span id="{inputId}-error" class="text-xs text-red-400 mt-1">{error}</span>
  {/if}
</div>
