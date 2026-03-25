<script lang="ts">
  import type { WeatherMetrics } from '@phavo/agent';

  interface Props {
    data: WeatherMetrics;
  }

  let { data }: Props = $props();

  // WMO Weather Interpretation Codes (WW) — https://open-meteo.com/en/docs
  const WMO_LABELS: Record<number, string> = {
    0: 'Clear Sky',
    1: 'Mainly Clear',
    2: 'Partly Cloudy',
    3: 'Overcast',
    45: 'Fog',
    48: 'Icy Fog',
    51: 'Light Drizzle',
    53: 'Drizzle',
    55: 'Heavy Drizzle',
    56: 'Freezing Drizzle',
    57: 'Heavy Freezing Drizzle',
    61: 'Light Rain',
    63: 'Rain',
    65: 'Heavy Rain',
    66: 'Freezing Rain',
    67: 'Heavy Freezing Rain',
    71: 'Light Snow',
    73: 'Snow',
    75: 'Heavy Snow',
    77: 'Snow Grains',
    80: 'Rain Showers',
    81: 'Moderate Rain Showers',
    82: 'Violent Rain Showers',
    85: 'Snow Showers',
    86: 'Heavy Snow Showers',
    95: 'Thunderstorm',
    96: 'Thunderstorm w/ Hail',
    99: 'Thunderstorm w/ Heavy Hail',
  };

  const condition = $derived(WMO_LABELS[data.conditionCode] ?? `Code ${data.conditionCode}`);

  function formatForecastDate(dateStr: string): string {
    // dateStr is YYYY-MM-DD from the API
    const d = new Date(dateStr + 'T12:00:00');
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  }
</script>

<div class="weather-widget">
  <!-- Current temperature -->
  <div class="current">
    <span class="temp mono"
      >{Math.round(data.currentTemp)}<span class="unit">°C</span></span
    >
    <span class="condition">{condition}</span>
  </div>

  <!-- Wind + Humidity row -->
  <div class="detail-row">
    <div class="detail-item">
      <span class="detail-label">Wind</span>
      <span class="detail-value mono">{Math.round(data.windSpeed)} km/h</span>
    </div>
    <div class="detail-divider"></div>
    <div class="detail-item">
      <span class="detail-label">Humidity</span>
      <span class="detail-value mono">{data.humidity}%</span>
    </div>
  </div>

  <!-- 5-day forecast strip -->
  <div class="forecast">
    {#each data.forecast as day (day.date)}
      <div class="forecast-day">
        <span class="forecast-date">{formatForecastDate(day.date)}</span>
        <span class="forecast-label">{WMO_LABELS[day.conditionCode] ?? '—'}</span>
        <span class="forecast-temps mono">
          <span class="temp-min">{Math.round(day.tempMin)}°</span>
          <span class="temp-sep">/</span>
          <span class="temp-max">{Math.round(day.tempMax)}°</span>
        </span>
      </div>
    {/each}
  </div>
</div>

<style>
  .weather-widget {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }

  /* --- Current --- */
  .current {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-1);
  }

  .temp {
    font-size: 3rem;
    font-weight: 700;
    line-height: 1;
    color: var(--color-text);
  }

  .unit {
    font-size: 1.5rem;
    font-weight: 400;
    color: var(--color-text-muted);
    margin-left: 2px;
  }

  .condition {
    font-size: 0.875rem;
    color: var(--color-text-muted);
  }

  /* --- Detail row --- */
  .detail-row {
    display: flex;
    align-items: center;
    gap: var(--space-3);
  }

  .detail-item {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .detail-label {
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--color-text-muted);
  }

  .detail-value {
    font-size: 0.925rem;
    color: var(--color-text);
  }

  .detail-divider {
    width: 1px;
    height: 28px;
    background: var(--color-border);
    flex-shrink: 0;
  }

  /* --- Forecast --- */
  .forecast {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    padding-top: var(--space-2);
    border-top: 1px solid var(--color-border);
  }

  .forecast-day {
    display: grid;
    grid-template-columns: 1fr 1fr auto;
    align-items: center;
    gap: var(--space-2);
  }

  .forecast-date {
    font-size: 0.8rem;
    color: var(--color-text-muted);
  }

  .forecast-label {
    font-size: 0.8rem;
    color: var(--color-text);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .forecast-temps {
    font-size: 0.85rem;
    display: flex;
    gap: 4px;
    align-items: center;
  }

  .temp-min {
    color: var(--color-text-muted);
  }

  .temp-sep {
    color: var(--color-border);
  }

  .temp-max {
    color: var(--color-text);
    font-weight: 600;
  }
</style>
