# Phavo — Technical Architecture Spec

**Version:** 3.2 · **Date:** 2026-04-11 · **PRD:** v5.0 · **Roadmap:** v5.0 · **Runtime:** v0.8.3 · **Design:** Celestial Wish

---

## Table of Contents

**Overview**
- [Overview](#overview)
- [Monorepo Structure](#monorepo-structure)
- [Request Lifecycle](#request-lifecycle)

**Backend**
- [Hono Routing](#hono-routing)
- [Middleware Stack](#middleware-stack)
- [Auth & Session](#auth--session)

**Database**
- [DB Schema](#db-schema)
- [plugin_data Table](#plugin_data-table)
- [Encryption Model](#encryption-model)
- [Migrations](#migrations)

**Frontend**
- [SvelteKit Shell](#sveltekit-shell)
- [Svelte Stores](#svelte-stores)
- [Widget System](#widget-system)
- [BentoGrid](#bentogrid)
- [Design Tokens](#design-tokens)

**Features**
- [AI Integration](#ai-integration)
- [Notifications](#notifications)
- [Export / Import](#export--import)
- [Update Mechanism](#update-mechanism)
- [Plugin System](#plugin-system)

**Infrastructure**
- [Docker](#docker)
- [Environment Variables](#environment-variables)
- [Mobile / Responsive](#mobile--responsive)
- [Content Security Policy](#content-security-policy)
- [Rate Limits](#rate-limits)
- [Security Decisions Summary](#security-decisions-summary)

---

## Overview

Phavo is a self-hosted personal dashboard. It runs entirely locally — no cloud account, no subscription, no phone-home. Free and open source under the MIT license. All features available to all users.

> **Key architectural invariant:** The app remains local-first. Runtime outbound calls are limited to explicit integrations (update check, weather API, RSS feeds, Pi-hole). Auth is fully local-only.

The web app (`apps/web/`) is the only active runtime target.

| Edition | License | Pages | Widgets | AI |
|---|---|---|---|---|
| **Celestial Edition** | MIT (open source) | Unlimited | All 14+ widgets | ✓ |

---

## Monorepo Structure

```
phavo/
├── apps/
│   ├── web/                    ← SvelteKit — the only active runtime
│   │   ├── src/
│   │   │   ├── routes/
│   │   │   │   ├── +layout.server.ts    ← DB init, session, redirect logic
│   │   │   │   ├── +layout.svelte       ← Shell: Sidebar + Header + slot
│   │   │   │   ├── (app)/+page.svelte   ← Dashboard / BentoGrid
│   │   │   │   ├── setup/+page.svelte   ← Setup wizard
│   │   │   │   ├── login/+page.svelte   ← Auth page
│   │   │   │   └── api/v1/[...path]/+server.ts  ← Hono catch-all
│   │   │   ├── lib/
│   │   │   │   ├── stores/              ← Svelte 5 Runes stores (incl. notifications.svelte.ts)
│   │   │   │   ├── components/settings/ ← Settings page components (master-detail)
│   │   │   │   ├── widgets/             ← Widget components + _widget-template.svelte
│   │   │   │   └── components/          ← Page-level Svelte components
│   │   │   └── hooks.server.ts          ← DB bootstrap, session pruning
├── packages/
│   ├── ui/                     ← @phavo/ui
│   │   └── src/
│   │       ├── theme.css        ← @theme block — Celestial Wish tokens
│   │       ├── index.ts         ← component exports
│   │       ├── icons.ts         ← Icon abstraction
│   │       ├── Sidebar.svelte
│   │       ├── Header.svelte
│   │       ├── BentoGrid.svelte
│   │       ├── WidgetCard.svelte
│   │       ├── WidgetDrawer.svelte  ← bottom sheet for adding widgets
│   │       ├── NotificationPanel.svelte ← right-side 380px slide-in
│   │       ├── WishStar.svelte  ← decorative 4-pointed star motif
│   │       └── ...
│   ├── db/                     ← @phavo/db
│   │   └── src/
│   │       ├── schema.ts        ← Drizzle schema
│   │       ├── client.ts        ← libSQL client + migration runner
│   │       ├── crypto.ts        ← AES-256-GCM + HKDF
│   │       └── migrations/
│   ├── types/                  ← @phavo/types
│   └── agent/                  ← @phavo/agent — metrics collectors
└── docs/
    ├── prd.md
    ├── archspec.md              ← this file
    ├── roadmap.html
    ├── design.md                ← Celestial Wish Design System
    └── rules.md
```

---

## Request Lifecycle

### Browser → API (authenticated mutation)

| Step | Actor | Message |
|---|---|---|
| 1 | Browser → SvelteKit hook | `POST /api/v1/config` |
| 2 | SvelteKit hook → Hono middleware | `authMiddleware` |
| 3 | Hono middleware → DB | `SELECT session` |
| 4 | DB → Hono middleware | session record |
| 5 | Hono middleware | `csrfMiddleware` |
| 6 | Hono middleware | `rateLimitMiddleware` |
| 7 | Hono middleware | route handler |
| 8 | Route handler → DB | `UPDATE config` |
| 9 | Browser ← | `{ ok: true, data }` |

### Response Envelope (all endpoints)

```ts
// Success
{ ok: true, data: T }

// Error
{ ok: false, error: "Human-readable message" }
```

---

## Hono Routing

All API traffic enters via a single SvelteKit catch-all at `apps/web/src/routes/api/v1/[...path]/+server.ts`, which mounts the Hono app. Route modules are registered on startup.

| Module | Prefix | Responsibility |
|---|---|---|
| `auth.ts` | `/auth` | Login, logout, session, TOTP setup/verify, password change |
| `config.ts` | `/config` | Dashboard config GET/POST, export, import |
| `tabs.ts` | `/tabs` | Pages CRUD, per-page widget list |
| `widgets.ts` | `/widgets` | Manifest, instances CRUD, config |
| `metrics.ts` | `/metrics` | cpu, memory, disk, network, temperature, uptime, weather |
| `integrations.ts` | `/integrations` | pihole, rss, links |
| `ai.ts` | `/ai` | AI provider config, status, chat — Vercel AI SDK (`ai` + `ollama-ai-provider` / `@ai-sdk/openai` / `@ai-sdk/anthropic`); streaming via Hono SSE |
| `notifications.ts` | `/notifications` | List/create/mute/mark-read/bulk-read/delete |
| `plugins.ts` | `/plugins` | List, upload .phwidget, delete, status |
| `system.ts` | `/system` | health (public), about, update check/apply |

---

## Middleware Stack

Every authenticated, non-GET route passes through this stack in order:

1. **`authMiddleware`** — Reads session cookie → `SELECT sessions WHERE id = token AND expiresAt > now()`. Injects `ctx.session`. Returns 401 if missing.
2. **`csrfMiddleware`** — Double-submit HMAC pattern. All non-GET mutations require `X-CSRF-Token` header derived from session ID. Returns 403 on mismatch.
3. **`rateLimitMiddleware`** — Per-IP (unauthenticated) or per-session (authenticated) counters. In-memory (Phase 1). Endpoint-specific limits. Returns 429 on breach.

### CSRF — `fetchWithCsrf()`

```ts
// Client-side helper — all mutating store methods use this
async function fetchWithCsrf(url: string, options: RequestInit) {
  const token = deriveToken(sessionId)  // HMAC-SHA256(sessionId, secret)
  return fetch(url, {
    ...options,
    headers: { ...(options.headers ?? {}), 'X-CSRF-Token': token }
  })
}
```

---

## Auth & Session

> **Local-only auth.** Runtime uses local username/password (Argon2id) and local session enforcement only.

### Login flow

```
POST /api/v1/auth/login  { username, password }

1. SELECT user WHERE username = ?
2. argon2id.verify(storedHash, password)  → 401 on fail
3. INSERT sessions { id: randomBytes(32), userId, expiresAt: +7days }
4. Set-Cookie: phavo_session=<sessionId>; HttpOnly; SameSite=Strict; Secure
5. Return { ok: true, data: { loggedIn: true } }
```

### TOTP (optional 2FA)

```
POST /api/v1/auth/totp/setup   → returns QR code + backup codes (AES-encrypted at rest)
POST /api/v1/auth/totp/verify  { token }  → validates TOTP before completing login
```

---

## DB Schema

> **Open source (MIT).** All features available to all users. No tier system, no legacy entitlement flow.

### `users`
Single-user system. One row expected at all times after setup.

| Column | Type | Null | Notes |
|---|---|---|---|
| `id` | text PK | NOT NULL | UUID v4 |
| `username` | text | NOT NULL UNIQUE | 1–40 chars, case-insensitive |
| `passwordHash` | text | NOT NULL | Argon2id encoded string |
| `totpSecret` | text | nullable | AES-256-GCM encrypted. Set only if TOTP enabled. |
| `totpBackupCodes` | text | nullable | AES-256-GCM encrypted JSON array. 8 one-time codes. |
| `createdAt` | integer | NOT NULL | Unix ms |

### `sessions`
Active session tokens. Sessions carry identity and expiry only.

| Column | Type | Null | Notes |
|---|---|---|---|
| `id` | text PK | NOT NULL | 32-byte random base64url — the cookie value |
| `userId` | text FK | NOT NULL | → users.id |
| `expiresAt` | integer | NOT NULL | Unix ms. Hard expiry — 7 days from creation. |
| `createdAt` | integer | NOT NULL | Unix ms |

### `config`
Key-value store for dashboard settings.

| Column | Type | Null | Notes |
|---|---|---|---|
| `key` | text PK | NOT NULL | e.g. 'dashboardName', 'location', 'setupComplete' |
| `value` | text | NOT NULL | JSON-serialised value |
| `updatedAt` | integer | NOT NULL | Unix ms |

### `tabs`
Named dashboard pages. Unlimited pages for all users.

| Column | Type | Null | Notes |
|---|---|---|---|
| `id` | text PK | NOT NULL | UUID |
| `label` | text | NOT NULL | Display name, 1–40 chars |
| `order` | integer | NOT NULL | Sort order, 0-indexed |
| `createdAt` | integer | NOT NULL | Unix ms |

### `widgetInstances`
Placed widgets per tab. Per-instance config encrypted at rest.

| Column | Type | Null | Notes |
|---|---|---|---|
| `id` | text PK | NOT NULL | UUID |
| `widgetId` | text | NOT NULL | References WidgetDefinition.id (not a DB FK — registry is in-memory) |
| `tabId` | text FK | NOT NULL | → tabs.id ON DELETE CASCADE |
| `size` | text | NOT NULL | 'S' \| 'M' \| 'L' \| 'XL' |
| `positionX` | integer | NOT NULL | Grid column (0–11) |
| `positionY` | integer | NOT NULL | Grid row |
| `configEncrypted` | text | nullable | AES-256-GCM JSON blob. Non-credential config only. |
| `configSchemaVersion` | text | nullable | Widget semver at time of last save. Detects breaking schema changes on startup. |
| `createdAt` | integer | NOT NULL | Unix ms |
| `updatedAt` | integer | NOT NULL | Unix ms |

### `credentials`
Sensitive integration secrets. Always encrypted. Never returned to frontend.

| Column | Type | Null | Notes |
|---|---|---|---|
| `id` | text PK | NOT NULL | UUID |
| `key` | text | NOT NULL UNIQUE | e.g. 'pihole_token', 'rss_feed_1_auth' |
| `valueEncrypted` | text | NOT NULL | AES-256-GCM. base64(iv + authTag + ciphertext) |
| `createdAt` | integer | NOT NULL | Unix ms |
| `updatedAt` | integer | NOT NULL | Unix ms |

### `notifications`
DB-persisted notifications. Survive restarts (unlike the old in-memory queue).

| Column | Type | Null | Notes |
|---|---|---|---|
| `id` | text PK | NOT NULL | UUID |
| `type` | text | NOT NULL | 'update' \| 'security' \| 'widget-error' \| 'widget-warning' \| 'task' \| 'info' |
| `title` | text | NOT NULL | |
| `body` | text | NOT NULL | |
| `widgetId` | text | nullable | Links to widget if applicable |
| `read` | integer | NOT NULL | 0 \| 1 (SQLite boolean) |
| `timestamp` | integer | NOT NULL | Unix ms |

---

## plugin_data Table

Added in migration 0006. Used for plugin key-value persistence (e.g. Speedtest result history). Namespaced per plugin_id.

### `plugin_data`
Plugin key-value persistence. Namespaced per plugin_id. Composite PK.

| Column | Type | Null | Notes |
|---|---|---|---|
| `plugin_id` | text PK | NOT NULL | Reverse-DNS widget ID (e.g. "net.phavo.cpu"). Composite PK with key. |
| `key` | text PK | NOT NULL | Arbitrary string key. Composite PK with plugin_id. |
| `value` | text | nullable | JSON-serialised value. null = deleted. |

```ts
// ctx.store API (never raw SQL from plugins)
await ctx.store.set('lastRun', JSON.stringify(Date.now()))
await ctx.store.get('lastRun')        // → string | null
await ctx.store.delete('lastRun')

// Quota: 10MB per plugin_id enforced in ctx.store.set()
// → { ok: false, error: 'Plugin data quota exceeded (10MB)' } on breach
// Cleanup: plugin deletion cascades to all plugin_data rows for that plugin_id
```

---

## Encryption Model

> **Algorithm scope:**
> AES-256-GCM = data at rest (credentials, config exports).
> Ed25519 = digital signatures only (plugin signing).
> Argon2id = password hashing (one-way).
> PBKDF2-SHA256 = passphrase-protected config export key derivation only.

### Key Derivation (data at rest)

```
PHAVO_SECRET (env var / Docker secret)
  → HKDF-SHA256 (info: "phavo-aes-key") → 256-bit key
  → AES-256-GCM Key (CryptoKey object, cached in memory)
```

### Encrypt / Decrypt

```ts
async function encrypt(plaintext: string): Promise<string> {
  const iv  = crypto.getRandomValues(new Uint8Array(12))
  const enc = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, aesKey, encode(plaintext))
  return btoa([ ...iv, ...new Uint8Array(enc) ].join(','))  // iv(12) + ciphertext+authTag
}

async function decrypt(stored: string): Promise<string> {
  const bytes = new Uint8Array(atob(stored).split(',').map(Number))
  const iv  = bytes.slice(0, 12)
  const ct  = bytes.slice(12)
  const dec = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, aesKey, ct)
  return decode(dec)
}
```

### PHAVO_SECRET Bootstrap

```ts
// hooks.server.ts — on every server start
const secret = process.env.PHAVO_SECRET
  ?? await readOrCreateSecret(`${PHAVO_DATA_DIR}/secret.key`)
// If env var absent: generate 32-byte random, persist to volume.
// User-provided env var overrides — required if PHAVO_DATA_DIR is ephemeral.
```

---

## Migrations

Drizzle migrations run automatically on server start via `runMigrations()` in `hooks.server.ts`. Each migration is a pure SQL file. Always additive — no destructive DDL on existing columns.

| File | Change |
|---|---|
| `0001_spicy_clea.sql` | Core schema: users, sessions, config, tabs, widgetInstances, credentials |
| `0002_keen_luminals.sql` | Auth tables |
| `0003_auth_mode_rename.sql` | Legacy authMode migration retained in history (phavo-io/local paths) |
| `0004_notifications.sql` | Add notifications table (DB-persisted, survives restarts) |
| `0005_local_auth_offline_license.sql` | Local-only auth normalization (rebuild sessions) |
| `0006_plugin_data.sql` | Add plugin_data table (Speedtest history) |
| `0007_remove_tier.sql` | Remove tier column from sessions and drop the obsolete activation table |

---

## SvelteKit Shell

### `hooks.server.ts` — startup sequence

```
1. Connect libSQL client (createClient({ url: PHAVO_DB_PATH }))
2. Run Drizzle migrations
3. Bootstrap PHAVO_SECRET → derive AES key → cache in module scope
4. Detect platform (isDocker) → write installMethod to config table if not present
5. Register graceful shutdown (SIGTERM, SIGINT)
6. Schedule session pruning (expired sessions deleted hourly)
```

### `+layout.server.ts` — per-request

```ts
export const load: LayoutServerLoad = async ({ cookies, url }) => {
  const token   = cookies.get('phavo_session')
  const session = token ? await db.getSession(token) : null

  if (!session && url.pathname !== '/login' && !url.pathname.startsWith('/setup'))
    throw redirect(302, '/login')

  const config = await db.getConfig()
  if (session && !config.setupComplete && url.pathname !== '/setup')
    throw redirect(302, '/setup')

  // edition labeling is presentational only and not returned here
  return { loggedIn: !!session, dashboardName: config.dashboardName }
}
```

---

## Svelte Stores

All stores use Svelte 5 Runes (`$state`, `$derived`). No legacy writable/readable stores.

| Store file | Exports | Responsibility |
|---|---|---|
| `widgets.svelte.ts` | `widgetStore` | Widget instances, polling loop, state management (active/loading/error/stale/unconfigured) |
| `config.svelte.ts` | `configStore` | Dashboard config, settings mutations via `fetchWithCsrf()` |
| `session.svelte.ts` | `sessionStore` | Login state, username — no tier |
| `notifications.svelte.ts` | `notifStore` | Notification list, unread count, mark-read |
| `ai.svelte.ts` | `aiStore` | AI chat state, provider config, streaming response state |

### Widget polling pattern

Widgets with `refreshInterval > 0` are polled on a staggered schedule: each widget starts 1500ms after the previous one. This spreads CPU load on constrained hardware (Pi 3/4). Polling uses separate `timeouts[]` and `intervals[]` arrays so teardown can use `clearTimeout` for pending starts and `clearInterval` for running polls.

```ts
// widgets.svelte.ts — simplified
// polls start staggered (1500ms × index) to spread CPU load
const timeouts: ReturnType<typeof setTimeout>[] = []
const intervals: ReturnType<typeof setInterval>[] = []

activeDefinitions.forEach((def, i) => {
  const t = setTimeout(() => {
    intervals.push(setInterval(() => fetchWidgetData(def, true), def.refreshInterval))
  }, i * 1500)
  timeouts.push(t)
})

// teardown — clear pending starts separately from running polls
return () => {
  for (const id of timeouts) clearTimeout(id)
  for (const id of intervals) clearInterval(id)
}
```

Stale detection: if `Date.now() − lastUpdated > 2 × refreshInterval` on a failed poll, status becomes `stale`; otherwise `error`.

---

## Widget System

> **Open-source invariant:** the registry exposes the full widget manifest to every client. All widgets are available without edition or tier filtering.

### `WidgetDefinition` contract

```ts
interface WidgetDefinition {
  id:              string           // reverse-DNS: "net.phavo.cpu"
  name:            string
  description:     string
  version:         string           // semver
  author:          string           // "phavo" for built-ins
  category:        'system' | 'consumer' | 'integration' | 'utility' | 'custom'
  sizes:           ('S' | 'M' | 'L' | 'XL')[]
  configSchema?:   ZodSchema        // drives auto-rendered settings panel
  dataEndpoint:    string           // relative API path
  refreshInterval: number           // ms, minimum 1000
  permissions:     WidgetPermission[]
  notifications?:  { condition: string; type: Notification['type'] }[]
}
```

### Widget states

| State | Trigger | WidgetCard treatment |
|---|---|---|
| `active` | Data loaded successfully | Default surface — `var(--surface-card)` |
| `loading` | First fetch in progress | CSS skeleton shimmer (no JS) |
| `error` | Fetch or config error | `var(--error-container)` bg + icon + message |
| `unconfigured` | configSchema present, not filled | Muted surface + configure CTA button |
| `stale` | Data age > 2× refreshInterval | 2px top border stripe `var(--outline)` |

---

## BentoGrid

```css
/* packages/ui/src/BentoGrid.svelte */
.bento-grid {
  display: grid;
  grid-template-columns: repeat(12, 1fr);
  gap: var(--space-4);    /* 16px */
  align-items: start;
}
@media (max-width: 1024px) { .bento-grid { grid-template-columns: repeat(6, 1fr); } }
@media (max-width:  640px) { .bento-grid { grid-template-columns: 1fr; } }
```

| Size | colSpan | rowSpan | Content depth |
|---|---|---|---|
| S | 1 | 1 | Number + label only |
| M | 2 | 2 | Stat + progress + subtitle |
| L | 4 | 4 | Stat + chart or list |
| XL | 8 | 4 | Full data story + nebula glow + WishStar |

---

## Design Tokens

> **Iron rule:** Zero hardcoded hex/rgb/hsl values in `@phavo/ui`. Every color comes from a CSS token. No exceptions. Violations fail code review.

All tokens are defined in `packages/ui/src/theme.css` using a Tailwind v4 `@theme` block. Tokens are dual-valid — usable as utility classes (`bg-surface`) and CSS variables (`var(--color-surface)`).

### Surface tier order (bottom → top)

```css
--color-surface-dim        #0a0e1a  /* page background (deepest void) */
--color-surface            #0f131f  /* main content area */
--color-surface-low        #171b28  /* sidebar, secondary panels */
--color-surface-card       #1b1f2c  /* widget cards (base) */
--color-surface-high       #262a37  /* widget cards (hover / raised) */
--color-surface-bright     #353946  /* modals, glass overlays */
```

### Accent palette

```css
--color-primary            #dcc66e  /* Soft Gold — wordmark, hero stats, active nav */
--color-secondary          #3fc8a0  /* Teal — progress bars, system online */
--color-tertiary           #a89cf5  /* Cosmic Purple — nebula glows, gradient accents */
```

### Glassmorphism + Pi 3/4 fallback

```css
.glass {
  background: color-mix(in srgb, var(--color-surface-bright) 50%, transparent);
  backdrop-filter: blur(20px);
}
/* Pi 3/4 at 1x: no GPU backdrop-filter support */
@media (prefers-reduced-motion: reduce), (max-resolution: 1.5dppx) {
  .glass {
    background: var(--color-surface-high);
    backdrop-filter: none;
  }
}
```

### Typography scale

| Role | Size | Weight | Letter-spacing | Color |
|---|---|---|---|---|
| Page title | 32px | 300 | -0.02em | `--color-on-surface` |
| Hero stat | 48–64px | 300 | -0.03em | `--color-primary` |
| Stat unit | 20px | 400 | 0 | `--color-on-surface-var` |
| Section heading | 16px | 500 | -0.01em | `--color-on-surface` |
| Category label | 11px | 500 | 0.1em | `--color-on-surface-var` (ALL CAPS) |
| Body | 13px | 400 | 0 | `--color-on-surface-var` |
| Caption | 11px | 400 | 0 | `--color-outline` |

---

## AI Integration

AI integration uses the **Vercel AI SDK** (`ai` package) with a provider abstraction layer supporting multiple backends:

| Provider | Package | Notes |
|---|---|---|
| Ollama (local) | `ollama-ai-provider` | Fully offline. Base URL configurable via `PHAVO_OLLAMA_URL` env var. |
| OpenAI | `@ai-sdk/openai` | API key stored encrypted in credentials table. |
| Anthropic | `@ai-sdk/anthropic` | API key stored encrypted in credentials table. |

Streaming responses use `streamText()` from the AI SDK piped through Hono's `streamSSE` helper. The searchbar AI mode and the dedicated AI chat panel both consume the same streaming endpoint (`POST /api/v1/ai/chat`). Full responses are never buffered server-side — always streamed token-by-token.

> **Provider factory pattern:** `createOllama()` / `createOpenAI()` / `createAnthropic()` are used to instantiate providers with the user's configured credentials. Provider selection is stored in the `config` table.

---

## Notifications

DB-persisted (not in-memory). Survive restarts. Pushed via widgets and core modules using the `notify()` function.

```ts
// @phavo/types
export type NotifyFn = (n: Omit<Notification, 'id' | 'timestamp' | 'read'>) => Promise<void>

// Built-in triggers:
// Disk usage >90%         → widget-warning
// CPU temp >80°C          → widget-warning
// Pi-hole 3 failed polls  → widget-error
// RSS consistently failing→ widget-error
// Update available        → update
```

---

## Export / Import

### Export format (`.phavo`)

```json
{
  "version": 1,
  "exportedAt": "<iso8601>",
  "dashboardName": "My Dashboard",
  "tabs": [ ... ],
  "widgetInstances": [ ... ],        // config included, credentials excluded by default
  "credentials": "<aes-gcm-blob>"   // optional: user-passphrase encrypted
}
```

### Import edge cases

| Scenario | Behaviour |
|---|---|
| Import contains unknown widget IDs | Unknown widgets are skipped and returned as non-fatal warnings so the rest of the dashboard still imports cleanly. |
| Import contains outdated widget config | Widget imports, then lands in an unconfigured state until the user resaves the config with the current schema. |
| Import has credentials but no passphrase provided | Credentials blob ignored. Widgets show 'unconfigured' state. |
| Import file is malformed JSON | Client-side check — "Invalid file" error, no request sent |
| Import version mismatch | Version 1 always accepted. Future: migration applied or 400. |

---

## Update Mechanism

```ts
// GET /api/v1/system/update/check — user-initiated, 1h server-side cache
const res = await fetch('https://api.github.com/repos/phabioo/phavo/releases/latest')
const { tag_name, body } = await res.json()
return { updateAvailable: semverGt(tag_name, PHAVO_VERSION), version: tag_name, changelog: body }

// installMethod determines what the update panel shows:
// 'docker-compose' → Docker Compose pull snippet + optional one-click (if socket available)
// 'bun-direct'     → Bun CLI snippet
```

---

## Plugin System

### Plugin file structure (`.phwidget` ZIP)

```
my-widget.phwidget/
├── manifest.json      ← id, name, version, permissions, configSchema, ...
├── handler.ts         ← Hono route handler (server-side)
└── Widget.svelte      ← Svelte 5 component (frontend)
```

### Import allowlist (enforced at load time)

```ts
const ALLOWED_IMPORTS = [
  '@phavo/types', '@phavo/agent', '@phavo/plugin-sdk',
  'hono', 'zod',
  // Node/Bun built-ins: 'node:fs', 'node:path', 'node:crypto', etc.
]
// Static analysis at load time. Import outside allowlist → plugin rejected, error logged.
```

### Rate limits

```
POST /api/v1/plugins/upload   → 5 complete uploads per 10 minutes per session
plugin_data per plugin_id     → 10MB quota enforced server-side (planned, pending table implementation)
```

---

## Docker

```yaml
# docker-compose.yml (recommended)
services:
  phavo:
    image: phabioo/phavo:latest
    ports:
      - "3000:3000"
      - "3443:3443"
    volumes:
      - phavo-data:/data
    environment:
      - PHAVO_SECRET=<your-secret>    # optional — auto-generated if absent
    restart: unless-stopped
    # Optional: Docker socket for container restart widget + one-click updates
    # volumes: - /var/run/docker.sock:/var/run/docker.sock:ro

volumes:
  phavo-data:
```

| Property | Value |
|---|---|
| Base image | oven/bun:alpine |
| Architectures | linux/amd64, linux/arm64 (Raspberry Pi 3/4/5) |
| User | Non-root `phavo` system user |
| Filesystem | Read-only except /data volume |
| HEALTHCHECK | `GET /api/v1/system/health` (public endpoint) |
| Docker Hub | phabioo/phavo — tagged :VERSION + :latest on release |

---

## Environment Variables

| Variable | Default | Purpose |
|---|---|---|
| `PHAVO_DB_PATH` | /data/phavo.db | libSQL database path |
| `PHAVO_DATA_DIR` | /data | Parent for DB, certs, plugins, secret.key |
| `PHAVO_PORT` | 3000 | HTTP port |
| `PHAVO_HTTPS_PORT` | 3443 | HTTPS port |
| `PHAVO_SECRET` | auto-generated | AES key source. Optional — auto-generated and persisted on first start if not set. Override for Kubernetes or multi-instance deployments. |
| `PHAVO_TRUST_PROXY` | false | true when behind nginx/Caddy/Traefik — reads X-Forwarded-For for rate limiting |
| `PHAVO_PLUGIN_DEV_DIR` | unset | Hot-reload from local dir. Dev env only. |
| `PHAVO_OLLAMA_URL` | http://localhost:11434 | Ollama base URL for AI integration. |

> **Iron rule:** Never use `/data/` as a literal string anywhere in `packages/` or `apps/web/src/lib/server/`. Always read from `process.env.PHAVO_DATA_DIR`.

---

## Mobile / Responsive

| Element | Mobile (<640px) | Tablet (640–1024px) | Desktop (>1024px) |
|---|---|---|---|
| Sidebar | Hidden → bottom nav bar (tab icons) | Icon-only rail (64px), hover tooltip | Full sidebar (240px) with labels |
| Widget grid | 2 columns | 4-column BentoGrid | 8-column BentoGrid |
| Widget S/M | S=1col, M/L=full width | S=1col, M=2col, L=full width | S=1col, M=2col, L=4col |
| Header | Logo + bell + hamburger | Full header (clock, bell, avatar) | Full header |
| Settings | Tab list stacks vertically | Horizontal tab bar | Horizontal tab bar |
| Notification panel | Full-screen overlay | 380px right drawer | 380px right drawer |
| Widget drawer | Bottom sheet | Right drawer | Right drawer |

```
Touch targets:  min 44×44px (WCAG 2.1 AA)
Drag-and-drop:  disabled on mobile — tap-to-select + arrow buttons instead
Font size:      minimum 13px body, 11px labels
Horizontal scroll: never, tested at 375px (iPhone SE)
```

---

## Content Security Policy

Applied as HTTP response header on all dashboard pages via Hono middleware.

```
Content-Security-Policy:
  default-src 'self';
  script-src  'self';                  /* no inline scripts */
  style-src   'self';                  /* @fontsource served from self — no CDN */
  font-src    'self';                  /* Geist + Geist Mono via @fontsource, self-hosted */
  img-src     'self' data: https:;    /* data: for widget icons */
  connect-src 'self'
              https://api.open-meteo.com    /* weather */
              https://api.github.com;       /* update check only */
  frame-src   'none';
  object-src  'none';
  base-uri    'self';
  form-action 'self';
```

> Fonts are self-hosted via `@fontsource/geist` and `@fontsource/geist-mono`. The CSP does not allowlist `fonts.googleapis.com` or `fonts.gstatic.com` — Google Fonts CDN is never used.

---

## Rate Limits

In-memory counters (Phase 1, single instance). Per-IP for unauthenticated, per-session for authenticated endpoints.

> Set `PHAVO_TRUST_PROXY=true` when running behind nginx/Caddy/Traefik to read `X-Forwarded-For` for real client IP. Default: false (use socket IP directly).

| Endpoint | Limit | Window | Key |
|---|---|---|---|
| `POST /auth/login` | 10 req | 5 min | per IP + per account |
| `POST /auth/totp/*` | 5 req | 5 min | per IP |
| `POST /auth/*` (other) | 30 req | 1 min | per IP |
| Integration endpoints | 60 req | 1 min | per session |
| `GET /system/update/check` | 1 req | 1 hour | per session (cached) |
| `POST /config/import` | 5 req | 10 min | per session |
| `POST /config` | 20 req | 1 min | per session |
| Metric endpoints | 60 req | 1 min | per session |
| `POST /plugins/upload` | 5 uploads | 10 min | per session |

---

## Security Decisions Summary

| # | Decision | Rationale |
|---|---|---|
| 1 | Session token is 32-byte random base64url — no JWT, no payload | Nothing to decode, nothing to forge |
| 2 | All features available to all users — no tier enforcement | Open source (MIT), single Celestial Edition |
| 3 | Fonts self-hosted via @fontsource — CSP allowlists no external font CDN | Eliminates Google Fonts network dependency and privacy concern |
| 4 | Plugin import allowlist enforced by static analysis at load time | Malicious plugins rejected before any code executes |
| 5 | Plugin permissions declared in manifest.json — undeclared capabilities blocked at runtime | Defense-in-depth alongside import allowlist |
| 6 | No telemetry. No analytics. No outbound calls at runtime except user-initiated actions. | Privacy by design — zero data leaves the device unless user explicitly triggers it |
| 7 | SSRF guard on all user-provided URLs — private IP ranges, localhost, and cloud metadata endpoints blocked | Prevents widgets from being used to attack internal network |
| 8 | `execFile()` used for all subprocesses — never `exec()` | Prevents shell injection in update and Docker socket commands |

---

*Phavo Architecture Spec v3.2 · github.com/phabioo/phavo*
