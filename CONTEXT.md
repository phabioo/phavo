# Phavo — Agent Context
> Read this file completely before writing or changing a single line of code.
> Pairs with: RULES.md · PRD v3.2 · Arch Spec v2.1

---

## Required reading before every session

| Document | Purpose |
|---|---|
| `docs/phavo_PRD_v3.2.md` | Product logic, tier model, feature descriptions, all decisions |
| `docs/phavo_arch_spec_v2.1.html` | DB schema, API contracts, auth flows, types, implementation details |

If a prompt names a specific section (e.g. "Setup Wizard"), read that section in the arch spec before starting.

---

## Stack — what lives where

```
Monorepo: Turborepo + Bun Workspaces

apps/web/                    SvelteKit — Phase 1 app
  src/lib/server/            Server-only: DB, auth, agent cache, middleware
  src/lib/server/routes/     Hono route modules (10 modules after god-file split)
  src/lib/stores/            Svelte 5 rune stores (client)
  src/lib/widgets/           Widget Svelte components (presentational only)
  src/routes/                SvelteKit file-based routing
  src/routes/api/            Hono API orchestrator (+server.ts < 150 lines)

apps/desktop/                Tauri 2.0 shell (Phase 2)

packages/ui/                 @phavo/ui — Svelte 5 components + theme.css
packages/db/                 @phavo/db — Drizzle ORM + libSQL + crypto.ts
packages/types/              @phavo/types — Zod schemas, shared types, env.ts, backup.ts
packages/agent/              @phavo/agent — metric functions (library, not a daemon)
packages/plugin-sdk/         @phavo/plugin-sdk — internal SDK (Phase 1)
  src/widgets/               First-party widget source (one dir per widget)
    io.phavo.cpu/            manifest.json + handler.ts + Widget.svelte
    io.phavo.pihole/
    io.phavo.docker/
    ...                      All 14 launch widgets
```

---

## Product tiers

| Tier | Price | Auth | Offline |
|---|---|---|---|
| `standard` | €0 | phavo.net account | 24h grace |
| `pro` | €8.99 (launch €5.99) | phavo.net account | 72h grace |
| `local` | €24.99 (launch €16.99) | Local account | Fully offline |

```typescript
type Tier = 'standard' | 'pro' | 'local'
const TIER_RANK = { standard: 0, pro: 1, local: 2 }
```

**Two separate product lines — no cross-upgrade:**
- Account Variant: Standard + Pro (phavo.net auth)
- Local Variant: Local only (separate purchase)
- Standard → Pro: pay on phavo.net → "Refresh licence" button in Settings → Licence

---

## Design system

**Stack:** Tailwind v4 + CSS variables as Single Source of Truth + Bits UI (headless logic)

**Fonts:** Geist (UI) + Geist Mono (data values). Self-hosted via `@fontsource`. Never hardcoded.

**Icons:** Lucide via `<Icon name="..." />` abstraction. No Material Symbols, no Google CDN.

**Token system** — `packages/ui/src/theme.css`:
```css
@import "tailwindcss";

@theme {
  /* Colours */
  --color-bg-base: #000000;
  --color-bg-surface: #0a0a0a;
  --color-bg-elevated: #141414;
  --color-bg-hover: #1c1c1e;
  --color-border: #2a2a2a;
  --color-text-primary: #f5f5f7;
  --color-text-secondary: #86868b;
  --color-text-muted: #48484a;
  --color-accent: #d4922a;

  /* Shape */
  --radius-sm: 6px; --radius-md: 10px;
  --radius-lg: 14px; --radius-xl: 20px;

  /* Shadows */
  --shadow-sm: 0 1px 2px rgba(0,0,0,.3);
  --shadow-md: 0 4px 12px rgba(0,0,0,.4);

  /* Typography */
  --font-ui: 'Geist', -apple-system, sans-serif;
  --font-mono: 'Geist Mono', 'SF Mono', monospace;
}
```

**Usage — both forms are valid:**
```svelte
<!-- Tailwind utility (preferred for new code) -->
<div class="bg-surface text-accent rounded-xl">

<!-- CSS variable (also valid, required for dynamic theming) -->
<div style="background: var(--color-bg-surface)">
```

**Iron rule — forbidden everywhere:**
```svelte
<!-- ❌ Never -->
<div style="background: #0a0a0a">
<div class="bg-[#0a0a0a]">
<div class="bg-zinc-900">   <!-- hardcoded tailwind color not in theme -->
```

---

## DB schema — quick reference

| Table | Purpose | Key field |
|---|---|---|
| `users` | Registered users | `authMode: 'phavo-net' \| 'local'` |
| `sessions` | Active sessions | `tier` — single source of truth |
| `config` | Dashboard settings | No `tier` key |
| `tabs` | Dashboard tabs | `order` for sort |
| `widgetInstances` | Placed widgets | `configEncrypted` (non-credential) + `configSchemaVersion` |
| `credentials` | Secrets | `valueEncrypted` — AES-256-GCM always |
| `licenseActivation` | Local tier | `activationJwt` — Ed25519 **signed** (signing/verification only, not encryption), two public keys embedded |
| `plugin_data` | Plugin persistence | `(plugin_id, key, value)` — 10MB quota per plugin_id |

Migrations: `0001` canonical schema · `0002` configSchemaVersion · `0003` authMode rename

---

## API conventions

```typescript
{ ok: true,  data: T }          // success — always
{ ok: false, error: string }    // error — never expose stack traces
```

All endpoints under `/api/v1/*`. Tier mapping:

| Endpoints | Guard |
|---|---|
| `/auth/login`, `/health` | public |
| `/cpu`, `/memory`, `/disk`, `/network`, `/temperature`, `/uptime`, `/weather`, `/system` | `requireSession()` |
| `/pihole`, `/rss`, `/links`, `/ai/chat`, `/docker`, `/health-check`, `/speedtest/*`, `/calendar` | `requireTier('pro')` |
| `/config`, `/widgets`, `/auth/session`, `/update/check`, `/plugins/*` | `requireSession()` |

Route modules in `apps/web/src/lib/server/routes/`:
```
auth.ts · metrics.ts · integrations.ts · widgets.ts · tabs.ts
config.ts · ai.ts · license.ts · notifications.ts · system.ts · plugins.ts
```

---

## Plugin system — v1.0 approach

**All widgets (including first-party) use the plugin structure — without bundle format:**

```
packages/plugin-sdk/src/widgets/io.phavo.cpu/
  manifest.json    ← WidgetDefinition + phavoRequires + permissions
  handler.ts       ← createHandler() from @phavo/plugin-sdk (TypeScript, Bun runs natively)
  Widget.svelte    ← CSS variables only, Svelte 5 Snippets for states
```

**v1.0 loading:**
```typescript
// Direct import — no ZIP bundle
registry.register({ id: 'io.phavo.cpu', _source: 'builtin', tier: 'standard', ... })
```

**v1.1 loading:** build-step produces `.phwidget` bundles from same source → `registry.registerPlugin()`

**User plugins** (v1.1+): uploaded via `POST /api/v1/plugins/upload` (two-phase: validate → confirm), stored in `/data/plugins/`, hot-reload.

**Widget states via Svelte 5 Snippets:**
```svelte
<WidgetCard state={widgetState}>
  {#snippet active()}   <CpuGraph data={data} />  {/snippet}
  {#snippet loading()}  <Skeleton class="h-32" /> {/snippet}
  {#snippet error(err)} <ErrorMessage message={err} /> {/snippet}
  {#snippet unconfigured()} <ConfigurePrompt /> {/snippet}
</WidgetCard>
```

**Permissions:** `'network:outbound' | 'network:local' | 'db:read' | 'db:write' | 'credentials:read' | 'fs:read' | 'notify' | 'agent:metrics'`

---

## Implementation status

> Update this section after every session. ✅ done · 🔄 in progress · ⬜ not started

### Core (Sessions 1–9) — ✅ Complete
- ✅ DB schema — all tables + migrations 0001–0003
- ✅ AES-256-GCM encryption (HKDF-SHA256 key derivation)
- ✅ PHAVO_SECRET auto-generate (atomic wx flag)
- ✅ Platform abstraction (env.ts + paths.ts)
- ✅ Auth flows — phavo.net OAuth + Local Argon2id + TOTP 2FA
- ✅ Session validation middleware — expiry + grace period + hourly pruning
- ✅ Tier enforcement — `requireTier()` on all Pro/Local endpoints
- ✅ Widget registry + split manifest
- ✅ All metric endpoints (7 Standard + 3 Pro + system)
- ✅ Config GET/POST/export/import
- ✅ CSRF middleware + fetchWithCsrf()
- ✅ Update check + apply (execFile, 1h cache)
- ✅ AI endpoints (requireTier('pro'), SSRF-protected)
- ✅ God-file split — 10 route modules, +server.ts < 150 lines
- ✅ Command Palette (Cmd+K — local search, web search, AI chat)
- ✅ Notification system (in-memory, bell icon, deep-links)
- ✅ Import/Export (.phavo format, PBKDF2 credential encryption)
- ✅ Setup Wizard (Full 10-step + Quick 3-step)
- ✅ Settings page (General, Tabs, Widgets, Backup & Export, Licence, Account, Plugins, About)
- ✅ Production audit — all CRITICAL/HIGH/MEDIUM/LOW/a11y findings resolved
- ✅ Version management (root package.json SSOT, Vite build injection)
- ✅ Docker CI (multi-arch amd64 + arm64, fires on version tags only)

### Pre-Launch Milestones
- ⬜ Milestone 1: Notification Redesign
- ⬜ Milestone 2: Additional Widgets (Docker, Service Health, Speedtest, Calendar)
- ⬜ Milestone 3: Security Testing (pen-test, encryption audit)
- ⬜ Milestone 4: Graphic Polish (Tailwind v4 migration, Bits UI, Bento-Grid, Stitch design)
- ⬜ Milestone 5: Web Presence (phavo.net, docs.phavo.net, github.phavo.net)
- ⬜ Milestone 6: Local Variant (Ed25519 licence, offline activation)

### Known issues / deferred
- Pre-existing a11y warnings in 5 shared UI components — post-launch
- Open-Meteo geocoding debounce (500ms) — not yet implemented
- Drag-and-drop library not chosen (`@neodrag/svelte` or `svelte-dnd-action`)
- `isDockerCompose()` detection heuristic incomplete
- Tauri free port reservation — atomic reservation needed
- Light theme — token system ready, not designed
- `@fontsource/geist` — verify self-hosting works before Milestone 4
- **svelte.config.js must NOT have `compilerOptions: { runes: true }`** — breaks lucide-svelte. Runes mode is auto-detected per component via $props()/$state() usage.

---

## Quick reference — common tasks

### Add a new first-party widget (v1.0 approach)
```
1. Create packages/plugin-sdk/src/widgets/<id>/
2. Write manifest.json (id, tier, permissions, configSchema, sizes, phavoRequires)
3. Write handler.ts using createHandler() from @phavo/plugin-sdk
4. Write Widget.svelte (CSS vars + Tailwind only, Svelte 5 Snippets for states)
5. Register in apps/web/src/lib/server/widget-registry.ts via registry.register()
6. Add API route in appropriate route module
7. If new metric: add type to packages/types/src/metrics.ts + implement in @phavo/agent
```

### Add a new API route
```
1. Find module in apps/web/src/lib/server/routes/
2. Add inside registerXxxRoutes(app) function
3. Apply requireSession() or requireTier('pro')
4. Return ok(data) or err(message) — never raw JSON
5. Validate body with Zod .safeParse() before use
```

### Add a new DB migration
```
1. Update schema in packages/db/src/schema.ts
2. Run: bun drizzle-kit generate
3. Commit migration file — never edit DB manually
```

### Start dev server (Windows)
```powershell
cd C:\Users\fabio\Documents\local_repositorys\phavo
$env:PHAVO_DEV_MOCK_AUTH="true"
$env:PHAVO_SECRET="dev-secret"
$env:PHAVO_PORT="3000"
$env:PHAVO_ENV="development"
$env:PHAVO_DATA_DIR="./apps/web/.dev-data"
bun run dev
```

### Validation (required after every session)
```bash
bun run typecheck   # must be 0 errors
bun run lint        # must be 0 errors
```

---

*Phavo · phavo.net · github.com/getphavo/phavo*
*CONTEXT.md v3.0 · PRD ref: v3.2 · Arch Spec ref: v2.1 · Rules: RULES.md*
