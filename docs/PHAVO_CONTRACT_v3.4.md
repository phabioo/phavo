# PHAVO AI ENGINEERING CONTRACT v3.4

> Read CLAUDE.md alongside this file before every session.
> If conflict between this contract and actual repo code: **CODE WINS**.

---

## SYSTEM CONTEXT

Monorepo: Turborepo + Bun Workspaces

```
apps/web/            SvelteKit + Hono API
packages/agent/      @phavo/agent — metric functions (library)
packages/db/         @phavo/db — Drizzle + libSQL + crypto
packages/types/      @phavo/types — shared types, Zod schemas
packages/ui/         @phavo/ui — shared UI shells (NOT widgets)
packages/plugin-sdk/ @phavo/plugin-sdk — internal SDK (Phase 1); npm publish Phase 4
```

Domain: **phavo.net** (not phavo.io)
DB authMode values: `'phavo-net'` | `'local'` (migrated from `'phavo-io'`)
Tiers: `'standard'` (free, €0) | `'pro'` (€8.99, launch €5.99) | `'local'` (€24.99, launch €16.99)
Open source: deferred to post-v1.0; codebase is closed source at launch
Ed25519: used for **signing only** (JWT verification, plugin signing, Tauri updates) — never for encryption

---

## CRITICAL ARCHITECTURE TRUTHS

### 1. API USES ROUTE MODULES (after god-file split)

API routes live in route modules under:
```
apps/web/src/lib/server/routes/
  auth.ts          — POST /auth/login, /totp, /logout etc.
  metrics.ts       — GET /cpu, /memory, /disk, /system etc.
  integrations.ts  — GET /pihole, /rss, /links, /ai/chat
  widgets.ts       — GET /widgets, POST/DELETE /widget-instances etc.
  tabs.ts          — GET/POST/PATCH/DELETE /tabs
  config.ts        — GET/POST /config, export/import
  ai.ts            — POST /ai/chat, GET /ai/status etc.
  license.ts       — POST /license/activate, /deactivate
  notifications.ts — GET /notifications, POST /notifications/read
  system.ts        — GET /health, /about, /update/check, POST /update/apply
  plugins.ts       — GET /plugins, POST /plugins/upload, DELETE /plugins/:id etc.
```

The orchestrator `apps/web/src/routes/api/v1/[...path]/+server.ts`
is <150 lines — only app creation, global middleware, and `registerXxxRoutes(app)` calls.

- Add new routes to the appropriate module file
- Never add route handlers directly to +server.ts
- Each module exports `registerXxxRoutes(app: Hono<...>): void`

### 2. ALL WIDGETS ARE PLUGINS

Every widget — built-in and third-party — is a `.phwidget` plugin bundle.

**First-party plugins** (all 10 launch widgets):
- Location: `/app/builtin-plugins/` in the Docker image (read-only)
- Signed with Phavo Ed25519 key at build time
- Loaded at server start via `registry.registerPlugin()`
- Cannot be deleted by users

**User plugins:**
- Location: `/data/plugins/*.phwidget` in the Docker volume
- Uploaded via `POST /api/v1/plugins/upload` (two-phase: validate → confirm)
- Hot-reload on upload — no server restart needed
- Permission approval required before activation

```
plugin.phwidget (ZIP)
├── manifest.json    — id, name, version, schemaVersion, phavoRequires, author,
                       category, tier, sizes, permissions, configSchema,
                       dataEndpoint, signature
├── widget.js        — pre-compiled Svelte component (no runtime compiler)
└── handler.ts       — Hono route handler
```

There is NO `packages/ui/src/widgets/` folder. Do not create it.
Shared UI shells (WidgetCard, WidgetDrawer, SchemaRenderer, Icon) live in:
```
packages/ui/src/components/
```

### 3. WIDGET DATA FLOW IS STORE-DRIVEN

```
PluginRegistry → API endpoint → widgets.svelte.ts store → +page.svelte → widget.js component
```
Widget components are presentational only. They receive typed props. They never fetch data.

### 4. SESSION IS THE ONLY TIER SOURCE

Tier comes from the `sessions` DB table via `authMiddleware`.
Never from config. Never from the frontend.
TIER_RANK: `{ standard: 0, pro: 1, local: 2 }`

### 5. PLUGIN DATA PERSISTENCE IS KEY-VALUE ONLY

Plugins store persistent data via `ctx.store.set/get/delete()` — backed by the `plugin_data` table.
Plugins cannot create new DB tables. Never use raw Drizzle from a plugin handler.

---

## HARD RULES

### API RESPONSES
```typescript
// ✅ VALID
return c.json(ok(data))
return c.json(err('message'), 400)

// ❌ INVALID
return c.json({ success: true })
return c.json({ data })
```

### AUTH MIDDLEWARE
```typescript
// ✅ VALID
app.get('/resource', requireSession(), async (c) => { ... })
app.get('/premium', requireTier('pro'), async (c) => { ... })

// ❌ INVALID
app.get('/resource', async (c) => {
  const cookie = c.req.header('Cookie') // manual auth check
})
```

### TIER ENFORCEMENT
```typescript
// ✅ VALID
const session = c.get('session')
session.tier  // 'standard' | 'pro' | 'local'

// ❌ INVALID
config.tier
entries.tier
data.tier // from config table
```

### CREDENTIALS
```typescript
// ✅ VALID — encrypt and store in credentials table
await db.insert(schema.credentials).values({
  key: 'pihole_token',
  valueEncrypted: await encrypt(token)
})

// ❌ INVALID — credentials in configEncrypted or config table
configEncrypted: JSON.stringify({ token: 'plaintext' })
```

### CSRF — ALL MUTATION REQUESTS
```typescript
// ✅ VALID — all non-GET frontend calls use fetchWithCsrf()
import { fetchWithCsrf } from '$lib/utils/api'
await fetchWithCsrf('/api/v1/config', { method: 'POST', body: ... })

// ❌ INVALID — raw fetch() for mutations
await fetch('/api/v1/config', { method: 'POST', body: ... })
```

### SSRF PROTECTION
```typescript
// ✅ VALID — assertNotCloudMetadata before any user-supplied URL
import { assertNotCloudMetadata } from '$lib/server/security'
assertNotCloudMetadata(url)
const res = await fetch(url)

// ❌ INVALID — fetching user-supplied URL directly
const res = await fetch(userSuppliedUrl)
```

### SUBPROCESS CALLS
```typescript
// ✅ VALID
import { execFile } from 'node:child_process'
execFile('docker', ['compose', 'pull'], callback)

// ❌ INVALID — shell injection risk
exec(`docker compose pull ${userInput}`)
```

### WIDGET CONFIG
```typescript
// ✅ VALID — Zod schema in manifest + SchemaRenderer
defineWidget({
  id: 'io.phavo.pihole',
  configSchema: z.object({ url: z.string().url() })
})

// ❌ INVALID — custom form component per widget
// <PiholeSettingsForm /> — never do this
```

### WIDGET DATA
```typescript
// ✅ VALID — data via store props
let { data }: Props = $props()

// ❌ INVALID — widget fetches its own data
const res = await fetch('/api/v1/weather') // inside widget component
```

### PLUGIN IMPORTS
```typescript
// ✅ VALID — allowlisted imports only in plugin handlers
import { defineWidget, createHandler, z } from '@phavo/plugin-sdk'
import { getCpu } from '@phavo/agent'

// ❌ INVALID — arbitrary npm packages in plugin handlers
import axios from 'axios'
import _ from 'lodash'
```

### PLUGIN SANDBOX
```typescript
// ✅ VALID — key-value persistence via WidgetContext
await ctx.store.set('lastRun', JSON.stringify(Date.now()))

// ❌ INVALID — direct DB access or dynamic code
import { db } from '@phavo/db'           // not allowlisted
eval(userCode)                           // never
new Function('return ' + code)()        // never
import(runtimeConstructedPath)           // never
```

### CSS / DESIGN TOKENS
```typescript
// ✅ VALID — CSS variables only
background: var(--color-bg-surface);
color: var(--color-text-primary);
border-radius: var(--radius-md);

// ❌ INVALID — hardcoded values anywhere in packages/ui/ or widget.js
background: #0a0a0a;
border-radius: 10px;
```

### IMPORTS
```typescript
// ✅ VALID
import { x } from '$lib/server/db'
import { y } from '@phavo/types'
import { Button } from '@phavo/ui'
import { Icon } from '@phavo/ui'   // use Icon component, not raw Lucide in plugins

// ❌ INVALID
import { x } from '../../server/db'        // relative cross-domain
import { y } from '../../../packages/types' // path outside alias
```

### ENV & PATHS
```typescript
// ✅ VALID
import { env } from '@phavo/types/env'
import { paths } from '$lib/server/paths'
const db = createClient({ url: `file:${paths.db}` })

// ❌ INVALID
const db = createClient({ url: 'file:/data/phavo.db' })
server.listen(3000)
```

### DATABASE
```typescript
// ✅ VALID
import { db, dbReady } from '$lib/server/db'
await dbReady
const rows = await db.select()...

// ❌ INVALID
const client = createClient({ url: '...' }) // direct client creation
```

### MOCK AUTH
```typescript
// ✅ VALID — already implemented
export const DEV_MOCK_AUTH_ENABLED =
  process.env.PHAVO_DEV_MOCK_AUTH === 'true' &&
  process.env.NODE_ENV !== 'production'

// ❌ INVALID
if (process.env.PHAVO_DEV_MOCK_AUTH) { // missing production guard
```

---

## SVELTE 5 HYDRATION RULES
### These caused a full day of debugging — never violate them

```typescript
// ❌ INVALID — top-level $effect in any hydrated component
$effect(() => { ... }) // at script root level

// ✅ VALID — always wrap in onMount + $effect.root
onMount(() => {
  return $effect.root(() => {
    $effect(() => { ... })
  })
})
```

```typescript
// ❌ INVALID — $app/state in $state() initializer
import { page } from '$app/state'
let mode = $state(page.url.searchParams.get('mode')) // breaks hydration

// ✅ VALID — safe literal + onMount URL read
let mode = $state('welcome')
onMount(() => {
  mode = new URLSearchParams(window.location.search).get('mode') ?? 'welcome'
})
```

```typescript
// ❌ INVALID — replaceState from $app/navigation in setup page
import { replaceState } from '$app/navigation'
replaceState('', { mode }) // causes SvelteKit layout re-evaluation

// ✅ VALID
window.history.replaceState({}, '', `?mode=${mode}`)
```

```typescript
// ❌ INVALID — top-level $effect in stores
$effect(() => { reconcileWidgetRuntime() }) // module level

// ✅ VALID — $effect.root at module level (safe in stores)
$effect.root(() => {
  $effect(() => { reconcileWidgetRuntime() })
})
```

---

## FAIL CONDITIONS

### ❌ FAIL: TIER LEAK
Code reads or writes `config.tier` or `entries.tier`.
Tier must only come from `session.tier` via `authMiddleware`.

### ❌ FAIL: LAYOUT/API AUTH MISMATCH
`+layout.server.ts` must NOT synthesize a session for a missing DB record.
If cookie exists but no DB session → clear cookies and redirect to `/setup`.
This matches API 401 behavior — no fake session synthesis.

### ❌ FAIL: WIDGET DATA BYPASS
Widget component fetches its own data directly.
All data must flow through `widgets.svelte.ts` store.

### ❌ FAIL: LOCKED WIDGET LEAK
A `WidgetTeaserDefinition` entry for unentitled tiers must NEVER include
`dataEndpoint`, `configSchema`, or `permissions`.

### ❌ FAIL: API BYPASS
Endpoint returns non-envelope response or skips middleware.

### ❌ FAIL: CREDENTIAL STORAGE
Credentials stored in `configEncrypted` or config key-value table.
Must go to `credentials` table with AES-256-GCM encryption.

### ❌ FAIL: HYDRATION VIOLATION
Any of the three Svelte 5 hydration rules violated (see above).

### ❌ FAIL: SHELL INJECTION
Using `exec()` with a shell string for subprocess calls.
Always use `execFile()` with an explicit args array.

### ❌ FAIL: SSRF
Fetching a user-supplied URL without calling `assertNotCloudMetadata()`.
All user-supplied URLs must be validated before `fetch()`.

### ❌ FAIL: HARDCODED VALUES
`/data/` literals, port `3000`, or hex color values in component code.
Use `env.*`, `paths.*`, and CSS variables only.

### ❌ FAIL: MISSING CSRF
Any non-GET frontend mutation that does not use `fetchWithCsrf()`.

### ❌ FAIL: PLUGIN SANDBOX VIOLATION
Plugin handler uses `eval()`, `new Function()`, dynamically constructed `import()`,
imports outside the allowlist, or accesses `@phavo/db` directly.

### ❌ FAIL: PLUGIN DB SCHEMA
Plugin creates or alters DB tables directly.
All plugin persistence must go through `ctx.store` (plugin_data table).

### ❌ FAIL: ED25519 MISUSE
Using Ed25519 for data encryption. Ed25519 is for signing/verification only.
Data encryption is AES-256-GCM. These must never be conflated.

### ❌ FAIL: HARDCODED WIDGET REGISTRATION
Registering a built-in widget via `registry.register()` at module load time.
All widgets (including first-party) must be loaded as `.phwidget` plugins
from `/app/builtin-plugins/` via `registry.registerPlugin()`.

---

## ARCHITECTURAL DEBT — DO NOT COPY, DO NOT FIX IN PASSING

These are known issues. Do not replicate them. Do not fix them unless
a prompt explicitly targets them.

| Debt | Status | Risk |
|---|---|---|
| ~~Giant API file~~ | ✅ Split complete — 10 route modules + 3 helpers; +server.ts = 99 lines | — |
| ~~`tier` in `DashboardConfig`~~ | ✅ Fixed | — |
| ~~`+layout.server.ts` fake session fallback~~ | ✅ Fixed | — |
| ~~CSRF fallback secret~~ | ✅ Fixed | — |
| ~~Missing plugin loader~~ | ✅ Phase 1 — plugin system implemented | — |
| `+page.svelte` 1066 lines | Post-v1.0 cleanup | Low |
| Pre-existing a11y warnings in 5 shared UI components | Known, tracked | None |
| ~~`configSchemaVersion` not yet in schema~~ | ✅ Fixed | — |
| Theme token extension (radius, shadow, spacing, fonts) | Dedicated session before Milestone 4 | Low |

---

## ADDING A NEW FIRST-PARTY WIDGET (plugin workflow)

```
1. Create packages/plugin-sdk/src/widgets/<id>/ directory

2. Write manifest.json:
   - id: reverse-DNS (e.g. "io.phavo.cpu")
   - tier: 'standard' | 'pro'
   - permissions: declare all needed capabilities
   - configSchema: Zod schema (if configurable)
   - sizes: ['S', 'M', 'L', 'XL'] subset
   - phavoRequires: '>=1.0.0'

3. Write handler.ts using createHandler() from @phavo/plugin-sdk
   - Only allowlisted imports
   - Credentials via ctx.credentials (if 'credentials:read' declared)
   - Persistence via ctx.store (if 'db:write' declared)
   - Notifications via ctx.notify (if 'notify' declared)

4. Write Widget.svelte (compiled to widget.js on build)
   - CSS variables only — no hardcoded values
   - Receives typed data props — never fetches directly
   - Must handle: loading, active, unconfigured, error, stale states

5. Run: bun run build (produces <id>.phwidget ZIP)

6. Place in /app/builtin-plugins/ — Docker build signs + embeds it

7. If metric type is new: add to packages/types/src/metrics.ts
   and implement in packages/agent/src/metrics/
```

---

## API ROUTE TEMPLATE

```typescript
// In apps/web/src/lib/server/routes/metrics.ts
export function registerMetricsRoutes(
  app: Hono<{ Variables: AppVariables }>
): void {
  app.get('/example', requireSession(), async (c) => {
    try {
      // No await dbReady needed — hooks.server.ts guarantees DB ready
      const data = await cachedAgentFunction()
      return c.json(ok(data))
    } catch {
      return c.json(err('Failed to fetch example'), 500)
    }
  })
}
```

---

## TESTING

The agent NEVER opens a browser.
After code changes: start or restart the dev server and report the URL.
User tests manually in Safari or Chrome at `http://localhost:3000`.

```bash
# Start dev server
/Users/fabio/.bun/bin/bun run dev

# Full rebuild (clears SvelteKit cache)
rm -rf apps/web/.svelte-kit && /Users/fabio/.bun/bin/bun run dev
```

---

## VALIDATION (required after every session)

```bash
bun run typecheck   # must be 0 errors
bun run lint        # must be 0 errors
```

---

*PHAVO_CONTRACT v3.4 · pairs with CLAUDE.md v2.9 · phavo.net*
