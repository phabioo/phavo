<script lang="ts">
import type { Snippet } from 'svelte';

interface Props {
  open?: boolean;
  onclose?: () => void;
  children: Snippet;
}

let { open = $bindable(false), onclose, children }: Props = $props();

function handleBackdrop() {
  open = false;
  onclose?.();
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    open = false;
    onclose?.();
  }
}
</script>

<svelte:window onkeydown={handleKeydown} />

{#if open}
  <div class="modal-backdrop" onclick={handleBackdrop} role="presentation"></div>
  <div class="modal" role="dialog" aria-modal="true">
    <div class="modal-content">
      {@render children()}
    </div>
  </div>
{/if}

<style>
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: color-mix(in srgb, var(--color-surface-dim) 60%, transparent);
    z-index: 999;
  }

  .modal {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    z-index: 1000;
    width: 90%;
    max-width: 520px;
    max-height: 85vh;
    overflow-y: auto;
  }

  .modal-content {
    background: var(--color-surface);
    border: 1px solid color-mix(in srgb, var(--color-outline-variant) 15%, transparent);
    border-radius: var(--radius-lg);
    padding: var(--space-6);
    box-shadow: var(--shadow-md);
  }
</style>
