import type { Session } from '@phavo/types';

let session = $state<Session | null>(null);

export function getSession(): Session | null {
  return session;
}

export function setSession(newSession: Session | null): void {
  session = newSession;
}

export function isAuthenticated(): boolean {
  return session !== null;
}
