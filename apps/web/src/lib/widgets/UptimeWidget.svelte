<script lang="ts">
  import type { UptimeMetrics, WidgetSize } from '@phavo/types';
  import { Icon } from '@phavo/ui';
  import { formatDuration } from '$lib/utils/format';

  interface Props {
    data: UptimeMetrics;
    size?: WidgetSize;
  }

  let { data, size = 'M' }: Props = $props();

  const formatted = $derived(formatDuration(data.seconds));
</script>

<div class="uptime-widget">
  {#if size === 'S'}
    <div class="s-row">
      <Icon name="clock" size={16} class="text-accent" />
      <span class="metric-value mono">{formatted}</span>
    </div>
  {:else}
    <div class="primary-metric">
      <span class="metric-value mono">{formatted}</span>
    </div>
    <span class="human-label">System uptime</span>
  {/if}
</div>

<style>
  .uptime-widget {
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

  .human-label {
    font-size: 12px;
    color: var(--color-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
</style>