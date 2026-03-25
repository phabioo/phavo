import si from 'systeminformation';

export interface TemperatureMetrics {
  cpuTemp: number | null;
  unit: string;
}

export async function getTemperature(): Promise<TemperatureMetrics> {
  const temp = await si.cpuTemperature();

  return {
    cpuTemp: temp.main !== -1 ? temp.main : null,
    unit: '°C',
  };
}
