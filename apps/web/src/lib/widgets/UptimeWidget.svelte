<script lang="ts">
  import type { UptimeMetrics } from '@phavo/types';

  interface Props {
    data: UptimeMetrics;
  }

  let { data }: Props = $props();

  const days    = $derived(Math.floor(data.seconds / 86400));
  const hours   = $derived(Math.floor((data.seconds % 86400) / 3600));
  const minutes = $derived(Math.floor((data.seconds % 3600) / 60));
  const seconds = $derived(data.seconds % 60);

  // Progress toward a "good uptime" milestone: days as fraction of 30
  const uptimePct = $derived(Math.min(100, (days / 30) * 100));
</script>

<div class="uptime-widget">
  <div class="time-blocks">
    {#if days > 0}
      <div class="time-block">
        <span class="time-value mono">{days}</span>
        <span class="time-unit">day{days !== 1 ? 's' : ''}</span>
      </div>
    {/if}
    <div class="time-block">
      <span class="time-value mono">{String(hours).padStart(2, '0')}</span>
      <span class="time-unit">hrs</span>
    </div>
    <div class="time-sep">:</div>
    <div class="time-block">
      <span class="time-value mono">{String(minutes).padStart(2, '0')}</span>
      <span class="time-unit">min</span>
    </div>
    <div class="time-sep">:</div>
    <div class="time-block">
      <span class="time-value mono">{String(seconds).padStart(2, '0')}</span>
      <span class="time-unit">sec</span>
    </div>
  </div>

  <div class="uptime-bar-section">
    <div class="bar-header">
      <span class="bar-label">Uptime toward 30-day milestone</span>
      <span class="bar-pct mono">{days}d</span>
    </div>
    <div class="uptime-track">
      <div class="uptime-fill" style:width="{uptimePct}%"></div>
    </div>
  </div>

  <div class="formatted-row">
    <span class="formatted-label">Running since</span>
    <span class="formatted-value">{data.formatted}</span>
  </div>
</div>

<style>
  .uptime-widget {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }

  .time-blocks {
    display: flex;
    align-items: flex-end;
    gap: var(--space-1);
  }

  .time-block {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
  }

  .time-value {
    font-size: 28px;
    font-weight: 700;
    color: var(--color-text-primary);
    line-height: 1;
  }

  .time-unit {
    font-size: 10px;
    color: var(--color-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.4px;
  }

  .time-sep {
    font-size: 24px;
    font-weight: 700;
    color: var(--color-text-muted);
    padding-bottom: 14px;
    line-height: 1;
    align-self: flex-end;
  }

  .uptime-bar-section {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .bar-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .bar-label {
    font-size: 11px;
    color: var(--color-text-muted);
  }

  .bar-pct {
    font-size: 11px;
    color: var(--color-text-secondary);
  }

  .uptime-track {
    height: 6px;
    background: var(--color-bg-hover);
    border-radius: 3px;
    overflow: hidden;
  }

  .uptime-fill {
    height: 100%;
    background: var(--color-accent);
    border-radius: 3px;
    transition: width 0.5s ease;
    min-width: 2px;
  }

  .formatted-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-top: var(--space-1);
    border-top: 1px solid var(--color-border-subtle);
  }

  .formatted-label {
    font-size: 11px;
    color: var(--color-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.4px;
  }

  .formatted-value {
    font-size: 12px;
    color: var(--color-text-secondary);
  }
</style>
