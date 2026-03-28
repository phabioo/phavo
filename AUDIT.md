# Phavo — Full Production Audit Report

**Date:** 2025-07-17
**Scope:** All source code in `apps/web/`, `packages/`, config files, Docker setup
**Excludes:** Already-fixed issues documented in CLAUDE.md §Open Issues (Resolved sections)

---

## 1. Security

### 🔴 CRITICAL — `POST /update/apply` uses `exec()` with shell string (Command Injection risk)

**File:** [+server.ts](apps/web/src/routes/api/v1/[...path]/+server.ts#L2046-L2048)

```ts
const { exec } = await import('node:child_process');
exec('docker compose pull && docker compose up -d');
```

The arch spec (§17.8) explicitly requires `execFile('docker', ['compose', 'pull'])` — not `exec()` with a shell string. While the command string itself is hardcoded (no user input interpolation), `exec()` spawns a shell, which is an unnecessary attack surface and violates the spec. If this endpoint is ever modified to accept parameters, shell injection becomes trivial.

**Fix:** Replace `exec()` with `execFile()`:
```ts
import { execFile } from 'node:child_process';
execFile('docker', ['compose', 'pull'], (err) => {
  if (!err) execFile('docker', ['compose', 'up', '-d']);
});
```

---

### 🔴 CRITICAL — `POST /ai/test-ollama` and `POST /ai/chat` (Ollama path) missing SSRF protection

**File:** [+server.ts](apps/web/src/routes/api/v1/[...path]/+server.ts#L2470-L2500)

The `/pihole/test` endpoint correctly blocks cloud metadata endpoints (169.254.169.254 etc.), but the Ollama endpoints (`/ai/test-ollama` and `/ai/chat` Ollama branch) only check `protocol === 'http:' || 'https:'`. They do **not** block requests to:
- `http://169.254.169.254/latest/meta-data/` (AWS metadata)
- `http://metadata.google.internal/`
- `http://[fd00:ec2::254]/`

A user who configures a malicious Ollama URL can use the server as an SSRF proxy to reach cloud metadata services.

**Fix:** Extract the SSRF hostname check from `/pihole/test` into a shared `assertNotCloudMetadata(url)` helper and apply it to all user-supplied URLs before `fetch()`.

---

### 🟠 HIGH — `loginAttempts` Map is unbounded (DoS via memory exhaustion)

**File:** [auth.ts](apps/web/src/lib/server/auth.ts#L19)

```ts
const loginAttempts = new Map<string, AttemptRecord>();
```

There is no size cap and no periodic pruning. An attacker who sends login requests from millions of spoofed IPs (via `X-Forwarded-For`) will grow this Map indefinitely, eventually exhausting server memory.

The `partialSessions` Map has a cap of 1000 — `loginAttempts` needs the same treatment.

**Fix:** Add a MAX_MAP_SIZE check before `.set()`, and add a periodic pruning interval (e.g. every 5 min, delete entries older than `LOCKOUT_DURATION_MS`).

---

### 🟠 HIGH — `X-Forwarded-For` header trusted without reverse-proxy guarantee

**File:** [rate-limit.ts](apps/web/src/lib/server/middleware/rate-limit.ts#L75-L80)

```ts
export function getClientIp(headers) {
  return headers.header('x-forwarded-for')?.split(',')[0]?.trim() ?? ...
}
```

Also duplicated inline at [+server.ts](apps/web/src/routes/api/v1/[...path]/+server.ts#L1153).

Any client can set `X-Forwarded-For: 127.0.0.1` to bypass rate limiting, or set a unique value per request to get a fresh bucket. In Docker behind a reverse proxy this header is expected, but the app should either:
1. Trust only `X-Forwarded-For` behind a known proxy (configurable), or
2. Use Bun's `remoteAddress` from the request as a fallback

This applies to both the rate limiter and the login rate limiter.

**Fix:** Add a `PHAVO_TRUST_PROXY` env var. When false/unset, ignore `X-Forwarded-For` entirely and use the socket IP. When true, trust only the rightmost untrusted entry.

---

### 🟠 HIGH — `renderMarkdown()` + `{@html}` is an XSS vector

**File:** [+page.svelte](apps/web/src/routes/settings/+page.svelte#L622-L630)

```ts
function renderMarkdown(md: string): string {
  return md.replace(/^## (.+)$/gm, '<strong>$1</strong>')
           .replace(/^[-*] (.+)$/gm, '<span class="cl-item">• $1</span>')
           .replace(/\n/g, '<br>');
}
```

Used as `{@html renderMarkdown(updateInfo.changelog)}` where `updateInfo.changelog` comes from the GitHub Releases API (`release.body`). If a GitHub Release body contains `<img onerror=...>` or `<script>`, it will execute in the user's browser.

**Fix:** Sanitize the output with a whitelist-based HTML sanitizer (e.g. `DOMPurify`) before rendering, or escape HTML entities before applying the regex transforms.

---

### 🟡 MEDIUM — `e.message` exposed in 20+ error responses

**File:** [+server.ts](apps/web/src/routes/api/v1/[...path]/+server.ts) — lines 869, 892, 929, 1133, 1519, 1534, 1767, 1838, 1898, 1961, 2071+

Pattern:
```ts
return c.json(err(e instanceof Error ? e.message : 'Fallback'), 500);
```

`e.message` from internal errors (DB driver, crypto, file system) can leak implementation details: file paths, SQL error messages, stack fragments. The API envelope contract says "never expose stack traces" — raw `e.message` is one step away.

**Fix:** Log the full error server-side (`console.error('[phavo]', e)`), return only the generic fallback string to the client.

---

### 🟡 MEDIUM — CSRF cookie uses `SameSite=Lax` instead of `Strict`

**File:** [+server.ts](apps/web/src/routes/api/v1/[...path]/+server.ts#L270)

```ts
`phavo_csrf=${csrfToken}; Path=/; SameSite=Lax; Max-Age=...`
```

The session cookie uses `SameSite=Strict`, but the CSRF cookie uses `SameSite=Lax`. This means the CSRF cookie is sent on top-level navigations from external sites (e.g. a link from email). While the double-submit check still holds because the CSRF value must match the HMAC, aligning both cookies to `Strict` provides defense-in-depth.

**Fix:** Change CSRF cookie to `SameSite=Strict`.

---

### 🟡 MEDIUM — `PHAVO_IO_PUBLIC_KEY` skipped silently if unset

**File:** [+server.ts](apps/web/src/routes/api/v1/[...path]/+server.ts#L1419-L1424)

```ts
const pubKeyB64 = process.env.PHAVO_IO_PUBLIC_KEY ?? '';
if (pubKeyB64) {
  const jwtValid = await verifyActivationJwt(...);
  if (!jwtValid) return ...;
}
// If PHAVO_IO_PUBLIC_KEY is not set, skip JWT verification (dev/test scenario).
```

In production, if `PHAVO_IO_PUBLIC_KEY` is accidentally missing from the environment, **offline license verification is silently bypassed** — any stale or forged activation JWT would be accepted. This should be a hard error in production.

**Fix:** Add `if (env.nodeEnv === 'production' && !pubKeyB64) return c.json(err('Server misconfiguration'), 500);`

---

### 🔵 LOW — CSP `style-src 'unsafe-inline'`

**File:** [hooks.server.ts](apps/web/src/hooks.server.ts#L46)

`style-src 'self' 'unsafe-inline' https://fonts.googleapis.com` — `'unsafe-inline'` is needed for Svelte's style injection. This is a known trade-off and documented, but it weakens CSP against CSS-based attacks. Consider migrating to hashed or nonce-based style injection in a future pass.

---

## 2. API Design

### 🟡 MEDIUM — `z.array(z.any())` for tabs in `ConfigPostSchema`

**File:** [+server.ts](apps/web/src/routes/api/v1/[...path]/+server.ts#L818)

```ts
tabs: z.array(z.any()).optional(),
```

This accepts arbitrary data in the `tabs` array — any nested object, script payload, or oversized blob passes validation. All other fields in `ConfigPostSchema` use strict Zod types.

**Fix:** Define a proper tab schema:
```ts
tabs: z.array(z.object({ id: z.string().uuid(), label: z.string().max(100), order: z.number().int().min(0) })).max(50).optional(),
```

---

### 🟡 MEDIUM — No length limit on tab `label` (POST/PATCH `/tabs`)

**File:** [+server.ts](apps/web/src/routes/api/v1/[...path]/+server.ts#L2081-L2098)

```ts
if (!body.label || typeof body.label !== 'string' || !body.label.trim()) {
  return c.json(err('Label is required'), 400);
}
```

No max-length check. A user can create a tab with a 10MB label string. The same applies to PATCH `/tabs/:id`.

**Fix:** Add `body.label.trim().length > 100` check.

---

### 🟡 MEDIUM — Widget instance creation/update not Zod-validated

**File:** [+server.ts](apps/web/src/routes/api/v1/[...path]/+server.ts#L2195-L2260)

`POST /widget-instances` and `PATCH /widget-instances/:id` parse `body` via `as { widgetId?: string; ... }` type assertions instead of Zod schemas. This allows unchecked types (e.g. `positionX: "abc"`) to reach the DB.

**Fix:** Add Zod schemas for both endpoints, matching the column types in the schema.

---

### 🟡 MEDIUM — GitHub Releases API response not Zod-validated

**File:** [+server.ts](apps/web/src/routes/api/v1/[...path]/+server.ts#L2006-L2015)

```ts
const release = (await res.json()) as { tag_name: string; body: string; published_at: string };
```

Type assertion instead of Zod validation. The arch spec iron rule says "Validate all external API responses with Zod before use."

**Fix:** Add a `GithubReleaseSchema` and `safeParse()`.

---

### 🔵 LOW — `POST /tabs` creates tab without verifying `tabId` ownership on the user

Tabs are globally shared — no `userId` column. In a single-user app this is fine, but the schema has no inherent user scoping. If multi-user support is ever added, all tab/widget queries need user scoping.

---

## 3. Database & State

### 🟠 HIGH — Old sessions never pruned

**File:** Schema `sessions` table has `expiresAt`, but there is no periodic cleanup job.

Sessions are deleted on explicit logout or when a request hits an expired session. Sessions from users who never return (abandoned browsers, stale API tokens) accumulate indefinitely in SQLite. Over months, this table will grow without bound.

**Fix:** Add a periodic cleanup (e.g. every hour on a server interval) that deletes where `expiresAt < Date.now()`.

---

### 🟡 MEDIUM — License activation table not scoped for re-activation race

**File:** [+server.ts](apps/web/src/routes/api/v1/[...path]/+server.ts#L1870-L1880)

```ts
const existingActivations = await db.select().from(schema.licenseActivation);
for (const activationRow of existingActivations) {
  await db.delete(schema.licenseActivation).where(eq(schema.licenseActivation.id, activationRow.id));
}
await db.insert(schema.licenseActivation).values({...});
```

The select-then-delete-then-insert is not wrapped in a transaction. A concurrent request could race between the delete and insert, leaving zero activation rows. Lock or transaction needed.

**Fix:** Wrap in `db.transaction(async (tx) => { ... })`.

---

### 🟡 MEDIUM — License deactivation delete loop same issue

**File:** [+server.ts](apps/web/src/routes/api/v1/[...path]/+server.ts#L1936-L1940)

Same pattern: select-loop-delete without a transaction.

---

## 4. Frontend — Svelte 5

### 🟡 MEDIUM — `$effect.root()` in `WidgetsTab.svelte` not cleaned up

**File:** [WidgetsTab.svelte](apps/web/src/lib/components/settings/WidgetsTab.svelte#L85-L97)

```ts
onMount(() => {
  $effect.root(() => {
    $effect(() => { ... });
  });
});
onMount(() => {
  $effect.root(() => {
    $effect(() => { ... });
  });
});
```

`$effect.root()` returns a cleanup function that is never captured or called. Every time this component mounts, two effect roots are leaked. On navigation back and forth to settings, these accumulate.

**Fix:** Capture the return value and call it in the onMount cleanup:
```ts
onMount(() => {
  const cleanup = $effect.root(() => { ... });
  return cleanup;
});
```

---

### 🟡 MEDIUM — `$effect.root()` in `+page.svelte` (dashboard) not cleaned up

**File:** [+page.svelte](apps/web/src/routes/+page.svelte#L178-L183)

```ts
onMount(() => {
  $effect.root(() => {
    $effect(() => {
      loadWidgetManifest();
      loadTabs();
    });
  });
});
```

Same issue: `$effect.root()` return value not captured. This one fires network requests on every re-run.

---

### 🔵 LOW — `isMobile` in `WidgetsTab.svelte` is `$derived` but doesn't react to resize

```ts
const isMobile = $derived(typeof window !== 'undefined' ? window.innerWidth < 640 : false);
```

`$derived` recalculates when its reactive dependencies change, but `window.innerWidth` is not reactive — this value is computed once and never updates. Use a `resize` event listener or `matchMedia` instead.

---

## 5. Logic & Correctness

### 🟠 HIGH — Login flow creates a full session before checking TOTP, then deletes it

**File:** [+server.ts](apps/web/src/routes/api/v1/[...path]/+server.ts#L1442-L1460)

```ts
const token = generateSessionToken();
await db.insert(schema.sessions).values({ id: token, ... });
// ...
if (user.totpSecret) {
  // ...
  await db.delete(schema.sessions).where(eq(schema.sessions.id, token));
  return c.json(ok({ requiresTotp: true, partialToken }));
}
```

A full session row is inserted into the DB, then deleted if TOTP is required. This is wasteful I/O and introduces a brief window where an unauthenticated session exists in the DB. If the server crashes between insert and delete, a dangling valid session exists forever.

**Fix:** Move session creation **after** the TOTP check. Only insert the session once authentication is fully complete.

---

### 🟡 MEDIUM — `update/check` falls back silently but allows stale data

**File:** [+server.ts](apps/web/src/routes/api/v1/[...path]/+server.ts#L1983-L2040)

The fallback object sets `updateAvailable: false`, so if the GitHub API is unreachable, the user never sees an update notification. But the result is cached for 1 hour, meaning after one failure, the user gets stale "no update" data for 60 minutes even if GitHub comes back online immediately.

Consider caching successful responses longer but not caching failures, or reducing the failure cache TTL.

---

### 🔵 LOW — `weather` endpoint defaults to Berlin coordinates

**File:** [+server.ts](apps/web/src/routes/api/v1/[...path]/+server.ts#L1603-L1608)

```ts
const latitude = Number.isFinite(requestedLatitude)
  ? requestedLatitude
  : (config.location?.latitude ?? 52.52);
```

If no location is configured and no query params are passed, Berlin (52.52, 13.405) weather is returned without indicating it's a default. A notification or explicit "no location configured" response would be more helpful.

---

## 6. Performance

### 🟡 MEDIUM — Cached metric data never evicted

**File:** [+server.ts](apps/web/src/routes/api/v1/[...path]/+server.ts) — `cached()` helper

The `cached()` function stores data in a `Map<string, { data, ts }>`. Entries are refreshed on access but never evicted if the key is abandoned (e.g. after removing an RSS widget instance, its cache key `rss:...` persists forever).

**Fix:** Add a periodic sweep (e.g. every 10 minutes) that deletes entries older than 2× their TTL.

---

### 🔵 LOW — RSS cache key includes all feed URLs concatenated

```ts
const cacheKey = `rss:${feeds.map(feed => `${feed.url}:${feed.auth?.type ?? 'none'}`).sort().join('|')}`;
```

If a user has many feeds, this key can get very long. Not a functional issue, but consider a hash of the key instead.

---

## 7. Production Readiness

### 🟠 HIGH — Dockerfile missing `HEALTHCHECK` instruction

**File:** [Dockerfile](Dockerfile)

The Dockerfile has no `HEALTHCHECK`. Docker and orchestrators (Compose, Swarm, Kubernetes readiness probes) rely on this to detect unhealthy containers. The `/api/v1/health` endpoint exists specifically for this purpose.

**Fix:** Add to the Dockerfile:
```dockerfile
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD bun -e "const r = await fetch('http://localhost:3000/api/v1/health'); process.exit(r.ok ? 0 : 1)"
```

Or use `wget`/`curl` if available in the Alpine image.

---

### 🟡 MEDIUM — `docker-compose.yml` exposes port 3443 but no TLS cert generation is automated

**File:** [docker-compose.yml](docker-compose.yml#L7-L8)

Port 3443 is exposed and `PHAVO_TLS_MODE` defaults to `self-signed`, but there's no TLS setup in the Dockerfile or entrypoint. Users who expose 3443 expecting HTTPS will get a connection refused or plain HTTP.

**Fix:** Either remove 3443 from the default compose file, or document/automate the TLS setup.

---

### 🟡 MEDIUM — No graceful shutdown handling

No `SIGTERM` or `SIGINT` handlers are registered. When Docker sends `SIGTERM` on container stop, in-flight requests may be dropped and the DB connection may not be closed cleanly. SQLite is generally robust to this, but explicit cleanup is best practice.

**Fix:** Register a handler that closes the DB connection and stops accepting new requests.

---

## 8. Config & Environment

### 🟡 MEDIUM — `env.ts` defaults `dataDir` to `/data` — works in Docker, breaks outside

**File:** [env.ts](packages/types/src/env.ts#L10)

```ts
dataDir: process.env.PHAVO_DATA_DIR ?? '/data',
```

When running via `bun run dev` on macOS/Windows without setting `PHAVO_DATA_DIR`, Phavo writes to the system root `/data` directory. This fails on macOS (SIP) and Windows (no `/data`).

The iron rule says "No `/data/` literals in server code" — `env.ts` is technically in `packages/types`, which the iron rule scopes to `packages/` and `apps/web/src/lib/server/`. This default is the root cause.

**Fix:** Detect non-Docker environments and default to `~/.phavo/data` or `./data` instead.

---

## 9. Architecture

### 🟡 MEDIUM — Single 2600+ line API file

**File:** [+server.ts](apps/web/src/routes/api/v1/[...path]/+server.ts)

All API routes — auth, metrics, widgets, tabs, AI, config, license, notifications, updates — live in a single file. This makes code review, git blame, and merge conflict resolution difficult. The file is over 2600 lines.

**Fix:** Split into route modules (e.g. `routes/auth.ts`, `routes/metrics.ts`, `routes/ai.ts`) and import into the Hono app.

---

### 🔵 LOW — `piholeMissingConfigNotified` and `piholeFailureCount` are module-level mutable state

These server-side flags persist across requests but reset on server restart. They work correctly for a single-instance deployment but won't scale to multi-instance without shared state.

---

## 10. Code Quality

### 🟡 MEDIUM — `PATCH /auth/password` body not Zod-validated

**File:** [+server.ts](apps/web/src/routes/api/v1/[...path]/+server.ts#L1507-L1511)

```ts
const body = (await c.req.json()) as { newPassword?: string };
if (!body.newPassword || body.newPassword.length < 8) { ... }
```

Type assertion + manual check instead of Zod. Missing max-length (allows 10MB password string to be hashed by Argon2id, which is a computational DoS vector).

**Fix:** `z.object({ newPassword: z.string().min(8).max(256) })`.

---

### 🟡 MEDIUM — Duplicate IP extraction logic

**File:** [+server.ts](apps/web/src/routes/api/v1/[...path]/+server.ts#L1152-L1155)

```ts
const ip = c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ??
  c.req.header('x-real-ip') ?? 'unknown';
```

This duplicates `getClientIp()` from `rate-limit.ts`. If one is updated, the other falls out of sync.

**Fix:** Use `getClientIp(c.req)` — it's already imported.

---

### 🔵 LOW — `tab.order` allows arbitrary integers via PATCH

The `PATCH /tabs/:id` handler accepts `body.order` as any number without bounds checking. Negative or extremely large order values are stored as-is. Not dangerous, but could cause unexpected sort behavior.

---

---

## 🚨 RELEASE BLOCKERS

| # | Severity | Finding | Why it blocks |
|---|---|---|---|
| 1 | 🔴 CRITICAL | `exec()` in `/update/apply` | Arch spec violation; shell injection class of vulnerability |
| 2 | 🔴 CRITICAL | SSRF in Ollama endpoints | User-controlled URL fetched without cloud metadata blocking |
| 3 | 🟠 HIGH | `loginAttempts` Map unbounded | Memory exhaustion DoS via spoofed IPs |
| 4 | 🟠 HIGH | `X-Forwarded-For` trusted unconditionally | Rate limiting and login lockout can be trivially bypassed |
| 5 | 🟠 HIGH | `renderMarkdown` + `{@html}` XSS | Unsanitized GitHub Release body rendered as HTML |
| 6 | 🟠 HIGH | Dockerfile missing HEALTHCHECK | Container orchestrators cannot detect unhealthy state |
| 7 | 🟠 HIGH | Sessions never pruned | Unbounded SQLite row growth over time |
| 8 | 🟠 HIGH | Login creates session before TOTP | Race condition leaves dangling sessions on crash |

**Items 1–5 are hard release blockers.** Items 6–8 should be fixed before release but are not exploitable at the same severity.

---

*Phavo Production Audit · 2025-07-17 · 28 findings total: 2 CRITICAL, 6 HIGH, 14 MEDIUM, 6 LOW*
