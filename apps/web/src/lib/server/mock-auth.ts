import type { Session } from '@phavo/types';

/**
 * Set PHAVO_DEV_MOCK_AUTH=true in .env to bypass local auth checks in development.
 * A synthetic session is injected automatically.
 * The setup wizard still runs on first launch when setupComplete is false.
 */
export const DEV_MOCK_AUTH = process.env.PHAVO_DEV_MOCK_AUTH === 'true';
export const DEV_MOCK_AUTH_ENABLED = DEV_MOCK_AUTH && process.env.NODE_ENV !== 'production';

/** Returns a synthetic dev session. Only used when DEV_MOCK_AUTH is true. */
export function getMockSession(): Session {
  return {
    userId: 'dev',
    authMode: 'local',
    validatedAt: Date.now(),
  };
}
