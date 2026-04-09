import type { DashboardConfig } from '@phavo/types';

let config = $state<DashboardConfig>({
  setupComplete: false,
  dashboardName: 'My Dashboard',
  tabs: [],
  sessionTimeout: '7d',
  location: undefined,
});

export function getConfig(): DashboardConfig {
  return config;
}

export function setConfig(newConfig: DashboardConfig): void {
  config = newConfig;
}

export function updateConfig(partial: Partial<DashboardConfig>): void {
  config = { ...config, ...partial };
}
