<script lang="ts">
  interface Props {
    id?: string;
    label?: string;
    placeholder?: string;
    value?: string;
    disabled?: boolean;
    error?: string;
    oninput?: (e: Event) => void;
  }

  let {
    id,
    label,
    placeholder = '',
    value = $bindable(''),
    disabled = false,
    error,
    oninput,
  }: Props = $props();

  const componentId = $props.id();
  const fallbackId = `textarea-${componentId}`;
  const textareaId = $derived(id ?? fallbackId);
</script>

<div class="flex flex-col gap-1">
  {#if label}
    <label
      class="text-xs text-text-muted uppercase tracking-widest mb-1"
      for={textareaId}
    >
      {label}
    </label>
  {/if}
  <textarea
    id={textareaId}
    class="bg-surface-card border rounded-md px-3 py-2 text-sm font-mono outline-none resize-y min-h-[80px] transition-colors
      {error
        ? 'border-error ring-1 ring-error/20'
        : 'border-border focus:border-accent focus:ring-1 focus:ring-accent/30'}
      {disabled ? 'opacity-50 cursor-not-allowed' : ''}
      text-text placeholder:text-text-muted"
    {placeholder}
    {disabled}
    bind:value
    {oninput}
    aria-invalid={error ? 'true' : undefined}
    aria-describedby={error ? `${textareaId}-error` : undefined}
  ></textarea>
  {#if error}
    <span id={`${textareaId}-error`} class="text-xs text-error mt-1">{error}</span>
  {/if}
</div>
