import type { WidgetDefinition } from '@phavo/types';

class WidgetRegistry {
  private widgets = new Map<string, WidgetDefinition>();

  register(def: WidgetDefinition): void {
    this.widgets.set(def.id, def);
  }

  getManifest(): WidgetDefinition[] {
    return Array.from(this.widgets.values());
  }

  getById(id: string): WidgetDefinition | undefined {
    return this.widgets.get(id);
  }

  getByTier(tier: 'free' | 'standard'): WidgetDefinition[] {
    return this.getManifest().filter((w) => {
      if (tier === 'standard') return true;
      return w.tier === 'free';
    });
  }
}

export const registry = new WidgetRegistry();

// Free tier widgets
registry.register({
  id: 'cpu',
  name: 'CPU',
  description: 'CPU usage, per-core breakdown, and load average',
  tier: 'free',
  category: 'system',
  sizes: ['S', 'M', 'L'],
  defaultSize: { w: 4, h: 3 },
  minSize: { w: 2, h: 2 },
  dataEndpoint: '/api/v1/cpu',
  refreshInterval: 5000,
});

registry.register({
  id: 'memory',
  name: 'Memory',
  description: 'RAM and swap usage',
  tier: 'free',
  category: 'system',
  sizes: ['S', 'M', 'L'],
  defaultSize: { w: 4, h: 3 },
  minSize: { w: 2, h: 2 },
  dataEndpoint: '/api/v1/memory',
  refreshInterval: 5000,
});

registry.register({
  id: 'disk',
  name: 'Disk',
  description: 'Per-mount disk usage, read/write throughput',
  tier: 'free',
  category: 'system',
  sizes: ['S', 'M', 'L'],
  defaultSize: { w: 4, h: 3 },
  minSize: { w: 2, h: 2 },
  dataEndpoint: '/api/v1/disk',
  refreshInterval: 5000,
});

registry.register({
  id: 'network',
  name: 'Network',
  description: 'Upload/download speed and total traffic',
  tier: 'free',
  category: 'system',
  sizes: ['S', 'M', 'L'],
  defaultSize: { w: 4, h: 3 },
  minSize: { w: 2, h: 2 },
  dataEndpoint: '/api/v1/network',
  refreshInterval: 5000,
});

registry.register({
  id: 'temperature',
  name: 'Temperature',
  description: 'CPU temperature (where available)',
  tier: 'free',
  category: 'system',
  sizes: ['S', 'M'],
  defaultSize: { w: 2, h: 2 },
  minSize: { w: 2, h: 2 },
  dataEndpoint: '/api/v1/temperature',
  refreshInterval: 10000,
});

registry.register({
  id: 'uptime',
  name: 'Uptime',
  description: 'System uptime, human-readable',
  tier: 'free',
  category: 'system',
  sizes: ['S', 'M'],
  defaultSize: { w: 2, h: 2 },
  minSize: { w: 2, h: 2 },
  dataEndpoint: '/api/v1/uptime',
  refreshInterval: 30000,
});

registry.register({
  id: 'weather',
  name: 'Weather',
  description: 'Current conditions and 5-day forecast via Open-Meteo',
  tier: 'free',
  category: 'consumer',
  sizes: ['S', 'M', 'L'],
  defaultSize: { w: 4, h: 3 },
  minSize: { w: 2, h: 2 },
  dataEndpoint: '/api/v1/weather',
  refreshInterval: 300000,
});

// Standard tier widgets
registry.register({
  id: 'pihole',
  name: 'Pi-hole',
  description: 'Total queries, blocked %, blocklist count, enable/disable toggle',
  tier: 'standard',
  category: 'integration',
  sizes: ['S', 'M', 'L'],
  defaultSize: { w: 4, h: 3 },
  minSize: { w: 2, h: 2 },
  dataEndpoint: '/api/v1/pihole',
  refreshInterval: 30000,
});

registry.register({
  id: 'rss',
  name: 'RSS Feed',
  description: 'User-configurable feed URLs with title, source, and timestamp',
  tier: 'standard',
  category: 'consumer',
  sizes: ['M', 'L', 'XL'],
  defaultSize: { w: 6, h: 4 },
  minSize: { w: 4, h: 3 },
  dataEndpoint: '/api/v1/rss',
  refreshInterval: 60000,
});

registry.register({
  id: 'links',
  name: 'Links / Bookmarks',
  description: 'Named links with optional icons grouped by category',
  tier: 'standard',
  category: 'utility',
  sizes: ['S', 'M', 'L'],
  defaultSize: { w: 4, h: 3 },
  minSize: { w: 2, h: 2 },
  dataEndpoint: '/api/v1/links',
  refreshInterval: 0,
});
