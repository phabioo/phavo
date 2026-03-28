// Better Auth configuration
// Phase 1: local accounts + phavo.net OAuth

import type { Db } from '@phavo/db';

interface AuthConfig {
  db: Db;
  sessionMaxAge?: number;
}

const MAX_LOGIN_ATTEMPTS = 10;
const MAX_LOGIN_ATTEMPTS_MAP = 10000;
const LOCKOUT_DURATION_MS = 5 * 60 * 1000; // 5 minutes

interface AttemptRecord {
  count: number;
  firstAttempt: number;
  lockedUntil: number;
}

const loginAttempts = new Map<string, AttemptRecord>();

function isAttemptExpired(record: AttemptRecord, now: number): boolean {
  return now - record.firstAttempt > LOCKOUT_DURATION_MS;
}

function pruneExpiredLoginAttempts(now = Date.now()): void {
  for (const [identifier, record] of loginAttempts) {
    if (isAttemptExpired(record, now)) {
      loginAttempts.delete(identifier);
    }
  }
}

function ensureLoginAttemptsCapacity(now: number): boolean {
  if (loginAttempts.size < MAX_LOGIN_ATTEMPTS_MAP) {
    return true;
  }

  pruneExpiredLoginAttempts(now);
  return loginAttempts.size < MAX_LOGIN_ATTEMPTS_MAP;
}

setInterval(
  () => {
    pruneExpiredLoginAttempts();
  },
  5 * 60 * 1000,
);

export function checkRateLimit(identifier: string): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();
  if (!ensureLoginAttemptsCapacity(now)) {
    return { allowed: false, retryAfter: Math.ceil(LOCKOUT_DURATION_MS / 1000) };
  }

  const record = loginAttempts.get(identifier);

  if (record) {
    if (isAttemptExpired(record, now)) {
      loginAttempts.delete(identifier);
      return { allowed: true };
    }

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

  const now = Date.now();
  if (!ensureLoginAttemptsCapacity(now)) {
    return;
  }

  const existingRecord = loginAttempts.get(identifier);
  const record =
    !existingRecord || isAttemptExpired(existingRecord, now)
      ? { count: 0, firstAttempt: now, lockedUntil: 0 }
      : existingRecord;

  record.count += 1;

  if (record.count >= MAX_LOGIN_ATTEMPTS) {
    record.firstAttempt = now;
    record.lockedUntil = now + LOCKOUT_DURATION_MS;
  }

  loginAttempts.set(identifier, record);
}

export function getLoginAttemptCount(identifier: string): number {
  return loginAttempts.get(identifier)?.count ?? 0;
}

export function createAuth(_config: AuthConfig) {
  // Better Auth setup will be fully configured when dependencies are installed
  // Phase 1: local email/password with Argon2id + phavo.net OAuth
  return {
    sessionMaxAge: _config.sessionMaxAge ?? 7 * 24 * 60 * 60, // 7 days
  };
}
