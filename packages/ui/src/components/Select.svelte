<script lang="ts">
interface SelectOption {
  value: string;
  label: string;
}

interface Props {
  label?: string;
  options: SelectOption[];
  value?: string;
  onchange?: (value: string) => void;
}

let { label, options, value = $bindable(''), onchange }: Props = $props();

const selectId = `select-${Math.random().toString(36).slice(2, 9)}`;

function handleChange(e: Event) {
  const target = e.target as HTMLSelectElement;
  value = target.value;
  onchange?.(target.value);
}
</script>

<div class="select-wrapper">
  {#if label}
    <label class="select-label" for={selectId}>{label}</label>
  {/if}
  <select id={selectId} class="select" bind:value onchange={handleChange}>
    {#each options as opt}
      <option value={opt.value}>{opt.label}</option>
    {/each}
  </select>
</div>

<style>
  .select-wrapper {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .select-label {
    font-size: 13px;
    font-weight: 500;
    color: var(--color-text-secondary);
  }

  .select {
    padding: var(--space-2) var(--space-3);
    background: var(--color-bg-base);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    color: var(--color-text-primary);
    font-family: var(--font-ui);
    font-size: 14px;
    outline: none;
    cursor: pointer;
    appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23888780' d='M2 4l4 4 4-4'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right var(--space-3) center;
    padding-right: var(--space-8);
  }

  .select:focus {
    border-color: var(--color-accent);
  }
</style>
