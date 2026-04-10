<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    gap?: string;
    children: Snippet;
    class?: string;
  }

  let {
    gap = '1.5rem',
    children,
    class: cls = '',
  }: Props = $props();
</script>

<div
  class="bento-grid {cls}"
  style:--bento-gap={gap}
>
  {@render children()}
</div>

<style>
  .bento-grid {
    display: grid;
    grid-template-columns: repeat(1, 1fr);
    gap: var(--bento-gap, 1.5rem);
    width: 100%;
  }

  @media (min-width: 640px) {
    .bento-grid {
      grid-template-columns: repeat(6, 1fr);
    }
  }

  @media (min-width: 1024px) {
    .bento-grid {
      grid-template-columns: repeat(12, 1fr);
      align-items: start;
    }
  }
</style>
