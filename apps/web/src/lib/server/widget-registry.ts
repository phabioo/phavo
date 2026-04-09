import { ensureZodMetaCompat, type WidgetDefinition, type WidgetManifestEntry } from '@phavo/types';
import { z } from 'zod';

export type RegisteredWidgetDefinition = WidgetDefinition & {
  configSchema?: z.ZodTypeAny;
  permissions?: string[];
  isPlugin?: boolean;
};

ensureZodMetaCompat();

export const PiholeWidgetConfigSchema = z.object({
  url: z.string().url().meta({
    label: 'Pi-hole URL',
    testEndpoint: '/api/v1/pihole/test',
  }),
  token: z.string().min(1).meta({
    credential: true,
    label: 'API token',
  }),
});

export const RssWidgetConfigSchema = z.object({
  feeds: z
    .array(
      z.object({
        id: z.string().uuid(),
        url: z.string().url().meta({ label: 'Feed URL' }),
        label: z.string().optional().meta({ label: 'Label' }),
        authType: z
          .enum(['none', 'basic', 'bearer'])
          .default('none')
          .meta({ label: 'Authentication' }),
        username: z.string().optional().meta({
          credential: true,
          label: 'Username',
        }),
        password: z.string().optional().meta({
          credential: true,
          label: 'Password',
        }),
        token: z.string().optional().meta({
          credential: true,
          label: 'Bearer token',
        }),
      }),
    )
    .min(1)
    .max(20),
});

const HttpUrlSchema = z
  .string()
  .url()
  .refine((value) => {
    try {
      const url = new URL(value);
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
      return false;
    }
  }, 'Only http:// and https:// URLs are allowed');

export const LinksWidgetConfigSchema = z.object({
  groups: z.array(
    z.object({
      label: z.string().min(1).meta({ label: 'Group label' }),
      links: z.array(
        z.object({
          title: z.string().min(1).meta({ label: 'Title' }),
          url: HttpUrlSchema.meta({ label: 'URL' }),
          icon: z.string().url().optional().meta({ label: 'Icon URL' }),
        }),
      ),
    }),
  ),
});

function toManifestDefinition(widget: RegisteredWidgetDefinition): WidgetDefinition {
  return {
    id: widget.id,
    name: widget.name,
    description: widget.description,
    category: widget.category,
    tier: widget.tier,
    minSize: widget.minSize,
    defaultSize: widget.defaultSize,
    sizes: widget.sizes,
    dataEndpoint: widget.dataEndpoint,
    refreshInterval: widget.refreshInterval,
  };
}

class WidgetRegistry {
  private widgets = new Map<string, RegisteredWidgetDefinition>();

  register(def: RegisteredWidgetDefinition): void {
    this.widgets.set(def.id, def);
  }

  getManifest(sessionTier: 'stellar' | 'celestial'): WidgetManifestEntry[] {
    return Array.from(this.widgets.values(), (widget) => {
      const entitled = sessionTier === 'celestial' || widget.tier === 'stellar';

      if (entitled) {
        return toManifestDefinition(widget);
      }

      return {
        id: widget.id,
        name: widget.name,
        description: widget.description,
        tier: widget.tier,
        locked: true,
      };
    });
  }

  getById(id: string): RegisteredWidgetDefinition | undefined {
    return this.widgets.get(id);
  }

  getByTier(tier: 'stellar' | 'celestial'): WidgetDefinition[] {
    return Array.from(this.widgets.values()).filter((w) => {
      if (tier === 'celestial') return true;
      return w.tier === 'stellar';
    });
  }
}

export const registry = new WidgetRegistry();

// Free tier widgets
registry.register({
  id: 'cpu',
  name: 'CPU',
  description: 'CPU usage, per-core breakdown, and load average',
  tier: 'stellar',
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
  tier: 'stellar',
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
  tier: 'stellar',
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
  tier: 'stellar',
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
  tier: 'stellar',
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
  tier: 'stellar',
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
  tier: 'stellar',
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
  tier: 'celestial',
  category: 'integration',
  sizes: ['S', 'M', 'L'],
  defaultSize: { w: 4, h: 3 },
  minSize: { w: 2, h: 2 },
  dataEndpoint: '/api/v1/pihole',
  refreshInterval: 30000,
  configSchema: PiholeWidgetConfigSchema,
});

registry.register({
  id: 'rss',
  name: 'RSS Feed',
  description: 'User-configurable feed URLs with title, source, and timestamp',
  tier: 'celestial',
  category: 'consumer',
  sizes: ['M', 'L'],
  defaultSize: { w: 6, h: 4 },
  minSize: { w: 4, h: 3 },
  dataEndpoint: '/api/v1/rss',
  refreshInterval: 60000,
  configSchema: RssWidgetConfigSchema,
});

registry.register({
  id: 'links',
  name: 'Links / Bookmarks',
  description: 'Named links with optional icons grouped by category',
  tier: 'celestial',
  category: 'utility',
  sizes: ['S', 'M', 'L'],
  defaultSize: { w: 4, h: 3 },
  minSize: { w: 2, h: 2 },
  dataEndpoint: '/api/v1/links',
  refreshInterval: 0,
  configSchema: LinksWidgetConfigSchema,
});
