import { z } from 'zod';

export const WidgetSize = z.enum(['S', 'M', 'L', 'XL']);
export type WidgetSize = z.infer<typeof WidgetSize>;

export const WidgetCategory = z.enum(['system', 'consumer', 'integration', 'utility']);
export type WidgetCategory = z.infer<typeof WidgetCategory>;

export const WidgetDefinitionSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  category: WidgetCategory,
  minSize: z.object({ w: z.number(), h: z.number() }),
  defaultSize: z.object({ w: z.number(), h: z.number() }),
  sizes: z.array(WidgetSize),
  configSchema: z.unknown().optional(),
  dataEndpoint: z.string(),
  refreshInterval: z.number(),
});
export type WidgetDefinition = z.infer<typeof WidgetDefinitionSchema>;

export const WidgetManifestEntrySchema = WidgetDefinitionSchema;
export type WidgetManifestEntry = WidgetDefinition;

export const WidgetInstanceSchema = z.object({
  id: z.string(),
  widgetId: z.string(),
  tabId: z.string(),
  size: WidgetSize,
  position: z.object({ x: z.number(), y: z.number() }),
  config: z.record(z.unknown()).optional(),
  configured: z.boolean().optional(),
});
export type WidgetInstance = z.infer<typeof WidgetInstanceSchema>;
