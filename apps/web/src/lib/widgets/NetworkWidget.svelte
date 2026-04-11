<script lang="ts">
  import type { NetworkMetrics, WidgetSize } from '@phavo/types';
  import { Icon } from '@phavo/ui';
  import { formatSpeed } from '$lib/utils/format';

  interface Props {
    data: NetworkMetrics;
    size?: WidgetSize;
  }

  let { data, size = 'M' }: Props = $props();

  let speedHistory = $state<number[]>(
    Array.from({ length: 14 }, (_, i) => 50000 + Math.random() * 200000)
  );

  let prevSpeed: number | undefined;

  $effect(() => {
    const speed = data?.downloadSpeed ?? 0;
    if (speed !== prevSpeed) {
      prevSpeed = speed;
      speedHistory = [...speedHistory.slice(-13), speed];
    }
  });

  const maxSpeed = $derived(Math.max(...speedHistory, 1));
  const sparkBars = $derived(
    speedHistory.map((s) => Math.max(8, (s / maxSpeed) * 100)),
  );

  const downSpeed = $derived(formatSpeed(data?.downloadSpeed ?? 0));
  const upSpeed = $derived(formatSpeed(data?.uploadSpeed ?? 0));

  const maxObserved = $derived(Math.max(...speedHistory, 1));
  const downPct = $derived(Math.min(100, ((data?.downloadSpeed ?? 0) / maxObserved) * 100));
  const upPct = $derived(Math.min(100, ((data?.uploadSpeed ?? 0) / maxObserved) * 100));
</script>

{#if size === 'S'}
  <div class="net-s">
    <span class="widget-category-label">NETWORK</span>
    <span class="net-value-s hero-glow">{downSpeed}</span>
  </div>
{:else if size === 'M'}
  <div class="net-m">
    <div class="widget-header">
      <div>
        <span class="widget-category-label">LIVE TRAFFIC</span>
        <h3 class="net-title">Network Throughput</h3>
      </div>
      <Icon name="activity" size={18} class="widget-icon" />
    </div>

    <span class="net-hero hero-glow">{downSpeed}</span>

    <div class="net-chart">
      {#each sparkBars as bar, i (i)}
        <div class="net-bar" style="height: {bar}%"></div>
      {/each}
    </div>
  </div>
{:else}
  <div class="net-l">
    <div class="widget-header">
      <div>
        <span class="widget-category-label">LIVE TRAFFIC</span>
        <h3 class="net-title">Network Throughput</h3>
      </div>
      <Icon name="activity" size={18} class="widget-icon" />
    </div>

    <!-- L-size: dual stats side-by-side at 40px -->
    <div class="net-dual">
      <div class="net-dual-stat">
        <span class="net-dual-label">DOWN</span>
        <span class="net-dual-value hero-glow">{downSpeed}</span>
      </div>
      <div class="net-dual-stat">
        <span class="net-dual-label">UP</span>
        <span class="net-dual-value hero-glow">{upSpeed}</span>
      </div>
    </div>

    <div class="net-chart">
      {#each sparkBars as bar, i (i)}
        <div class="net-bar" style="height: {bar}%"></div>
      {/each}
    </div>

    <!-- L-only: bandwidth bars -->
    <div class="net-bars-section">
      <div class="net-bar-row">
        <span class="widget-meta-label">DOWNLOAD</span>
        <div class="net-bandwidth-track">
          <div class="net-bandwidth-fill" style="width: {downPct}%"></div>
        </div>
        <span class="net-bar-value">{downSpeed}</span>
      </div>
      <div class="net-bar-row">
        <span class="widget-meta-label">UPLOAD</span>
        <div class="net-bandwidth-track">
          <div class="net-bandwidth-fill" style="width: {upPct}%"></div>
        </div>
        <span class="net-bar-value">{upSpeed}</span>
      </div>
    </div>
  </div>
{/if}

<style>
  /* ── S-size ─────────────────────────────────────────────────────────── */
  .net-s {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: flex-start;
    height: 100%;
    gap: var(--space-1);
  }

  .net-value-s {
    font-size: 24px;
    font-weight: 700;
    color: var(--color-primary-fixed);
    letter-spacing: -0.02em;
    font-family: var(--font-mono);
  }

  /* ── M-size ─────────────────────────────────────────────────────────── */
  .net-m {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    height: 100%;
  }

  .net-hero {
    font-size: var(--font-size-hero);
    font-weight: 700;
    color: var(--color-primary-fixed);
    line-height: 1;
    font-family: var(--font-mono);
    display: block;
  }

  /* ── shared ─────────────────────────────────────────────────────────── */
  .net-title {
    font-size: var(--font-size-xl);
    font-weight: 600;
    color: var(--color-on-surface);
    margin-top: var(--space-2);
    margin-bottom: 0;
  }

  .net-chart {
    display: flex;
    align-items: flex-end;
    gap: 3px;
    height: 96px;
    width: 100%;
    flex: 1;
    margin: var(--space-4) 0;
    overflow: hidden;
  }

  .net-bar {
    flex: 1;
    min-width: 0;
    background: linear-gradient(
      to top,
      color-mix(in srgb, var(--color-secondary) 15%, transparent),
      var(--color-secondary)
    );
    border-radius: 4px 4px 0 0;
    transition: height var(--motion-component);
  }

  /* ── L-size layout ──────────────────────────────────────────────────── */
  .net-l {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    height: 100%;
  }

  .net-dual {
    display: flex;
    align-items: baseline;
    gap: var(--space-6);
  }

  .net-dual-stat {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .net-dual-value {
    font-size: 40px;
    font-weight: 700;
    color: var(--color-primary-fixed);
    line-height: 1;
    font-family: var(--font-mono);
  }

  .net-dual-label {
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--color-outline);
  }

  .net-bars-section {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    margin-top: var(--space-4);
    padding-top: var(--space-4);
    border-top: 1px solid color-mix(in srgb, var(--color-outline-variant) 15%, transparent);
  }

  .net-bar-row {
    display: grid;
    grid-template-columns: 64px 1fr auto;
    align-items: center;
    gap: var(--space-3);
  }

  .net-bandwidth-track {
    height: 4px;
    background: color-mix(in srgb, var(--color-primary) 5%, transparent);
    border-radius: 9999px;
    overflow: hidden;
  }

  .net-bandwidth-fill {
    height: 100%;
    background: var(--color-secondary);
    border-radius: 9999px;
    transition: width var(--motion-component);
  }

  .net-bar-value {
    font-size: 11px;
    font-weight: 700;
    font-family: var(--font-mono);
    color: var(--color-on-surface-variant);
    white-space: nowrap;
    min-width: 64px;
    text-align: right;
  }
</style>
