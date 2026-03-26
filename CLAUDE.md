# Phavo — Claude Context

> Read this file completely before writing or changing a single line of code.

---

## Required reading before every session

| Document | Location | What you need from it |
|---|---|---|
| `docs/phavo_PRD_v2.5.md` | repo root/docs/ | Product logic, tier model, feature descriptions, decisions |
| `docs/phavo_arch_spec_v1.7.html` | repo root/docs/ | DB schema, API contracts, auth flows, types, all implementation details |

If a prompt names a specific section (e.g. "Setup Wizard"), read exactly that section in the arch spec before you start.

---

## Stack — what lives where

```
Monorepo: Turborepo + Bun Workspaces

apps/web/              SvelteKit — Phase 1 app + Tauri sidecar target (Phase 2)
  src/lib/server/      Server-only: DB, auth, agent cache, middleware
  src/lib/stores/      Svelte 5 rune stores (client)
  src/routes/          SvelteKit file-based routing
  src/routes/api/      Hono API router

apps/desktop/          Tauri 2.0 shell (Phase 2)
  src-tauri/           Rust: sidecar spawn, WebView, updater
  binaries/            Compiled Bun sidecar (build artifact)

packages/ui/           @phavo/ui — Svelte 5 components + theme.css
packages/db/           @phavo/db — Drizzle ORM + libSQL client + crypto.ts
packages/types/        @phavo/types — Zod schemas, shared types, env.ts
packages/agent/        @phavo/agent — metric functions (library, not a daemon)
```

---

## Absolute iron rules — never break, never debate

### Tier enforcement
- `requireTier()` middleware on **every** Standard/Local endpoint — no exceptions
- `session.tier` always comes from the DB (`sessions` table), never from the cookie payload or any client header
- No `tier` column in the `users` or `config` table — tier flows exclusively via phavo.io validation → session record → middleware
- Widget manifest: send `WidgetTeaserDefinition` entries for locked tiers — never expose `dataEndpoint`, `configSchema`, or `permissions` to unentitled tiers

### Credentials & security
- Credentials (Pi-hole token, RSS auth, OAuth tokens) **never** reach the frontend — read them server-side only, inside `@phavo/agent` functions or Hono handlers
- Credentials always go into the `credentials` table (AES-256-GCM encrypted), never into `widgetInstances.configEncrypted` or a `config` key-value
- `WidgetDefinition` is server-only — never serialise the full object to the client
- No debug endpoints in production (`NODE_ENV === 'production'` check)

### Platform abstraction
- **No `/data/` literals** anywhere in `packages/` or `apps/web/src/lib/server/` — always use `env.dataDir` from `@phavo/types/env` or `paths.*` from `apps/web/src/lib/server/paths.ts`
- **No hardcoded port 3000** — always use `env.port` from `@phavo/types/env`
- **No hardcoded DB path** — always use `paths.db`
- `installMethod` is read from the `config` table — never re-derived at runtime after first start
- `GET /api/v1/health` must always be reachable (public, no auth) — the Tauri sidecar polls it on startup

### TypeScript
- `strict: true` — no `any`, no `as unknown as X` without a comment explaining why
- Validate all external API responses (GitHub, phavo.io, Open-Meteo) with Zod before use
- Shared types come from `@phavo/types` — never duplicate them

### Design system
- **CSS variables only** from `packages/ui/src/theme.css` — no hardcoded colours, no hex values in components
- Fonts: `Geist` (UI) and `Geist Mono` (data values) — via CSS variables `--font-ui` / `--font-mono`, never hardcoded
- No inline styles with colour values
- No Tailwind arbitrary colour values (`text-[#abc]` is forbidden)

---

## DB schema — quick reference

| Table | Purpose | Critical field |
|---|---|---|
| `users` | Registered users | `authMode`: `'phavo-io'` \| `'local'` |
| `sessions` | Active sessions | `tier` — single source of truth for tier enforcement |
| `config` | Dashboard settings | No `tier` key here |
| `tabs` | Dashboard tabs | `order` for sort position |
| `widgetInstances` | Placed widgets | `configEncrypted` (non-credential config only) |
| `credentials` | Secrets | `valueEncrypted` — always AES-256-GCM |
| `licenseActivation` | Local tier JWT | `activationJwt` — RS256, verified against embedded public key |

Full schema definition: arch spec section "Database Schema".

---

## API conventions

Every response follows this envelope — no exceptions:
```typescript
{ ok: true,  data: T }          // success
{ ok: false, error: string }    // error — never expose stack traces
```

All endpoints under `/api/v1/*`. Tier mapping:
- `free+` (requireSession): `/cpu`, `/memory`, `/disk`, `/network`, `/temperature`, `/uptime`, `/weather`
- `standard+` (requireTier('standard')): `/pihole`, `/rss`, `/links`
- `any session`: `/config`, `/widgets`, `/auth/session`, `/update/check`
- `public`: `/auth/login`, `/health`

---

## Implementation status

> **Important:** Update this section manually after every session.
> Mark completed items ✅, in-progress 🔄, not started ⬜.

### Phase 1 — Core
- ✅ DB schema — all 7 tables, Drizzle migration `0001_spicy_clea.sql`
- ✅ AES-256-GCM encryption (`packages/db/src/crypto.ts`) — HKDF-SHA256 key derivation
- ✅ Platform abstraction (`packages/types/src/env.ts`, `apps/web/src/lib/server/paths.ts`)
- ✅ Auth flows — full phavo.io OAuth + Local Argon2id paths; session creation with tier
- ✅ Session validation middleware — standalone `authMiddleware`; expiry + grace period enforced
- ✅ Tier enforcement middleware — `requireTier()` on all Standard endpoints; mock auth defaults to `'free'`
- ✅ Widget registry + split manifest — `getManifest(tier)` returns 7 full + 3 teasers for Free; 10 full for Standard/Local

### Phase 1 — API
- ✅ `GET /api/v1/health` — public, no auth, returns version + platform
- ✅ `installMethod` derivation — `deriveInstallMethod()` in `install.ts`
- ✅ Metric endpoints — all 7 routes with `requireSession()` and caching
- ✅ Pi-hole endpoint — reads encrypted credentials from DB; `null` + notification if missing/unreachable
- ✅ RSS endpoint — reads per-instance feed configs; partial failures return items + errors array
- ✅ Links endpoint — reads grouped link config from `configEncrypted`
- ✅ Config GET / POST — `requireSession()`; Free tier tab count capped at 1 server-side
- ⬜ Config export / import — no endpoints exist
- ✅ Update check — 1h cache; notification trigger; update command per `installMethod`
- ✅ Widget instance config — `POST /api/v1/widgets/:instanceId/config`; credential fields → encrypted `credentials` table; rest → `configEncrypted`
- ✅ Licence activate / deactivate — `POST /api/v1/license/activate` + `/deactivate` registered
- ✅ CSRF middleware — applied to POST/PUT/DELETE/PATCH
- ✅ Auth routes — logout, session (no tier field), TOTP
- ✅ Mock auth production-gated — `DEV_MOCK_AUTH_ENABLED = PHAVO_DEV_MOCK_AUTH && NODE_ENV !== 'production'`

### Phase 1 — Frontend
- 🔄 Dashboard layout — Sidebar + Header wired; widgets render; no 12-column grid; no drag-and-drop
- ✅ Widget polling store — state machine (loading/active/unconfigured/error/stale); retry; threshold notifications
- ✅ Widget drawer — locked teaser cards; category filter chips (All/System/Consumer/Integration/Utility)
- ✅ Tab limit UI — Free tier shows upgrade prompt on second tab attempt
- 🔄 Notification panel — exists + wired; working
- ✅ Quick Setup Wizard — real auth wiring (phavo.io OAuth + Local), location, sessionStorage persistence
- ✅ Full Setup Wizard — all steps wired: auth (phavo.io + local), location + weather preview, tab builder (Free-tier limit), widget select from manifest, widget-to-tab assignment, per-widget config (Pi-hole, RSS, Links), final save via existing endpoints
- ✅ Settings page — 7 tabs: general, account, security, about, widgets (master/detail), licence, import/export (placeholder)
- ✅ Licence UI — Free/Standard/Local views; activate + deactivate wired to backend
- ✅ Update panel — Settings → About; version, changelog, update command
- ✅ Pi-hole + RSS config UI — Settings → Widgets master/detail with SchemaRenderer; credential masking; test connection button
- ⬜ Import / Export UI — not present
- 🔄 Mobile responsiveness — 768px breakpoints exist; no 375px; no responsive rules in `theme.css`

### Phase 1 — Design
- ✅ Theme — pure black (#000000) dark; Geist font (UI + Mono); amber/gold accent (#d4922a)
- ✅ CSS token system — all colours via CSS variables; no hardcoded hex in components
- ⬜ Light theme — token system ready, not designed

### Phase 1 — Infrastructure
- 🔄 Docker — 2-stage + non-root user; no multi-arch; missing `read_only: true` + `tmpfs`
- ⬜ CSP headers — not set anywhere
- 🔄 Rate limiting — login rate limiting only; no HTTP-level limiting on other endpoints
- ⬜ Plugin loading pipeline — `paths.plugins` defined; no loading logic

### Phase 2 — Desktop app (after Phase 1 launch)
- ⬜ `apps/desktop/` Tauri 2.0 setup
- ⬜ Sidecar build script (`build-sidecar.sh`)
- ⬜ Tauri updater config + Ed25519 keypair
- ⬜ CI matrix (macOS / Windows / Linux)
- ⬜ Code signing (Apple Developer ID, Windows EV cert)
- ⬜ phavo.io update endpoint

---

## How to run a session

### At the start of every session
1. Read CLAUDE.md (this file)
2. Read the relevant arch spec section for today's scope
3. Inspect existing files in scope before making changes
4. Work in this order: types / schemas → server logic → UI

### Before every commit
- TypeScript: `bun run typecheck` — must pass with zero errors
- Linting: `bun run lint` (Biome) — must pass with zero errors
- No `any`, no hardcoded colours, no credentials in the frontend
- No `/data/` literals in server code — sanity check: `grep -r '"/data/' apps/web/src/lib/server/ packages/`

### Testing environment — VS Code only
**Never open a browser outside of VS Code to test.** All visual verification must happen through the VS Code Simple Browser or the built-in preview panel:
- Use the VS Code command **"Simple Browser: Show"** with `http://localhost:3000`
- Or use the Ports panel in VS Code to open the forwarded port
- Do NOT launch Safari, Chrome, or any external browser
- Do NOT use `open http://localhost:3000` shell commands
- Screenshots for reporting must come from VS Code's built-in tools only
If visual verification is not possible within VS Code, describe the expected result in text instead of opening an external browser.

### What you must never do
- Implement tier logic on the client (always server-side)
- Add a `tier` column to `users` or `config`
- Store credentials in `widgetInstances.configEncrypted`
- Replace CSS variables with hex values
- Serialise the full `WidgetDefinition` to the frontend
- Allow `eval()` or `new Function()` in plugin code
- Use `/data/` as a literal string in server code
- Hardcode port 3000
- **Write a hardcoded Settings panel for a specific widget** — all widget config UI must go through `<SchemaRenderer>`. Express config fields in `configSchema`, not in custom Svelte components.

---

## Common tasks — quick reference

### Add a new widget
1. Register `WidgetDefinition` in `apps/web/src/lib/server/widget-registry.ts`
2. Create Hono handler in `apps/web/src/routes/api/v1/[widget]/+server.ts`
3. Apply `requireTier('free' | 'standard')` middleware
4. Create Svelte component in `packages/ui/src/widgets/[Widget].svelte`
5. Fetch metrics via `@phavo/agent` — never call `systeminformation` directly in a route handler

### Add a new Settings tab
1. Add tab ID to the tab list in `src/routes/settings/+page.svelte`
2. Create component at `src/lib/components/settings/[TabName].svelte`
3. Deep-link via URL hash: `/settings#tabname`

### Add a new DB migration
1. Update schema in `packages/db/src/schema.ts`
2. Run `bun drizzle-kit generate`
3. Commit the migration file — never edit the DB file manually

### Reference a file path correctly
```typescript
// ✅ Correct
import { paths } from '$lib/server/paths'
const db = createClient({ url: `file:${paths.db}` })

// ❌ Wrong
const db = createClient({ url: 'file:/data/phavo.db' })
```

---

## Open issues / known issues

### Resolved in Sessions 1–3 ✅
- ~~`'phavio-io'` typo~~ — fixed across all files
- ~~12 typecheck errors~~ — 0 errors
- ~~All endpoints unguarded~~ — `requireTier()` and `requireSession()` applied to all routes
- ~~Mock auth returned 'standard'~~ — now defaults to 'free'
- ~~Widget manifest exposed full defs to all tiers~~ — split manifest implemented
- ~~Pi-hole/RSS/Links returned stub data~~ — wired to DB credentials
- ~~`configEncrypted` never written~~ — credential separation enforced in widget config endpoint
- ~~No `/api/v1/license/*` routes~~ — activate + deactivate registered
- ~~Tab limit not enforced client-side~~ — upgrade prompt shown + server-side 403 enforced
- ~~Locked widget cards layout broken~~ — flex layout fixed, no absolute positioning

### Active — pre-Session 6
- **Import / Export UI** — placeholder tab exists; endpoints + real UI needed; Session 7
- **svelte-check accessibility warnings** — 5 pre-existing warnings in shared UI components (Input, Select, Switch, TabBar, WidgetDrawer); address in dedicated UI polish session
- **Plugin discovery notification missing** — server start doesn't notify on new plugins; Phase 1.x
- **8 svelte-check warnings** in `packages/ui` — pre-existing, address in dedicated UI session
- **`bun drizzle-kit migrate` broken** — must be fixed before Docker production deploy; Session 9

### General
- **Open-Meteo geocoding rate limits** in Setup Wizard — debounce required (500ms recommended)
- **Drag-and-drop library** not yet chosen — candidates: `@neodrag/svelte`, `svelte-dnd-action`
- **`isDockerCompose()` detection** — heuristic not yet implemented in `install.ts`
- **Tauri free port reservation** — atomic port reservation needed to avoid race condition

---

*Phavo · phavo.io · github.com/phabioo/phavo*
*CLAUDE.md v1.5 · PRD ref: v2.5 · Arch Spec ref: v1.7 · Roadmap: docs/phavo_roadmap_v2.html*
