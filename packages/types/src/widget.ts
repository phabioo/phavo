import { z } from 'zod';

export const WidgetSize = z.enum(['S', 'M', 'L', 'XL']);
export type WidgetSize = z.infer<typeof WidgetSize>;

export const WidgetCategory = z.enum(['system', 'consumer', 'integration', 'utility']);
export type WidgetCategory = z.infer<typeof WidgetCategory>;

export const WidgetTier = z.enum(['free', 'standard']);
export type WidgetTier = z.infer<typeof WidgetTier>;

export const WidgetDefinitionSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  category: WidgetCategory,
  tier: WidgetTier,
  minSize: z.object({ w: z.number(), h: z.number() }),
  defaultSize: z.object({ w: z.number(), h: z.number() }),
  sizes: z.array(WidgetSize),
  configSchema: z.unknown().optional(),
  dataEndpoint: z.string(),
  refreshInterval: z.number(),
});
export type WidgetDefinition = z.infer<typeof WidgetDefinitionSchema>;

export const WidgetTeaserDefinitionSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  tier: WidgetTier,
  locked: z.literal(true),
});
export type WidgetTeaserDefinition = z.infer<typeof WidgetTeaserDefinitionSchema>;

export const WidgetManifestEntrySchema = z.union([
  WidgetDefinitionSchema,
  WidgetTeaserDefinitionSchema,
]);
export type WidgetManifestEntry = z.infer<typeof WidgetManifestEntrySchema>;

export function isWidgetDefinition(entry: WidgetManifestEntry): entry is WidgetDefinition {
  return !('locked' in entry);
}

export function isWidgetTeaserDefinition(
  entry: WidgetManifestEntry,
): entry is WidgetTeaserDefinition {
  return 'locked' in entry && entry.locked === true;
}

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
