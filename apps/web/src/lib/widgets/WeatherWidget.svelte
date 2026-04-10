<script lang="ts">
  import type { WeatherMetrics, WidgetSize } from '@phavo/types';
  import { Icon } from '@phavo/ui';

  interface Props {
    data: WeatherMetrics;
    size?: WidgetSize;
  }

  let { data, size = 'M' }: Props = $props();

  const WMO_LABELS: Record<number, string> = {
    0: 'Clear Sky', 1: 'Mainly Clear', 2: 'Partly Cloudy', 3: 'Overcast',
    45: 'Fog', 48: 'Icy Fog',
    51: 'Light Drizzle', 53: 'Drizzle', 55: 'Heavy Drizzle',
    56: 'Freezing Drizzle', 57: 'Heavy Freezing Drizzle',
    61: 'Light Rain', 63: 'Rain', 65: 'Heavy Rain',
    66: 'Freezing Rain', 67: 'Heavy Freezing Rain',
    71: 'Light Snow', 73: 'Snow', 75: 'Heavy Snow', 77: 'Snow Grains',
    80: 'Rain Showers', 81: 'Moderate Rain Showers', 82: 'Violent Rain Showers',
    85: 'Snow Showers', 86: 'Heavy Snow Showers',
    95: 'Thunderstorm', 96: 'Thunderstorm w/ Hail', 99: 'Thunderstorm w/ Heavy Hail',
  };

  const condition = $derived(WMO_LABELS[data.conditionCode] ?? `Code ${data.conditionCode}`);

  function wmoIcon(code: number): string {
    if (code === 0 || code === 1) return 'sun';
    if (code === 2) return 'cloud-sun';
    if (code === 3 || code === 45 || code === 48) return 'cloud';
    if (code >= 51 && code <= 67) return 'cloud-rain';
    if (code >= 71 && code <= 77) return 'cloud-snow';
    if (code >= 80 && code <= 82) return 'cloud-drizzle';
    if (code >= 85 && code <= 86) return 'cloud-snow';
    if (code >= 95) return 'cloud-lightning';
    return 'cloud';
  }

  const weatherIcon = $derived(wmoIcon(data.conditionCode));

  function formatForecastDate(dateStr: string): string {
    const d = new Date(dateStr + 'T12:00:00');
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  }
</script>

<div class="weather-widget">
  <div class="weather-bg" aria-hidden="true"></div>

  {#if size === 'S'}
    <div class="s-row">
      <Icon name={weatherIcon} size={16} class="text-accent" />
      <span class="metric-value mono hero-glow">{Math.round(data.currentTemp)}°C</span>
    </div>
  {:else}
    <div class="current-row">
      <div class="current-temp">
        <span class="temp mono">{Math.round(data.currentTemp)}<span class="unit">°C</span></span>
        <span class="condition">{condition}</span>
      </div>
      <Icon name={weatherIcon} size={32} class="weather-icon" />
    </div>

    {#if data.city}
      <span class="city-label">{data.city}</span>
    {/if}

    {#if (size === 'L' || size === 'XL') && data.forecast.length > 0}
      <div class="forecast">
        {#each data.forecast.slice(0, 5) as day (day.date)}
          <div class="forecast-day">
            <span class="forecast-date">{formatForecastDate(day.date)}</span>
            <Icon name={wmoIcon(day.conditionCode)} size={14} />
            <span class="forecast-temps mono">
              {Math.round(day.tempMin)}° / {Math.round(day.tempMax)}°
            </span>
          </div>
        {/each}
      </div>
    {/if}
  {/if}
</div>

<style>
  .weather-widget {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    height: 100%;
    position: relative;
  }

  .weather-bg {
    position: absolute;
    inset: 0;
    opacity: 0.08;
    background: linear-gradient(135deg, var(--color-primary-fixed) 0%, var(--color-secondary) 100%);
    pointer-events: none;
    border-radius: inherit;
  }

  .s-row {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    position: relative;
  }

  .current-row {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    position: relative;
  }

  .current-temp {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .temp {
    font-size: 2.5rem;
    font-weight: 700;
    line-height: 1;
    color: var(--color-on-surface);
  }

  .unit {
    font-size: 1.25rem;
    font-weight: 400;
    color: var(--color-outline);
    margin-left: 2px;
  }

  .metric-value {
    font-size: 20px;
    font-weight: 700;
    color: var(--color-on-surface);
    line-height: 1;
  }

  .condition {
    font-size: 0.875rem;
    color: var(--color-on-surface-variant);
  }

  .city-label {
    font-size: 11px;
    color: var(--color-outline);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    position: relative;
  }

  :global(.weather-icon) {
    color: var(--color-primary-fixed);
  }

  .forecast {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    padding-top: var(--space-2);
    border-top: 1px solid color-mix(in srgb, var(--color-outline-variant) 15%, transparent);
    position: relative;
  }

  .forecast-day {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  .forecast-date {
    font-size: 11px;
    color: var(--color-on-surface-variant);
    min-width: 100px;
  }

  .forecast-temps {
    font-size: 12px;
    color: var(--color-on-surface-variant);
    margin-left: auto;
  }
</style>