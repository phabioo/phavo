<script lang="ts">
interface Props {
  value: number;
  color?: 'accent' | 'danger' | 'warning';
}

let { value, color = 'accent' }: Props = $props();

const clamped = $derived(Math.min(100, Math.max(0, value)));
</script>

<div class="progress-bar">
  <div
    class="progress-fill progress-{color}"
    style:width="{clamped}%"
  ></div>
</div>

<style>
  .progress-bar {
    width: 100%;
    height: 6px;
    background: var(--color-bg-hover);
    border-radius: 3px;
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    border-radius: 3px;
    transition: width 0.3s ease;
  }

  .progress-accent { background: var(--color-accent); }
  .progress-danger { background: var(--color-danger); }
  .progress-warning { background: var(--color-warning); }
</style>
