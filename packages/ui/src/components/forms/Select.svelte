<script lang="ts">
  import Icon from '../Icon.svelte';

  interface SelectOption {
    value: string;
    label: string;
  }

  interface Props {
    id?: string;
    label?: string;
    value?: string;
    options: SelectOption[];
    onchange?: (value: string) => void;
  }

  let { id, label, value = $bindable(''), options, onchange }: Props = $props();

  let open = $state(false);
  let triggerEl: HTMLButtonElement | undefined = $state();

  const componentId = $props.id();
  const fallbackId = `select-${componentId}`;
  const selectId = $derived(id ?? fallbackId);

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

<div class={open ? 'relative z-[1200] flex flex-col gap-1' : 'relative flex flex-col gap-1'}>
  {#if label}
    <label class="text-xs text-text-muted uppercase tracking-widest mb-1" for={selectId}>{label}</label>
  {/if}

  <button
    bind:this={triggerEl}
    id={selectId}
    type="button"
    class="flex items-center justify-between bg-surface-card border border-border rounded-md px-3 py-2 text-sm font-mono text-text outline-none transition-colors
      hover:border-outline-variant/40 focus:border-accent focus:ring-1 focus:ring-accent/30 cursor-pointer"
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
    <div class="fixed inset-0 z-[1190]" onclick={handleBackdropClick} aria-hidden="true"></div>
    <ul
      class="absolute top-full left-0 right-0 mt-1 bg-surface-card border border-border rounded-md shadow-lg z-[1200] py-1 max-h-60 overflow-auto"
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
