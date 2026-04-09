<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    children: Snippet;
    master?: Snippet;
    title: string;
    subtitle?: string;
  }

  let { children, master, title, subtitle }: Props = $props();
</script>

<div class="settings-shell">
  {#if master}
    <div class="settings-master">
      {@render master()}
    </div>
  {/if}
  <div class="settings-detail" class:settings-detail-full={!master}>
    {@render children()}
  </div>
</div>

<style>
  .settings-detail-full {
    grid-column: 1 / -1;
  }
</style>
