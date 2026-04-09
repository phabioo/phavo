<script lang="ts">
interface Props {
  width?: string;
  height?: string;
  rounded?: boolean;
}

let { width = '100%', height = '14px', rounded = true }: Props = $props();
</script>

<div
  class="skeleton"
  class:rounded
  style:width
  style:height
></div>

<style>
  .skeleton {
    background: var(--color-surface-high);
    animation: pulse 1.5s ease-in-out infinite;
  }

  .skeleton.rounded {
    border-radius: var(--radius-sm);
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.4; }
  }
</style>
