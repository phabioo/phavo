import type { DashboardConfig } from '@phavo/types';
import { browser } from '$app/environment';

let config = $state<DashboardConfig>({
  setupComplete: false,
  dashboardName: 'My Dashboard',
  tabs: [],
  sessionTimeout: '7d',
  location: undefined,
});

export function getConfig(): DashboardConfig {
  // Keep SSR request rendering independent from shared client store state.
  if (!browser) {
    return {
      setupComplete: false,
      dashboardName: '',
      tabs: [],
      sessionTimeout: '7d',
      location: undefined,
    };
  }
  return config;
}

export function setConfig(newConfig: DashboardConfig): void {
  if (!browser) return;
  config = newConfig;
}

export function updateConfig(partial: Partial<DashboardConfig>): void {
  if (!browser) return;
  config = { ...config, ...partial };
}
