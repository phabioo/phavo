<script lang="ts">
  import type { DockerMetrics, WidgetSize } from '@phavo/types';
  import { Icon, Badge, ProgressBar } from '@phavo/ui';
  import { formatBytes } from '$lib/utils/format';

  interface Props {
    data: DockerMetrics;
    size?: WidgetSize;
  }

  let { data, size = 'M' }: Props = $props();

  const running = $derived(data.containers.filter(c => c.status === 'running').length);
  const total = $derived(data.containers.length);

  function stateVariant(state: string) {
    if (state === 'running') return 'success' as const;
    if (state === 'paused') return 'warning' as const;
    return 'danger' as const;
  }
</script>

<div class="docker-widget">
  {#if size === 'S'}
    <div class="s-row">
      <Icon name="container" size={16} class="text-accent" />
      <span class="metric-value mono">{running}/{total}</span>
    </div>
  {:else}
    <div class="summary">
      <span class="metric-value mono">{running}</span>
      <span class="metric-label">/ {total} running</span>
    </div>

    {#if data.containers.length === 0}
      <div class="empty">
        <Icon name="container" size={20} />
        <span>No containers</span>
      </div>
    {:else}
      <div class="container-list">
        {#each data.containers.slice(0, size === 'M' ? 5 : 10) as ctr (ctr.name)}
          <div class="ctr-row">
            <div class="ctr-info">
              <Badge variant={stateVariant(ctr.status)}>{ctr.status}</Badge>
              <span class="ctr-name">{ctr.name}</span>
            </div>
            {#if (size === 'L' || size === 'XL') && ctr.cpuPercent != null}
              <div class="ctr-stats">
                <span class="ctr-stat">{ctr.cpuPercent.toFixed(1)}%</span>
                <span class="ctr-stat">{formatBytes(ctr.memoryUsed ?? 0)}</span>
              </div>
            {/if}
          </div>
        {/each}
      </div>
    {/if}
  {/if}
</div>

<style>
  .docker-widget {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .s-row {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  .summary {
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
    font-size: 13px;
    color: var(--color-text-muted);
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

  .container-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .ctr-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
  }

  .ctr-info {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    min-width: 0;
  }

  .ctr-name {
    font-size: 13px;
    color: var(--color-text-primary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .ctr-stats {
    display: flex;
    gap: var(--space-3);
    flex-shrink: 0;
  }

  .ctr-stat {
    font-size: 12px;
    color: var(--color-text-muted);
    font-family: var(--font-mono);
  }
</style>