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

  const conditionLabel = $derived(WMO_LABELS[data.conditionCode] ?? `Code ${data.conditionCode}`);

  function conditionToIcon(code: number): string {
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

  const weatherIcon = $derived(conditionToIcon(data.conditionCode));
  const currentTemp = $derived(Math.round(data.currentTemp));
  const today = $derived(data.forecast[0]);

  function formatDay(dateStr: string): string {
    const d = new Date(dateStr + 'T12:00:00');
    return d.toLocaleDateString('en-US', { weekday: 'short' });
  }
</script>

<div class="weather-widget">
  <div class="weather-bg" aria-hidden="true"></div>

  {#if size === 'S'}
    <div class="weather-s">
      <span class="widget-category-label">WEATHER</span>
      <div class="weather-s-hero">
        <span class="weather-s-temp hero-glow">{currentTemp}<span class="weather-s-unit">°C</span></span>
      </div>
    </div>

  {:else if size === 'M'}
    <div class="widget-header">
      <span class="widget-category-label">WEATHER</span>
      <Icon name={weatherIcon} size={18} class="widget-icon" />
    </div>
    <div class="weather-hero">
      <span class="weather-temp hero-glow">{currentTemp}<span class="weather-unit">°C</span></span>
    </div>
    <div class="weather-meta">
      <span class="weather-condition">{conditionLabel}</span>
      <span class="weather-secondary">
        {#if today}<span>↑{today.tempMax}°</span><span>↓{today.tempMin}°</span>{/if}
        {#if data.feelsLike != null}<span>Feels like {data.feelsLike}°</span>{/if}
      </span>
    </div>

  {:else if size === 'L'}
    <div class="widget-header">
      <span class="widget-category-label">WEATHER</span>
      <Icon name={weatherIcon} size={18} class="widget-icon" />
    </div>
    <div class="weather-hero">
      <span class="weather-temp hero-glow">{currentTemp}<span class="weather-unit">°C</span></span>
    </div>
    <div class="weather-meta">
      <span class="weather-condition">{conditionLabel}</span>
      <span class="weather-secondary">
        {#if today}<span>↑{today.tempMax}°</span><span>↓{today.tempMin}°</span>{/if}
        {#if data.feelsLike != null}<span>Feels like {data.feelsLike}°</span>{/if}
      </span>
    </div>
    <div class="weather-divider"></div>
    <div class="weather-stat-grid">
      <div class="weather-stat">
        <span class="weather-stat-label">FEELS LIKE</span>
        <span class="weather-stat-value">{data.feelsLike != null ? data.feelsLike + '°' : '—'}</span>
      </div>
      <div class="weather-stat">
        <span class="weather-stat-label">HUMIDITY</span>
        <span class="weather-stat-value">{data.humidity}%</span>
      </div>
      <div class="weather-stat">
        <span class="weather-stat-label">WIND</span>
        <span class="weather-stat-value">{data.windSpeed} <span class="weather-stat-unit">km/h</span></span>
      </div>
      <div class="weather-stat">
        <span class="weather-stat-label">UV INDEX</span>
        <span class="weather-stat-value">{data.uvIndex != null ? data.uvIndex : '—'}</span>
      </div>
    </div>
    <div class="weather-divider"></div>
    <div class="weather-forecast">
      {#each data.forecast.slice(1, 4) as day (day.date)}
        <div class="weather-forecast-row">
          <span class="weather-forecast-day">{formatDay(day.date)}</span>
          <Icon name={conditionToIcon(day.conditionCode)} size={14} class="weather-forecast-icon" />
          <span class="weather-forecast-temp">↑{day.tempMax}°</span>
          <span class="weather-forecast-temp-low">↓{day.tempMin}°</span>
        </div>
      {/each}
    </div>
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

  /* Gradient atmosphere overlay */
  .weather-bg {
    position: absolute;
    inset: 0;
    opacity: 0.08;
    background: linear-gradient(135deg, var(--color-primary-fixed) 0%, var(--color-secondary) 100%);
    pointer-events: none;
    border-radius: inherit;
  }

  /* S-size */
  .weather-s {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    gap: var(--space-1);
    position: relative;
  }

  .weather-s-hero {
    display: flex;
    align-items: baseline;
  }

  .weather-s-temp {
    font-size: var(--font-size-s-hero);
    font-weight: 700;
    color: var(--color-primary-fixed);
    line-height: 1;
  }

  .weather-s-unit {
    font-size: 14px;
    font-weight: 300;
    color: var(--color-on-surface-variant);
  }

  /* M/L hero */
  .weather-hero {
    display: flex;
    align-items: baseline;
    gap: var(--space-1);
    margin-bottom: var(--space-2);
    position: relative;
  }

  .weather-temp {
    font-size: var(--font-size-hero);
    font-weight: 700;
    color: var(--color-primary-fixed);
    line-height: 1;
  }

  .weather-unit {
    font-size: var(--font-size-2xl);
    font-weight: 300;
    color: var(--color-on-surface-variant);
  }

  /* M/L meta */
  .weather-meta {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    margin-bottom: var(--space-3);
    position: relative;
  }

  .weather-condition {
    font-size: var(--font-size-sm);
    color: var(--color-on-surface-variant);
  }

  .weather-secondary {
    display: flex;
    gap: var(--space-3);
    font-size: var(--font-size-xs);
    color: var(--color-outline);
  }

  /* L-only */
  .weather-divider {
    height: 1px;
    background: color-mix(in srgb, var(--color-outline-variant) 15%, transparent);
    margin: var(--space-2) 0;
    position: relative;
  }

  .weather-stat-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-2);
    margin-bottom: var(--space-2);
    position: relative;
  }

  .weather-stat {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .weather-stat-label {
    font-size: var(--font-size-xs);
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--color-outline);
  }

  .weather-stat-value {
    font-size: var(--font-size-sm);
    color: var(--color-on-surface);
  }

  .weather-stat-unit {
    font-size: var(--font-size-xs);
    color: var(--color-outline);
  }

  .weather-forecast {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    position: relative;
  }

  .weather-forecast-row {
    display: flex;
    align-items: center;
    gap: var(--space-3);
  }

  .weather-forecast-day {
    font-size: var(--font-size-xs);
    font-weight: 700;
    color: var(--color-on-surface-variant);
    width: 28px;
  }

  :global(.weather-forecast-icon) {
    color: var(--color-outline);
  }

  .weather-forecast-temp {
    font-size: var(--font-size-xs);
    color: var(--color-on-surface-variant);
  }

  .weather-forecast-temp-low {
    font-size: var(--font-size-xs);
    color: var(--color-outline);
  }
</style>
