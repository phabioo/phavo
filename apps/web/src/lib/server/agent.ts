const SWEEP_INTERVAL_MS = 10 * 60 * 1000;
const MAX_CACHE_ENTRIES = 200;

const cache = new Map<string, { value: unknown; expiresAt: number; ttlMs: number; ts: number }>();

const cacheSweepTimer = setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of cache) {
    if (now - entry.ts > entry.ttlMs * 2) {
      cache.delete(key);
    }
  }
}, SWEEP_INTERVAL_MS);

cacheSweepTimer.unref?.();

export async function cached<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() < hit.expiresAt) return hit.value as T;
  const value = await fn();
  // Evict oldest entry when cache exceeds max size to keep memory bounded on Pi.
  if (cache.size >= MAX_CACHE_ENTRIES) {
    let oldestKey: string | undefined;
    let oldestTs = Infinity;
    for (const [k, v] of cache) {
      if (v.ts < oldestTs) {
        oldestTs = v.ts;
        oldestKey = k;
      }
    }
    if (oldestKey) cache.delete(oldestKey);
  }
  cache.set(key, { value, expiresAt: Date.now() + ttlMs, ttlMs, ts: Date.now() });
  return value;
}
