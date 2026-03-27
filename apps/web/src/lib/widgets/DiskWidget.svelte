<script lang="ts">
  import type { DiskMetrics } from '@phavo/types';
  import { ProgressBar } from '@phavo/ui';
  import { formatBytes, formatPercentage, formatSpeed } from '$lib/utils/format';

  interface Props {
    data: DiskMetrics[];
  }

  let { data }: Props = $props();

  // Show only real mounts: /  and /Volumes/*, exclude system internals
  const visibleDisks = $derived(
    data.filter(
      (d) =>
        !d.mount.includes('/System/Volumes/') &&
        !d.mount.includes('/Library/Developer/CoreSimulator/') &&
        !d.mount.includes('/private/var/') &&
        d.total > 0,
    ),
  );

  function diskColor(pct: number): 'accent' | 'warning' | 'danger' {
    if (pct >= 90) return 'danger';
    if (pct >= 75) return 'warning';
    return 'accent';
  }

  // Aggregate totals across all physical disks
  const totalUsed = $derived(data.reduce((sum, d) => sum + d.used, 0));
  const totalSize = $derived(data.reduce((sum, d) => sum + d.total, 0));
  const totalPct = $derived(totalSize > 0 ? (totalUsed / totalSize) * 100 : 0);

  // I/O from any disk (all share same stats from agent)
  const ioRead = $derived(data[0]?.readSpeed ?? 0);
  const ioWrite = $derived(data[0]?.writeSpeed ?? 0);
</script>

<div class="disk-widget">
  {#if visibleDisks.length === 1}
    {@const disk = visibleDisks[0]!}
    <div class="primary-metric">
      <span class="metric-value mono">{formatBytes(disk.used)}</span>
      <span class="metric-label">of {formatBytes(disk.total)}</span>
    </div>

    <div class="progress-labeled">
      <div class="progress-header">
        <span class="progress-title">{disk.mount}</span>
        <span class="progress-pct mono">{formatPercentage(disk.usePercent)}</span>
      </div>
      <ProgressBar value={disk.usePercent} color={diskColor(disk.usePercent)} />
    </div>
  {:else}
    <div class="disk-list">
      {#each visibleDisks.slice(0, 4) as disk}
        <div class="disk-row">
          <div class="disk-info">
            <span class="disk-mount">{disk.mount}</span>
            <span class="disk-sizes mono">
              {formatBytes(disk.used)} / {formatBytes(disk.total)}
            </span>
          </div>
          <div class="disk-progress">
            <ProgressBar value={disk.usePercent} color={diskColor(disk.usePercent)} />
          </div>
          <span class="disk-pct mono">{formatPercentage(disk.usePercent, 0)}</span>
        </div>
      {/each}
    </div>
  {/if}

  <div class="io-row">
    <div class="io-stat">
      <span class="io-arrow io-read">↓</span>
      <span class="io-label">Read</span>
      <span class="io-value mono">{formatSpeed(ioRead)}</span>
    </div>
    <div class="io-stat">
      <span class="io-arrow io-write">↑</span>
      <span class="io-label">Write</span>
      <span class="io-value mono">{formatSpeed(ioWrite)}</span>
    </div>
    {#if visibleDisks.length > 1}
      <div class="io-stat">
        <span class="io-label">Total</span>
        <span class="io-value mono">{formatPercentage(totalPct, 0)} used</span>
      </div>
    {/if}
  </div>
</div>

<style>
  .disk-widget {
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

  .disk-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .disk-row {
    display: grid;
    grid-template-columns: 1fr auto;
    grid-template-rows: auto auto;
    gap: 2px var(--space-2);
    align-items: center;
  }

  .disk-info {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    grid-column: 1 / 2;
  }

  .disk-mount {
    font-size: 12px;
    color: var(--color-text-secondary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 140px;
  }

  .disk-sizes {
    font-size: 10px;
    color: var(--color-text-muted);
    flex-shrink: 0;
  }

  .disk-progress {
    grid-column: 1 / 2;
  }

  .disk-pct {
    font-size: 11px;
    color: var(--color-text-muted);
    grid-row: 2;
    grid-column: 2 / 3;
    text-align: right;
  }

  .io-row {
    display: flex;
    gap: var(--space-4);
    padding-top: var(--space-2);
    border-top: 1px solid var(--color-border-subtle);
  }

  .io-stat {
    display: flex;
    align-items: center;
    gap: var(--space-1);
  }

  .io-arrow {
    font-size: 12px;
    line-height: 1;
  }

  .io-read  { color: var(--color-accent); }
  .io-write { color: var(--color-warning); }

  .io-label {
    font-size: 11px;
    color: var(--color-text-muted);
  }

  .io-value {
    font-size: 12px;
    color: var(--color-text-secondary);
  }
</style>
