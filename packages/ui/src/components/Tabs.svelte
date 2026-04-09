<script lang="ts">
interface TabItem {
  id: string;
  label: string;
}

interface Props {
  tabs: TabItem[];
  activeTab?: string;
  onchange?: (id: string) => void;
}

let { tabs, activeTab = $bindable(''), onchange }: Props = $props();

function handleClick(id: string) {
  activeTab = id;
  onchange?.(id);
}
</script>

<div class="tabs" role="tablist">
  {#each tabs as tab}
    <button
      class="tab"
      class:active={activeTab === tab.id}
      role="tab"
      aria-selected={activeTab === tab.id}
      onclick={() => handleClick(tab.id)}
      type="button"
    >
      {tab.label}
    </button>
  {/each}
</div>

<style>
  .tabs {
    display: flex;
    gap: var(--space-1);
    border-bottom: 1px solid color-mix(in srgb, var(--color-outline-variant) 10%, transparent);
    padding: 0 var(--space-4);
  }

  .tab {
    padding: var(--space-2) var(--space-4);
    background: none;
    border: none;
    border-bottom: 2px solid transparent;
    color: var(--color-on-surface-variant);
    font-family: var(--font-ui);
    font-size: 14px;
    cursor: pointer;
    transition: color 0.15s, border-color 0.15s;
  }

  .tab:hover {
    color: var(--color-on-surface);
  }

  .tab.active {
    color: var(--color-primary);
    border-bottom-color: var(--color-primary);
  }
</style>
