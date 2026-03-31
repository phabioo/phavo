<script lang="ts">
  import type { CpuMetrics, WidgetSize } from '@phavo/types';
  import { Icon, ProgressBar } from '@phavo/ui';
  import { formatPercentage } from '$lib/utils/format';

  interface Props {
    data: CpuMetrics;
    size?: WidgetSize;
  }

  let { data, size = 'M' }: Props = $props();

  const usageColor = $derived(
    data.usage >= 90 ? 'danger' : data.usage >= 70 ? 'warning' : 'accent',
  );

  const statusLabel = $derived(
    data.usage >= 90 ? 'Critical' : data.usage >= 70 ? 'High' : 'Stable',
  );
</script>

<div class="cpu-widget">
  {#if size === 'S'}
    <div class="s-row">
      <Icon name="cpu" size={16} class="text-accent" />
      <span class="metric-value mono">{formatPercentage(data.usage, 0)}</span>
    </div>
  {:else}
    <div class="primary-metric">
      <span class="metric-value mono">{formatPercentage(data.usage)}</span>
      <span class="status-label" class:status-danger={data.usage >= 90} class:status-warning={data.usage >= 70 && data.usage < 90}>{statusLabel}</span>
    </div>

    <div class="core-count">
      <Icon name="cpu" size={14} />
      <span>{data.cores.length} cores</span>
    </div>

    <div class="progress-row">
      <ProgressBar value={data.usage} color={usageColor} />
    </div>

    {#if (size === 'L' || size === 'XL') && data.cores.length > 0}
      <div class="cores-grid">
        {#each data.cores as coreLoad, i}
          <div class="core-item">
            <span class="core-label">C{i + 1}</span>
            <div class="core-bar-wrap">
              <div
                class="core-bar"
                class:bar-danger={coreLoad >= 90}
                class:bar-warning={coreLoad >= 70 && coreLoad < 90}
                style:width="{Math.min(100, coreLoad)}%"
              ></div>
            </div>
            <span class="core-pct mono">{Math.round(coreLoad)}%</span>
          </div>
        {/each}
      </div>

      <div class="load-avg-row">
        <span class="load-label">Load avg</span>
        <div class="load-values">
          {#each data.loadAvg as val, i}
            <span class="load-item mono">
              {val.toFixed(2)}<span class="load-period">{['1m', '5m', '15m'][i]}</span>
            </span>
          {/each}
        </div>
      </div>
    {/if}
  {/if}
</div>

<style>
  .cpu-widget {
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

  .status-label {
    font-size: 11px;
    font-weight: 600;
    color: var(--color-accent-text);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .status-warning { color: var(--color-warning); }
  .status-danger { color: var(--color-danger); }

  .core-count {
    display: flex;
    align-items: center;
    gap: var(--space-1);
    font-size: 12px;
    color: var(--color-text-secondary);
  }

  .progress-row {
    margin: var(--space-1) 0;
  }

  .cores-grid {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding-top: var(--space-1);
  }

  .core-item {
    display: grid;
    grid-template-columns: 24px 1fr 36px;
    align-items: center;
    gap: var(--space-2);
  }

  .core-label {
    font-size: 10px;
    color: var(--color-text-muted);
    text-align: right;
  }

  .core-bar-wrap {
    height: 4px;
    background: var(--color-bg-hover);
    border-radius: 2px;
    overflow: hidden;
  }

  .core-bar {
    height: 100%;
    border-radius: 2px;
    background: var(--color-accent);
    transition: width 0.4s ease;
    min-width: 2px;
  }

  .core-bar.bar-warning { background: var(--color-warning); }
  .core-bar.bar-danger { background: var(--color-danger); }

  .core-pct {
    font-size: 10px;
    color: var(--color-text-muted);
    text-align: right;
  }

  .load-avg-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-top: var(--space-1);
    border-top: 1px solid var(--color-border-subtle);
  }

  .load-label {
    font-size: 11px;
    color: var(--color-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.4px;
  }

  .load-values {
    display: flex;
    gap: var(--space-3);
  }

  .load-item {
    font-size: 12px;
    color: var(--color-text-secondary);
    display: flex;
    align-items: baseline;
    gap: 3px;
  }

  .load-period {
    font-size: 10px;
    color: var(--color-text-muted);
  }
</style>
