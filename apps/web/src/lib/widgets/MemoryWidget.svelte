<script lang="ts">
  import type { MemoryMetrics } from '@phavo/types';
  import { ProgressBar } from '@phavo/ui';
  import { formatBytes, formatPercentage } from '$lib/utils/format';

  interface Props {
    data: MemoryMetrics;
  }

  let { data }: Props = $props();

  const usedPct = $derived(data.total > 0 ? (data.used / data.total) * 100 : 0);
  const swapPct = $derived(
    data.swap.total > 0 ? (data.swap.used / data.swap.total) * 100 : 0,
  );
  const ramColor = $derived(
    usedPct >= 90 ? 'danger' : usedPct >= 75 ? 'warning' : 'accent',
  );
</script>

<div class="memory-widget">
  <div class="primary-metric">
    <span class="metric-value mono">{formatBytes(data.used, 1)}</span>
    <span class="metric-label">of {formatBytes(data.total, 1)}</span>
  </div>

  <div class="progress-labeled">
    <div class="progress-header">
      <span class="progress-title">RAM</span>
      <span class="progress-pct mono">{formatPercentage(usedPct)}</span>
    </div>
    <ProgressBar value={usedPct} color={ramColor} />
  </div>

  {#if data.swap.total > 0}
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

  <div class="stat-row">
    <div class="stat">
      <span class="stat-label">Used</span>
      <span class="stat-value mono">{formatBytes(data.used)}</span>
    </div>
    <div class="stat">
      <span class="stat-label">Free</span>
      <span class="stat-value mono">{formatBytes(data.free)}</span>
    </div>
    <div class="stat">
      <span class="stat-label">Total</span>
      <span class="stat-value mono">{formatBytes(data.total)}</span>
    </div>
  </div>
</div>

<style>
  .memory-widget {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
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

  .metric-label {
    font-size: 12px;
    color: var(--color-text-muted);
  }

  .progress-labeled {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
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

  .stat-row {
    display: flex;
    justify-content: space-between;
    padding-top: var(--space-2);
    border-top: 1px solid var(--color-border-subtle);
  }

  .stat {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .stat-label {
    font-size: 10px;
    color: var(--color-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.4px;
  }

  .stat-value {
    font-size: 13px;
    color: var(--color-text-secondary);
  }
</style>
