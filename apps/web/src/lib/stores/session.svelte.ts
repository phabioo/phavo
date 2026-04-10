import type { Session } from '@phavo/types';
import { browser } from '$app/environment';

let session = $state<Session | null>(null);

export function getSession(): Session | null {
  // Never read shared module state during SSR.
  return browser ? session : null;
}

export function setSession(newSession: Session | null): void {
  if (!browser) return;
  session = newSession;
}

export function isAuthenticated(): boolean {
  return browser && session !== null;
}
