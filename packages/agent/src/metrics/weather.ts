import type { WeatherForecastDay, WeatherMetrics } from '@phavo/types';
import { z } from 'zod';

export type { WeatherForecastDay, WeatherMetrics } from '@phavo/types';

const OpenMeteoResponseSchema = z.object({
  current: z.object({
    temperature_2m: z.number(),
    weather_code: z.number(),
    wind_speed_10m: z.number(),
    relative_humidity_2m: z.number(),
    apparent_temperature: z.number().nullable().optional(),
    uv_index: z.number().nullable().optional(),
  }),
  daily: z.object({
    time: z.array(z.string()),
    temperature_2m_min: z.array(z.number()),
    temperature_2m_max: z.array(z.number()),
    weather_code: z.array(z.number()),
  }),
});

export async function getWeather(latitude: number, longitude: number): Promise<WeatherMetrics> {
  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.searchParams.set('latitude', String(latitude));
  url.searchParams.set('longitude', String(longitude));
  url.searchParams.set(
    'current',
    'temperature_2m,weather_code,wind_speed_10m,relative_humidity_2m,apparent_temperature,uv_index',
  );
  url.searchParams.set('daily', 'temperature_2m_min,temperature_2m_max,weather_code');
  url.searchParams.set('forecast_days', '5');
  url.searchParams.set('timezone', 'auto');

  const response = await fetch(url.toString());

  if (!response.ok) {
    throw new Error(`Open-Meteo API error: ${response.status} ${response.statusText}`);
  }

  const raw: unknown = await response.json();
  const parsed = OpenMeteoResponseSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(`Invalid Open-Meteo response: ${parsed.error.issues[0]?.message ?? 'unknown'}`);
  }

  const data = parsed.data;

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
    ...(data.current.apparent_temperature != null && {
      feelsLike: data.current.apparent_temperature,
    }),
    ...(data.current.uv_index != null && { uvIndex: data.current.uv_index }),
    forecast,
  };
}
