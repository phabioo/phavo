<script lang="ts">
  import type { TemperatureMetrics } from '@phavo/types';

  interface Props {
    data: TemperatureMetrics;
  }

  let { data }: Props = $props();

  const hasTemp = $derived(data.cpuTemp !== null);
  const temp = $derived(data.cpuTemp ?? 0);

  // Color thresholds: cool < 60, warm < 80, hot >= 80
  const tempState = $derived(
    !hasTemp ? 'unknown' : temp >= 80 ? 'hot' : temp >= 60 ? 'warm' : 'cool',
  );

  // Gauge: treat 100°C as max
  const gaugePct = $derived(hasTemp ? Math.min(100, (temp / 100) * 100) : 0);

  // Gauge arc SVG params
  const r = 44;
  const cx = 60;
  const cy = 60;
  const circumference = Math.PI * r; // half-circle = π*r
  const dashOffset = $derived(circumference * (1 - gaugePct / 100));
</script>

<div class="temp-widget">
  {#if hasTemp}
    <div class="gauge-wrap">
      <svg class="gauge-svg" viewBox="0 0 120 70" aria-hidden="true">
        <!-- Track -->
        <path
          d="M {cx - r} {cy} A {r} {r} 0 0 1 {cx + r} {cy}"
          fill="none"
          stroke-width="8"
          class="gauge-track"
        />
        <!-- Fill -->
        <path
          d="M {cx - r} {cy} A {r} {r} 0 0 1 {cx + r} {cy}"
          fill="none"
          stroke-width="8"
          class="gauge-fill gauge-{tempState}"
          stroke-dasharray="{circumference}"
          stroke-dashoffset="{dashOffset}"
          stroke-linecap="round"
        />
      </svg>

      <div class="gauge-label">
        <span class="temp-value mono">{temp.toFixed(1)}</span>
        <span class="temp-unit">{data.unit}</span>
      </div>
    </div>

    <div class="temp-state-badge state-{tempState}">
      {tempState === 'cool' ? 'Normal' : tempState === 'warm' ? 'Warm' : 'Hot'}
    </div>

    <div class="thresholds">
      <span class="threshold cool-mark">0°</span>
      <span class="threshold warm-mark">60°</span>
      <span class="threshold hot-mark">80°</span>
      <span class="threshold max-mark">100°</span>
    </div>
  {:else}
    <div class="no-sensor">
      <span class="no-sensor-icon">—</span>
      <span class="no-sensor-text">Temperature sensor unavailable</span>
    </div>
  {/if}
</div>

<style>
  .temp-widget {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-3);
  }

  .gauge-wrap {
    position: relative;
    width: 120px;
    height: 70px;
  }

  .gauge-svg {
    width: 100%;
    height: 100%;
  }

  .gauge-track {
    stroke: var(--color-bg-hover);
  }

  .gauge-cool { stroke: var(--color-accent); }
  .gauge-warm { stroke: var(--color-warning); }
  .gauge-hot  { stroke: var(--color-danger); }

  .gauge-fill {
    transition: stroke-dashoffset 0.6s ease, stroke 0.4s ease;
  }

  .gauge-label {
    position: absolute;
    bottom: 0;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    align-items: baseline;
    gap: 2px;
  }

  .temp-value {
    font-size: 26px;
    font-weight: 700;
    color: var(--color-text-primary);
    line-height: 1;
  }

  .temp-unit {
    font-size: 13px;
    color: var(--color-text-muted);
  }

  .temp-state-badge {
    font-size: 11px;
    font-weight: 600;
    padding: 2px 10px;
    border-radius: var(--radius-sm);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .state-cool {
    background: var(--color-accent-subtle);
    color: var(--color-accent-text);
  }

  .state-warm {
    background: var(--color-warning-subtle);
    color: var(--color-warning);
  }

  .state-hot {
    background: var(--color-danger-subtle);
    color: var(--color-danger);
  }

  .thresholds {
    display: flex;
    justify-content: space-between;
    width: 100%;
    padding: 0 var(--space-1);
  }

  .threshold {
    font-size: 10px;
    color: var(--color-text-muted);
  }

  .no-sensor {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-4) 0;
  }

  .no-sensor-icon {
    font-size: 32px;
    color: var(--color-text-muted);
    line-height: 1;
  }

  .no-sensor-text {
    font-size: 12px;
    color: var(--color-text-muted);
    text-align: center;
  }
</style>
