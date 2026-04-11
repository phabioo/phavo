# Phavo — Product Requirements Document

**Version:** 4.1
**Date:** 2026-04-09
**Status:** Active — MA Design & Experience in progress · Pre-Launch
**Owner:** getphavo

**Changelog v4.1:** Documentation alignment with the v0.8.0 runtime. UI updates include
header scroll state handling and sidebar delete-page actions. Server updates include
expanded notification routes, current auth/session behavior, and current license
activation flow.

**Changelog v4.0:** Complete product model revision. Tiers simplified to Stellar (free)
+ Celestial (one-time, €24.99). No subscriptions, no phavo.net account infrastructure,
no cloud backend. Runtime auth/license is local-only in v1.0: offline Ed25519
verification + local session enforcement.
Design language updated to Celestial Wish. Phase 4 cloud/sync/marketplace deferred
indefinitely. Auth mode is `local` at runtime.
Tier identifiers in code: `stellar` / `celestial`.

---

## 1. Product Overview

Phavo is a modular, self-hosted personal dashboard.
**Positioning: "Your personal dashboard, done right."**

Phavo targets two core personas: homelab/self-hosting users who want a polished
dashboard without YAML or config files, and informed consumers who want a personal
daily dashboard without setup complexity. Both share the same core need — a dashboard
that works beautifully without friction — and differ only in their entry point.

The core promise: **beautiful by default, infinitely extensible, yours to own — built
with security at every layer, and no cloud required.**

### Product Tiers

| | Stellar | Celestial |
|---|---|---|
| **Price** | €0 forever | €24.99 one-time (launch: €16.99) |
| **License** | None required | Ed25519 offline key via Gumroad |
| **Internet required** | Never | Never (after key import) |
| **Pages** | 1 (Home only) | Unlimited |
| **Widgets** | Stellar set (7) | All widgets (14+) |
| **AI Assistant** | ✗ | ✓ |
| **Phavo branding** | Visible | Removable |
| **Refund** | N/A | 14-day guarantee |
| **Updates** | All v1.x | All v1.x |
| **Code identifier** | `stellar` | `celestial` |

**There are no subscriptions.** The product is a one-time purchase.
All 1.x feature updates are included in the Celestial purchase.

### Open Source Strategy

Open source release is deferred to post-v1.0. Codebase is currently closed source
(all rights reserved). After v1.0 proves commercial viability, a dual-licence release
(AGPL-3.0 + commercial) will be evaluated.

---

## 2. Background & Context

Phavo is the successor to **phaboard** — a locally-hosted Node.js/Svelte dashboard
running on a Raspberry Pi. Phaboard proved the concept: modular widgets, system
metrics, Pi-hole integration. Phavo rebuilds it from scratch with a production-grade
stack, a proper business model, and a multi-platform roadmap.

**Existing tools and their gap:**

| Tool | Weakness |
|---|---|
| Dashy / Homepage | Config via YAML only, no GUI |
| Glance | Minimal, no widget system |
| Übersicht | macOS only, dead community |
| iStat Menus | System monitoring only, not extensible |

Phavo's differentiator: **polished Celestial Wish design, guided setup, resizable
widgets, extensible plugin system, free Stellar tier to drive adoption, fully offline.**

---

## 3. Goals

### Primary Goals (v1.0)
- Ship a self-hosted web dashboard with a curated set of launch widgets
- Deliver both Quick Setup and Full Setup guided experiences
- Establish a clean widget schema and plugin API as the foundation for the ecosystem
- Launch a free Stellar tier to drive adoption; convert to Celestial via one-time purchase
- Generate initial revenue; validate product-market fit

### Secondary Goals (v1.0)
- Deliver the Celestial Wish design — a visually distinctive, atmospheric dark dashboard
- Build a complete CSS token system that enables theming from day one
- Publish phavo.net landing page before launch
- Establish documentation and a support channel at launch

### Non-Goals (v1.0)
- Cloud sync or multi-user support (deferred indefinitely)
- Widget marketplace (deferred until traction proven)
- Mobile or desktop native apps (v1.1+)
- phavo.net account infrastructure — no server-side session validation
- Subscriptions of any kind
- Multi-device or multi-user

---

## 4. Target Users

### Persona A — The Homelab Enthusiast
- IT professional, developer, or power user
- Runs a Raspberry Pi, home server, or NAS
- Wants system metrics, Pi-hole stats, and service monitoring in one place
- Comfortable with Docker and basic configuration
- Values reliability, performance data, and extensibility
- **Entry point:** Stellar tier → upgrades to Celestial for full widget set + AI

### Persona B — The Informed Consumer
- Non-technical but digitally fluent
- Wants a personal dashboard: weather, news, bookmarks
- Values design quality and ease of use
- May not own a server — runs Phavo on a home machine via Docker
- **Phase 1 limitation:** Docker knowledge required. A native installer (v1.1 desktop
  app) removes this barrier.
- **Entry point:** Sees screenshot/demo, buys Celestial directly

---

## 5. Tech Stack

```
Monorepo:   Turborepo + Bun Workspaces
Language:   TypeScript (strict)
Linting:    Biome

apps/
  web/        SvelteKit + Svelte 5 Runes (Phase 1 — active)
  desktop/    Tauri 2.0 stub (v1.1+)
  mobile/     Tauri Mobile stub (future)

packages/
  ui/         @phavo/ui — Svelte 5 component library + Celestial Wish theme
  db/         @phavo/db — Drizzle ORM + libSQL + AES-256-GCM crypto
  types/      @phavo/types — shared TypeScript types & schemas
  agent/      @phavo/agent — system metrics + integration collectors

Design:     Celestial Wish Design System (docs/design.md)
Components: shadcn-svelte + Bits UI
Icons:      Lucide via <Icon> abstraction — never direct lucide-svelte imports
Fonts:      Geist + Geist Mono via @fontsource — never Google Fonts CDN
API:        Hono (mounted via SvelteKit catch-all)
Auth:       Local only (username + password + Argon2id)
Database:   libSQL (SQLite, local)
Docker:     multi-arch (amd64 + arm64)
CI/CD:      GitHub Actions
```

---

## 6. Phase 1 — Web Dashboard

### 6.1 Summary

A SvelteKit web application served via Docker (or direct Bun process). Users access
it via browser at their local IP or custom domain. All data stays local, always.

**Stellar tier (free):** No account, no key, no internet. Just run and go.
Base widgets + 1 page (Home). Phavo branding visible.

**Celestial tier (paid, one-time):** User pastes a Gumroad license key in
Settings → Licence. The app verifies the Ed25519 signature offline against the
embedded public key. After verification, tier is persisted in the DB. No further
network calls ever — not on login, not on restart, not ever.

### 6.2 Core Features

#### Setup Assistant — Quick Setup

For users who want to get started immediately. Default path for Persona B.

**Flow (3 steps):**
1. **Auth** — Create local account (username + password, Argon2id hashing)
2. **Weather location** — Optional, skippable. Open-Meteo geocoding.
3. **Done** — Dashboard loads with sensible default layout.

#### Setup Assistant — Full Setup

For users who want a tailored experience from the start.
Each step has a back button and a progress indicator.

**Flow:**
1. **Welcome** — Phavo logo, tagline, two CTAs: "Quick Setup" / "Full Setup"
2. **Account creation** — Username + password + confirm. Local only.
3. **Dashboard name** — Text input, default "My Dashboard". 1–40 chars.
4. **Weather location** — City search with geocode. Skippable.
5. **Pages** — Add/rename/reorder pages. Default: one page "Home".
   Stellar: add button disabled after first page with upgrade prompt.
6. **Plugin installation (optional)** — Upload `.phwidget` files. Permissions shown.
   Skip available. Installed plugins appear in next step.
7. **Widget selection** — Grid loaded from registry manifest. Locked Celestial widgets
   shown as teasers. Multi-select Stellar widgets to start.
8. **Widget configuration** — Only for widgets with `configSchema`. Per-widget:
   - Pi-hole: URL + token + "Test connection"
   - RSS: feed URL(s) + optional auth
   - Weather: auto-filled from step 4
9. **Done** — Animated success screen. Config saved. "Go to dashboard →"

**State persistence:** Each step saved to `sessionStorage`. Browser refresh does
not lose progress. If `setupComplete = false`, redirect to `/setup` at last step.

#### Dashboard Layout

- BentoGrid: 12-column CSS grid. Widget sizes S/M/L/XL with grid snapping.
  colSpan × rowSpan from widget instance config.
- Multiple named pages with per-page widget assignment (Celestial; Stellar: 1 page)
- Layout persisted to database per page
- Sidebar navigation (collapsible, 240px expanded / 64px collapsed)
- Live clock + weather summary in header
- **Mobile responsive:** ≥375px usable
  - Mobile (<640px): sidebar → bottom nav bar. Single-column grid. S/M → full-width.
  - Tablet (640–1024px): icon rail (64px). 4-column BentoGrid.
  - Desktop (>1024px): full sidebar (240px), 8-column BentoGrid.
  - Minimum touch targets: 44×44px (WCAG 2.1 AA)
  - No horizontal scroll at any breakpoint
- **Widget drawer:** `+` button adds/removes widgets without setup re-run

#### Update Mechanism

- Header badge appears when a new version is available (GitHub Releases API poll,
  1h cache, user-initiated only)
- Clicking opens update panel: current version, new version, full changelog
- Shows exact update command for user's install method (Docker Compose snippet,
  Bun CLI, Tauri auto-update)
- Docker Compose: optional one-click update if Docker socket is accessible (opt-in)
- Accessible at any time via Settings → About

#### Settings Pages

Master-detail layout: Sidebar (280px) = navigation cards, detail panel = full-width content.

**Tabs:**
- **General** — Dashboard name, weather location, display preferences
- **Widgets** — Per-widget configuration, size selection, data endpoint status
- **Backup & Export** — .phavo export/import, credential inclusion toggle
- **Licence** — Celestial key activation/deactivation, tier status, Gumroad link
- **Account** — Username, password change, TOTP 2FA setup
- **Plugins** — Installed plugin list, .phwidget upload
- **About** — Version info, update check, system health

**Visual architecture:**
- Two-column card grid (`.settings-cards-grid`) for detail content
- Hero/status card (`.settings-hero-card`) with gold background accent
- Form card (`.settings-form-card`) for configuration inputs
- Input fields: `--color-surface-dim` background, teal focus ring (`--color-secondary`)

#### Widget System

Auto-discovered from the backend registry. The manifest drives the setup flow,
dashboard loader, widget drawer, and settings UI.

**Widget contract (`@phavo/types`):**
```typescript
interface WidgetDefinition {
  id: string                    // globally unique, reverse-DNS: "net.phavo.cpu"
  name: string
  description: string
  version: string               // semver
  author: string                // "phavo" for built-ins
  category: 'system' | 'consumer' | 'integration' | 'utility' | 'custom'
  tier: 'stellar' | 'celestial' // 'stellar' available on both tiers
  sizes: ('S' | 'M' | 'L' | 'XL')[]
  configSchema?: ZodSchema       // drives auto-rendered settings panel
  dataEndpoint: string           // relative path served by widget's Hono handler
  refreshInterval: number        // ms; minimum enforced: 1000ms
  permissions: WidgetPermission[]
  notifications?: { condition: string; type: Notification['type'] }[]
}

// Teaser sent to browser for locked Celestial widgets (Stellar users):
interface WidgetTeaserDefinition {
  id: string
  name: string
  description: string
  tier: 'celestial'
  locked: true
  // No dataEndpoint, configSchema, or permissions ever sent to Stellar clients
}
```

**Widget states:**

| State | Meaning | WidgetCard treatment |
|---|---|---|
| `active` | Data loaded, rendering | Default surface |
| `loading` | First fetch in progress | CSS skeleton shimmer |
| `error` | Fetch or config error | Error container bg + message |
| `unconfigured` | `configSchema` present but not filled | Muted + configure CTA |
| `stale` | Data older than 2× refresh interval | 2px top stripe |

**Widget size → BentoGrid span:**

| Size | colSpan | rowSpan | Content depth |
|---|---|---|---|
| S | 1 | 1 | Number + label only |
| M | 2 | 2 | Stat + progress + subtitle |
| L | 4 | 4 | Stat + chart or list |
| XL | 8 | 4 | Full data story + nebula glow + WishStar |

Widgets are always **presentational** — no self-fetching.
Data flows: store → widget component. Never widget → API.

#### Notifications

DB-persisted (not in-memory — survives restarts).

| Type | Source | Example |
|---|---|---|
| `update` | Phavo core | "Phavo v1.2.0 is available" |
| `security` | Phavo core | "Brute-force attempt detected" |
| `widget-error` | Any widget | "Pi-hole unreachable" |
| `widget-warning` | Any widget | "Disk at 91% capacity" |
| `task` | Phavo core | "Backup completed" |
| `info` | Phavo core | "Setup completed successfully" |

**Built-in triggers:**
- Disk usage >90% on any mount → `widget-warning`
- CPU temperature >80°C → `widget-warning`
- Pi-hole unreachable after 3 failed polls → `widget-error`
- RSS feed consistently failing → `widget-error`
- Update available → `update`

#### File Formats

- Config backup: `.phavo` (JSON archive)
- Widget plugin: `.phwidget` (ZIP bundle)
- Theme: `.phtheme` (ZIP bundle, post-launch)

Credential export excluded by default. Separate prompt to include them,
encrypted with user-provided passphrase.

---

### 6.3 Launch Widgets

#### Stellar Tier Widgets

| Widget | Data |
|---|---|
| CPU | Usage %, per-core breakdown, load average |
| Memory | Used / total, swap, segmented donut chart |
| Disk | Per-mount usage %, read/write throughput |
| Network | Upload/download speed, total traffic |
| Temperature | CPU temp (where available) |
| Uptime | System uptime, human-readable |
| Weather | Open-Meteo, no API key. Current + 5-day forecast. |

#### Celestial Tier Widgets (all Stellar + the following)

| Widget | Details |
|---|---|
| Pi-hole | Total queries, blocked %, blocklist count, enable/disable toggle |
| RSS Feed | User-configurable feeds. Title, source, timestamp. Auth supported. |
| Links / Bookmarks | Named links with icons, grouped by category |
| Docker | Container status, CPU + RAM per container, restart button. Opt-in socket. |
| Service Health | HTTP/Ping checks for self-hosted services. Response time + status badge. |
| Speedtest | On-demand speed test + 30-result history chart. Rate-limited 1/5min. |
| Calendar | CalDAV feed or local events. Upcoming events view. |

#### Post-v1.0 Widgets

| Widget | Notes |
|---|---|
| Spotify | OAuth relay via phavo.net. Now playing, controls. Celestial only. |

---

### 6.4 Celestial Tier Conversion Strategy

Conversion levers built into the product:

- **Widget drawer upgrade prompt:** Celestial widgets visible but locked for Stellar
  users — lock icon + "LOCKED" label. Click triggers upgrade prompt with Gumroad link.
  Split manifest: Stellar clients receive teaser entries only (no `dataEndpoint`,
  `configSchema`, or `permissions`).
- **Page limit prompt:** Attempting to add a second page on Stellar shows upgrade prompt.
- **Phavo branding:** "Powered by PHAVO" footer badge on Stellar. Removable on Celestial.
- **No feature degradation:** Stellar tier stays free indefinitely.

---

### 6.5 License Architecture (Celestial — Local-First)

Runtime is local-only for auth/license in v1.0.

License key format:
```
base64url(ed25519_signature || json_payload)

Payload:
{
  "tier": "celestial",
  "licenseId": "<uuid>",
  "issuedAt": "<iso8601>"
}
```

Activation flow:
1. User purchases on Gumroad → receives key via email
2. User pastes key in Settings → Licence
3. App verifies key offline against embedded/public Ed25519 key and writes activation payload/signature
4. On success: tier written to `license_activation` table, session updated
5. Session/tier enforcement remains server-side in local runtime

**Ed25519 key management:**
- Private key: GitHub Actions Secrets only, never in repo
- Two public keys embedded in binary (current + next) for rotation
- Key rotation: bump `next` → `current` in next release, generate new `next`
- Tampered key: signature verification fails → falls back to Stellar behaviour

**Deactivation:** User can clear their license in Settings → Licence.
Falls back to Stellar. Re-activation requires the same key.

---

### 6.6 API Design

All endpoints follow a consistent response envelope:
```typescript
{ ok: true, data: T }         // success
{ ok: false, error: string }  // error
```

Middleware stack: `auth → csrf → rate-limit → handler`

**Local app endpoints:**
```
GET  /api/v1/config
GET  /api/v1/config/export
POST /api/v1/config/import
POST /api/v1/config

GET  /api/v1/widgets

GET  /api/v1/metrics/cpu
GET  /api/v1/metrics/memory
GET  /api/v1/metrics/disk
GET  /api/v1/metrics/network
GET  /api/v1/metrics/temperature
GET  /api/v1/metrics/uptime
GET  /api/v1/metrics/weather

GET  /api/v1/integrations/pihole
POST /api/v1/integrations/pihole/test
GET  /api/v1/integrations/rss
GET  /api/v1/integrations/links

POST /api/v1/auth/login
POST /api/v1/auth/logout
GET  /api/v1/auth/session
POST /api/v1/auth/totp/setup
POST /api/v1/auth/totp/verify

POST /api/v1/license/activate
POST /api/v1/license/deactivate
GET  /api/v1/license/status

GET  /api/v1/update/check
POST /api/v1/update/apply

GET  /api/v1/tabs
POST /api/v1/tabs
PATCH /api/v1/tabs/:tabId
DELETE /api/v1/tabs/:tabId

GET  /api/v1/widgets/instances
POST /api/v1/widgets/instances
PATCH /api/v1/widgets/instances/:id
DELETE /api/v1/widgets/instances/:id

GET  /api/v1/notifications
POST /api/v1/notifications
PATCH /api/v1/notifications/:id
PATCH /api/v1/notifications
PATCH /api/v1/notifications/mute
DELETE /api/v1/notifications/:id
DELETE /api/v1/notifications

GET  /api/v1/plugins
POST /api/v1/plugins/upload
DELETE /api/v1/plugins/:pluginId

GET  /api/v1/ai/status
POST /api/v1/ai/chat

GET  /api/v1/system/health
GET  /api/v1/system/about
```

**AI Assistant (Celestial tier):**
The AI Assistant uses the Vercel AI SDK (`ai` package) with a unified provider
abstraction supporting Ollama (local, fully offline via `ollama-ai-provider`),
OpenAI (`@ai-sdk/openai`), and Anthropic (`@ai-sdk/anthropic`).
Streaming responses via Hono SSE (`streamSSE` helper). The searchbar AI mode
consumes the same streaming endpoint. API keys are stored server-side in
encrypted form (`credentials` table) and never exposed to the browser.

**Runtime note (v4.1):**
Auth and license paths are local-only (`local` mode). Session and tier enforcement remain server-side.

---

### 6.7 Design System — Celestial Wish

Full specification: `docs/design.md`. Summary:

**Creative North Star:** "The Astral Curator" — atmospheric dark, editorial typography,
tonal depth without visible borders.

**Palette anchors:**
- Base surface: `#0f131f` (Deep Celestial Blue)
- Primary accent: `#dcc66e` (Soft Gold) — wordmark, hero stats, active nav
- Secondary: `#3fc8a0` (Teal) — progress, system online indicator
- Tertiary: `#a89cf5` (Cosmic Purple) — nebula glows, gradient accents

**Typography:** Geist 300/400/500 + Geist Mono. Self-hosted via `@fontsource`.

**Iron rules:**
- Zero hardcoded hex/rgb/hsl in `@phavo/ui` — CSS tokens only
- No `1px solid` borders for layout — tonal surface tier shifts instead
- No Google Fonts CDN — `@fontsource/geist` only
- Glassmorphism requires Pi 3/4 fallback (`max-resolution: 1.5dppx`)

**Wish Star motif:** 4-pointed SVG star, decorative element on XL widget cards.
Static (no animation) for Pi 3 performance.

**Dark only at launch.** Token system enables future themes with no component changes.

---

### 6.8 Docker

Target: `docker run -p 3000:3000 -v phavo-data:/data getphavo/phavo`

- Single-container
- Multi-arch: amd64 + arm64 (Raspberry Pi 3/4/5)
- Docker Hub: `getphavo/phavo` — tagged `:VERSION` + `:latest`
- Volume `phavo-data` persists database, config, plugins, license activation
- Runs as non-root user
- Read-only filesystem except for `phavo-data` volume
- **TLS — three modes:**
  - Self-signed (default) — generated on first start
  - Custom cert — user provides cert + key via volume
  - Let's Encrypt/ACME — for publicly reachable instances

### 6.9 Platform Abstraction

All server code uses environment variables — no hardcoded paths or ports.
Required for Phase 2 Tauri compatibility without code changes.

| Variable | Default (Docker) | Tauri value | Purpose |
|---|---|---|---|
| `PHAVO_DB_PATH` | `/data/phavo.db` | OS app data dir | libSQL location |
| `PHAVO_DATA_DIR` | `/data` | OS app data dir | Parent for all data |
| `PHAVO_PORT` | `3000` | Dynamic free port | HTTP port |
| `PHAVO_ENV` | `docker` | `tauri` | Platform identifier |

**Iron rule:** Never use `/data/` as a literal string. Always `process.env.PHAVO_DATA_DIR`.

---

## 7. Phase 2 — Desktop App (v1.1+)

Tauri 2.0 wraps the existing SvelteKit/Hono server as a sidecar process.
No changes to `apps/web/` — the platform abstraction layer is the only prerequisite.

**Installer roadmap:**
- **v1.1** — Linux: `.deb` + AppImage. No signing.
- **v1.2** — macOS: Apple Developer ID (€99/year, register before milestone).
- **v1.3** — Windows: unsigned or standard cert (SmartScreen warning acceptable).

**Features:** System tray, auto-update (Tauri Updater + Ed25519), autostart option.

---

## 8. Phase 3 — Mobile (Future)

Tauri 2.0 Mobile. Same `@phavo/ui` components. Touch-optimized layout.
iOS, iPadOS, Android. Dependent on Phase 2 success.

---

## 9. Phase 4 — Cloud + Marketplace (Deferred)

**Status: Deferred indefinitely. No development until v1.0 proves traction.**

If v1.0 achieves sufficient adoption, potential future scope:
- Turso cloud libSQL for multi-device sync
- Widget Marketplace at `store.phavo.net`
- Phase 4 subscription (separate product, does not affect one-time pricing)
- Developer accounts + revenue share
- Hosted public demo instance

No code, no stubs, no placeholders for Phase 4 in the current codebase.

---

## 10. Monetization

### Pricing

| Tier | Price | Model |
|---|---|---|
| Stellar | €0 | Free forever |
| Celestial | €24.99 (launch: €16.99) | One-time purchase, all v1.x updates |

**Payment processor:** Gumroad (Merchant of Record — handles EU VAT automatically).
**Delivery:** License key emailed after purchase. Pasted into Settings → Licence.
**Refund:** 14-day money-back guarantee, no questions asked. Via Gumroad.
**Launch pricing:** First 30 days. Price increases announced ≥7 days in advance.

### Revenue Model

No recurring revenue at v1.0. Pure one-time licence sales.
Phase 4 subscription is a separate future product decision.

---

## 11. Security

### 11.1 Auth

- Local username + password (Argon2id), local-only runtime mode.
- Session: DB-backed, cookie-token based (random 32-byte session ID, not JWT).
- No tier data in cookie — tier derived from `license_activation` table on every request.
- Optional TOTP 2FA.
- No phavo.net account backend. No online auth/license runtime dependency.

### 11.2 Tier Enforcement

- `requireTier('celestial')` middleware on all Celestial API routes.
- Tier re-read from DB on every request — never from cookie payload.
- Widget manifest is tier-filtered server-side — Stellar clients never receive
  `dataEndpoint`, `configSchema`, or `permissions` for Celestial widgets.
- No tier column in `users` table — tier flows only via `license_activation` record.

### 11.3 License Security

- Ed25519 signature verification on activation and on every server start.
- Manually edited activation record → signature fails → fall back to Stellar.
- Two public keys embedded in binary for key rotation.
- Private key never in repo — GitHub Actions Secrets only.

### 11.4 Data Security

- AES-256-GCM encryption + HKDF key derivation for widget credentials at rest.
- CSRF double-submit protection on all non-GET mutations.
- Per-IP rate limiting with endpoint-specific rules.
- SSRF guard on all user-provided URLs.
- Subprocess safety: `execFile` only, never `exec`.

### 11.5 Client-Side Hardening

- Tier never serialised into HTML or client-accessible store.
- Widget manifest tier-filtering is the security gate — upgrade prompts are cosmetic UX.
- No debug endpoints in production.
- No telemetry. No analytics. No background network calls.

### 11.6 Rate Limits

| Endpoint | Limit | Window |
|---|---|---|
| `POST /api/v1/auth/login` | 10 requests | 5 min per IP + per account |
| `POST /api/v1/auth/*` | 30 requests | 1 min per IP |
| Integration endpoints | 60 requests | 1 min per session |
| `GET /api/v1/update/check` | 1 request | 1 hour per session |
| `POST /api/v1/config` | 20 requests | 1 min per session |
| `POST /api/v1/license/activate` | 5 requests | 1 hour per IP |

### 11.7 What Is Intentionally Not Hardened

- Users reading their own data from the volume — they own the hardware.
- Network interception between browser and local instance — local network, user's trust.
- Plugin source inspection — transparency is a feature.

---

## 12. Plugin System

### 12.1 Phase 1 — First-Party Structure

First-party widgets adopt the plugin file structure internally.
Third-party `.phwidget` ZIP bundle format is supported for user uploads.

### 12.2 Plugin File Structure

```
my-widget.phwidget (ZIP)
├── manifest.json       # id, name, version, tier, permissions, configSchema, ...
├── handler.ts          # Hono route handler (server-side)
└── Widget.svelte       # Svelte component (frontend)
```

### 12.3 Plugin Security

- Import allowlist: `@phavo/types`, `@phavo/agent`, `@phavo/plugin-sdk`, `hono`,
  `zod`, Node/Bun built-ins. No arbitrary npm packages.
- `plugin_data` table: key-value persistence, 10MB quota per plugin.
- Upload rate limit: 5 complete uploads per 10 minutes per session.
- Permissions declared in `manifest.json`, shown to user at install time.

### 12.4 Local Dev Mode

`PHAVO_PLUGIN_DEV_DIR` env var enables hot-reload from a local directory.
Dev env only — not available in production builds.

---

## 13. Success Metrics (v1.0 Launch)

- 500+ Docker Hub pulls in first month
- 50+ Celestial license sales within 60 days
- Stellar → Celestial conversion rate ≥ 8%
- Setup completion rate ≥ 80%
- < 5 critical bug reports in first 2 weeks
- Positive reception on r/selfhosted, r/homelab, Product Hunt

---

## 14. Launch Checklist (v1.0)

- [x] Docker Hub — `getphavo/phavo` public + GitHub Secrets set
- [x] Hetzner Mail — MX + SPF + DKIM in Cloudflare
- [x] GitHub Org — `getphavo/phavo`
- [x] Version management — release scripts + Docker CI working
- [ ] MA–MC milestones complete
- [ ] `bun run release:minor` → v1.0.0 → Docker CI → `getphavo/phavo:1.0.0`
- [ ] Pi 4/5 arm64 smoke test — fresh docker compose up, all 14 widgets
- [ ] phavo.net landing page live (hero screenshot from MA)
- [ ] Gumroad product live — Celestial €16.99 launch price, 14-day refund visible
- [ ] Public demo instance on phavo.net
- [ ] Launch channels: r/selfhosted, r/homelab, Product Hunt, Hacker News Show HN

---

## Appendix — Key Decisions

| # | Decision |
|---|---|
| 1 | **Two tiers only:** Stellar (free) + Celestial (one-time). No subscriptions. |
| 2 | **Fully offline:** No phavo.net account infrastructure. License is Ed25519-signed key. |
| 3 | **Tier identifiers in code:** `stellar` / `celestial`. No other strings. |
| 4 | **Gumroad as MoR:** Handles EU VAT. License key delivered via email. |
| 5 | **No machine lock in v1.0:** Key is not bound to hardware. Revisit in v1.1. |
| 6 | **No telemetry:** Neither tier sends any data anywhere. No toggle needed. |
| 7 | **Phase 4 deferred indefinitely:** No cloud, no marketplace, no sync in roadmap. |
| 8 | **Auth mode is `local` only:** Session and middleware paths enforce local-only runtime behavior. |
| 9 | **Design: Celestial Wish:** Atmospheric dark, Soft Gold primary, Teal secondary. |
| 10 | **Fonts via @fontsource:** Geist + Geist Mono. Google Fonts CDN never used. |
| 11 | **Icons via `<Icon>` abstraction:** Never `lucide-svelte` direct imports. |
| 12 | **No hardcoded values in @phavo/ui:** CSS tokens only. Iron rule, no exceptions. |
| 13 | **Glassmorphism Pi fallback:** `max-resolution: 1.5dppx` disables backdrop-filter. |
| 14 | **Widget manifest tier-filtered server-side:** Stellar clients never see Celestial endpoints. |
| 15 | **`requireTier()` reads from DB on every request:** Never from cookie or client. |
| 16 | **Two Ed25519 public keys embedded:** Current + next, for key rotation without breaking installs. |
| 17 | **Plugin import allowlist enforced at load time:** Arbitrary npm blocked until Phase 4. |
| 18 | **`plugin_data` quota:** 10MB per plugin_id, enforced server-side. |
| 19 | **Version management:** Single source in root `package.json`. Vite injects `PHAVO_VERSION`. |
| 20 | **Desktop roadmap:** v1.1 Linux, v1.2 macOS (register Apple Developer ID first), v1.3 Windows. |

---

*Phavo · phavo.net · github.com/getphavo/phavo*
