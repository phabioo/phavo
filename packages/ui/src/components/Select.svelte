<script lang="ts">
import Icon from './Icon.svelte';

interface SelectOption {
  value: string;
  label: string;
}

interface Props {
  id?: string;
  label?: string;
  options: SelectOption[];
  value?: string;
  onchange?: (value: string) => void;
}

let { id, label, options, value = $bindable(''), onchange }: Props = $props();

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

<style>
  .phavo-select-wrapper {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .phavo-select-open {
    z-index: 1200;
  }

  .phavo-select-label {
    font-size: 0.75rem;
    color: var(--color-text-muted, var(--color-outline));
    text-transform: uppercase;
    letter-spacing: 0.1em;
    margin-bottom: 4px;
  }

  .phavo-select-trigger {
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: var(--color-surface-card);
    border: 1px solid color-mix(in srgb, var(--color-outline-variant) 20%, transparent);
    border-radius: var(--radius-md);
    padding: var(--space-2) var(--space-3);
    font-size: var(--font-size-sm);
    font-family: var(--font-mono);
    color: var(--color-on-surface);
    outline: none;
    cursor: pointer;
    width: 100%;
    transition: background var(--motion-micro), border-color var(--motion-micro);
  }

  .phavo-select-trigger:hover {
    background: var(--color-surface-high);
    border-color: color-mix(in srgb, var(--color-outline-variant) 40%, transparent);
  }

  .phavo-select-trigger:focus {
    border-color: var(--color-accent, var(--color-primary));
  }

  .phavo-select-value {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .phavo-select-chevron {
    color: var(--color-outline);
    margin-left: var(--space-2);
    flex-shrink: 0;
  }

  .phavo-select-backdrop {
    position: fixed;
    inset: 0;
    z-index: 1190;
  }

  .phavo-select-dropdown {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    margin-top: 4px;
    background: var(--color-surface-card);
    border: 1px solid color-mix(in srgb, var(--color-outline-variant) 20%, transparent);
    border-radius: var(--radius-md);
    box-shadow: 0 8px 24px color-mix(in srgb, var(--color-surface-dim) 60%, transparent);
    z-index: 1200;
    padding: var(--space-1) 0;
    max-height: 15rem;
    overflow-y: auto;
    list-style: none;
    margin-left: 0;
    margin-right: 0;
  }

  .phavo-select-option {
    padding: var(--space-2) var(--space-3);
    font-size: var(--font-size-sm);
    cursor: pointer;
    color: var(--color-on-surface);
    transition: background var(--motion-micro);
  }

  .phavo-select-option:hover {
    background: var(--color-surface-high);
  }

  .phavo-select-option-selected {
    color: var(--color-accent, var(--color-primary));
  }

  .phavo-select-option-btn {
    width: 100%;
    text-align: left;
    background: transparent;
    border: none;
    padding: 0;
    font: inherit;
    color: inherit;
    cursor: pointer;
  }
</style>

<div class="phavo-select-wrapper" class:phavo-select-open={open}>
  {#if label}
    <label class="phavo-select-label" for={selectId}>{label}</label>
  {/if}

  <button
    bind:this={triggerEl}
    id={selectId}
    type="button"
    class="phavo-select-trigger"
    aria-haspopup="listbox"
    aria-expanded={open}
    onclick={toggle}
    onkeydown={handleKeydown}
  >
    <span class="phavo-select-value">{selectedLabel || '\u00A0'}</span>
    <span class="phavo-select-chevron"><Icon name="chevron-down" size={14} /></span>
  </button>

  {#if open}
    <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
    <div class="phavo-select-backdrop" onclick={handleBackdropClick} aria-hidden="true"></div>
    <ul
      class="phavo-select-dropdown"
      role="listbox"
      aria-labelledby={selectId}
    >
      {#each options as opt (opt.value)}
        <li
          role="option"
          aria-selected={value === opt.value}
          class="phavo-select-option"
          class:phavo-select-option-selected={value === opt.value}
        >
          <button
            type="button"
            class="phavo-select-option-btn"
            onclick={() => select(opt)}
          >
            {opt.label}
          </button>
        </li>
      {/each}
    </ul>
  {/if}
</div>
