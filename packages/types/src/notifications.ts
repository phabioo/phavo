export interface Notification {
  id: string;
  type: 'update' | 'widget-error' | 'widget-warning' | 'system-alert' | 'info';
  title: string;
  body: string;
  widgetId?: string;
  settingsTab?: string;
  timestamp: number;
  read: boolean;
}

export type NotifyFn = (n: Omit<Notification, 'id' | 'timestamp' | 'read'>) => void;
