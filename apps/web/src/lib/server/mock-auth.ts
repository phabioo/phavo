import type { Session } from '@phavo/types';

/**
 * Set PHAVO_DEV_MOCK_AUTH=true in .env to bypass phavo.io validation in local
 * development. A synthetic standard-tier session is injected automatically.
 * The setup wizard still runs on first launch when setupComplete is false.
 */
export const DEV_MOCK_AUTH = process.env.PHAVO_DEV_MOCK_AUTH === 'true';

/** Returns a synthetic dev session. Only used when DEV_MOCK_AUTH is true. */
export function getMockSession(): Session {
  return {
    userId: 'dev',
    tier: 'standard',
    authMode: 'local',
    validatedAt: Date.now(),
  };
}
