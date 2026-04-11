<script lang="ts">
  import type { TemperatureMetrics, WidgetSize } from '@phavo/types';
  import { Icon } from '@phavo/ui';

  interface Props {
    data: TemperatureMetrics;
    size?: WidgetSize;
  }

  let { data, size = 'M' }: Props = $props();

  const hasTemp = $derived(data.cpuTemp !== null);
  const temp = $derived(data.cpuTemp ?? 0);
  const tempState = $derived(
    !hasTemp ? 'unknown' : temp >= 80 ? 'hot' : temp >= 60 ? 'warm' : 'cool',
  );
  const badgeLabel = $derived(
    tempState === 'hot' ? 'Hot' : tempState === 'warm' ? 'Warm' : 'Cool',
  );

  const sensors = $derived(
    hasTemp ? [{ label: 'CPU', temp: Math.round(temp) }] : [],
  );
</script>

<div class="temp-widget">
  {#if !hasTemp}
    <div class="no-sensor">
      <Icon name="thermometer" size={20} />
      <span class="no-sensor-text">Not available</span>
    </div>
  {:else if size === 'S'}
    <div class="temp-s">
      <span class="widget-category-label">THERMAL</span>
      <span class="temp-s-value hero-glow">{temp.toFixed(0)}<span class="temp-s-unit">°C</span></span>
    </div>
  {:else if size === 'M'}
    <div class="widget-header">
      <span class="widget-category-label">THERMAL STATUS</span>
      <Icon name="thermometer" size={18} class="widget-icon" />
    </div>
    <div class="primary-metric">
      <span class="metric-value mono">{temp.toFixed(1)}</span>
      <span class="metric-unit">°{data.unit}</span>
    </div>

    <span class="temp-status temp-status-{tempState}">&bull; {badgeLabel.toUpperCase()}</span>
  {:else}
    <div class="widget-header">
      <span class="widget-category-label">TEMPERATURE</span>
      <Icon name="thermometer" size={18} class="widget-icon" />
    </div>
    <div class="temp-hero-row">
      <span class="metric-value mono">{temp.toFixed(1)}</span>
      <span class="metric-unit">°{data.unit}</span>
    </div>

    <span class="temp-status temp-status-{tempState}">&bull; {badgeLabel.toUpperCase()}</span>

    <!-- L-only: per-sensor list -->
    {#if sensors.length > 1}
    <div class="temp-sensors">
      {#each sensors as sensor}
      <div class="temp-sensor-row">
        <span class="temp-sensor-name">{sensor.label}</span>
        <div class="temp-sensor-bar-track">
          <div
            class="temp-sensor-bar-fill"
            style="width: {Math.min(100, (sensor.temp / 100) * 100)}%;
                   background: {sensor.temp > 80
                     ? 'var(--color-error)'
                     : sensor.temp > 60
                     ? 'var(--color-primary-fixed)'
                     : 'var(--color-secondary)'};"
          ></div>
        </div>
        <span class="temp-sensor-value">{sensor.temp}°</span>
      </div>
      {/each}
    </div>
    {/if}
  {/if}
</div>

<style>
  .temp-widget {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    height: 100%;
  }

  .temp-s {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    gap: var(--space-1);
  }

  .temp-s-value {
    font-size: var(--font-size-s-hero);
    font-weight: 700;
    color: var(--color-primary-fixed);
    line-height: 1;
  }

  .temp-s-unit {
    font-size: 16px;
    font-weight: 300;
    color: var(--color-on-surface-variant);
  }

  .primary-metric {
    display: flex;
    align-items: baseline;
    gap: 2px;
  }

  .metric-value {
    font-size: var(--font-size-hero);
    font-weight: 700;
    color: var(--color-primary-fixed);
    letter-spacing: -0.03em;
    line-height: 1;
    filter: drop-shadow(0 0 20px color-mix(in srgb, var(--color-primary-fixed) 30%, transparent));
  }

  .metric-unit {
    font-size: 30px;
    font-weight: 300;
    color: var(--color-on-surface-variant);
  }

  .no-sensor {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-4) 0;
    color: var(--color-outline);
  }

  .no-sensor-text {
    font-size: 13px;
  }

  /* ── L-size layout ──────────────────────────────────────────────────── */
  .temp-hero-row {
    display: flex;
    align-items: baseline;
    gap: 2px;
  }

  .temp-sensors {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    margin-top: var(--space-4);
    padding-top: var(--space-4);
    border-top: 1px solid color-mix(in srgb, var(--color-outline-variant) 15%, transparent);
  }

  .temp-sensor-row {
    display: grid;
    grid-template-columns: 1fr auto auto;
    align-items: center;
    gap: var(--space-3);
  }

  .temp-sensor-name {
    font-size: 11px;
    font-family: var(--font-mono);
    color: var(--color-on-surface-variant);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .temp-sensor-bar-track {
    width: 80px;
    height: 3px;
    background: color-mix(in srgb, var(--color-primary) 5%, transparent);
    border-radius: 9999px;
    overflow: hidden;
  }

  .temp-sensor-bar-fill {
    height: 100%;
    border-radius: 9999px;
    transition: width var(--motion-component);
  }

  .temp-sensor-value {
    font-size: 11px;
    font-weight: 700;
    font-family: var(--font-mono);
    color: var(--color-on-surface-variant);
    min-width: 32px;
    text-align: right;
  }

  .temp-status {
    font-size: var(--font-size-sm);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .temp-status-cool {
    color: var(--color-secondary);
  }

  .temp-status-warm {
    color: var(--color-primary-fixed);
  }

  .temp-status-hot {
    color: var(--color-error);
  }
</style>