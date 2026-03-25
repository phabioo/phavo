import si from 'systeminformation';

export interface NetworkMetrics {
  uploadSpeed: number;
  downloadSpeed: number;
  totalSent: number;
  totalReceived: number;
}

export async function getNetwork(): Promise<NetworkMetrics> {
  const stats = await si.networkStats();
  const primary = stats[0];

  return {
    uploadSpeed: primary?.tx_sec ?? 0,
    downloadSpeed: primary?.rx_sec ?? 0,
    totalSent: primary?.tx_bytes ?? 0,
    totalReceived: primary?.rx_bytes ?? 0,
  };
}
