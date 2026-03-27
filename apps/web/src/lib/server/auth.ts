// Better Auth configuration
// Phase 1: local accounts + phavo.net OAuth

import type { Db } from '@phavo/db';

interface AuthConfig {
  db: Db;
  sessionMaxAge?: number;
}

const MAX_LOGIN_ATTEMPTS = 10;
const LOCKOUT_DURATION_MS = 5 * 60 * 1000; // 5 minutes

interface AttemptRecord {
  count: number;
  lockedUntil: number;
}

const loginAttempts = new Map<string, AttemptRecord>();

export function checkRateLimit(identifier: string): { allowed: boolean; retryAfter?: number } {
  const record = loginAttempts.get(identifier);
  const now = Date.now();

  if (record) {
    if (record.lockedUntil > now) {
      return { allowed: false, retryAfter: Math.ceil((record.lockedUntil - now) / 1000) };
    }

    if (record.lockedUntil <= now && record.count >= MAX_LOGIN_ATTEMPTS) {
      // Reset after lockout
      loginAttempts.delete(identifier);
    }
  }

  return { allowed: true };
}

export function recordLoginAttempt(identifier: string, success: boolean): void {
  if (success) {
    loginAttempts.delete(identifier);
    return;
  }

  const record = loginAttempts.get(identifier) ?? { count: 0, lockedUntil: 0 };
  record.count += 1;

  if (record.count >= MAX_LOGIN_ATTEMPTS) {
    record.lockedUntil = Date.now() + LOCKOUT_DURATION_MS;
  }

  loginAttempts.set(identifier, record);
}

export function createAuth(_config: AuthConfig) {
  // Better Auth setup will be fully configured when dependencies are installed
  // Phase 1: local email/password with Argon2id + phavo.net OAuth
  return {
    sessionMaxAge: _config.sessionMaxAge ?? 7 * 24 * 60 * 60, // 7 days
  };
}
