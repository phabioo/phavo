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
    grid-template-columns: repeat(2, 1fr);
    grid-auto-rows: clamp(80px, 20vw, 120px);
    gap: var(--bento-gap, 1.5rem);
    width: 100%;
  }

  @media (min-width: 640px) {
    .bento-grid {
      grid-template-columns: repeat(4, 1fr);
      grid-auto-rows: clamp(120px, 7vw, 160px);
    }
  }

  @media (min-width: 1024px) {
    .bento-grid {
      grid-template-columns: repeat(8, 1fr);
      grid-auto-rows: clamp(120px, 7vw, 160px);
    }
  }
</style>
