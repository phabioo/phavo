import type { Component } from 'svelte';
import CalendarWidget from '$lib/widgets/CalendarWidget.svelte';
import CpuWidget from '$lib/widgets/CpuWidget.svelte';
import DiskWidget from '$lib/widgets/DiskWidget.svelte';
import DockerWidget from '$lib/widgets/DockerWidget.svelte';
import LinksWidget from '$lib/widgets/LinksWidget.svelte';
import MemoryWidget from '$lib/widgets/MemoryWidget.svelte';
import NetworkWidget from '$lib/widgets/NetworkWidget.svelte';
import PiholeWidget from '$lib/widgets/PiholeWidget.svelte';
import RssWidget from '$lib/widgets/RssWidget.svelte';
import ServiceHealthWidget from '$lib/widgets/ServiceHealthWidget.svelte';
import SpeedtestWidget from '$lib/widgets/SpeedtestWidget.svelte';
import TemperatureWidget from '$lib/widgets/TemperatureWidget.svelte';
import UptimeWidget from '$lib/widgets/UptimeWidget.svelte';
import WeatherWidget from '$lib/widgets/WeatherWidget.svelte';

export type GenericWidgetComponent = Component<{ data: unknown; size?: 'S' | 'M' | 'L' | 'XL' }>;

export const widgetComponentRegistry = {
  cpu: CpuWidget as GenericWidgetComponent,
  memory: MemoryWidget as GenericWidgetComponent,
  disk: DiskWidget as GenericWidgetComponent,
  network: NetworkWidget as GenericWidgetComponent,
  temperature: TemperatureWidget as GenericWidgetComponent,
  uptime: UptimeWidget as GenericWidgetComponent,
  weather: WeatherWidget as GenericWidgetComponent,
  pihole: PiholeWidget as GenericWidgetComponent,
  rss: RssWidget as GenericWidgetComponent,
  links: LinksWidget as GenericWidgetComponent,
  docker: DockerWidget as GenericWidgetComponent,
  'service-health': ServiceHealthWidget as GenericWidgetComponent,
  speedtest: SpeedtestWidget as GenericWidgetComponent,
  calendar: CalendarWidget as GenericWidgetComponent,
} satisfies Record<string, GenericWidgetComponent>;

export const widgetHeadingPresets = {
  cpu: { title: 'CPU Utilization', subtitle: 'Processor Unit', icon: 'cpu' },
  memory: { title: 'Memory Usage', subtitle: 'Memory', icon: 'memory-stick' },
  disk: { title: 'Storage Overview', subtitle: 'Storage', icon: 'database' },
  network: { title: 'Network Activity', subtitle: 'Network', icon: 'globe' },
  temperature: { title: 'Thermal Status', subtitle: 'Temperature', icon: 'thermometer' },
  uptime: { title: 'System Uptime', subtitle: 'System', icon: 'clock-3' },
  weather: { title: 'Current Weather', subtitle: 'Environment', icon: 'cloud-sun' },
  pihole: { title: 'DNS Filtering', subtitle: 'Pi-hole', icon: 'shield' },
  rss: { title: 'News Feed', subtitle: 'RSS', icon: 'rss' },
  links: { title: 'Bookmarks', subtitle: 'Quick Access', icon: 'bookmark' },
  docker: { title: 'Containers', subtitle: 'Docker', icon: 'box' },
  'service-health': { title: 'Service Health', subtitle: 'Monitoring', icon: 'activity' },
  speedtest: { title: 'Network Benchmark', subtitle: 'Speedtest', icon: 'gauge' },
  calendar: { title: 'Calendar', subtitle: 'Schedule', icon: 'calendar-days' },
} as const;

export const widgetIconMap = {
  cpu: 'cpu',
  memory: 'memory-stick',
  disk: 'hard-drive',
  network: 'wifi',
  temperature: 'thermometer',
  uptime: 'clock',
  weather: 'cloud-sun',
  pihole: 'shield',
  rss: 'rss',
  links: 'link',
  docker: 'container',
  'service-health': 'activity',
  speedtest: 'gauge',
  calendar: 'calendar',
} as const;

type WidgetHeadingFallback = {
  name: string;
  category: string;
};

export function getWidgetComponent(widgetId: string) {
  return widgetComponentRegistry[widgetId as keyof typeof widgetComponentRegistry] ?? null;
}

export function getWidgetHeading(widgetId: string, fallback: WidgetHeadingFallback) {
  return (
    widgetHeadingPresets[widgetId as keyof typeof widgetHeadingPresets] ?? {
      title: fallback.name,
      subtitle: fallback.category.replace('-', ' '),
      icon: 'layout-grid',
    }
  );
}

export function getWidgetIcon(widgetId: string, fallback = 'puzzle') {
  return widgetIconMap[widgetId as keyof typeof widgetIconMap] ?? fallback;
}
