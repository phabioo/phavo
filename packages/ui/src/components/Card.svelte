<script lang="ts">
import type { Snippet } from 'svelte';

interface Props {
  padding?: 'none' | 'sm' | 'md' | 'lg';
  elevated?: boolean;
  children: Snippet;
}

let { padding = 'md', elevated = false, children }: Props = $props();
</script>

<div class="card card-padding-{padding}" class:elevated>
  {@render children()}
</div>

<style>
  .card {
    background: var(--color-surface);
    border: 1px solid color-mix(in srgb, var(--color-outline-variant) 10%, transparent);
    border-radius: var(--radius-xl);
    box-shadow: var(--shadow-sm);
  }

  .card.elevated {
    background: var(--color-surface-card);
  }

  .card-padding-none { padding: 0; }
  .card-padding-sm { padding: var(--space-3); }
  .card-padding-md { padding: var(--space-4); }
  .card-padding-lg { padding: var(--space-6); }
</style>
