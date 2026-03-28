# Phavo — Monorepo Scaffold Prompt
# For use with: Claude Code (Opus 4) or Cursor Agent
# Working directory: empty `phavo` GitHub repo, freshly cloned

---

You are scaffolding **Phavo** — a modular, self-hosted personal dashboard — from scratch. Build the complete monorepo as described below. Do not ask for confirmation between steps. Work through the entire scaffold in one session.

---

## Your Mandate

Build a production-ready monorepo skeleton. This means:
- All files and folders created, no placeholders skipped
- All configs valid and functional (no broken references)
- TypeScript compiles clean with zero errors
- `bun install` succeeds at the root
- `bun run dev` starts the SvelteKit dev server
- All packages correctly cross-reference each other

---

## 1. Repository Structure

Create the following structure exactly:

```
phavo/
├── apps/
│   ├── web/                    # SvelteKit — Phase 1 dashboard (build this fully)
│   ├── desktop/                # Tauri 2.0 — Phase 2 (scaffold only, README stub)
│   └── mobile/                 # Tauri Mobile — Phase 3 (scaffold only, README stub)
├── packages/
│   ├── ui/                     # @phavo/ui — Svelte 5 component library
│   ├── db/                     # @phavo/db — Drizzle ORM + libSQL
│   ├── types/                  # @phavo/types — shared TypeScript types & Zod schemas
│   └── agent/                  # @phavo/agent — Bun daemon for system metrics
├── .github/
│   └── workflows/
│       ├── ci.yml
│       └── docker.yml
├── turbo.json
├── package.json                # Bun workspaces root
├── biome.json
├── .gitignore
├── .env.example
├── docker-compose.yml
├── Dockerfile
└── SECURITY.md
```

---

## 2. Root Configuration

### `package.json` (root)
```json
{
  "name": "phavo",
  "private": true,
  "workspaces": ["apps/*", "packages/*"],
  "scripts": {
    "dev": "turbo run dev",
    "build": "turbo run build",
    "lint": "biome check .",
    "format": "biome format --write .",
    "typecheck": "turbo run typecheck",
    "clean": "turbo run clean"
  },
  "devDependencies": {
    "@biomejs/biome": "latest",
    "turbo": "latest",
    "typescript": "^5.4.0"
  },
  "engines": {
    "bun": ">=1.1.0"
  }
}
```

### `turbo.json`
Configure a pipeline with tasks: `dev`, `build`, `typecheck`, `lint`, `clean`. Set correct dependencies between packages (ui, db, types must build before apps/web).

### `biome.json`
Configure Biome with:
- TypeScript strict rules enabled
- Single quotes, 2-space indent, trailing commas
- Organised imports enabled
- No `any` allowed

### `tsconfig.base.json` (root)
```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "moduleResolution": "bundler",
    "target": "ES2022",
    "module": "ESNext",
    "lib": ["ES2022", "DOM"],
    "skipLibCheck": true,
    "noEmit": true
  }
}
```

### `.env.example`
```
# Phavo local instance configuration
PHAVO_SECRET=change-me-in-production          # Server-side encryption key for credentials at rest
PHAVO_PORT=3000
PHAVO_HTTPS_PORT=3443
PHAVO_DATA_DIR=/data

# TLS mode: self-signed | acme | custom
PHAVO_TLS_MODE=self-signed
PHAVO_DOMAIN=                                  # Required for ACME mode

# phavo.io licence validation (leave empty for fully offline Local tier)
PHAVO_IO_URL=https://phavo.io
```

---

## 3. Package: `@phavo/types`

**Path:** `packages/types/`  
**Purpose:** Shared TypeScript types, Zod schemas, and constants used by all other packages and apps.

### `package.json`
```json
{
  "name": "@phavo/types",
  "version": "0.0.1",
  "main": "./src/index.ts",
  "exports": { ".": "./src/index.ts" },
  "devDependencies": { "typescript": "^5.4.0" },
  "dependencies": { "zod": "^3.23.0" }
}
```

### Files to create:

**`src/widget.ts`** — Widget system types:
```typescript
import { z } from 'zod'

export const WidgetSize = z.enum(['S', 'M', 'L', 'XL'])
export type WidgetSize = z.infer<typeof WidgetSize>

export const WidgetCategory = z.enum(['system', 'consumer', 'integration', 'utility'])
export type WidgetCategory = z.infer<typeof WidgetCategory>

export const WidgetTier = z.enum(['free', 'standard'])
export type WidgetTier = z.infer<typeof WidgetTier>

export const WidgetDefinitionSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  category: WidgetCategory,
  tier: WidgetTier,
  minSize: z.object({ w: z.number(), h: z.number() }),
  defaultSize: z.object({ w: z.number(), h: z.number() }),
  sizes: z.array(WidgetSize),
  configSchema: z.unknown().optional(),
  dataEndpoint: z.string(),
  refreshInterval: z.number(),
})
export type WidgetDefinition = z.infer<typeof WidgetDefinitionSchema>

export const WidgetInstanceSchema = z.object({
  id: z.string(),
  widgetId: z.string(),
  tabId: z.string(),
  size: WidgetSize,
  position: z.object({ x: z.number(), y: z.number() }),
  config: z.record(z.unknown()).optional(),
})
export type WidgetInstance = z.infer<typeof WidgetInstanceSchema>
```

**`src/config.ts`** — Dashboard config types:
```typescript
import { z } from 'zod'

export const TabSchema = z.object({
  id: z.string(),
  label: z.string(),
  order: z.number(),
})
export type Tab = z.infer<typeof TabSchema>

export const DashboardConfigSchema = z.object({
  setupComplete: z.boolean().default(false),
  dashboardName: z.string().default('My Dashboard'),
  tier: z.enum(['free', 'standard', 'local']).default('free'),
  tabs: z.array(TabSchema).default([]),
  location: z.object({
    name: z.string(),
    latitude: z.number(),
    longitude: z.number(),
  }).optional(),
})
export type DashboardConfig = z.infer<typeof DashboardConfigSchema>
```

**`src/auth.ts`** — Auth types:
```typescript
import { z } from 'zod'

export const AuthMode = z.enum(['phavio-io', 'local'])
export type AuthMode = z.infer<typeof AuthMode>

export const SessionSchema = z.object({
  userId: z.string(),
  tier: z.enum(['free', 'standard', 'local']),
  authMode: AuthMode,
  validatedAt: z.number(),         // unix timestamp
  graceUntil: z.number().optional(), // unix timestamp for offline grace
})
export type Session = z.infer<typeof SessionSchema>
```

**`src/api.ts`** — API response envelope:
```typescript
export type ApiSuccess<T> = { ok: true; data: T }
export type ApiError = { ok: false; error: string }
export type ApiResponse<T> = ApiSuccess<T> | ApiError

export function ok<T>(data: T): ApiSuccess<T> {
  return { ok: true, data }
}

export function err(error: string): ApiError {
  return { ok: false, error }
}
```

**`src/index.ts`** — Re-export everything:
```typescript
export * from './widget'
export * from './config'
export * from './auth'
export * from './api'
```

---

## 4. Package: `@phavo/db`

**Path:** `packages/db/`  
**Purpose:** Drizzle ORM schema + libSQL client. Single source of truth for all database interactions.

### `package.json`
```json
{
  "name": "@phavo/db",
  "version": "0.0.1",
  "main": "./src/index.ts",
  "exports": { ".": "./src/index.ts" },
  "dependencies": {
    "@phavo/types": "workspace:*",
    "@libsql/client": "^0.6.0",
    "drizzle-orm": "^0.30.0"
  },
  "devDependencies": {
    "drizzle-kit": "^0.21.0",
    "typescript": "^5.4.0"
  }
}
```

### Files to create:

**`src/schema.ts`** — Full Drizzle schema:

Create tables for:
- `users` — id, email (nullable for local), passwordHash (nullable for phavo.io), authMode, createdAt
- `sessions` — id, userId, tier, authMode, validatedAt, graceUntil, expiresAt
- `config` — key, value (JSON), updatedAt (single-row KV store pattern)
- `tabs` — id, label, order, createdAt
- `widgetInstances` — id, widgetId, tabId, size, positionX, positionY, configEncrypted (TEXT, nullable), createdAt, updatedAt
- `credentials` — id, key (e.g. 'pihole_token', 'rss_feed_1_auth'), valueEncrypted (TEXT), createdAt, updatedAt
- `licenseActivation` — id, licenseKey, tier, activatedAt, instanceIdentifier

Use proper Drizzle column types (`text`, `integer`, `blob`). All tables use `text('id').$defaultFn(() => crypto.randomUUID())` as primary key.

**`src/client.ts`** — libSQL client factory:
```typescript
import { createClient } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'
import * as schema from './schema'

export function createDb(url: string = 'file:/data/phavo.db') {
  const client = createClient({ url })
  return drizzle(client, { schema })
}

export type Db = ReturnType<typeof createDb>
```

**`src/crypto.ts`** — AES-256-GCM encryption helpers for credentials at rest:
```typescript
// Encrypt and decrypt using the PHAVO_SECRET env var as the key
// Use Node.js/Bun crypto module
// Functions: encrypt(plaintext: string): string, decrypt(ciphertext: string): string
// Format: base64(iv + authTag + ciphertext)
```

Implement fully working encrypt/decrypt using `crypto.subtle` (Web Crypto API, available in Bun).

**`src/migrations/`** — Create an initial migration file using drizzle-kit conventions.

**`drizzle.config.ts`** — Drizzle Kit config pointing to the schema and libSQL.

**`src/index.ts`** — Export `createDb`, `schema`, `encrypt`, `decrypt`.

---

## 5. Package: `@phavo/agent`

**Path:** `packages/agent/`  
**Purpose:** Bun daemon that collects system metrics. Runs as a background process within the Docker container alongside the SvelteKit app. Each metric is a separate async function.

### `package.json`
```json
{
  "name": "@phavo/agent",
  "version": "0.0.1",
  "main": "./src/index.ts",
  "exports": { ".": "./src/index.ts" },
  "dependencies": {
    "@phavo/types": "workspace:*",
    "systeminformation": "^5.22.0"
  }
}
```

### Files to create:

**`src/metrics/cpu.ts`**
```typescript
import si from 'systeminformation'

export interface CpuMetrics {
  usage: number           // overall %
  cores: number[]         // per-core %
  loadAvg: [number, number, number]  // 1, 5, 15 min
  speed: number           // GHz
  model: string
}

export async function getCpu(): Promise<CpuMetrics> {
  // implement using systeminformation
}
```

**`src/metrics/memory.ts`** — `MemoryMetrics`: used, total, free, swap (used/total)

**`src/metrics/disk.ts`** — `DiskMetrics[]`: per-mount: fs, mount, used, total, usePercent, readSpeed, writeSpeed

**`src/metrics/network.ts`** — `NetworkMetrics`: upload speed (bytes/s), download speed, total sent, total received

**`src/metrics/temperature.ts`** — `TemperatureMetrics`: cpu temp (nullable — not all systems expose this), unit

**`src/metrics/uptime.ts`** — `UptimeMetrics`: seconds, formatted human string (e.g. "3 days, 4 hours")

**`src/metrics/weather.ts`** — `WeatherMetrics`: fetch from Open-Meteo API. Accept latitude + longitude as parameters. Return: current temp, condition code, wind speed, humidity, 5-day forecast array. No API key required. Handle network errors gracefully.

**`src/metrics/pihole.ts`** — `PiholeMetrics`: accept url + token. Fetch Pi-hole v6 API. Return: total queries, blocked, percent blocked, domains on blocklist, status (enabled/disabled). Also export `setPiholeStatus(url, token, enabled: boolean)`.

**`src/metrics/rss.ts`** — `RssFeedItem[]`: accept array of feed configs `{url, auth?: {type: 'basic' | 'bearer', value: string}}`. Fetch and parse RSS/Atom XML server-side. Return normalised items: title, link, source, publishedAt. Handle errors per-feed (return partial results, mark failed feeds).

**`src/index.ts`** — Export all metric functions.

---

## 6. Package: `@phavo/ui`

**Path:** `packages/ui/`  
**Purpose:** Svelte 5 component library. All components use only CSS custom properties — never hardcoded color values. This is the iron rule enforced throughout.

### `package.json`
```json
{
  "name": "@phavo/ui",
  "version": "0.0.1",
  "main": "./src/index.ts",
  "exports": { ".": "./src/index.ts" },
  "peerDependencies": { "svelte": "^5.0.0" },
  "devDependencies": {
    "svelte": "^5.0.0",
    "typescript": "^5.4.0"
  }
}
```

### Files to create:

**`src/theme.css`** — The single source of truth for all design tokens:
```css
/* IRON RULE: Every component in @phavo/ui uses ONLY these variables.
   Zero hardcoded hex values anywhere in component files. */

:root[data-theme="dark"] {
  /* Backgrounds */
  --color-bg-base:        #1a1918;
  --color-bg-surface:     #222120;
  --color-bg-elevated:    #2a2928;
  --color-bg-hover:       #2e2d2b;

  /* Borders */
  --color-border:         #3a3936;
  --color-border-subtle:  #2e2d2b;
  --color-border-strong:  #4a4845;

  /* Text */
  --color-text-primary:   #d4d2c8;
  --color-text-secondary: #888780;
  --color-text-muted:     #5f5e5a;
  --color-text-inverse:   #1a1918;

  /* Accent (teal) */
  --color-accent:         #0f6e56;
  --color-accent-subtle:  #085041;
  --color-accent-hover:   #1a8a6a;
  --color-accent-text:    #9fe1cb;

  /* Semantic */
  --color-danger:         #993c1d;
  --color-danger-subtle:  #4a1b0c;
  --color-warning:        #854f0b;
  --color-warning-subtle: #412402;
  --color-success:        #0f6e56;

  /* Typography */
  --font-ui:   'Inter', -apple-system, sans-serif;
  --font-mono: 'JetBrains Mono', 'Fira Code', monospace;

  /* Radii */
  --radius-sm: 6px;
  --radius-md: 10px;
  --radius-lg: 14px;
  --radius-xl: 20px;

  /* Spacing scale */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;

  /* Shadows — flat design, minimal */
  --shadow-sm: 0 1px 2px rgba(0,0,0,0.4);
  --shadow-md: 0 2px 8px rgba(0,0,0,0.5);

  /* Sidebar width */
  --sidebar-width: 220px;
  --sidebar-collapsed-width: 56px;

  /* Widget grid */
  --grid-cols: 12;
  --grid-gap: 12px;
}

/* Base reset */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

body {
  font-family: var(--font-ui);
  background: var(--color-bg-base);
  color: var(--color-text-primary);
  font-size: 14px;
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
}

/* Monospace for all data values */
.mono, .metric { font-family: var(--font-mono); }
```

**`src/components/`** — Create these Svelte 5 components using Runes (`$state`, `$props`, `$derived`). All use only CSS variables from theme.css. No Tailwind in component files — pure CSS with tokens.

- **`Button.svelte`** — variants: primary, secondary, ghost, danger. sizes: sm, md, lg.
- **`Card.svelte`** — base card wrapper. Props: padding, elevated (uses --color-bg-elevated).
- **`Badge.svelte`** — variants: default, accent, danger, warning, success.
- **`Input.svelte`** — text input. Props: label, placeholder, error, type.
- **`Select.svelte`** — styled select dropdown.
- **`Switch.svelte`** — toggle switch. Props: checked, label, onchange.
- **`Modal.svelte`** — accessible modal with backdrop. Slot-based.
- **`Sidebar.svelte`** — collapsible sidebar. Props: collapsed. Emits: toggle. Fixed position, uses --sidebar-width.
- **`Header.svelte`** — top bar with clock, dashboard name, update badge slot, user menu slot.
- **`WidgetCard.svelte`** — wrapper for all widgets. Props: title, size (S/M/L/XL), loading, error. Slot for widget content.
- **`Skeleton.svelte`** — animated loading skeleton for widget cards.
- **`ProgressBar.svelte`** — horizontal progress bar. Props: value (0-100), color (accent/danger/warning).
- **`Tabs.svelte`** — horizontal tab navigation. Props: tabs[], activeTab, onchange.
- **`Tooltip.svelte`** — simple CSS tooltip wrapper.
- **`UpgradeBanner.svelte`** — shown when Free user hits a paid feature. Props: feature, price.

**`src/icons/`** — Create `icons.ts` with inline SVG strings for all icons used in the dashboard:
`cpu`, `memory`, `disk`, `network`, `temperature`, `uptime`, `weather`, `pihole`, `rss`, `links`, `spotify`, `settings`, `plus`, `close`, `chevronLeft`, `chevronRight`, `chevronDown`, `menu`, `logout`, `shield`, `refresh`, `download`, `check`, `alert`, `info`, `external`, `drag`

Each icon is a function that returns an SVG string with `width="16" height="16" viewBox="0 0 16 16"`.

**`src/index.ts`** — Export all components and icons.

---

## 7. App: `apps/web` — SvelteKit Dashboard

**Path:** `apps/web/`  
**Purpose:** The Phase 1 web dashboard. SvelteKit with server-side Hono API, Better Auth, Drizzle.

### `package.json`
```json
{
  "name": "@phavo/web",
  "version": "0.0.1",
  "scripts": {
    "dev": "vite dev",
    "build": "vite build",
    "preview": "vite preview",
    "typecheck": "svelte-check --tsconfig ./tsconfig.json"
  },
  "dependencies": {
    "@phavo/ui": "workspace:*",
    "@phavo/db": "workspace:*",
    "@phavo/types": "workspace:*",
    "@phavo/agent": "workspace:*",
    "better-auth": "^1.0.0",
    "hono": "^4.3.0",
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "@sveltejs/adapter-node": "^5.0.0",
    "@sveltejs/kit": "^2.5.0",
    "svelte": "^5.0.0",
    "svelte-check": "^3.7.0",
    "vite": "^5.2.0"
  }
}
```

### SvelteKit Configuration

**`svelte.config.js`** — Use `@sveltejs/adapter-node`. Enable Svelte 5 runes.

**`vite.config.ts`** — Standard SvelteKit Vite config. Add alias: `$lib` → `./src/lib`.

### File Structure

```
apps/web/src/
├── lib/
│   ├── server/
│   │   ├── db.ts          # singleton Db instance
│   │   ├── auth.ts        # Better Auth setup
│   │   ├── agent.ts       # re-exports from @phavo/agent with caching
│   │   ├── license.ts     # licence validation + grace period logic
│   │   ├── crypto.ts      # re-export from @phavo/db/crypto
│   │   └── widget-registry.ts  # auto-discovers and registers widgets
│   ├── stores/
│   │   ├── config.svelte.ts    # dashboard config store (Svelte 5 runes)
│   │   ├── session.svelte.ts   # auth session store
│   │   └── widgets.svelte.ts   # widget instances store
│   ├── i18n/
│   │   └── en.json        # ALL user-facing strings — nothing hardcoded in components
│   └── utils/
│       ├── format.ts      # bytes, duration, percentage formatters
│       └── time.ts        # uptime formatter, relative time
├── routes/
│   ├── +layout.svelte     # root layout: load theme.css, Inter + JetBrains Mono fonts
│   ├── +layout.server.ts  # check auth session on every request
│   ├── +page.svelte       # dashboard (redirect to /setup if !setupComplete)
│   ├── setup/
│   │   ├── +page.svelte   # setup wizard (quick + full mode)
│   │   └── +page.server.ts
│   ├── settings/
│   │   └── +page.svelte   # settings page
│   ├── auth/
│   │   ├── login/
│   │   │   └── +page.svelte
│   │   └── callback/
│   │       └── +server.ts  # phavo.io OAuth callback
│   └── api/
│       └── v1/
│           └── [...path]/
│               └── +server.ts   # Hono API handler (all /api/v1/* routes)
└── app.html
```

### Key Implementation Details

**`src/lib/server/widget-registry.ts`**

Create a `WidgetRegistry` class that:
- Holds a `Map<string, WidgetDefinition>` of all registered widgets
- Has a `register(def: WidgetDefinition)` method
- Has a `getManifest()` method that returns all widget definitions
- Has a `getByTier(tier: 'free' | 'standard')` method

Then create and register all 10 launch widget definitions:

```typescript
// Free tier
registry.register({ id: 'cpu', name: 'CPU', tier: 'free', category: 'system',
  sizes: ['S','M','L'], defaultSize: {w:4,h:3}, minSize: {w:2,h:2},
  dataEndpoint: '/api/v1/cpu', refreshInterval: 5000, ... })

// ... repeat for memory, disk, network, temperature, uptime, weather

// Standard tier
registry.register({ id: 'pihole', name: 'Pi-hole', tier: 'standard', category: 'integration',
  sizes: ['S','M','L'], defaultSize: {w:4,h:3}, minSize: {w:2,h:2},
  dataEndpoint: '/api/v1/pihole', refreshInterval: 30000,
  configSchema: z.object({ url: z.string().url(), token: z.string() }), ... })

// ... register rss, links
```

**`src/routes/api/v1/[...path]/+server.ts`** — Hono handler:

```typescript
import { Hono } from 'hono'
import { ok, err } from '@phavo/types'
import { getCpu, getMemory, getDisk, getNetwork, getTemperature, getUptime, getWeather, getPihole, getRss } from '@phavo/agent'
import { cache } from '$lib/server/agent'
import { registry } from '$lib/server/widget-registry'

const app = new Hono().basePath('/api/v1')

// Widget manifest
app.get('/widgets', (c) => c.json(ok(registry.getManifest())))

// Config
app.get('/config', async (c) => { /* read from db */ })
app.post('/config', async (c) => { /* validate + write to db */ })

// Auth
app.post('/auth/login', async (c) => { /* handle phavo.io or local login */ })
app.post('/auth/logout', async (c) => { /* invalidate session */ })
app.get('/auth/session', async (c) => { /* return current session */ })

// System metrics (with 5s cache via agent.ts)
app.get('/cpu', async (c) => c.json(ok(await cache('cpu', 5000, getCpu))))
app.get('/memory', async (c) => c.json(ok(await cache('memory', 5000, getMemory))))
app.get('/disk', async (c) => c.json(ok(await cache('disk', 5000, getDisk))))
app.get('/network', async (c) => c.json(ok(await cache('network', 5000, getNetwork))))
app.get('/temperature', async (c) => c.json(ok(await cache('temperature', 10000, getTemperature))))
app.get('/uptime', async (c) => c.json(ok(await cache('uptime', 30000, getUptime))))

// Integration widgets
app.get('/weather', async (c) => { /* get location from config, call getWeather */ })
app.get('/pihole', async (c) => { /* get credentials from db (decrypted), call getPihole */ })
app.post('/pihole/test', async (c) => { /* test pihole connection */ })
app.get('/rss', async (c) => { /* get feed configs from db, call getRss */ })
app.get('/links', async (c) => { /* get links from db */ })

// Update
app.get('/update/check', async (c) => { /* check GitHub releases API, cache 1h */ })

export const GET = (req: Request) => app.fetch(req)
export const POST = (req: Request) => app.fetch(req)
```

**`src/lib/server/auth.ts`** — Better Auth setup:

Configure Better Auth with:
- Two providers: local (email/password with Argon2id) and a custom phavo.io OAuth provider
- Session stored in libSQL via the Drizzle adapter
- HttpOnly + Secure + SameSite=Strict session cookies
- Session idle timeout: 7 days
- Rate limiting: 10 attempts → 5-minute lockout (use a simple in-memory counter for Phase 1)
- TOTP/2FA plugin enabled (optional for users)

**`src/lib/server/license.ts`** — Licence validation:

```typescript
// Validates against phavo.io for Standard/Free
// Returns tier: 'free' | 'standard' | 'local'
// Implements 72h offline grace period for Standard, 24h for Free
// For Local tier: reads instanceIdentifier from Docker volume, validates once on activation
export async function validateLicense(licenseKey: string, authMode: 'phavo-io' | 'local'): Promise<{
  valid: boolean
  tier: 'free' | 'standard' | 'local'
  graceUntil?: number
}>
```

**`src/lib/server/agent.ts`** — Metric caching layer:

```typescript
// Simple in-memory cache with TTL
// cache(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T>
const cache = new Map<string, { value: unknown; expiresAt: number }>()

export async function cached<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const hit = cache.get(key)
  if (hit && Date.now() < hit.expiresAt) return hit.value as T
  const value = await fn()
  cache.set(key, { value, expiresAt: Date.now() + ttlMs })
  return value
}
```

### Routes Implementation

**`src/routes/+layout.svelte`**
- Import `theme.css` from `@phavo/ui`
- Load Inter and JetBrains Mono from Google Fonts (or self-hosted via `@fontsource`)
- Set `data-theme="dark"` on `<html>` element
- Render `<slot />`

**`src/routes/+layout.server.ts`**
- On every request: check for valid session cookie
- If no session and path is not `/auth/login` or `/setup`: redirect to `/auth/login`
- If session but `setupComplete: false`: redirect to `/setup`
- Pass session and tier to all child routes via `locals`

**`src/routes/+page.svelte`** — Main dashboard:
- Render `<Sidebar>` + `<Header>` + widget grid
- Widget grid: CSS grid, 12 columns, widgets snap to S/M/L/XL sizes
- Widget instances loaded from db via page server load function
- Widget data polled client-side via `setInterval` → `fetch('/api/v1/{widgetId}')`
- Show `<WidgetCard>` with `<Skeleton>` while loading

**`src/routes/setup/+page.svelte`** — Setup wizard:
- Step indicator at top
- Implements both Quick Setup (3 steps) and Full Setup (10 steps)
- Step 1: Mode selection — Quick or Full
- Quick: Auth → Location (skippable) → Done
- Full: Branding → Tier select → Auth → Name → Location → Tabs → Widget select → Widget-to-tab → Config → Done
- All strings from `en.json`
- On Done: `POST /api/v1/config` with completed config

**`src/routes/settings/+page.svelte`** — Settings:
- Tabs: General, Widgets, Tabs, Account, Security, About
- Each tab is a separate component in `settings/` subfolder

### i18n: `src/lib/i18n/en.json`

Create comprehensive translation file with keys for every user-facing string:
```json
{
  "setup": {
    "welcome": { "title": "Welcome to Phavo", "subtitle": "..." },
    "quickSetup": "Quick Setup",
    "fullSetup": "Full Setup",
    "steps": { ... }
  },
  "dashboard": { "addWidget": "Add widget", ... },
  "widgets": {
    "cpu": { "name": "CPU", "description": "..." },
    "memory": { "name": "Memory", ... },
    ...
  },
  "auth": { "login": "Sign in", "logout": "Sign out", ... },
  "upgrade": {
    "prompt": "Upgrade to Standard to unlock all widgets — €7.99 one-time.",
    "tabLimit": "Upgrade to Standard for unlimited tabs."
  },
  "errors": { ... },
  "settings": { ... }
}
```

---

## 8. App: `apps/desktop` (Stub)

**Path:** `apps/desktop/`

Create only:
- `README.md` — "Phase 2: Tauri 2.0 desktop app. Not yet implemented."
- `package.json` with name `@phavo/desktop` and no scripts

---

## 9. App: `apps/mobile` (Stub)

**Path:** `apps/mobile/`

Create only:
- `README.md` — "Phase 3: Tauri Mobile. Not yet implemented."
- `package.json` with name `@phavo/mobile` and no scripts

---

## 10. Docker

**`Dockerfile`** — Multi-stage build:

```dockerfile
# Stage 1: build
FROM oven/bun:1-alpine AS builder
WORKDIR /app
COPY . .
RUN bun install --frozen-lockfile
RUN bun run build

# Stage 2: production
FROM oven/bun:1-alpine AS runner
# Create non-root user
RUN addgroup -S phavo && adduser -S phavo -G phavo
WORKDIR /app
# Copy only what's needed
COPY --from=builder /app/apps/web/build ./build
COPY --from=builder /app/node_modules ./node_modules
# Set permissions
RUN chown -R phavo:phavo /app
USER phavo
# Data volume for database and config
VOLUME ["/data"]
EXPOSE 3000 3443
CMD ["bun", "run", "./build/index.js"]
```

**`docker-compose.yml`**:
```yaml
version: '3.8'
services:
  phavo:
    image: getphavo/phavo:latest
    build: .
    ports:
      - "3000:3000"
      - "3443:3443"
    volumes:
      - phavo-data:/data
    environment:
      - PHAVO_SECRET=${PHAVO_SECRET:-change-me}
      - PHAVO_TLS_MODE=${PHAVO_TLS_MODE:-self-signed}
      - PHAVO_DOMAIN=${PHAVO_DOMAIN:-}
    restart: unless-stopped
    read_only: true
    tmpfs:
      - /tmp
volumes:
  phavo-data:
```

---

## 11. CI/CD

**`.github/workflows/ci.yml`**:
```yaml
name: CI
on: [push, pull_request]
jobs:
  ci:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4  # pin to SHA in production
      - uses: oven-sh/setup-bun@v1
      - run: bun install --frozen-lockfile
      - run: bun run typecheck
      - run: bun run lint
      - run: bun audit
```

**`.github/workflows/docker.yml`**:
```yaml
name: Docker
on:
  push:
    tags: ['v*']
jobs:
  docker:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: docker/setup-buildx-action@v3
      - uses: docker/setup-qemu-action@v3  # for arm64
      - name: Build and push
        uses: docker/build-push-action@v5
        with:
          platforms: linux/amd64,linux/arm64
          push: true
          tags: |
            getphavo/phavo:latest
            getphavo/phavo:${{ github.ref_name }}
```

---

## 12. Security Files

**`SECURITY.md`**:
```markdown
# Security Policy

## Reporting a Vulnerability

Please report security vulnerabilities to **security@phavo.io**.

A PGP key is available at phavo.io/security for encrypted reports.

**Response commitment:**
- Acknowledgement within 48 hours
- Status update within 7 days
- Fix timeline communicated within 14 days

We coordinate critical vulnerabilities via GitHub Security Advisories before public disclosure.

We will not pursue legal action against researchers acting in good faith.

## Supported Versions

| Version | Supported |
|---------|-----------|
| Latest  | ✅        |
| < latest | ❌       |
```

**`.gitignore`**:
```
node_modules/
.svelte-kit/
build/
dist/
*.db
*.db-wal
*.db-shm
.env
.env.local
/data/
*.local
.DS_Store
```

---

## 13. Iron Rules to Enforce Throughout

These must be true everywhere in the codebase:

1. **No hardcoded colors** in any `.svelte` or `.css` file inside `@phavo/ui` or `apps/web`. Only `var(--color-*)` references.

2. **No `any` type** anywhere. TypeScript strict mode must pass.

3. **All user-facing strings** come from `en.json`. No string literals in Svelte templates.

4. **Credentials never hit the frontend.** Pi-hole tokens, RSS passwords, and all sensitive values are only accessed in `+server.ts` files or `src/lib/server/` — never in `+page.svelte` or `+page.ts`.

5. **All API responses** use the `{ ok: true, data: T }` / `{ ok: false, error: string }` envelope from `@phavo/types`.

6. **Widget data endpoints** always return data even when partially unavailable (e.g. temperature returns `null` if not accessible, not an error).

7. **Every `+server.ts`** checks for a valid session before processing any request, except `/api/v1/auth/login`.

---

## 14. Final Verification Checklist

After building the entire scaffold, verify:

- [ ] `bun install` succeeds at root with no errors
- [ ] `bun run typecheck` passes across all packages and apps
- [ ] `bun run lint` reports zero errors
- [ ] `bun run dev` starts the SvelteKit dev server at `localhost:3000`
- [ ] `GET /api/v1/widgets` returns a valid JSON manifest of all 10 widgets
- [ ] `GET /api/v1/cpu` returns a valid CpuMetrics response
- [ ] `src/lib/i18n/en.json` contains keys for every hardcoded string you encounter
- [ ] No `#` hex color values appear in any `.svelte` or `.css` file in `@phavo/ui` or `apps/web`
- [ ] No `any` type appears in any `.ts` or `.svelte` file
- [ ] `docker build .` succeeds (or at minimum the Dockerfile is syntactically valid)

---

*This scaffold is the foundation for Phavo v1.0. Build it completely and correctly. Do not abbreviate or skip sections.*
