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
    background: var(--color-bg-surface);
    border: 1px solid var(--color-border-subtle);
    border-radius: var(--radius-md);
  }

  .card.elevated {
    background: var(--color-bg-elevated);
  }

  .card-padding-none { padding: 0; }
  .card-padding-sm { padding: var(--space-3); }
  .card-padding-md { padding: var(--space-4); }
  .card-padding-lg { padding: var(--space-6); }
</style>
