// apps/web/src/lib/server/middleware/rate-limit.ts
// In-memory, per-IP rate limiter (sliding window via token bucket approximation).
// Stored in a Map that is pruned automatically to prevent unbounded growth.

import { env } from '@phavo/types/env';
import type { HonoRequest } from 'hono';

interface BucketEntry {
  count: number;
  windowStart: number;
}

interface RateLimitRule {
  maxRequests: number;
  windowMs: number;
}

const MAX_BUCKETS = 500;
const buckets = new Map<string, BucketEntry>();

// Prune stale buckets every 5 minutes to keep memory bounded.
setInterval(
  () => {
    const now = Date.now();
    for (const [key, entry] of buckets) {
      // Use the largest possible window (10 minutes) as the staleness threshold.
      if (now - entry.windowStart > 10 * 60 * 1000) {
        buckets.delete(key);
      }
    }
  },
  5 * 60 * 1000,
);

/**
 * Checks and records a rate-limit attempt for the given (key, rule) pair.
 * Returns { allowed: true } or { allowed: false, retryAfterMs: number }.
 */
export function checkIpRateLimit(
  key: string,
  rule: RateLimitRule,
): { allowed: boolean; retryAfterMs?: number } {
  const now = Date.now();
  const entry = buckets.get(key);

  if (!entry || now - entry.windowStart >= rule.windowMs) {
    // Evict oldest bucket when at capacity to keep memory bounded on Pi.
    if (!entry && buckets.size >= MAX_BUCKETS) {
      let oldestKey: string | undefined;
      let oldestStart = Infinity;
      for (const [k, v] of buckets) {
        if (v.windowStart < oldestStart) { oldestStart = v.windowStart; oldestKey = k; }
      }
      if (oldestKey) buckets.delete(oldestKey);
    }
    // New window.
    buckets.set(key, { count: 1, windowStart: now });
    return { allowed: true };
  }

  if (entry.count >= rule.maxRequests) {
    const retryAfterMs = rule.windowMs - (now - entry.windowStart);
    return { allowed: false, retryAfterMs };
  }

  entry.count += 1;
  return { allowed: true };
}

// ─── Pre-defined rules ────────────────────────────────────────────────────────

/** POST /auth/totp — 5 req / 5 min per IP. */
export const TOTP_RULE: RateLimitRule = { maxRequests: 5, windowMs: 5 * 60 * 1000 };

/** GET /cpu, /memory, /disk, /network, /temperature, /uptime, /weather — 60 req / 1 min per IP. */
export const METRICS_RULE: RateLimitRule = { maxRequests: 60, windowMs: 60 * 1000 };

/** POST /config/import — 5 req / 10 min per IP. */
export const IMPORT_RULE: RateLimitRule = { maxRequests: 5, windowMs: 10 * 60 * 1000 };

/** Default for all other authenticated endpoints — 120 req / 1 min per IP. */
export const DEFAULT_RULE: RateLimitRule = { maxRequests: 120, windowMs: 60 * 1000 };

/** POST /webhooks/gumroad — 20 req / 1 min per IP. */
export const WEBHOOK_RULE: RateLimitRule = { maxRequests: 20, windowMs: 60 * 1000 };

/**
 * Extracts the client IP from a Hono request.
 * Trust x-forwarded-for only when PHAVO_TRUST_PROXY=true.
 */
export function getClientIp(req: HonoRequest): string {
  if (env.trustProxy) {
    const forwarded = req.header('x-forwarded-for');
    if (forwarded) {
      // split(',')[0] is always defined when the source string is non-empty
      return (forwarded.split(',')[0] ?? forwarded).trim();
    }

    const realIp = req.header('x-real-ip');
    if (realIp) return realIp;
  }

  return 'unknown';
}
