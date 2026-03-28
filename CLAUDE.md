# Phavo — Claude Context

> Read this file completely before writing or changing a single line of code.

---

## Required reading before every session

| Document | Location | What you need from it |
|---|---|---|
| `docs/phavo_PRD_v2.7.md` | repo root/docs/ | Product logic, tier model, feature descriptions, decisions |
| `docs/phavo_arch_spec_v1.9.html` | repo root/docs/ | DB schema, API contracts, auth flows, types, all implementation details |

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
- No `tier` column in the `users` or `config` table — tier flows exclusively via phavo.net validation → session record → middleware
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
- Validate all external API responses (GitHub, phavo.net, Open-Meteo) with Zod before use
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
- ✅ Auth flows — full phavo.net OAuth + Local Argon2id paths; session creation with tier
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
- ✅ Config export / import — GET /api/v1/config/export + POST /api/v1/config/export (passphrase-encrypted credentials via PBKDF2-SHA256 → AES-256-GCM) + POST /api/v1/config/import (Zod-validated, UUID remapping, Free-tier tab cap, widget-warning notifications)
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
- ✅ Quick Setup Wizard — real auth wiring (phavo.net OAuth + Local), location, sessionStorage persistence
- ✅ Full Setup Wizard — all steps wired: auth (phavo.net + local), location + weather preview, tab builder (Free-tier limit), widget select from manifest, widget-to-tab assignment, per-widget config (Pi-hole, RSS, Links), final save via existing endpoints
- ✅ Settings page — 7 tabs: general, account, security, about, widgets (master/detail), licence, import/export (placeholder)
- ✅ Licence UI — Free/Standard/Local views; activate + deactivate wired to backend
- ✅ Update panel — Settings → About; version, changelog, update command
- ✅ Pi-hole + RSS config UI — Settings → Widgets master/detail with SchemaRenderer; credential masking; test connection button
- ✅ Import / Export UI — ImportExportTab.svelte: export with optional credential encryption, drag-and-drop import, client-side validation, preview panel, warnings display
- ✅ Mobile responsiveness — ≥375px across all pages; bottom nav <640px; widget grid 1/2/12-col; settings vertical stack; setup full-screen steps; bottom sheet panels

### Phase 1 — Design
- ✅ Theme — pure black (#000000) dark; Geist font (UI + Mono); amber/gold accent (#d4922a)
- ✅ CSS token system — all colours via CSS variables; no hardcoded hex in components
- ⬜ Light theme — token system ready, not designed

### Phase 1 — Infrastructure
- ✅ Docker — 2-stage + non-root user; multi-arch (amd64 + arm64); read_only + tmpfs; PHAVO_MIGRATIONS_DIR env var for runtime migration path
- ✅ CSP headers — full Content-Security-Policy in hooks.server.ts; API routes exempt
- ✅ Rate limiting — per-IP in-memory limiter (rate-limit.ts); TOTP 5/5min, metrics 60/1min, import 5/10min, default 120/1min; 429 + Retry-After header
- ⬜ Plugin loading pipeline — `paths.plugins` defined; no loading logic
- ✅ Version management — single source of truth in root `package.json`; Vite injects `PHAVO_VERSION` at build time; `release:patch/minor/major` scripts; Docker CI tags `phavo/phavo:VERSION + :latest`; GitHub Release workflow; CHANGELOG.md

### Phase 2 — Desktop app (after Phase 1 launch)
- ⬜ `apps/desktop/` Tauri 2.0 setup
- ⬜ Sidecar build script (`build-sidecar.sh`)
- ⬜ Tauri updater config + Ed25519 keypair
- ⬜ CI matrix (macOS / Windows / Linux)
- ⬜ Code signing (Apple Developer ID, Windows EV cert)
- ⬜ phavo.net update endpoint

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

### Testing environment
Visual verification is done by the user manually in Safari or Chrome at http://localhost:3000. The agent must never attempt to open a browser, use `open` commands, or interact with any browser directly. After code changes, the agent starts or restarts the dev server and reports the URL — the user handles all browser testing.

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
4. `0001_spicy_clea.sql` is the canonical full schema — `0000_initial.sql` is now a SELECT 1 no-op

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

### Resolved — Production Audit Fixes ✅
- ~~CSRF tokens missing from Settings + Widget store~~ — `fetchWithCsrf()` utility in `utils/api.ts`; all internal fetch calls replaced
- ~~SSRF via /pihole/test~~ — cloud metadata endpoints blocked (169.254.169.254 etc); local IPs allowed for self-hosted Pi-hole
- ~~Session cookies missing Secure flag~~ — `; Secure` added in production
- ~~POST /config not Zod-validated~~ — `ConfigPostSchema.safeParse()` with length limits + enum checks
- ~~Config import not transactional~~ — wrapped in `db.transaction()`; full rollback on failure
- ~~External APIs not Zod-validated~~ — weather.ts, pihole.ts, license.ts all use safeParse()
- ~~Notification queue unbounded~~ — capped at 100, oldest dropped on overflow
- ~~Default PHAVO_SECRET accepted in production~~ — process exits if value is 'change-me'
- ~~configSchemaVersion missing from schema~~ — added to widgetInstances; migration 0002_keen_luminals.sql generated
- ~~Health check doesn't verify DB~~ — SELECT 1 check; returns 503 if unreachable
- ~~partialSessions map unbounded~~ — capped at 1000 pending TOTP sessions
- ~~Redundant await dbReady in route handlers~~ — all 18 removed; hooks.server.ts guarantees DB ready
- ~~.svelte-kit in docker tmpfs~~ — removed, doesn't exist at runtime

### Resolved — Security Hardening ✅
- ~~`tier` in `DashboardConfig`~~ — removed; tier now only from session
- ~~Layout fake session fallback~~ — cleared; invalid sessions now redirect to /setup
- ~~CSRF fallback secret~~ — `PHAVO_SECRET` required in production, process exits if missing

### Active — pre-Launch
- **Docker Hub setup** — Account `docker@phavo.net`, Repository `phavo/phavo`, GitHub Secrets `DOCKERHUB_USERNAME` + `DOCKERHUB_TOKEN` needed before first release tag
- **Hetzner Mail** — MX-Records bei Cloudflare eintragen, Mailboxen anlegen: docker@, security@, hello@, noreply@ phavo.net
- **Landing Page** phavo.net — Hero, Pricing, Quick-Start, Links
- **docs.phavo.net** — Installation, Widget-Referenz, Command Palette Guide, FAQ
- **Windows ESM module resolution** — `packages/types/src/index.ts` uses extensionless relative imports (e.g. `./api`) which fail on Windows; needs `.js` extensions
- **svelte-check accessibility warnings** — 5 pre-existing warnings in shared UI components (Input, Select, Switch, TabBar, WidgetDrawer); address in dedicated UI polish session
- **Plugin discovery notification missing** — server start doesn't notify on new plugins; Phase 1.x
- **8 svelte-check warnings** in `packages/ui` — pre-existing, address in dedicated UI session
- ~~`bun drizzle-kit migrate` broken~~ — ✅ Fixed: libsql client bumped to ^0.14.0, duplicate migration SQL removed, db.ts now exits on migration failure, hooks.server.ts awaits migration before handling requests, stale bun cache cleared

### General
- **Open-Meteo geocoding rate limits** in Setup Wizard — debounce required (500ms recommended)
- **Drag-and-drop library** not yet chosen — candidates: `@neodrag/svelte`, `svelte-dnd-action`
- **`isDockerCompose()` detection** — heuristic not yet implemented in `install.ts`
- **Tauri free port reservation** — atomic port reservation needed to avoid race condition

---

*Phavo · phavo.net · github.com/phabioo/phavo*
*CLAUDE.md v2.1 · PRD ref: v2.7 · Arch Spec ref: v1.9 · Contract: PHAVO_CONTRACT_v3.md · Roadmap: docs/phavo_roadmap_v3.html*
