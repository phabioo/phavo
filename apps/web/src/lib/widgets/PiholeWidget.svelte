<script lang="ts">
  import type { PiholeMetrics } from '@phavo/agent';
  import { ProgressBar } from '@phavo/ui';

  interface Props {
    data: PiholeMetrics;
  }

  let { data }: Props = $props();

  function formatNumber(n: number): string {
    return n.toLocaleString('en-US');
  }

  // Colour the ProgressBar by how much is blocked — higher is better for Pi-hole
  const barColor = $derived(
    data.percentBlocked >= 25 ? 'accent' : data.percentBlocked >= 10 ? 'warning' : 'accent',
  );
</script>

<div class="pihole-widget">
  <!-- Status badge -->
  <div class="status-row">
    <span
      class="status-badge"
      class:status-enabled={data.status === 'enabled'}
      class:status-disabled={data.status === 'disabled'}
    >
      {data.status === 'enabled' ? 'Enabled' : 'Disabled'}
    </span>
    {#if data.status === 'disabled'}
      <span class="configure-hint">Configure in Settings to activate</span>
    {/if}
  </div>

  <!-- Totals grid -->
  <div class="stats-grid">
    <div class="stat-item">
      <span class="stat-value mono">{formatNumber(data.totalQueries)}</span>
      <span class="stat-label">Total Queries</span>
    </div>
    <div class="stat-item">
      <span class="stat-value mono">{formatNumber(data.domainsOnBlocklist)}</span>
      <span class="stat-label">Blocklist Domains</span>
    </div>
  </div>

  <!-- Blocked row with ProgressBar -->
  <div class="blocked-section">
    <div class="blocked-header">
      <span class="stat-label">Blocked</span>
      <span class="blocked-values mono">
        {formatNumber(data.blockedQueries)}
        <span class="pct">({data.percentBlocked.toFixed(1)}%)</span>
      </span>
    </div>
    <ProgressBar value={data.percentBlocked} color={barColor} />
  </div>
</div>

<style>
  .pihole-widget {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }

  /* --- Status badge --- */
  .status-row {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  .status-badge {
    display: inline-block;
    padding: 2px 10px;
    border-radius: 999px;
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  .status-enabled {
    background: color-mix(in srgb, var(--color-accent) 20%, transparent);
    color: var(--color-accent);
  }

  .status-disabled {
    background: color-mix(in srgb, var(--color-text-muted) 15%, transparent);
    color: var(--color-text-muted);
  }

  .configure-hint {
    font-size: 0.75rem;
    color: var(--color-text-muted);
  }

  /* --- Stats grid --- */
  .stats-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-3);
  }

  .stat-item {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .stat-value {
    font-size: 1.4rem;
    font-weight: 700;
    color: var(--color-text);
    line-height: 1;
  }

  .stat-label {
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--color-text-muted);
  }

  /* --- Blocked row --- */
  .blocked-section {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .blocked-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .blocked-values {
    font-size: 0.875rem;
    color: var(--color-text);
  }

  .pct {
    color: var(--color-text-muted);
    margin-left: 4px;
  }
</style>
