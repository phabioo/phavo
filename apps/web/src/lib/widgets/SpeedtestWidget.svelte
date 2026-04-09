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
    return mbps >= 1000 ? `${(mbps / 1000).toFixed(1)}` : `${mbps.toFixed(1)}`;
  }

  function fmtSpeedUnit(mbps: number) {
    return mbps >= 1000 ? 'Gbps' : 'Mbps';
  }

  function fmtTime(ts: number) {
    return new Date(ts).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  }
</script>

{#if size === 'S'}
  {#if !latest}
    <div class="speed-s">
      <span class="widget-category-label">SPEEDTEST</span>
      <span class="speed-s-value" style="color: var(--color-outline); font-size: 14px;">No results</span>
    </div>
  {:else}
    <div class="speed-s">
      <span class="widget-category-label">SPEEDTEST</span>
      <span class="speed-s-value hero-glow">
        {fmtSpeed(latest.downloadMbps)}<span class="speed-s-unit">{fmtSpeedUnit(latest.downloadMbps)}</span>
      </span>
    </div>
  {/if}
{:else if size === 'M'}
  <div class="speed-m">
    <div class="widget-header">
      <span class="widget-category-label">SPEEDTEST</span>
      <Icon name="gauge" size={18} class="widget-icon" />
    </div>

    {#if !latest}
      <div class="speed-empty">
        <Icon name="gauge" size={20} />
        <span>No results yet</span>
      </div>
    {:else}
      <div class="speed-hero-wrap">
        <div class="speed-hero-block">
          <span class="widget-meta-label">DOWNLOAD</span>
          <span class="speed-hero hero-glow">
            {fmtSpeed(latest.downloadMbps)}<span class="speed-hero-unit">{fmtSpeedUnit(latest.downloadMbps)}</span>
          </span>
        </div>
        <div class="speed-hero-block">
          <span class="widget-meta-label">UPLOAD</span>
          <span class="speed-secondary">
            {fmtSpeed(latest.uploadMbps)}<span class="speed-secondary-unit">{fmtSpeedUnit(latest.uploadMbps)}</span>
          </span>
        </div>
      </div>

      <div class="speed-meta">
        <span class="speed-meta-item">Ping {latest.latencyMs.toFixed(0)}ms</span>
        <span class="speed-meta-item">{fmtTime(latest.timestamp)}</span>
      </div>
    {/if}
  </div>
{:else}
  <div class="speed-l">
    <div class="widget-header">
      <span class="widget-category-label">SPEEDTEST</span>
      <Icon name="gauge" size={18} class="widget-icon" />
    </div>

    {#if !latest}
      <div class="speed-empty">
        <Icon name="gauge" size={20} />
        <span>No results yet</span>
      </div>
    {:else}
      <div class="speed-hero-wrap">
        <div class="speed-hero-block">
          <span class="widget-meta-label">DOWNLOAD</span>
          <span class="speed-hero hero-glow">
            {fmtSpeed(latest.downloadMbps)}<span class="speed-hero-unit">{fmtSpeedUnit(latest.downloadMbps)}</span>
          </span>
        </div>
        <div class="speed-hero-block">
          <span class="widget-meta-label">UPLOAD</span>
          <span class="speed-secondary">
            {fmtSpeed(latest.uploadMbps)}<span class="speed-secondary-unit">{fmtSpeedUnit(latest.uploadMbps)}</span>
          </span>
        </div>
      </div>

      <div class="speed-meta">
        <span class="speed-meta-item">Ping {latest.latencyMs.toFixed(0)}ms</span>
        <span class="speed-meta-item">{fmtTime(latest.timestamp)}</span>
      </div>

      {#if data.history.length > 0}
        <div class="speed-history">
          <span class="widget-meta-label">RECENT</span>
          {#each data.history.slice(0, 5) as r (r.timestamp)}
            <div class="speed-history-row">
              <span class="speed-history-val">{fmtSpeed(r.downloadMbps)} {fmtSpeedUnit(r.downloadMbps)}</span>
              <span class="speed-history-val">{fmtSpeed(r.uploadMbps)} {fmtSpeedUnit(r.uploadMbps)}</span>
              <span class="speed-history-time">{fmtTime(r.timestamp)}</span>
            </div>
          {/each}
        </div>
      {/if}
    {/if}
  </div>
{/if}

<style>
  /* ── S size ─────────────────────────────────────────── */
  .speed-s {
    display: flex;
    flex-direction: column;
    justify-content: center;
    height: 100%;
    padding: var(--space-4);
    gap: var(--space-1);
  }

  .speed-s-value {
    font-size: 32px;
    font-weight: 700;
    color: var(--color-primary-fixed);
    letter-spacing: -0.02em;
  }

  .speed-s-unit {
    font-size: 16px;
    font-weight: 300;
    color: var(--color-on-surface-variant);
  }

  /* ── M/L/XL shared ──────────────────────────────────── */
  .speed-m,
  .speed-l {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    height: 100%;
    gap: var(--space-4);
  }

  /* ── Hero stat ──────────────────────────────────────── */
  .speed-hero-wrap {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    justify-content: center;
  }

  .speed-hero-block {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .speed-hero {
    font-size: 56px;
    font-weight: 700;
    color: var(--color-primary-fixed);
    letter-spacing: -0.03em;
    line-height: 1;
  }

  .speed-hero-unit {
    font-size: 24px;
    font-weight: 300;
    color: var(--color-on-surface-variant);
  }

  .speed-secondary {
    font-size: 36px;
    font-weight: 700;
    color: var(--color-primary-fixed);
    letter-spacing: -0.02em;
    line-height: 1;
  }

  .speed-secondary-unit {
    font-size: 18px;
    font-weight: 300;
    color: var(--color-on-surface-variant);
  }

  /* ── Empty state ────────────────────────────────────── */
  .speed-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-4) 0;
    color: var(--color-outline);
    font-size: 13px;
    flex: 1;
    justify-content: center;
  }

  /* ── Meta row ───────────────────────────────────────── */
  .speed-meta {
    display: flex;
    gap: var(--space-3);
  }

  .speed-meta-item {
    font-size: 12px;
    color: var(--color-outline);
    font-family: var(--font-mono);
  }

  /* ── History (L/XL) ─────────────────────────────────── */
  .speed-history {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    padding-top: var(--space-2);
    border-top: 1px solid color-mix(in srgb, var(--color-outline-variant) 15%, transparent);
  }

  .speed-history-row {
    display: flex;
    gap: var(--space-3);
    font-size: 12px;
    color: var(--color-on-surface);
    font-family: var(--font-mono);
  }

  .speed-history-val {
    min-width: 100px;
  }

  .speed-history-time {
    color: var(--color-outline);
    margin-left: auto;
  }
</style>