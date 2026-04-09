<script lang="ts">
  import type { DiskMetrics, WidgetSize } from '@phavo/types';
  import { Icon } from '@phavo/ui';
  import { formatBytes } from '$lib/utils/format';

  interface Props {
    data: DiskMetrics[];
    size?: WidgetSize;
  }

  let { data, size = 'M' }: Props = $props();

  const visibleDisks = $derived(
    data.filter(
      (d) =>
        !d.mount.includes('/System/Volumes/') &&
        !d.mount.includes('/Library/Developer/CoreSimulator/') &&
        !d.mount.includes('/private/var/') &&
        d.total > 0,
    ),
  );

  const primary = $derived(visibleDisks[0] as DiskMetrics | undefined);
  const primaryUsed = $derived(formatBytes(primary?.used ?? 0, 1));
  const primaryTotal = $derived(formatBytes(primary?.total ?? 0, 1));
  const primaryPercent = $derived(Math.round(primary?.usePercent ?? 0));

  const mounts = $derived(
    visibleDisks.slice(1, 4).map((d) => ({
      path: d.mount,
      used: formatBytes(d.used, 1),
      total: formatBytes(d.total, 1),
      percent: d.total ? Math.round((d.used / d.total) * 100) : 0,
    })),
  );
</script>

{#if size === 'S'}
  <div class="disk-s">
    <span class="widget-category-label">STORAGE</span>
    <span class="disk-value-s hero-glow">{primaryUsed}</span>
  </div>
{:else if size === 'M'}
  <div class="disk-m">
    <div class="disk-header widget-header">
      <span class="widget-category-label">STORAGE LIBRARY</span>
      <Icon name="hard-drive" size={18} class="widget-icon" />
    </div>

    <div class="disk-body">
      <div class="disk-stat-row">
        <div class="disk-hero-wrap">
          <span class="disk-hero hero-glow">{primaryUsed}</span>
          <span class="disk-unit">/ {primaryTotal}</span>
        </div>
        <span class="disk-capacity">{primaryPercent}% Capacity</span>
      </div>

      <div class="disk-bar-track">
        <div class="disk-bar-fill" style="width: {primaryPercent}%; min-width: 12px;"></div>
      </div>
    </div>
  </div>
{:else}
  <div class="disk-l">
    <div class="disk-header widget-header">
      <span class="widget-category-label">STORAGE LIBRARY</span>
      <Icon name="hard-drive" size={18} class="widget-icon" />
    </div>

    <div class="disk-body">
      <div class="disk-stat-row">
        <div class="disk-hero-wrap">
          <span class="disk-hero hero-glow">{primaryUsed}</span>
          <span class="disk-unit">/ {primaryTotal}</span>
        </div>
        <span class="disk-capacity">{primaryPercent}% Capacity</span>
      </div>

      <div class="disk-bar-track">
        <div class="disk-bar-fill" style="width: {primaryPercent}%; min-width: 12px;"></div>
      </div>
    </div>

    <!-- L-only: per-mount breakdown -->
    {#if mounts.length > 0}
    <div class="disk-mounts">
      {#each mounts as mount}
      <div class="disk-mount-row">
        <span class="disk-mount-path">{mount.path}</span>
        <div class="disk-mount-bar-track">
          <div class="disk-mount-bar-fill" style="width: {mount.percent}%"></div>
        </div>
        <span class="disk-mount-value">{mount.used}/{mount.total}</span>
      </div>
      {/each}
    </div>
    {/if}
  </div>
{/if}

<style>
  .disk-s {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: flex-start;
    height: 100%;
    gap: var(--space-1);
  }

  .disk-value-s {
    font-size: 32px;
    font-weight: 700;
    color: var(--color-primary-fixed);
    letter-spacing: -0.02em;
  }

  .disk-m {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    height: 100%;
    position: relative;
  }

  .disk-body {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: center;
  }

  .disk-hero-wrap {
    display: flex;
    align-items: baseline;
    gap: var(--space-2);
    min-width: 0;
  }

  .disk-hero {
    font-size: var(--font-size-4xl);
    font-weight: 700;
    color: var(--color-primary-fixed);
    letter-spacing: -0.02em;
    line-height: 1;
    white-space: nowrap;
  }

  .disk-unit {
    font-size: var(--font-size-xl);
    font-weight: 300;
    color: var(--color-on-surface-variant);
    white-space: nowrap;
  }

  .disk-capacity {
    font-size: var(--font-size-sm);
    font-weight: 700;
    color: var(--color-secondary);
    white-space: nowrap;
    justify-self: end;
  }

  .disk-stat-row {
    display: grid;
    grid-template-columns: 1fr auto;
    align-items: baseline;
    gap: var(--space-2);
    width: 100%;
    margin-bottom: var(--space-4);
  }

  .disk-bar-track {
    height: 6px;
    background: color-mix(in srgb, var(--color-on-surface) 5%, transparent);
    border-radius: 9999px;
    overflow: hidden;
    width: 100%;
    margin: var(--space-4) 0;
  }

  .disk-bar-fill {
    height: 100%;
    min-width: 6px;
    background: linear-gradient(90deg, var(--color-secondary), var(--color-primary-fixed));
    border-radius: 0 9999px 9999px 0;
    transition: width 0.5s ease;
  }

  /* ── L-size layout ──────────────────────────────────────────────────── */
  .disk-l {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    height: 100%;
    position: relative;
  }

  .disk-mounts {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    margin-top: var(--space-4);
    padding-top: var(--space-4);
    border-top: 1px solid color-mix(in srgb, var(--color-outline-variant) 15%, transparent);
  }

  .disk-mount-row {
    display: grid;
    grid-template-columns: 80px 1fr auto;
    align-items: center;
    gap: var(--space-3);
  }

  .disk-mount-path {
    font-size: 11px;
    font-family: var(--font-mono);
    color: var(--color-on-surface-variant);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .disk-mount-bar-track {
    height: 3px;
    background: color-mix(in srgb, var(--color-primary) 5%, transparent);
    border-radius: 9999px;
    overflow: hidden;
  }

  .disk-mount-bar-fill {
    height: 100%;
    background: var(--color-secondary);
    border-radius: 9999px;
  }

  .disk-mount-value {
    font-size: 10px;
    font-family: var(--font-mono);
    color: var(--color-outline);
    white-space: nowrap;
    text-align: right;
  }
</style>
