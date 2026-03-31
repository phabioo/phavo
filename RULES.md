# Phavo — Agent Rules
> Read CONTEXT.md alongside this file before every session.
> If conflict between this file and actual repo code: **CODE WINS**.
> Pairs with: CONTEXT.md · PRD v3.2 · Arch Spec v2.1

---

## SYSTEM CONTEXT

```
apps/web/            SvelteKit + Hono API
packages/agent/      @phavo/agent — metric functions (library)
packages/db/         @phavo/db — Drizzle + libSQL + crypto
packages/types/      @phavo/types — shared types, Zod schemas, IBackupProvider
packages/ui/         @phavo/ui — shared UI components (NOT widgets)
packages/plugin-sdk/ @phavo/plugin-sdk — internal SDK + first-party widget source
```

Domain: **phavo.net** (not phavo.io)  
DB authMode: `'phavo-net'` | `'local'` (migrated from `'phavo-io'`)  
Tiers: `'standard'` (€0) · `'pro'` (€8.99) · `'local'` (€24.99) · `TIER_RANK = { standard:0, pro:1, local:2 }`  
Two product lines — no cross-upgrade (Standard/Pro ≠ Local)  
Ed25519: signing/verification only — never for encryption  
Encryption: AES-256-GCM always  

---

## CRITICAL ARCHITECTURE TRUTHS

### 1. API USES ROUTE MODULES

```
apps/web/src/lib/server/routes/
  auth.ts · metrics.ts · integrations.ts · widgets.ts · tabs.ts
  config.ts · ai.ts · license.ts · notifications.ts · system.ts · plugins.ts
```

Orchestrator `apps/web/src/routes/api/v1/[...path]/+server.ts` < 150 lines.  
Never add handlers to +server.ts directly.  
Each module exports `registerXxxRoutes(app: Hono<...>): void`

### 2. ALL WIDGETS USE PLUGIN STRUCTURE

**v1.0:** First-party widgets live in `packages/plugin-sdk/src/widgets/<id>/`, loaded via `registry.register()`. No ZIP bundle.  
**v1.1:** Build-step produces `.phwidget` bundles → `registry.registerPlugin()`. Zero widget logic changes.

```
packages/plugin-sdk/src/widgets/io.phavo.cpu/
  manifest.json   ← WidgetDefinition
  handler.ts      ← createHandler() — TypeScript, Bun runs natively
  Widget.svelte   ← CSS vars + Tailwind only, Svelte 5 Snippets
```

No `packages/ui/src/widgets/` folder. Do not create it.  
Shared shells (WidgetCard, WidgetDrawer, SchemaRenderer, Icon, BentoGrid) → `packages/ui/src/components/`

### 3. WIDGET DATA FLOW IS STORE-DRIVEN

```
PluginRegistry → API endpoint → widgets.svelte.ts store → +page.svelte → widget.js
```

Widget components are presentational only. They receive typed props. They never fetch data.

### 4. SESSION IS THE ONLY TIER SOURCE

Tier comes from `sessions` DB table via `authMiddleware`. Never from config. Never from frontend.

### 5. PLUGIN DATA PERSISTENCE IS KEY-VALUE ONLY

Plugins use `ctx.store.get/set/delete()` → `plugin_data` table. 10MB quota per plugin_id.  
Plugins cannot create new DB tables.

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
app.get('/premium',  requireTier('pro'), async (c) => { ... })

// ❌ INVALID — manual auth check
app.get('/resource', async (c) => {
  const cookie = c.req.header('Cookie')
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
data.tier  // from config table
```

### CREDENTIALS
```typescript
// ✅ VALID — credentials table, AES-256-GCM
await db.insert(schema.credentials).values({
  key: 'pihole_token',
  valueEncrypted: await encrypt(token)
})

// ❌ INVALID
configEncrypted: JSON.stringify({ token: 'plaintext' })
```

### CSRF
```typescript
// ✅ VALID — all non-GET frontend mutations
import { fetchWithCsrf } from '$lib/utils/api'
await fetchWithCsrf('/api/v1/config', { method: 'POST', body: ... })

// ❌ INVALID
await fetch('/api/v1/config', { method: 'POST', body: ... })
```

### SSRF PROTECTION
```typescript
// ✅ VALID
import { assertNotCloudMetadata } from '$lib/server/security'
assertNotCloudMetadata(url)
const res = await fetch(url)

// ❌ INVALID
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

// ❌ INVALID
// <PiholeSettingsForm /> — never
```

### WIDGET DATA
```typescript
// ✅ VALID
let { data }: Props = $props()

// ❌ INVALID — widget fetches its own data
const res = await fetch('/api/v1/cpu')  // inside widget component
```

### DESIGN SYSTEM
```svelte
<!-- ✅ VALID — Tailwind utility -->
<div class="bg-surface text-accent rounded-xl border border-border">

<!-- ✅ VALID — CSS variable -->
<div style="background: var(--color-bg-surface)">

<!-- ❌ INVALID — hardcoded values -->
<div style="background: #0a0a0a">
<div class="bg-[#0a0a0a]">
<div class="bg-zinc-900">
```

### ICONS
```svelte
<!-- ✅ VALID — Lucide via abstraction layer -->
<Icon name="cpu" />
<Icon name="database" />

<!-- ❌ INVALID — direct icon import or Google Material Symbols -->
<LucideCpu />
<span class="material-symbols-outlined">memory</span>
```

### PLUGIN IMPORTS
```typescript
// ✅ VALID — allowlist only
import { defineWidget, createHandler, z } from '@phavo/plugin-sdk'
import { getCpu } from '@phavo/agent'

// ❌ INVALID
import axios from 'axios'
```

### PLUGIN SANDBOX
```typescript
// ✅ VALID
await ctx.store.set('key', JSON.stringify(value))

// ❌ INVALID
import { db } from '@phavo/db'   // not allowlisted
eval(code)
new Function('return ' + code)()
import(runtimePath)
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

// ❌ INVALID — direct client creation
const client = createClient({ url: '...' })
```

### MOCK AUTH
```typescript
// ✅ VALID
export const DEV_MOCK_AUTH_ENABLED =
  process.env.PHAVO_DEV_MOCK_AUTH === 'true' &&
  process.env.NODE_ENV !== 'production'

// ❌ INVALID — missing production guard
if (process.env.PHAVO_DEV_MOCK_AUTH) {
```

---

## SVELTE 5 HYDRATION RULES
### These caused a full day of debugging — never violate them

```typescript
// ❌ INVALID — top-level $effect in hydrated component
$effect(() => { ... })

// ✅ VALID
onMount(() => {
  return $effect.root(() => {
    $effect(() => { ... })
  })
})
```

```typescript
// ❌ INVALID — $app/state in $state() initializer
import { page } from '$app/state'
let mode = $state(page.url.searchParams.get('mode'))

// ✅ VALID
let mode = $state('welcome')
onMount(() => {
  mode = new URLSearchParams(window.location.search).get('mode') ?? 'welcome'
})
```

```typescript
// ❌ INVALID — replaceState in setup page
import { replaceState } from '$app/navigation'
replaceState('', { mode })

// ✅ VALID
window.history.replaceState({}, '', `?mode=${mode}`)
```

```typescript
// ❌ INVALID — top-level $effect in stores
$effect(() => { reconcileWidgetRuntime() })

// ✅ VALID
$effect.root(() => {
  $effect(() => { reconcileWidgetRuntime() })
})
```

---

## FAIL CONDITIONS

### ❌ FAIL: TIER LEAK
`config.tier` or `entries.tier` read/written. Tier must only come from `session.tier`.

### ❌ FAIL: LAYOUT/API AUTH MISMATCH
`+layout.server.ts` synthesises a session for missing DB record. Must redirect to `/setup`.

### ❌ FAIL: WIDGET DATA BYPASS
Widget component fetches its own data. All data flows through `widgets.svelte.ts` store.

### ❌ FAIL: LOCKED WIDGET LEAK
`WidgetTeaserDefinition` includes `dataEndpoint`, `configSchema`, or `permissions`.

### ❌ FAIL: API BYPASS
Endpoint returns non-envelope response or skips middleware.

### ❌ FAIL: CREDENTIAL STORAGE
Credentials in `configEncrypted` or config table. Must use `credentials` table + AES-256-GCM.

### ❌ FAIL: HYDRATION VIOLATION
Any Svelte 5 hydration rule violated (see above).

### ❌ FAIL: SHELL INJECTION
`exec()` with shell string. Always use `execFile()` with explicit args array.

### ❌ FAIL: SSRF
User-supplied URL fetched without `assertNotCloudMetadata()`.

### ❌ FAIL: HARDCODED VALUES
`/data/` literals, port `3000`, hex colours, hardcoded font names in component code.

### ❌ FAIL: MISSING CSRF
Non-GET frontend mutation without `fetchWithCsrf()`.

### ❌ FAIL: PLUGIN SANDBOX VIOLATION
Plugin uses `eval()`, `new Function()`, dynamic `import()`, non-allowlisted import, or raw `@phavo/db`.

### ❌ FAIL: PLUGIN DB SCHEMA
Plugin creates/alters DB tables. All persistence via `ctx.store` (plugin_data table).

### ❌ FAIL: ED25519 MISUSE
Ed25519 used for data encryption. It is for signing/verification only. Encryption = AES-256-GCM.

### ❌ FAIL: HARDCODED WIDGET REGISTRATION
`registry.register()` called with inline definition outside of plugin structure.  
First-party widgets must be defined in `packages/plugin-sdk/src/widgets/<id>/manifest.json`.

### ❌ FAIL: WRONG ICON SYSTEM
Material Symbols, Font Awesome, or any icon system other than Lucide via `<Icon name="..." />`.

### ❌ FAIL: WRONG FONT
Manrope, Inter, or any font other than Geist/Geist Mono referenced in component code.

---

## ARCHITECTURAL DEBT — DO NOT COPY, DO NOT FIX IN PASSING

| Debt | Status | Risk |
|---|---|---|
| ~~Giant API file~~ | ✅ Split — 10 modules, +server.ts < 150 lines | — |
| ~~`tier` in DashboardConfig~~ | ✅ Fixed | — |
| ~~Layout fake session fallback~~ | ✅ Fixed | — |
| ~~CSRF fallback secret~~ | ✅ Fixed | — |
| ~~Missing plugin loader~~ | ✅ Plugin structure in v1.0, bundle format v1.1 | — |
| ~~`configSchemaVersion` missing~~ | ✅ Fixed | — |
| `+page.svelte` 1066 lines | Post-v1.0 cleanup | Low |
| Pre-existing a11y warnings (5 components) | Known, tracked | None |
| Theme token extension (shadows, spacing) | Before Milestone 4 | Low |
| Tailwind v4 full migration | Milestone 4 | Medium |
| Bits UI integration | Milestone 4 | Medium |

---

## ADDING A FIRST-PARTY WIDGET

```
1. Create packages/plugin-sdk/src/widgets/<id>/

2. Write manifest.json:
   {
     "id": "io.phavo.<name>",
     "tier": "standard" | "pro",
     "permissions": [...],
     "configSchema": {...},
     "sizes": ["S", "M", "L", "XL"],
     "phavoRequires": ">=1.0.0"
   }

3. Write handler.ts:
   import { createHandler, z } from '@phavo/plugin-sdk'
   export default createHandler(async (ctx) => {
     // Only allowlisted imports
     // Credentials via ctx.credentials (if declared)
     // Persistence via ctx.store (if declared)
     // Notifications via ctx.notify (if declared)
   })

4. Write Widget.svelte:
   - CSS variables + Tailwind utilities only — no hardcoded values
   - Svelte 5 Snippets for states (active, loading, error, unconfigured, stale)
   - Receives typed data props — never fetches directly

5. Register in apps/web/src/lib/server/widget-registry.ts:
   registry.register({ id: 'io.phavo.<name>', _source: 'builtin', ...manifest })

6. Add API route in appropriate routes/ module

7. If new metric: add to packages/types/src/metrics.ts + packages/agent/src/metrics/
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

Agent never opens a browser. After changes: start dev server, report URL. User tests manually.

```bash
# Validation — required after every session
bun run typecheck   # must be 0 errors
bun run lint        # must be 0 errors
```

---

*RULES.md v1.0 · Phavo · phavo.net · github.com/getphavo/phavo*
