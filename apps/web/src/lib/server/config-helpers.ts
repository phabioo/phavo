/**
 * Config parsing helpers shared across route modules.
 */

export function parseConfigEntries(rows: Array<{ key: string; value: string }>) {
  const entries: Record<string, string> = {};
  for (const row of rows) entries[row.key] = row.value;
  return {
    setupComplete: entries.setup_complete === 'true',
    dashboardName: entries.dashboard_name ?? 'My Dashboard',
    tabs: [],
    sessionTimeout: (entries.session_timeout as '1d' | '7d' | '30d' | 'never' | undefined) ?? '7d',
    location:
      entries.location_name && entries.location_latitude && entries.location_longitude
        ? {
            name: entries.location_name,
            latitude: Number(entries.location_latitude),
            longitude: Number(entries.location_longitude),
          }
        : undefined,
    telemetryAsked: entries.telemetry_asked === 'true' ? true : undefined,
    telemetryEnabled: entries.telemetry_enabled === 'true' ? true : undefined,
  };
}
