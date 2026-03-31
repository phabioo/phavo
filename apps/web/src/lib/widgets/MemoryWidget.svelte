<script lang="ts">
  import type { MemoryMetrics, WidgetSize } from '@phavo/types';
  import { Icon, ProgressBar } from '@phavo/ui';
  import { formatBytes, formatPercentage } from '$lib/utils/format';

  interface Props {
    data: MemoryMetrics;
    size?: WidgetSize;
  }

  let { data, size = 'M' }: Props = $props();

  const usedPct = $derived(data.total > 0 ? (data.used / data.total) * 100 : 0);
  const freePct = $derived(data.total > 0 ? (data.free / data.total) * 100 : 0);
  const cachedPct = $derived(Math.max(0, 100 - usedPct - freePct));
  const swapPct = $derived(
    data.swap.total > 0 ? (data.swap.used / data.swap.total) * 100 : 0,
  );
  const ramColor = $derived(
    usedPct >= 90 ? 'danger' : usedPct >= 75 ? 'warning' : 'accent',
  );
</script>

<div class="memory-widget">
  {#if size === 'S'}
    <div class="s-row">
      <Icon name="server" size={16} class="text-accent" />
      <span class="metric-value mono">{formatBytes(data.used, 0)}</span>
    </div>
  {:else}
    <div class="primary-metric">
      <span class="metric-value mono">{formatBytes(data.used, 1)}</span>
      <span class="metric-label">of {formatBytes(data.total, 1)} total</span>
    </div>

    <div class="segmented-bar">
      <div class="seg seg-used" style:width="{usedPct}%"></div>
      <div class="seg seg-cached" style:width="{cachedPct}%"></div>
      <div class="seg seg-free" style:width="{freePct}%"></div>
    </div>

    <div class="legend">
      <span class="legend-item"><span class="legend-dot dot-used"></span> Used</span>
      <span class="legend-item"><span class="legend-dot dot-cached"></span> Cached</span>
      <span class="legend-item"><span class="legend-dot dot-free"></span> Free</span>
    </div>

    {#if (size === 'L' || size === 'XL') && data.swap.total > 0}
      <div class="progress-labeled">
        <div class="progress-header">
          <span class="progress-title">Swap</span>
          <span class="progress-pct mono">
            {formatBytes(data.swap.used)} / {formatBytes(data.swap.total)}
          </span>
        </div>
        <ProgressBar value={swapPct} color="warning" />
      </div>
    {/if}
  {/if}
</div>

<style>
  .memory-widget {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .s-row {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  .primary-metric {
    display: flex;
    align-items: baseline;
    gap: var(--space-2);
  }

  .metric-value {
    font-size: 28px;
    font-weight: 700;
    color: var(--color-text-primary);
    line-height: 1;
  }

  .s-row .metric-value {
    font-size: 20px;
  }

  .metric-label {
    font-size: 12px;
    color: var(--color-text-muted);
  }

  .segmented-bar {
    display: flex;
    height: 6px;
    border-radius: 3px;
    overflow: hidden;
    background: var(--color-bg-hover);
  }

  .seg {
    height: 100%;
    transition: width 0.3s ease;
  }

  .seg-used { background: var(--color-accent); }
  .seg-cached { background: var(--color-accent-subtle); }
  .seg-free { background: var(--color-bg-hover); }

  .legend {
    display: flex;
    gap: var(--space-3);
    font-size: 11px;
    color: var(--color-text-secondary);
  }

  .legend-item {
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }

  .legend-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
  }

  .dot-used { background: var(--color-accent); }
  .dot-cached { background: var(--color-accent-subtle); }
  .dot-free { background: var(--color-bg-hover); border: 1px solid var(--color-border); }

  .progress-labeled {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    padding-top: var(--space-2);
    border-top: 1px solid var(--color-border-subtle);
  }

  .progress-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .progress-title {
    font-size: 11px;
    color: var(--color-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.4px;
  }

  .progress-pct {
    font-size: 11px;
    color: var(--color-text-secondary);
  }
</style>
