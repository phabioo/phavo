<script lang="ts">
  interface Props {
    checked?: boolean;
    onchange?: (value: boolean) => void;
    label?: string;
    ariaLabel?: string;
    disabled?: boolean;
  }

  let {
    checked = $bindable(false),
    onchange,
    label,
    ariaLabel,
    disabled = false,
  }: Props = $props();
  const resolvedAriaLabel = $derived(ariaLabel?.trim() || label?.trim() || 'Toggle switch');

  function toggle() {
    if (disabled) return;
    checked = !checked;
    onchange?.(checked);
  }
</script>

<label class="inline-flex items-center gap-3 {disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}">
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={resolvedAriaLabel}
    {disabled}
    class="relative w-10 h-6 rounded-full transition-colors duration-200 outline-none
      focus-visible:ring-2 focus-visible:ring-accent/50
      {checked ? 'bg-accent' : 'bg-border'}"
    onclick={toggle}
  >
    <span
      class="absolute top-1 w-4 h-4 bg-primary rounded-full shadow transition-transform duration-200
        {checked ? 'translate-x-5' : 'translate-x-1'}"
    ></span>
  </button>
  {#if label}
    <span class="text-sm text-text">{label}</span>
  {/if}
</label>
