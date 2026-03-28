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
  src/lib/server/routes/  Hono route modules (after god-file split)
  src/lib/stores/      Svelte 5 rune stores (client)
  src/lib/widgets/     Widget Svelte components (presentational only)
  src/routes/          SvelteKit file-based routing
  src/routes/api/      Hono API orchestrator (+server.ts, <150 lines after split)

apps/desktop/          Tauri 2.0 shell (Phase 2)
  src-tauri/           Rust: sidecar spawn, WebView, updater
  binaries/            Compiled Bun sidecar (build artifact)

packages/ui/           @phavo/ui — Svelte 5 components + theme.css (shells only, NOT widgets)
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
- Credentials (Pi-hole token, RSS auth, OAuth tokens, AI API keys) **never** reach the frontend — read them server-side only, inside `@phavo/agent` functions or Hono handlers
- Credentials always go into the `credentials` table (AES-256-GCM encrypted), never into `widgetInstances.configEncrypted` or a `config` key-value
- `WidgetDefinition` is server-only — never serialise the full object to the client
- No debug endpoints in production (`NODE_ENV === 'production'` check)
- All user-supplied URLs must pass `assertNotCloudMetadata()` before `fetch()` — blocks cloud metadata endpoints

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
| `users` | Registered users | `authMode`: `'phavo-net'` \| `'local'` (migrated from `'phavo-io'` in 0003) |
| `sessions` | Active sessions | `tier` — single source of truth for tier enforcement |
| `config` | Dashboard settings | No `tier` key here |
| `tabs` | Dashboard tabs | `order` for sort position |
| `widgetInstances` | Placed widgets | `configEncrypted` (non-credential config only) + `configSchemaVersion` |
| `credentials` | Secrets | `valueEncrypted` — always AES-256-GCM |
| `licenseActivation` | Local tier JWT | `activationJwt` — RS256, verified against embedded public key |

Migrations: `0001_spicy_clea.sql` (canonical schema) + `0002_keen_luminals.sql` (configSchemaVersion).
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
- `standard+` (requireTier('standard')): `/pihole`, `/rss`, `/links`, `/ai/chat`
- `any session` (requireSession): `/config`, `/widgets`, `/auth/session`, `/update/check`, `/ai/status`, `/ai/config`, `/ai/test-ollama`
- `public`: `/auth/login`, `/health`

---

## Implementation status

> **Important:** Update this section manually after every session.
> Mark completed items ✅, in-progress 🔄, not started ⬜.

### Phase 1 — Core
- ✅ DB schema — all 7 tables + configSchemaVersion + authMode rename, migrations 0001 + 0002 + 0003
- ✅ AES-256-GCM encryption (`packages/db/src/crypto.ts`) — HKDF-SHA256 key derivation
- ✅ PHAVO_SECRET auto-generate — `loadOrCreateSecret()` with atomic `wx` flag, stored in `paths.encKey`
- ✅ Platform abstraction (`packages/types/src/env.ts`, `apps/web/src/lib/server/paths.ts`)
- ✅ Auth flows — full phavo.net OAuth + Local Argon2id paths; session creation after TOTP only
- ✅ Session validation middleware — standalone `authMiddleware`; expiry + grace period enforced; hourly pruning
- ✅ Tier enforcement middleware — `requireTier()` on all Standard/AI endpoints; mock auth defaults to `'free'`
- ✅ Widget registry + split manifest — `getManifest(tier)` returns 7 full + 3 teasers for Free; 10 full for Standard/Local

### Phase 1 — API
- ✅ `GET /api/v1/health` — public, no auth, returns version + platform + DB check (503 if unreachable)
- ✅ `installMethod` derivation — `deriveInstallMethod()` in `install.ts`
- ✅ Metric endpoints — all 7 routes with `requireSession()` and caching
- ✅ Pi-hole endpoint — reads encrypted credentials from DB; SSRF-protected via `assertNotCloudMetadata()`
- ✅ RSS endpoint — reads per-instance feed configs; partial failures return items + errors array
- ✅ Links endpoint — reads grouped link config from `configEncrypted`
- ✅ Config GET / POST — Zod-validated (ConfigPostSchema); Free tier tab count capped at 1 server-side
- ✅ Config export / import — `.phavo` format; PBKDF2-SHA256 credential encryption; transactional import; UUID remapping
- ✅ Update check — 1h cache; notification trigger; update command per `installMethod` via `execFile()`
- ✅ Widget instance config — credential fields → `credentials` table; rest → `configEncrypted`
- ✅ Licence activate / deactivate — RS256 JWT verification; `PHAVO_IO_PUBLIC_KEY` required in production
- ✅ CSRF middleware — applied to POST/PUT/DELETE/PATCH; `fetchWithCsrf()` on all frontend mutations
- ✅ Auth routes — logout, session, TOTP; login throttling with bounded Map
- ✅ AI endpoints — `POST /ai/chat` (requireTier('standard')); Ollama/OpenAI/Anthropic; SSRF-protected
- ✅ Mock auth production-gated — `DEV_MOCK_AUTH_ENABLED = PHAVO_DEV_MOCK_AUTH && NODE_ENV !== 'production'`

### Phase 1 — Frontend
- ✅ Dashboard layout — Sidebar + Header wired; widgets render; widget removal from dashboard
- ✅ Widget polling store — state machine (loading/active/unconfigured/error/stale); retry; threshold notifications
- ✅ Widget drawer — bottom sheet on desktop; locked teaser cards; category filter chips; resize handle
- ✅ Tab limit UI — Free tier shows upgrade prompt on second tab attempt
- ✅ Notification panel — exists + wired; working
- ✅ Quick Setup Wizard — real auth wiring (phavo.net OAuth + Local), location, sessionStorage persistence
- ✅ Full Setup Wizard — all steps wired: auth, location + weather preview, tab builder, widget select + assign + config
- ✅ Settings page — 7 tabs: general, account, security, widgets (master/detail), licence, import/export, about
- ✅ Licence UI — Free/Standard/Local views; activate + deactivate wired to backend
- ✅ Update panel — Settings → About; version, changelog, update command
- ✅ Pi-hole + RSS config UI — SchemaRenderer; credential masking; test connection button
- ✅ Import / Export UI — `.phavo` export (Blob download); drag-and-drop import; client-side validation; preview panel
- ✅ Command Palette / HeaderSearch — Cmd+K; inline dropdown below search bar; local search + web search + AI chat; Free tier shows locked AI with upgrade prompt
- ✅ Mobile responsiveness — ≥375px; bottom nav <640px; widget grid 1/2/12-col; settings vertical stack

### Phase 1 — Design
- ✅ Theme — pure black (#000000) dark; Geist font (UI + Mono); amber/gold accent (#d4922a)
- ✅ CSS token system — all colours via CSS variables; no hardcoded hex in components
- ⬜ Light theme — token system ready, not designed

### Phase 1 — Infrastructure
- ✅ Docker — 2-stage + non-root user; multi-arch (amd64 + arm64); read_only + tmpfs; HEALTHCHECK; PHAVO_MIGRATIONS_DIR
- ✅ CSP headers — nonce-based via `svelte.config.js csp: { mode: 'nonce' }` + `hooks.server.ts`
- ✅ Rate limiting — per-IP in-memory; TOTP 5/5min, metrics 60/1min, import 5/10min, default 120/1min; `PHAVO_TRUST_PROXY` env var
- ✅ Version management — root `package.json` SSOT; Vite injects `PHAVO_VERSION`; `release:patch/minor/major` scripts; Docker CI; GitHub Release workflow; CHANGELOG.md
- ✅ God-file split — `+server.ts` (2660 lines → 99 lines); 10 route modules + 3 shared helpers under `apps/web/src/lib/server/routes/`; 44 routes verified
- ✅ MEDIUM audit fixes — all 14 applied; config/tabs/auth/license/system/ai/integrations/widgets route modules + agent.ts/hooks.server.ts/docker-compose.yml/env.ts
- ⬜ Plugin loading pipeline — `paths.plugins` defined; no loading logic

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

### Dev server startup (Windows)
```powershell
cd C:\Users\fabio\Documents\local_repositorys\phavo
$env:PHAVO_DEV_MOCK_AUTH="true"; $env:PHAVO_SECRET="dev-secret"; $env:PHAVO_PORT="3000"; $env:PHAVO_ENV="development"; $env:PHAVO_DATA_DIR="./apps/web/.dev-data"; bun run dev
```
Or use the `dev.ps1` script in the repo root.

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
- Use `exec()` with shell strings — always use `execFile()` for subprocess calls
- Fetch user-supplied URLs without calling `assertNotCloudMetadata()` first
- **Write a hardcoded Settings panel for a specific widget** — all widget config UI must go through `<SchemaRenderer>`

---

## Common tasks — quick reference

### Add a new widget
1. Add metric type to `packages/types/src/metrics.ts` (if new shape)
2. Implement metric function in `packages/agent/src/metrics/`
3. Re-export from `packages/agent/src/index.ts`
4. Register `WidgetDefinition` in `apps/web/src/lib/server/widget-registry.ts`
5. Add API route in `apps/web/src/lib/server/routes/metrics.ts` (or appropriate category module)
6. Apply `requireTier('free' | 'standard')` middleware
7. Create Svelte component in `apps/web/src/lib/widgets/[Widget].svelte` (presentational only — no data fetching)
8. Wire rendering in `apps/web/src/routes/+page.svelte`
9. If configurable: add Zod `configSchema` in widget-registry.ts — SchemaRenderer handles Settings UI automatically

### Add a new Settings tab
1. Add tab ID to the tab list in `src/routes/settings/+page.svelte`
2. Create component at `src/lib/components/settings/[TabName].svelte`
3. Deep-link via URL hash: `/settings#tabname`

### Add a new DB migration
1. Update schema in `packages/db/src/schema.ts`
2. Run `bun drizzle-kit generate`
3. Commit the migration file — never edit the DB file manually
4. `0001_spicy_clea.sql` is the canonical full schema — `0002_keen_luminals.sql` adds `configSchemaVersion`

### Add a new API route (after god-file split)
1. Find the appropriate module in `apps/web/src/lib/server/routes/`
2. Add the route handler inside the `registerXxxRoutes(app)` function
3. Apply `requireSession()` or `requireTier('standard')` as needed
4. Return `ok(data)` or `err(message)` — never raw JSON
5. Validate request body with Zod `.safeParse()` before use

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

### Resolved — Security Hardening ✅
- ~~`tier` in `DashboardConfig`~~ — removed; tier now only from session
- ~~Layout fake session fallback~~ — cleared; invalid sessions now redirect to /setup
- ~~CSRF fallback secret~~ — `PHAVO_SECRET` required in production, process exits if missing

### Resolved — Production Audit Fixes v1 ✅
- ~~CSRF tokens missing from Settings + Widget store~~ — `fetchWithCsrf()` utility in `utils/api.ts`
- ~~SSRF via /pihole/test~~ — cloud metadata endpoints blocked; `assertNotCloudMetadata()` helper
- ~~Session cookies missing Secure flag~~ — `; Secure` added in production
- ~~POST /config not Zod-validated~~ — `ConfigPostSchema.safeParse()` with length limits + enum checks
- ~~Config import not transactional~~ — wrapped in `db.transaction()`; full rollback on failure
- ~~External APIs not Zod-validated~~ — weather.ts, pihole.ts, license.ts all use safeParse()
- ~~Notification queue unbounded~~ — capped at 100, oldest dropped on overflow
- ~~Default PHAVO_SECRET accepted in production~~ — process exits if value is 'change-me'
- ~~configSchemaVersion missing from schema~~ — added; migration 0002_keen_luminals.sql
- ~~Health check doesn't verify DB~~ — SELECT 1 check; returns 503 if unreachable
- ~~partialSessions map unbounded~~ — capped at 1000 pending TOTP sessions
- ~~Redundant await dbReady in route handlers~~ — all 18 removed
- ~~.svelte-kit in docker tmpfs~~ — removed

### Resolved — Production Audit Fixes v2 ✅
- ~~`exec()` in `/update/apply`~~ — replaced with `execFile()` chain
- ~~SSRF in Ollama endpoints~~ — `assertNotCloudMetadata()` applied to all user-supplied URLs
- ~~`loginAttempts` Map unbounded~~ — capped at 10000, pruned every 5min
- ~~`X-Forwarded-For` trusted unconditionally~~ — `PHAVO_TRUST_PROXY` env var; `getClientIp()` unified
- ~~`renderMarkdown` XSS~~ — `escapeHtml()` applied before regex transforms
- ~~Dockerfile missing HEALTHCHECK~~ — added, probes `/api/v1/health`
- ~~Expired sessions never pruned~~ — hourly cleanup job in `hooks.server.ts`
- ~~Session created before TOTP~~ — session inserted only after TOTP verification

### Resolved — Misc ✅
- ~~Windows ESM module resolution~~ — `.js` extensions added to all relative imports in packages
- ~~`authMode: 'phavo-io'`~~ — migrated to `'phavo-net'`; migration 0003_auth_mode_rename.sql; commit 27da53b
- ~~Locked widget price €7.99~~ — updated to €8.99 in en.json, +page.svelte, UpgradeBanner.svelte, WidgetDrawer.svelte
- ~~Locked widget label 'STANDARD'~~ — changed to 'LOCKED'
- ~~Upgrade button contrast~~ — color: var(--color-bg) on amber background
- ~~`bun drizzle-kit migrate` broken~~ — libsql client bumped to ^0.14.0; duplicate SQL removed
- ~~PHAVO_DEV_MOCK_AUTH not reaching process.env~~ — fixed via Vite `define` block in `vite.config.ts`

### Resolved — Infrastructure ✅
- ~~GitHub repo at phabioo/phavo~~ — transferred to `getphavo/phavo`
- ~~Docker Hub username~~ — `getphavo` account created, `getphavo/phavo` repository public
- ~~GitHub Secrets~~ — `DOCKERHUB_USERNAME` + `DOCKERHUB_TOKEN` set
- ~~Hetzner Mail~~ — MX + SPF + DKIM records set in Cloudflare

### Active — pre-Launch
- ✅ LOW audit fixes — all 6 applied; CSP comment, RSS hash key, weather locationDefault, graceful shutdown, startup logging, auth event logging

- ✅ a11y warnings — all 7 fixed: HeaderSearch clear button, Input/Select label association, Switch aria-label, TabBar nav→div + menu role, WidgetDrawer locked/unlocked split via Svelte 5 snippet; 0 warnings
- **Docker Hub setup** — Account `docker@phavo.net`, Repository `getphavo/phavo`, GitHub Secrets needed
- **Hetzner Mail** — MX-Records bei Cloudflare, Mailboxen: docker@, security@, hello@, noreply@ phavo.net
- **Landing Page** phavo.net — Hero, Pricing, Quick-Start, Links
- **docs.phavo.net** — Installation, Widget-Referenz, Command Palette Guide, FAQ

### General
- **svelte-check a11y warnings** — 8 pre-existing in shared UI components; address post-launch
- **Open-Meteo geocoding rate limits** in Setup Wizard — debounce required (500ms recommended)
- **Drag-and-drop library** not yet chosen — candidates: `@neodrag/svelte`, `svelte-dnd-action`
- **`isDockerCompose()` detection** — heuristic not yet implemented in `install.ts`
- **Tauri free port reservation** — atomic port reservation needed to avoid race condition
- **Plugin loading pipeline** — `paths.plugins` defined; no loading logic; Phase 1.x
- **Light theme** — CSS token system ready; not designed; post-launch

---

*Phavo · phavo.net · github.com/getphavo/phavo*
*CLAUDE.md v2.8 · PRD ref: v2.7 · Arch Spec ref: v1.9 · Contract: PHAVO_CONTRACT_v3.md · Roadmap: docs/phavo_roadmap_v3.html*
