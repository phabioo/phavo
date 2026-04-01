<script lang="ts">
  import Icon from '../Icon.svelte';

  interface SelectOption {
    value: string;
    label: string;
  }

  interface Props {
    label?: string;
    value?: string;
    options: SelectOption[];
    onchange?: (value: string) => void;
  }

  let { label, value = $bindable(''), options, onchange }: Props = $props();

  let open = $state(false);
  let triggerEl: HTMLButtonElement | undefined = $state();

  const selectId = `select-${Math.random().toString(36).slice(2, 9)}`;

  const selectedLabel = $derived(
    options.find((o) => o.value === value)?.label ?? value,
  );

  function toggle() {
    open = !open;
  }

  function select(opt: SelectOption) {
    value = opt.value;
    open = false;
    onchange?.(opt.value);
    triggerEl?.focus();
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      open = false;
      triggerEl?.focus();
    }
    if (!open && (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      open = true;
    }
  }

  function handleBackdropClick() {
    open = false;
  }
</script>

<div class="relative flex flex-col gap-1">
  {#if label}
    <span class="text-xs text-text-muted uppercase tracking-widest mb-1">{label}</span>
  {/if}

  <button
    bind:this={triggerEl}
    id={selectId}
    type="button"
    class="flex items-center justify-between bg-elevated border border-border rounded-md px-3 py-2 text-sm font-mono text-text outline-none transition-colors
      hover:border-border-strong focus:border-accent focus:ring-1 focus:ring-accent/30 cursor-pointer"
    aria-haspopup="listbox"
    aria-expanded={open}
    onclick={toggle}
    onkeydown={handleKeydown}
  >
    <span class="truncate">{selectedLabel || '\u00A0'}</span>
    <Icon name="chevron-down" size={14} class="text-text-muted ml-2 shrink-0" />
  </button>

  {#if open}
    <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
    <div class="fixed inset-0 z-40" onclick={handleBackdropClick} aria-hidden="true"></div>
    <ul
      class="absolute top-full left-0 right-0 mt-1 bg-elevated border border-border rounded-md shadow-lg z-50 py-1 max-h-60 overflow-auto"
      role="listbox"
      aria-labelledby={selectId}
    >
      {#each options as opt (opt.value)}
        <li
          role="option"
          aria-selected={value === opt.value}
          class="px-3 py-2 text-sm cursor-pointer transition-colors
            {value === opt.value ? 'text-accent' : 'text-text'}
            hover:bg-hover"
        >
          <button
            type="button"
            class="w-full text-left bg-transparent border-none p-0 font-inherit text-inherit cursor-pointer"
            onclick={() => select(opt)}
          >
            {opt.label}
          </button>
        </li>
      {/each}
    </ul>
  {/if}
</div>
