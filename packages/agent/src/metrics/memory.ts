import type { MemoryMetrics } from '@phavo/types';
import si from 'systeminformation';

export type { MemoryMetrics } from '@phavo/types';

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
