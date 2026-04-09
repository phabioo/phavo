<script lang="ts">
import type { Snippet } from 'svelte';

interface Props {
  text: string;
  children: Snippet;
}

let { text, children }: Props = $props();
</script>

<span class="tooltip-wrapper">
  {@render children()}
  <span class="tooltip-text">{text}</span>
</span>

<style>
  .tooltip-wrapper {
    position: relative;
    display: inline-flex;
  }

  .tooltip-text {
    position: absolute;
    bottom: calc(100% + 6px);
    left: 50%;
    transform: translateX(-50%);
    padding: var(--space-1) var(--space-2);
    background: var(--color-surface-card);
    color: var(--color-on-surface);
    font-size: 12px;
    border-radius: var(--radius-sm);
    border: 1px solid color-mix(in srgb, var(--color-outline-variant) 15%, transparent);
    white-space: nowrap;
    visibility: hidden;
    opacity: 0;
    transition: opacity 0.15s, visibility 0.15s;
    pointer-events: none;
    z-index: 1000;
  }

  .tooltip-wrapper:hover .tooltip-text {
    visibility: visible;
    opacity: 1;
  }
</style>
