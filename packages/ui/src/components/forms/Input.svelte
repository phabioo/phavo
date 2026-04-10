<script lang="ts">
  interface Props {
    id?: string;
    label?: string;
    placeholder?: string;
    type?: string;
    value?: string;
    disabled?: boolean;
    error?: string;
    oninput?: (e: Event) => void;
  }

  let {
    id,
    label,
    placeholder = '',
    type = 'text',
    value = $bindable(''),
    disabled = false,
    error,
    oninput,
  }: Props = $props();

  const componentId = $props.id();
  const fallbackId = `input-${componentId}`;
  const inputId = $derived(id ?? fallbackId);
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
    class="bg-surface-card border rounded-md px-3 py-2 text-sm font-mono outline-none transition-colors
      {error
        ? 'border-error ring-1 ring-error/20'
        : 'border-border focus:border-accent focus:ring-1 focus:ring-accent/30'}
      {disabled ? 'opacity-50 cursor-not-allowed' : ''}
      text-text placeholder:text-text-muted"
    {type}
    {placeholder}
    {disabled}
    bind:value
    {oninput}
    aria-invalid={error ? 'true' : undefined}
    aria-describedby={error ? `${inputId}-error` : undefined}
  />
  {#if error}
    <span id={`${inputId}-error`} class="text-xs text-error mt-1">{error}</span>
  {/if}
</div>
