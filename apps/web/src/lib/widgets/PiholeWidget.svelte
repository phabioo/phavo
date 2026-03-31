<script lang="ts">
  import type { PiholeMetrics, WidgetSize } from '@phavo/types';
  import { Badge, Icon, ProgressBar } from '@phavo/ui';
  import { formatPercentage } from '$lib/utils/format';

  interface Props {
    data: PiholeMetrics;
    size?: WidgetSize;
  }

  let { data, size = 'M' }: Props = $props();
</script>

<div class="pihole-widget">
  {#if size === 'S'}
    <div class="s-row">
      <Icon name="shield" size={16} class="text-accent" />
      <span class="metric-value mono">{formatPercentage(data.percentBlocked, 0)}</span>
    </div>
  {:else}
    <div class="stat-row">
      <div class="stat">
        <span class="stat-label">Total queries</span>
        <span class="stat-value mono">{data.totalQueries.toLocaleString()}</span>
      </div>
      <div class="stat">
        <span class="stat-label">Blocked</span>
        <span class="stat-value mono">{formatPercentage(data.percentBlocked)}</span>
      </div>
    </div>

    <ProgressBar value={data.percentBlocked} color="accent" />

    <Badge variant={data.status === 'enabled' ? 'success' : 'danger'}>
      {data.status === 'enabled' ? 'Active' : 'Disabled'}
    </Badge>

    {#if size === 'L' || size === 'XL'}
      <div class="extra">
        <div class="extra-stat">
          <span class="extra-label">Blocklists</span>
          <span class="extra-value mono">{data.domainsOnBlocklist.toLocaleString()}</span>
        </div>
      </div>
    {/if}
  {/if}
</div>

<style>
  .pihole-widget {
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

  .stat-row {
    display: flex;
    justify-content: space-between;
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
    font-size: 22px;
    font-weight: 700;
    color: var(--color-text-primary);
    line-height: 1;
  }

  .extra {
    padding-top: var(--space-2);
    border-top: 1px solid var(--color-border-subtle);
  }

  .extra-stat {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .extra-label {
    font-size: 11px;
    color: var(--color-text-muted);
  }

  .extra-value {
    font-size: 13px;
    color: var(--color-text-secondary);
  }
</style>