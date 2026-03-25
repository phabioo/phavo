import si from 'systeminformation';

export interface UptimeMetrics {
  seconds: number;
  formatted: string;
}

function formatUptime(totalSeconds: number): string {
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);

  const parts: string[] = [];
  if (days > 0) parts.push(`${days} day${days !== 1 ? 's' : ''}`);
  if (hours > 0) parts.push(`${hours} hour${hours !== 1 ? 's' : ''}`);
  if (minutes > 0) parts.push(`${minutes} minute${minutes !== 1 ? 's' : ''}`);

  return parts.join(', ') || '< 1 minute';
}

export async function getUptime(): Promise<UptimeMetrics> {
  const time = await si.time();
  const seconds = time.uptime;

  return {
    seconds,
    formatted: formatUptime(seconds),
  };
}
