export interface Notification {
  id: string;
  type: 'update' | 'security' | 'widget-error' | 'task' | 'info';
  title: string;
  message: string;
  read: boolean;
  actionLabel?: string;
  actionUrl?: string;
  widgetId?: string;
  progress?: number;
  createdAt: number;
}

export type NotifyFn = (n: Omit<Notification, 'id' | 'createdAt' | 'read'>) => void;
