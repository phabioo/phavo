<script lang="ts">
  import { untrack } from 'svelte';
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

  $effect(() => {
    const speed = data?.downloadSpeed;
    if (speed !== undefined) {
      // Use untrack to read speedHistory without subscribing — prevents an
      // infinite reactive loop where mutating the array re-triggers this effect.
      speedHistory = [...untrack(() => speedHistory), speed].slice(-14);
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
    <div class="net-header widget-header">
      <div>
        <span class="widget-category-label">LIVE TRAFFIC</span>
        <h3 class="net-title">Network Throughput</h3>
      </div>
      <Icon name="activity" size={18} class="widget-icon" />
    </div>

    <div class="net-chart">
      {#each sparkBars as bar}
        <div class="net-bar" style="height: {bar}%"></div>
      {/each}
    </div>

    <div class="net-stats">
      <div class="net-stat-group">
        <div class="net-stat">
          <span class="widget-meta-label">DOWN</span>
          <span class="net-stat-value hero-glow">{downSpeed}</span>
        </div>
        <div class="net-stat">
          <span class="widget-meta-label">UP</span>
          <span class="net-stat-value hero-glow">{upSpeed}</span>
        </div>
      </div>
      <span class="net-stable-badge">STABLE</span>
    </div>
  </div>
{:else}
  <div class="net-l">
    <div class="net-header widget-header">
      <div>
        <span class="widget-category-label">LIVE TRAFFIC</span>
        <h3 class="net-title">Network Throughput</h3>
      </div>
      <Icon name="activity" size={18} class="widget-icon" />
    </div>

    <div class="net-chart">
      {#each sparkBars as bar}
        <div class="net-bar" style="height: {bar}%"></div>
      {/each}
    </div>

    <div class="net-stats">
      <div class="net-stat-group">
        <div class="net-stat">
          <span class="widget-meta-label">DOWN</span>
          <span class="net-stat-value hero-glow">{downSpeed}</span>
        </div>
        <div class="net-stat">
          <span class="widget-meta-label">UP</span>
          <span class="net-stat-value hero-glow">{upSpeed}</span>
        </div>
      </div>
      <span class="net-stable-badge">STABLE</span>
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
    color: var(--color-secondary);
    letter-spacing: -0.02em;
    font-family: var(--font-mono);
  }

  .net-m {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    height: 100%;
  }

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
    transition: height 0.5s ease;
  }

  .net-stats {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
  }

  .net-stat-group { display: flex; gap: var(--space-6); }

  .net-stat {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .net-stat-value {
    font-size: var(--font-size-lg);
    font-weight: 700;
    color: var(--color-on-surface);
    display: block;
    font-family: var(--font-mono);
  }

  .net-stable-badge {
    font-size: var(--font-size-xs);
    font-weight: 700;
    font-family: var(--font-mono);
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--color-secondary);
    background: color-mix(in srgb, var(--color-secondary) 10%, transparent);
    padding: var(--space-1) var(--space-2);
    border-radius: var(--radius-sm);
  }

  /* ── L-size layout ──────────────────────────────────────────────────── */
  .net-l {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    height: 100%;
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
    transition: width 0.5s ease;
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
