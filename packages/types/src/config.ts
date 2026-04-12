import { z } from 'zod';

export const TabSchema = z.object({
  id: z.string(),
  label: z.string(),
  order: z.number(),
});
export type Tab = z.infer<typeof TabSchema>;

export const DashboardConfigSchema = z.object({
  setupComplete: z.boolean().default(false),
  dashboardName: z.string().default('My Dashboard'),
  tabs: z.array(TabSchema).default([]),
  sessionTimeout: z.enum(['1d', '7d', '30d', 'never']).default('7d'),
  location: z
    .object({
      name: z.string(),
      latitude: z.number(),
      longitude: z.number(),
    })
    .optional(),
});
export type DashboardConfig = z.infer<typeof DashboardConfigSchema>;
