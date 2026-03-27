<script lang="ts">
  import type { CpuMetrics } from '@phavo/types';
  import { ProgressBar } from '@phavo/ui';
  import { formatPercentage } from '$lib/utils/format';

  interface Props {
    data: CpuMetrics;
  }

  let { data }: Props = $props();

  const usageColor = $derived(
    data.usage >= 90 ? 'danger' : data.usage >= 70 ? 'warning' : 'accent',
  );
</script>

<div class="cpu-widget">
  <div class="primary-metric">
    <span class="metric-value mono">{formatPercentage(data.usage)}</span>
    <span class="metric-label">CPU Usage</span>
  </div>

  <div class="progress-row">
    <ProgressBar value={data.usage} color={usageColor} />
  </div>

  <div class="model-row">
    <span class="model-name">{data.model}</span>
    <span class="speed mono">{data.speed} GHz</span>
  </div>

  {#if data.cores.length > 0}
    <div class="cores-grid">
      {#each data.cores as coreLoad, i}
        <div class="core-item">
          <div class="core-label">C{i + 1}</div>
          <div class="core-bar-wrap">
            <div
              class="core-bar"
              class:bar-danger={coreLoad >= 90}
              class:bar-warning={coreLoad >= 70 && coreLoad < 90}
              style:width="{Math.min(100, coreLoad)}%"
            ></div>
          </div>
          <div class="core-pct mono">{Math.round(coreLoad)}%</div>
        </div>
      {/each}
    </div>
  {/if}

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
</div>

<style>
  .cpu-widget {
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
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .progress-row {
    margin: var(--space-1) 0;
  }

  .model-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .model-name {
    font-size: 12px;
    color: var(--color-text-secondary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .speed {
    font-size: 12px;
    color: var(--color-text-muted);
    flex-shrink: 0;
    margin-left: var(--space-2);
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
  .core-bar.bar-danger  { background: var(--color-danger); }

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
