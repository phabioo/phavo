import os from 'node:os';
import si from 'systeminformation';

export interface CpuMetrics {
  usage: number;
  cores: number[];
  loadAvg: [number, number, number];
  speed: number;
  model: string;
}

export async function getCpu(): Promise<CpuMetrics> {
  const [load, cpuInfo, cpuSpeed] = await Promise.all([
    si.currentLoad(),
    si.cpu(),
    si.cpuCurrentSpeed(),
  ]);

  const avg = os.loadavg();

  return {
    usage: load.currentLoad,
    cores: load.cpus.map((c) => c.load),
    loadAvg: [avg[0] ?? 0, avg[1] ?? 0, avg[2] ?? 0],
    speed: cpuSpeed.avg,
    model: `${cpuInfo.manufacturer} ${cpuInfo.brand}`,
  };
}
