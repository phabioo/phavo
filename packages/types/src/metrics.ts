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
  forecast: WeatherForecastDay[];
}
