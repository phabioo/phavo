/**
 * Widget config schemas — shared between server (widget-registry) and client (WidgetsTab).
 *
 * These are pure Zod schemas with no server-side dependencies, so they can be
 * safely imported on both sides of the wire.
 */
import { ensureZodMetaCompat, z } from '@phavo/types';

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

export const DockerWidgetConfigSchema = z.object({
  socketPath: z
    .string()
    .optional()
    .meta({ label: 'Docker socket path (default: /var/run/docker.sock)' }),
});

export const ServiceHealthWidgetConfigSchema = z.object({
  services: z
    .array(
      z.object({
        id: z.string().uuid(),
        name: z.string().meta({ label: 'Service name' }),
        url: HttpUrlSchema.meta({ label: 'URL to check' }),
        method: z.enum(['GET', 'HEAD', 'PING']).default('GET').meta({ label: 'Check method' }),
      }),
    )
    .min(1)
    .max(10),
});

export const SpeedtestWidgetConfigSchema = z.object({
  autoRun: z.boolean().default(false).meta({ label: 'Auto-run test every 6 hours' }),
  server: z
    .string()
    .optional()
    .meta({ label: 'Preferred speedtest server ID (leave empty for auto)' }),
});

export const CalendarWidgetConfigSchema = z.object({
  url: z.string().url().meta({ label: 'CalDAV server URL' }),
  username: z.string().meta({ credential: true, label: 'Username' }),
  password: z.string().meta({ credential: true, label: 'Password' }),
  calendarName: z.string().optional().meta({ label: 'Calendar name filter (leave empty for all)' }),
});

/** Client-side widget ID → config schema lookup. */
export const configSchemaMap = new Map<string, z.ZodTypeAny>([
  ['pihole', PiholeWidgetConfigSchema],
  ['rss', RssWidgetConfigSchema],
  ['links', LinksWidgetConfigSchema],
  ['docker', DockerWidgetConfigSchema],
  ['service-health', ServiceHealthWidgetConfigSchema],
  ['speedtest', SpeedtestWidgetConfigSchema],
  ['calendar', CalendarWidgetConfigSchema],
]);
