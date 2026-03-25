import si from 'systeminformation';

export interface MemoryMetrics {
  used: number;
  total: number;
  free: number;
  swap: {
    used: number;
    total: number;
  };
}

export async function getMemory(): Promise<MemoryMetrics> {
  const mem = await si.mem();

  return {
    used: mem.used,
    total: mem.total,
    free: mem.free,
    swap: {
      used: mem.swapused,
      total: mem.swaptotal,
    },
  };
}
