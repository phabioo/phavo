import type { TemperatureMetrics } from '@phavo/types';
import si from 'systeminformation';

export type { TemperatureMetrics } from '@phavo/types';

export async function getTemperature(): Promise<TemperatureMetrics> {
  const temp = await si.cpuTemperature();

  return {
    cpuTemp: temp.main !== -1 ? temp.main : null,
    unit: '°C',
  };
}
