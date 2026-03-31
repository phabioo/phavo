<script lang="ts">
  import type { ServiceHealthMetrics, WidgetSize } from '@phavo/types';
  import { Icon, Badge } from '@phavo/ui';

  interface Props {
    data: ServiceHealthMetrics;
    size?: WidgetSize;
  }

  let { data, size = 'M' }: Props = $props();

  const up = $derived(data.services.filter(s => s.status === 'up').length);
  const down = $derived(data.services.filter(s => s.status === 'down').length);

  function statusVariant(status: string) {
    if (status === 'up') return 'success' as const;
    if (status === 'timeout') return 'warning' as const;
    return 'danger' as const;
  }
</script>

<div class="sh-widget">
  {#if size === 'S'}
    <div class="s-row">
      <Icon name="heart-pulse" size={16} class="text-accent" />
      <span class="metric-value mono">{up}</span>
      <span class="s-label">up</span>
      {#if down > 0}
        <span class="s-down mono">{down} down</span>
      {/if}
    </div>
  {:else}
    <div class="summary">
      <span class="metric-value mono">{up}</span>
      <span class="metric-label">/ {data.services.length} healthy</span>
    </div>

    <div class="service-list">
      {#each data.services.slice(0, size === 'M' ? 6 : 12) as svc (svc.name)}
        <div class="svc-row">
          <div class="svc-info">
            <Badge variant={statusVariant(svc.status)}>{svc.status}</Badge>
            <span class="svc-name">{svc.name}</span>
          </div>
          {#if svc.responseTimeMs != null && (size === 'L' || size === 'XL')}
            <span class="svc-latency mono">{svc.responseTimeMs}ms</span>
          {/if}
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .sh-widget {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .s-row {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  .s-down {
    font-size: 12px;
    color: var(--color-danger);
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

  .s-label {
    font-size: 12px;
    color: var(--color-text-muted);
  }

  .service-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .svc-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
  }

  .svc-info {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    min-width: 0;
  }

  .svc-name {
    font-size: 13px;
    color: var(--color-text-primary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .svc-latency {
    font-size: 12px;
    color: var(--color-text-muted);
    flex-shrink: 0;
  }
</style>