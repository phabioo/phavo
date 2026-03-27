// apps/web/src/lib/server/middleware/rate-limit.ts
// In-memory, per-IP rate limiter (sliding window via token bucket approximation).
// Stored in a Map that is pruned automatically to prevent unbounded growth.

interface BucketEntry {
  count: number;
  windowStart: number;
}

interface RateLimitRule {
  maxRequests: number;
  windowMs: number;
}

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

/**
 * Extracts the client IP from a Hono request context.
 * Prefers x-forwarded-for (first value) then x-real-ip then 'unknown'.
 */
export function getClientIp(headers: { header: (name: string) => string | undefined }): string {
  return (
    headers.header('x-forwarded-for')?.split(',')[0]?.trim() ??
    headers.header('x-real-ip') ??
    'unknown'
  );
}
