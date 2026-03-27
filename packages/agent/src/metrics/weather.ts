import type { WeatherForecastDay, WeatherMetrics } from '@phavo/types';

export type { WeatherForecastDay, WeatherMetrics } from '@phavo/types';

export async function getWeather(latitude: number, longitude: number): Promise<WeatherMetrics> {
  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.searchParams.set('latitude', String(latitude));
  url.searchParams.set('longitude', String(longitude));
  url.searchParams.set(
    'current',
    'temperature_2m,weather_code,wind_speed_10m,relative_humidity_2m',
  );
  url.searchParams.set('daily', 'temperature_2m_min,temperature_2m_max,weather_code');
  url.searchParams.set('forecast_days', '5');
  url.searchParams.set('timezone', 'auto');

  const response = await fetch(url.toString());

  if (!response.ok) {
    throw new Error(`Open-Meteo API error: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as {
    current: {
      temperature_2m: number;
      weather_code: number;
      wind_speed_10m: number;
      relative_humidity_2m: number;
    };
    daily: {
      time: string[];
      temperature_2m_min: number[];
      temperature_2m_max: number[];
      weather_code: number[];
    };
  };

  const forecast: WeatherForecastDay[] = data.daily.time.map((date, i) => ({
    date,
    tempMin: data.daily.temperature_2m_min[i] ?? 0,
    tempMax: data.daily.temperature_2m_max[i] ?? 0,
    conditionCode: data.daily.weather_code[i] ?? 0,
  }));

  return {
    currentTemp: data.current.temperature_2m,
    conditionCode: data.current.weather_code,
    windSpeed: data.current.wind_speed_10m,
    humidity: data.current.relative_humidity_2m,
    forecast,
  };
}
