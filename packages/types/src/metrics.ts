export interface CpuMetrics {
  usage: number;
  cores: number[];
  loadAvg: [number, number, number];
  speed: number;
  model: string;
}

export interface DiskMetrics {
  fs: string;
  mount: string;
  used: number;
  total: number;
  usePercent: number;
  readSpeed: number;
  writeSpeed: number;
}

export interface MemoryMetrics {
  used: number;
  total: number;
  free: number;
  swap: {
    used: number;
    total: number;
  };
}

export interface NetworkMetrics {
  uploadSpeed: number;
  downloadSpeed: number;
  totalSent: number;
  totalReceived: number;
}

export interface PiholeMetrics {
  totalQueries: number;
  blockedQueries: number;
  percentBlocked: number;
  domainsOnBlocklist: number;
  status: 'enabled' | 'disabled';
}

export interface RssFeedConfig {
  url: string;
  auth?: {
    type: 'basic' | 'bearer';
    value: string;
  };
}

export interface RssFeedItem {
  title: string;
  link: string;
  source: string;
  publishedAt: string;
}

export interface RssFeedError {
  feedUrl: string;
  error: string;
}

export interface RssFeedResult {
  items: RssFeedItem[];
  errors: RssFeedError[];
}

export interface TemperatureMetrics {
  cpuTemp: number | null;
  unit: string;
}

export interface UptimeMetrics {
  seconds: number;
  formatted: string;
}

export interface WeatherForecastDay {
  date: string;
  tempMin: number;
  tempMax: number;
  conditionCode: number;
}

export interface WeatherMetrics {
  currentTemp: number;
  conditionCode: number;
  windSpeed: number;
  humidity: number;
  feelsLike?: number;
  uvIndex?: number;
  forecast: WeatherForecastDay[];
  /** True when falling back to default Berlin coordinates (no location configured). */
  locationDefault?: boolean;
  city?: string;
}

// ── Docker metrics ─────────────────────────────────────────────────────
export interface DockerContainer {
  id: string;
  name: string;
  status: 'running' | 'stopped' | 'paused';
  cpuPercent: number;
  memoryUsed: number;
  memoryTotal: number;
}

export interface DockerMetrics {
  containers: DockerContainer[];
}

// ── Service Health metrics ─────────────────────────────────────────────
export interface ServiceHealthEntry {
  name: string;
  url: string;
  status: 'up' | 'down' | 'timeout';
  responseTimeMs: number;
  lastChecked: number;
}

export interface ServiceHealthMetrics {
  services: ServiceHealthEntry[];
}

// ── Speedtest metrics ──────────────────────────────────────────────────
export interface SpeedtestResult {
  downloadMbps: number;
  uploadMbps: number;
  latencyMs: number;
  timestamp: number;
}

export interface SpeedtestMetrics {
  lastResult: SpeedtestResult | null;
  history: SpeedtestResult[];
  testInProgress: boolean;
  cooldownUntil: number | null;
}

// ── Calendar metrics ───────────────────────────────────────────────────
export interface CalendarEvent {
  title: string;
  startTime: string;
  endTime: string;
  calendarName: string;
}

export interface CalendarMetrics {
  events: CalendarEvent[];
}
