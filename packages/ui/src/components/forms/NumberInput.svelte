<script lang="ts">
  interface Props {
    label?: string;
    placeholder?: string;
    value?: number | string;
    min?: number;
    max?: number;
    step?: number;
    disabled?: boolean;
    error?: string;
    oninput?: (e: Event) => void;
  }

  let {
    label,
    placeholder = '',
    value = $bindable(''),
    min,
    max,
    step,
    disabled = false,
    error,
    oninput,
  }: Props = $props();

  const inputId = `number-${Math.random().toString(36).slice(2, 9)}`;
</script>

<div class="flex flex-col gap-1">
  {#if label}
    <label
      class="text-xs text-text-muted uppercase tracking-widest mb-1"
      for={inputId}
    >
      {label}
    </label>
  {/if}
  <input
    id={inputId}
    class="bg-elevated border rounded-md px-3 py-2 text-sm font-mono outline-none transition-colors
      {error
        ? 'border-red-500 ring-1 ring-red-500/20'
        : 'border-border focus:border-accent focus:ring-1 focus:ring-accent/30'}
      {disabled ? 'opacity-50 cursor-not-allowed' : ''}
      text-text placeholder:text-text-dim"
    type="number"
    {placeholder}
    {disabled}
    {min}
    {max}
    {step}
    bind:value
    {oninput}
    aria-invalid={error ? 'true' : undefined}
    aria-describedby={error ? `${inputId}-error` : undefined}
  />
  {#if error}
    <span id="{inputId}-error" class="text-xs text-red-400 mt-1">{error}</span>
  {/if}
</div>
