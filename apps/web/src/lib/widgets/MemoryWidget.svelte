<script lang="ts">
  import type { MemoryMetrics, WidgetSize } from '@phavo/types';
  import { Icon } from '@phavo/ui';

  interface Props {
    data: MemoryMetrics;
    size?: WidgetSize;
  }

  let { data, size = 'M' }: Props = $props();

  const usedGb = $derived(((data?.used ?? 0) / 1024 / 1024 / 1024).toFixed(1));
  const totalGb = $derived(Math.round((data?.total ?? 0) / 1024 / 1024 / 1024));
  const usedPercent = $derived(data?.total ? (data.used / data.total) * 100 : 0);
  const swapGb = $derived(((data?.swap?.used ?? 0) / 1024 / 1024 / 1024).toFixed(1));
  const swapPercent = $derived(data?.swap?.total ? (data.swap.used / data.swap.total) * 100 : 0);
</script>

{#if size === 'S'}
  <div class="mem-s">
    <span class="widget-category-label">MEMORY</span>
    <span class="mem-value-s hero-glow">{usedGb}<span class="mem-unit-s"> GB</span></span>
  </div>
{:else}
  <div class="mem-m">
    <div class="widget-header">
      <span class="widget-category-label">MEMORY</span>
      <Icon name="memory-stick" size={18} class="widget-icon" />
    </div>

    <div class="mem-top">
      <div>
        <div class="mem-stat">
          <span class="mem-hero hero-glow">{usedGb}</span>
          <span class="mem-total">/{totalGb}GB</span>
        </div>
      </div>

      <div class="mem-donut">
        <svg viewBox="0 0 96 96" class="mem-donut-svg">
          <circle
            cx="48" cy="48" r="40"
            fill="transparent"
            stroke="currentColor"
            stroke-width="4"
            class="mem-donut-track"
          />
          <circle
            cx="48" cy="48" r="40"
            fill="transparent"
            stroke="currentColor"
            stroke-width="6"
            stroke-linecap="round"
            stroke-dasharray="251.2"
            stroke-dashoffset={251.2 * (1 - usedPercent / 100)}
            class="mem-donut-fill"
            transform="rotate(-90 48 48)"
          />
        </svg>
      </div>
    </div>

    <div class="mem-footer">
      <div class="mem-swap-label">
        <span class="widget-meta-label">SWAP USAGE</span>
        <span class="mem-swap-value">{swapGb} GB</span>
      </div>
      <div class="mem-swap-track">
        <div class="mem-swap-fill" style="width: {swapPercent}%"></div>
      </div>
    </div>
  </div>
{/if}

<style>
  .mem-s {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: flex-start;
    height: 100%;
    gap: var(--space-1);
  }

  .mem-value-s {
    font-size: 32px;
    font-weight: 700;
    color: var(--color-primary-fixed);
    letter-spacing: -0.02em;
  }

  .mem-unit-s {
    font-size: 16px;
    font-weight: 300;
    color: var(--color-on-surface-variant);
  }

  .mem-m {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    height: 100%;
  }

  .mem-top {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
  }

  .mem-stat { margin-top: var(--space-2); }

  .mem-hero {
    font-size: var(--font-size-hero);
    font-weight: 700;
    color: var(--color-primary-fixed);
    letter-spacing: -0.03em;
    line-height: 1;
  }

  .mem-total {
    font-size: 30px;
    font-weight: 300;
    color: var(--color-on-surface-variant);
  }

  .mem-donut {
    width: 96px;
    height: 96px;
    flex-shrink: 0;
  }

  .mem-donut-svg { width: 100%; height: 100%; }

  .mem-donut-track {
    color: color-mix(in srgb, var(--color-primary) 5%, transparent);
  }

  .mem-donut-fill {
    color: var(--color-secondary);
    filter: drop-shadow(0 0 8px color-mix(in srgb, var(--color-secondary) 40%, transparent));
  }

  .mem-footer { padding-top: var(--space-4); }

  .mem-swap-label {
    display: flex;
    justify-content: space-between;
    margin-bottom: var(--space-2);
  }

  .mem-swap-value {
    color: var(--color-secondary);
    font-size: var(--font-size-xs);
    font-weight: 700;
  }

  .mem-swap-track {
    height: 4px;
    background: color-mix(in srgb, var(--color-primary) 5%, transparent);
    border-radius: 9999px;
    overflow: hidden;
  }

  .mem-swap-fill {
    height: 100%;
    background: color-mix(in srgb, var(--color-secondary) 50%, transparent);
    border-radius: 9999px;
  }
</style>
