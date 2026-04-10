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
  const totalSeconds = $derived(data.seconds ?? 0);
  const days = $derived(Math.floor(totalSeconds / 86400));
  const hours = $derived(Math.floor((totalSeconds % 86400) / 3600));
  const mins = $derived(Math.floor((totalSeconds % 3600) / 60));
  const secs = $derived(totalSeconds % 60);
</script>

<div class="uptime-widget">
  {#if size === 'S'}
    <div class="s-row">
      <Icon name="clock" size={16} class="text-accent" />
      <span class="metric-value mono hero-glow">{formatted}</span>
    </div>
  {:else if size === 'M'}
    <div class="widget-header">
      <span class="widget-category-label">SYSTEM UPTIME</span>
      <Icon name="clock" size={18} class="widget-icon" />
    </div>
    <div class="primary-metric">
      <span class="metric-value mono">{formatted}</span>
    </div>
    <span class="human-label">System uptime</span>
  {:else}
    <div class="widget-header">
      <span class="widget-category-label">SYSTEM UPTIME</span>
      <Icon name="clock" size={18} class="widget-icon" />
    </div>
    <div class="uptime-hero-row">
      <span class="uptime-hero hero-glow">{days}<span class="uptime-unit">d</span></span>
      <span class="uptime-hero hero-glow">{hours}<span class="uptime-unit">h</span></span>
      <span class="uptime-hero hero-glow">{mins}<span class="uptime-unit">m</span></span>
    </div>
    <span class="widget-meta-label">SYSTEM UPTIME</span>

    <!-- L-only: labeled breakdown -->
    <div class="uptime-breakdown">
      <div class="uptime-unit-card">
        <span class="uptime-unit-value">{days}</span>
        <span class="widget-meta-label">DAYS</span>
      </div>
      <div class="uptime-unit-card">
        <span class="uptime-unit-value">{hours}</span>
        <span class="widget-meta-label">HOURS</span>
      </div>
      <div class="uptime-unit-card">
        <span class="uptime-unit-value">{mins}</span>
        <span class="widget-meta-label">MINUTES</span>
      </div>
      <div class="uptime-unit-card">
        <span class="uptime-unit-value">{secs}</span>
        <span class="widget-meta-label">SECONDS</span>
      </div>
    </div>
  {/if}
</div>

<style>
  .uptime-widget {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    height: 100%;
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
    font-size: var(--font-size-hero);
    font-weight: 700;
    color: var(--color-primary-fixed);
    letter-spacing: -0.03em;
    line-height: 1;
    filter: drop-shadow(0 0 20px color-mix(in srgb, var(--color-primary-fixed) 30%, transparent));
  }

  .s-row .metric-value {
    font-size: 20px;
  }

  .human-label {
    font-size: 12px;
    color: var(--color-on-surface-variant);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  /* ── L-size layout ──────────────────────────────────────────────────── */
  .uptime-hero-row {
    display: flex;
    gap: var(--space-3);
    align-items: baseline;
    margin: var(--space-4) 0 var(--space-2);
  }

  .uptime-hero {
    font-size: 48px;
    font-weight: 700;
    color: var(--color-primary-fixed);
    letter-spacing: -0.03em;
    line-height: 1;
  }

  .uptime-unit {
    font-size: 20px;
    font-weight: 300;
    color: var(--color-on-surface-variant);
  }

  .uptime-breakdown {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: var(--space-3);
    margin-top: var(--space-4);
    padding-top: var(--space-4);
    border-top: 1px solid color-mix(in srgb, var(--color-outline-variant) 15%, transparent);
  }

  .uptime-unit-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-1);
    padding: var(--space-3);
    background: var(--color-surface-high);
    border-radius: var(--radius-lg);
  }

  .uptime-unit-value {
    font-size: 24px;
    font-weight: 700;
    color: var(--color-primary-fixed);
    font-family: var(--font-mono);
    letter-spacing: -0.02em;
  }
</style>