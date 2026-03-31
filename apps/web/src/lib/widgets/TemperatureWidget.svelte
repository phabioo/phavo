<script lang="ts">
  import type { TemperatureMetrics, WidgetSize } from '@phavo/types';
  import { Badge, Icon } from '@phavo/ui';

  interface Props {
    data: TemperatureMetrics;
    size?: WidgetSize;
  }

  let { data, size = 'M' }: Props = $props();

  const hasTemp = $derived(data.cpuTemp !== null);
  const temp = $derived(data.cpuTemp ?? 0);
  const tempState = $derived(
    !hasTemp ? 'unknown' : temp >= 80 ? 'hot' : temp >= 60 ? 'warm' : 'cool',
  );
  const badgeVariant = $derived(
    tempState === 'hot' ? 'danger' : tempState === 'warm' ? 'warning' : 'success',
  );
  const badgeLabel = $derived(
    tempState === 'hot' ? 'Hot' : tempState === 'warm' ? 'Warm' : 'Cool',
  );
</script>

<div class="temp-widget">
  {#if !hasTemp}
    <div class="no-sensor">
      <Icon name="thermometer" size={20} />
      <span class="no-sensor-text">Not available</span>
    </div>
  {:else if size === 'S'}
    <div class="s-row">
      <Icon name="thermometer" size={16} class="text-accent" />
      <span class="metric-value mono">{temp.toFixed(0)}°C</span>
    </div>
  {:else}
    <div class="primary-metric">
      <span class="metric-value mono">{temp.toFixed(1)}</span>
      <span class="metric-unit">°{data.unit}</span>
    </div>

    <Badge variant={badgeVariant}>{badgeLabel}</Badge>
  {/if}
</div>

<style>
  .temp-widget {
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
    gap: 2px;
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

  .metric-unit {
    font-size: 14px;
    color: var(--color-text-muted);
  }

  .no-sensor {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-4) 0;
    color: var(--color-text-muted);
  }

  .no-sensor-text {
    font-size: 13px;
  }
</style>