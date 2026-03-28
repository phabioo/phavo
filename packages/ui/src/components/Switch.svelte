<script lang="ts">
interface Props {
  checked?: boolean;
  label?: string;
  onchange?: (checked: boolean) => void;
}

let { checked = $bindable(false), label, onchange }: Props = $props();

function toggle() {
  checked = !checked;
  onchange?.(checked);
}
</script>

<label class="switch-wrapper">
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label}
    class="switch"
    class:active={checked}
    onclick={toggle}
  >
    <span class="switch-thumb"></span>
  </button>
  {#if label}
    <span class="switch-label">{label}</span>
  {/if}
</label>

<style>
  .switch-wrapper {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    cursor: pointer;
  }

  .switch {
    position: relative;
    width: 36px;
    height: 20px;
    background: var(--color-bg-hover);
    border: 1px solid var(--color-border);
    border-radius: 10px;
    cursor: pointer;
    transition: background 0.2s, border-color 0.2s;
    padding: 0;
  }

  .switch.active {
    background: var(--color-accent);
    border-color: var(--color-accent);
  }

  .switch-thumb {
    position: absolute;
    top: 2px;
    left: 2px;
    width: 14px;
    height: 14px;
    background: var(--color-text-primary);
    border-radius: 50%;
    transition: transform 0.2s;
  }

  .switch.active .switch-thumb {
    transform: translateX(16px);
  }

  .switch-label {
    font-size: 14px;
    color: var(--color-text-primary);
  }
</style>
