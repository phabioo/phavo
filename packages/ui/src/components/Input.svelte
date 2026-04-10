<script lang="ts">
interface Props {
  id?: string;
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
  id,
  label,
  ariaLabel,
  placeholder = '',
  error,
  type = 'text',
  value = $bindable(''),
  disabled = false,
  oninput,
}: Props = $props();

const componentId = $props.id();
const fallbackId = `input-${componentId}`;
const inputId = $derived(id ?? fallbackId);
</script>

<div class="flex flex-col gap-1">
  {#if label}
    <label class="text-xs text-text-muted uppercase tracking-widest mb-1" for={inputId}>{label}</label>
  {/if}
  <input
    id={inputId}
    class="phavo-input bg-surface-card border rounded-md px-3 py-2 text-sm font-mono outline-none transition-colors text-text placeholder:text-text-muted
      hover:bg-surface-high hover:border-outline-variant/40
      {error ? 'border-error ring-1 ring-error/20' : 'border-border focus:border-accent focus:ring-1 focus:ring-accent/30'}
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
    <span id={`${inputId}-error`} class="text-xs text-error mt-1">{error}</span>
  {/if}
</div>
