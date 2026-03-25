import si from 'systeminformation';

export interface DiskMetrics {
  fs: string;
  mount: string;
  used: number;
  total: number;
  usePercent: number;
  readSpeed: number;
  writeSpeed: number;
}

export async function getDisk(): Promise<DiskMetrics[]> {
  const [fsSize, fsStats] = await Promise.all([si.fsSize(), si.disksIO()]);

  return fsSize.map((disk) => ({
    fs: disk.fs,
    mount: disk.mount,
    used: disk.used,
    total: disk.size,
    usePercent: disk.use,
    readSpeed: fsStats.rIO_sec ?? 0,
    writeSpeed: fsStats.wIO_sec ?? 0,
  }));
}
