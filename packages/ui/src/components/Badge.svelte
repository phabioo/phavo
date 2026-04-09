<script lang="ts">
import type { Snippet } from 'svelte';

interface Props {
  variant?: 'default' | 'accent' | 'danger' | 'warning' | 'success';
  children: Snippet;
}

let { variant = 'default', children }: Props = $props();
</script>

<span class="badge badge-{variant}">
  {@render children()}
</span>

<style>
  .badge {
    display: inline-flex;
    align-items: center;
    padding: 2px var(--space-2);
    font-size: 11px;
    font-weight: 600;
    border-radius: var(--radius-sm);
    line-height: 1.4;
  }

  .badge-default {
    background: var(--color-surface-card);
    color: var(--color-on-surface-variant);
  }

  .badge-accent {
    background: var(--color-primary-fixed-dim);
    color: var(--color-bg);
  }

  .badge-danger {
    background: var(--color-danger-subtle);
    color: var(--color-on-surface);
  }

  .badge-warning {
    background: var(--color-warning-subtle);
    color: var(--color-on-surface);
  }

  .badge-success {
    background: var(--color-primary-fixed-dim);
    color: var(--color-bg);
  }
</style>
