const SWEEP_INTERVAL_MS = 10 * 60 * 1000;

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
  cache.set(key, { value, expiresAt: Date.now() + ttlMs, ttlMs, ts: Date.now() });
  return value;
}
