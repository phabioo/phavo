<script lang="ts">
  import type { SpeedtestMetrics, WidgetSize } from '@phavo/types';
  import { Icon } from '@phavo/ui';

  interface Props {
    data: SpeedtestMetrics;
    size?: WidgetSize;
  }

  let { data, size = 'M' }: Props = $props();

  const latest = $derived(data.lastResult);

  let running = $state(false);
  let lastError = $state<string | null>(null);

  async function runTest() {
    if (running) return;
    running = true;
    lastError = null;
    try {
      const res = await fetch('/api/v1/integrations/speedtest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const json = await res.json();
      if (!json.ok) lastError = json.error ?? 'Test failed';
    } catch {
      lastError = 'Connection error';
    } finally {
      running = false;
    }
  }

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
      <span class="speed-s-empty">No results</span>
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
      <span class="speed-hero hero-glow">{fmtSpeed(latest.downloadMbps)}<span class="speed-unit">{fmtSpeedUnit(latest.downloadMbps)}</span></span>

      <div class="speed-meta">
        <span class="speed-meta-item">Ping {latest.latencyMs.toFixed(0)}ms</span>
        <span class="speed-meta-item">{fmtTime(latest.timestamp)}</span>
      </div>
    {/if}

    <button
      class="speedtest-run-btn"
      onclick={runTest}
      disabled={running}
      aria-label="Run speed test"
    >
      {#if running}
        <Icon name="loader-2" size={14} class="spin" />
        <span>TESTING...</span>
      {:else}
        <Icon name="play" size={14} />
        <span>RUN TEST</span>
      {/if}
    </button>
    {#if lastError}
      <span class="speed-error">{lastError}</span>
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
      <div class="speed-dual">
        <div class="speed-dual-stat">
          <span class="speed-dual-label">DOWNLOAD</span>
          <span class="speed-dual-value hero-glow">{fmtSpeed(latest.downloadMbps)}<span class="speed-dual-unit">{fmtSpeedUnit(latest.downloadMbps)}</span></span>
        </div>
        <div class="speed-dual-stat">
          <span class="speed-dual-label">UPLOAD</span>
          <span class="speed-dual-value hero-glow">{fmtSpeed(latest.uploadMbps)}<span class="speed-dual-unit">{fmtSpeedUnit(latest.uploadMbps)}</span></span>
        </div>
      </div>

      <div class="speed-meta">
        <span class="speed-meta-item">Ping {latest.latencyMs.toFixed(0)}ms</span>
        <span class="speed-meta-item">{fmtTime(latest.timestamp)}</span>
        {#if data.testInProgress}
          <span class="speed-meta-item">Running...</span>
        {:else if data.cooldownUntil && data.cooldownUntil > Date.now()}
          <span class="speed-meta-item">Cooldown</span>
        {/if}
      </div>

      <div class="speed-bars">
        <div class="speed-bar-row">
          <span class="speed-bar-label">Down</span>
          <div class="speed-bar-track"><div class="speed-bar-fill" style:width={`${Math.min(latest.downloadMbps / 10, 100)}%`}></div></div>
        </div>
        <div class="speed-bar-row">
          <span class="speed-bar-label">Up</span>
          <div class="speed-bar-track"><div class="speed-bar-fill speed-bar-fill-dim" style:width={`${Math.min(latest.uploadMbps / 10, 100)}%`}></div></div>
        </div>
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

    <button
      class="speedtest-run-btn"
      onclick={runTest}
      disabled={running}
      aria-label="Run speed test"
    >
      {#if running}
        <Icon name="loader-2" size={14} class="spin" />
        <span>TESTING...</span>
      {:else}
        <Icon name="play" size={14} />
        <span>RUN TEST</span>
      {/if}
    </button>
    {#if lastError}
      <span class="speed-error">{lastError}</span>
    {/if}
  </div>
{/if}

<style>
  /* ── S size ─────────────────────────────────────────── */
  .speed-s {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    height: 100%;
    padding: var(--space-4);
    gap: var(--space-1);
  }

  .speed-s-value {
    font-size: var(--font-size-s-hero);
    font-weight: 700;
    color: var(--color-primary-fixed);
    letter-spacing: -0.02em;
  }

  .speed-s-empty {
    font-size: var(--font-size-md);
    color: var(--color-outline);
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

  /* ── M hero stat ────────────────────────────────────── */
  .speed-hero {
    font-size: var(--font-size-hero);  /* 72px */
    font-weight: 700;
    color: var(--color-primary-fixed);
    line-height: 1;
    font-family: var(--font-mono);
  }

  .speed-unit {
    font-size: 28px;
    font-weight: 300;
    color: var(--color-on-surface-variant);
    margin-left: 4px;
  }

  /* ── L dual stats ───────────────────────────────────── */
  .speed-dual {
    display: flex;
    align-items: flex-start;
    gap: var(--space-6);
  }

  .speed-dual-stat {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .speed-dual-value {
    font-size: 40px;
    font-weight: 700;
    color: var(--color-primary-fixed);
    line-height: 1;
    font-family: var(--font-mono);
  }

  .speed-dual-unit {
    font-size: 16px;
    font-weight: 300;
    color: var(--color-on-surface-variant);
  }

  .speed-dual-label {
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--color-outline);
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

  .speed-bars {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .speed-bar-row {
    display: grid;
    grid-template-columns: 44px 1fr;
    align-items: center;
    gap: var(--space-2);
  }

  .speed-bar-label {
    font-size: 10px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    font-family: var(--font-mono);
    color: var(--color-on-surface-variant);
  }

  .speed-bar-track {
    height: 6px;
    border-radius: var(--radius-full);
    background: color-mix(in srgb, var(--color-on-surface) 7%, transparent);
    overflow: hidden;
  }

  .speed-bar-fill {
    height: 100%;
    border-radius: inherit;
    background: linear-gradient(90deg, var(--color-secondary), var(--color-secondary-fixed));
    transition: width var(--motion-component);
  }

  .speed-bar-fill-dim {
    background: linear-gradient(
      90deg,
      color-mix(in srgb, var(--color-secondary) 75%, var(--color-surface-high)),
      var(--color-secondary)
    );
  }

  /* ── Run Test button ────────────────────────────────── */
  .speedtest-run-btn {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-2) var(--space-4);
    border-radius: var(--radius-full);
    background: color-mix(in srgb, var(--color-primary-fixed) 12%, transparent);
    border: 1px solid color-mix(in srgb, var(--color-primary-fixed) 25%, transparent);
    color: var(--color-primary-fixed);
    font-size: 11px;
    font-weight: 700;
    font-family: var(--font-mono);
    letter-spacing: 0.08em;
    text-transform: uppercase;
    cursor: pointer;
    transition: background var(--motion-micro);
    margin-top: auto;
  }

  .speedtest-run-btn:hover {
    background: color-mix(in srgb, var(--color-primary-fixed) 20%, transparent);
  }

  .speedtest-run-btn:disabled {
    opacity: 0.5;
    pointer-events: none;
  }

  .speed-error {
    font-size: var(--font-size-xs);
    color: var(--color-error);
    margin-top: var(--space-1);
  }

  :global(.spin) {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to   { transform: rotate(360deg); }
  }
</style>