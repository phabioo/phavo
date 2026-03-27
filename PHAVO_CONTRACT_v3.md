# PHAVO AI ENGINEERING CONTRACT v3

> Read CLAUDE.md alongside this file before every session.
> If conflict between this contract and actual repo code: **CODE WINS**.

---

## SYSTEM CONTEXT

Monorepo: Turborepo + Bun Workspaces

```
apps/web/          SvelteKit + Hono API
packages/agent/    @phavo/agent — metric functions (library)
packages/db/       @phavo/db — Drizzle + libSQL + crypto
packages/types/    @phavo/types — shared types, Zod schemas
packages/ui/       @phavo/ui — shared UI shells (NOT widgets)
```

Domain: **phavo.net** (not phavo.io)

---

## CRITICAL ARCHITECTURE TRUTHS

### 1. API IS ONE FILE

ALL API logic lives in:
```
apps/web/src/routes/api/v1/[...path]/+server.ts
```
- Add routes here only
- Follow existing patterns exactly
- Do NOT create new +server.ts files for API routes

### 2. WIDGET COMPONENTS ARE APP-LOCAL

Widget renderers live in:
```
apps/web/src/lib/widgets/
```
Shared UI shells (WidgetCard, WidgetDrawer, SchemaRenderer etc.) live in:
```
packages/ui/src/components/
```
There is NO `packages/ui/src/widgets/` folder. Do not create it.

### 3. WIDGET DATA FLOW IS STORE-DRIVEN

```
Registry → API endpoint → widgets.svelte.ts store → +page.svelte → Widget component
```
Widget components are presentational only. They receive typed props. They never fetch data.

### 4. SESSION IS THE ONLY TIER SOURCE

Tier comes from the `sessions` DB table via `authMiddleware`.
Never from config. Never from the frontend.

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
app.get('/premium', requireTier('standard'), async (c) => { ... })

// ❌ INVALID
app.get('/resource', async (c) => {
  const cookie = c.req.header('Cookie') // manual auth check
})
```

### TIER ENFORCEMENT
```typescript
// ✅ VALID
const session = c.get('session')
session.tier

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

### WIDGET CONFIG
```typescript
// ✅ VALID — Zod schema in widget-registry.ts + SchemaRenderer
registry.register({
  id: 'example',
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

### IMPORTS
```typescript
// ✅ VALID
import { x } from '$lib/server/db'
import { y } from '@phavo/types'
import { Button } from '@phavo/ui'

// ❌ INVALID
import { x } from '../../server/db'      // relative cross-domain
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
// apps/web/src/lib/stores/widgets.svelte.ts
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
If cookie exists but no DB session → redirect to `/auth/login`, same as API 401.

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

### ❌ FAIL: HARDCODED VALUES
`/data/` literals, port `3000`, or hex color values in component code.
Use `env.*`, `paths.*`, and CSS variables only.

---

## ARCHITECTURAL DEBT — DO NOT COPY, DO NOT FIX IN PASSING

These are known issues. Do not replicate them. Do not fix them unless
a prompt explicitly targets them.

| Debt | Status | Risk |
|---|---|---|
| Giant API file (1765 lines) | Known, intentional for now | Low |
| `tier` in `DashboardConfig` and config table | **Scheduled for fix** | High — security |
| `+layout.server.ts` fake session fallback | **Scheduled for fix** | Medium |
| CSRF fallback secret in `csrf.ts` | **Scheduled for fix** | High — security |
| Missing plugin loader | Phase 1.x, not a bug | None |
| `+page.svelte` 1066 lines | Post-v1.0 cleanup | Low |
| Pre-existing a11y warnings in 5 shared UI components | Known, tracked | None |
| `configSchemaVersion` not yet in `widgetInstances` schema | Session 8 | Low |

---

## WIDGET IMPLEMENTATION CHECKLIST

```
1. Add metric type to packages/types/src/metrics.ts (if new shape)
2. Implement metric function in packages/agent/src/metrics/
3. Re-export from packages/agent/src/index.ts
4. Register in apps/web/src/lib/server/widget-registry.ts
5. Add API endpoint in apps/web/src/routes/api/v1/[...path]/+server.ts
6. Create presentational component in apps/web/src/lib/widgets/
7. Wire rendering in apps/web/src/routes/+page.svelte
8. If configurable: add Zod configSchema in widget-registry.ts
   → SchemaRenderer handles the Settings UI automatically
```

---

## API ROUTE TEMPLATE

```typescript
app.get('/example', requireSession(), async (c) => {
  try {
    await dbReady
    const data = await cachedAgentFunction()
    return c.json(ok(data))
  } catch {
    return c.json(err('Failed to fetch example'), 500)
  }
})
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

*PHAVO_CONTRACT v3 · pairs with CLAUDE.md v1.5 · phavo.net*
