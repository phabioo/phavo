<script lang="ts">
  import type { SpeedtestMetrics, WidgetSize } from '@phavo/types';
  import { Icon } from '@phavo/ui';

  interface Props {
    data: SpeedtestMetrics;
    size?: WidgetSize;
  }

  let { data, size = 'M' }: Props = $props();

  const latest = $derived(data.lastResult);

  function fmtSpeed(mbps: number) {
    return mbps >= 1000 ? `${(mbps / 1000).toFixed(1)} Gbps` : `${mbps.toFixed(1)} Mbps`;
  }

  function fmtTime(ts: number) {
    return new Date(ts).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  }
</script>

<div class="speed-widget">
  {#if !latest}
    <div class="empty">
      <Icon name="gauge" size={20} />
      <span>No results yet</span>
    </div>
  {:else if size === 'S'}
    <div class="s-row">
      <Icon name="arrow-down" size={14} class="text-accent" />
      <span class="metric-value mono">{fmtSpeed(latest.downloadMbps)}</span>
    </div>
  {:else}
    <div class="speed-blocks">
      <div class="speed-block">
        <Icon name="arrow-down" size={16} class="text-accent" />
        <span class="speed-val mono">{fmtSpeed(latest.downloadMbps)}</span>
        <span class="speed-label">Download</span>
      </div>
      <div class="speed-block">
        <Icon name="arrow-up" size={16} class="text-accent" />
        <span class="speed-val mono">{fmtSpeed(latest.uploadMbps)}</span>
        <span class="speed-label">Upload</span>
      </div>
    </div>

    <div class="meta-row">
      <span class="meta-item">Ping {latest.latencyMs.toFixed(0)}ms</span>
      <span class="meta-item">{fmtTime(latest.timestamp)}</span>
    </div>

    {#if (size === 'L' || size === 'XL') && data.history.length > 0}
      <div class="history">
        <span class="history-label">Recent</span>
        {#each data.history.slice(0, 5) as r (r.timestamp)}
          <div class="history-row">
            <span class="mono">{fmtSpeed(r.downloadMbps)}</span>
            <span class="mono">{fmtSpeed(r.uploadMbps)}</span>
            <span class="history-time">{fmtTime(r.timestamp)}</span>
          </div>
        {/each}
      </div>
    {/if}
  {/if}
</div>

<style>
  .speed-widget {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .s-row {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  .metric-value {
    font-size: 20px;
    font-weight: 700;
    color: var(--color-text-primary);
    line-height: 1;
  }

  .empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-4) 0;
    color: var(--color-text-muted);
    font-size: 13px;
  }

  .speed-blocks {
    display: flex;
    gap: var(--space-4);
  }

  .speed-block {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .speed-val {
    font-size: 24px;
    font-weight: 700;
    color: var(--color-text-primary);
    line-height: 1;
  }

  .speed-label {
    font-size: 11px;
    color: var(--color-text-muted);
  }

  .meta-row {
    display: flex;
    gap: var(--space-3);
  }

  .meta-item {
    font-size: 12px;
    color: var(--color-text-muted);
  }

  .history {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    border-top: 1px solid var(--color-border-subtle);
    padding-top: var(--space-2);
  }

  .history-label {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--color-text-muted);
    margin-bottom: var(--space-1);
  }

  .history-row {
    display: flex;
    gap: var(--space-3);
    font-size: 12px;
    color: var(--color-text-primary);
  }

  .history-time {
    color: var(--color-text-muted);
    margin-left: auto;
  }
</style>