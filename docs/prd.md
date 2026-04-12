# Phavo — Product Requirements Document

**Version:** 5.0
**Date:** 2026-04-11
**Status:** Active — targeting v1.0 from the v0.8.3 baseline
**Owner:** phabioo

**Changelog v5.0:** Open source transition. Single free edition
(Celestial Edition). MIT license. Desktop/mobile/cloud removed from versioned roadmap
(anecdotal future ideas only). All commercial gating references removed.
Auth is local-only with no feature gates.

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

### Edition

PHAVO is free and open source (MIT). All features available to all users.
The current edition is **Celestial Edition**.

There are no subscriptions, no tiers, no feature gates. One edition, fully featured.

### Open Source Strategy

PHAVO is released under the MIT license. The codebase is public at
`github.com/phabioo/phavo`. All widgets, AI assistant, multi-page support,
and plugin system are available to every user.

---

## 2. Background & Context

Phavo is the successor to **phaboard** — a locally-hosted Node.js/Svelte dashboard
running on a Raspberry Pi. Phaboard proved the concept: modular widgets, system
metrics, Pi-hole integration. Phavo rebuilds it from scratch with a production-grade
stack and a clearer open-source product direction.

**Existing tools and their gap:**

| Tool | Weakness |
|---|---|
| Dashy / Homepage | Config via YAML only, no GUI |
| Glance | Minimal, no widget system |
| Übersicht | macOS only, dead community |
| iStat Menus | System monitoring only, not extensible |

Phavo's differentiator: **polished Celestial Wish design, guided setup, resizable
widgets, extensible plugin system, fully open source, fully offline.**

---

## 3. Goals

### Primary Goals (v1.0)
- Ship a self-hosted web dashboard with a curated set of launch widgets
- Deliver both Quick Setup and Full Setup guided experiences
- Establish a clean widget schema and plugin API as the foundation for the ecosystem
- Release as open source (MIT) to drive adoption and community contribution

### Secondary Goals (v1.0)
- Deliver the Celestial Wish design — a visually distinctive, atmospheric dark dashboard
- Build a complete CSS token system that enables theming from day one
- Publish phavo.net landing page before launch
- Establish documentation and a support channel at launch

### Non-Goals (v1.0)
- Cloud sync or multi-user support
- Widget marketplace
- Mobile or desktop native apps
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
- **Entry point:** Docker pull → running dashboard in minutes

### Persona B — The Informed Consumer
- Non-technical but digitally fluent
- Wants a personal dashboard: weather, news, bookmarks
- Values design quality and ease of use
- May not own a server — runs Phavo on a home machine via Docker
- **Entry point:** Sees screenshot/demo, pulls Docker image

---

## 5. Tech Stack

```
Monorepo:   Turborepo + Bun Workspaces
Language:   TypeScript (strict)
Linting:    Biome

apps/
  web/        SvelteKit + Svelte 5 Runes (active)

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

All features are available to all users. No entitlement flow, no internet
required. Just run and go.

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
6. **Plugin installation (optional)** — Upload `.phwidget` files. Permissions shown.
   Skip available. Installed plugins appear in next step.
7. **Widget selection** — Grid loaded from registry manifest. Multi-select widgets to start.
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
- Multiple named pages with per-page widget assignment
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
  Bun CLI)
- Docker Compose: optional one-click update if Docker socket is accessible (opt-in)
- Accessible at any time via Settings → About

#### Settings Pages

Master-detail layout: Sidebar (280px) = navigation cards, detail panel = full-width content.

**Tabs:**
- **General** — Dashboard name, weather location, display preferences
- **Widgets** — Per-widget configuration, size selection, data endpoint status
- **Backup & Export** — .phavo export/import, credential inclusion toggle
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
  sizes: ('S' | 'M' | 'L' | 'XL')[]
  configSchema?: ZodSchema       // drives auto-rendered settings panel
  dataEndpoint: string           // relative path served by widget's Hono handler
  refreshInterval: number        // ms; minimum enforced: 1000ms
  permissions: WidgetPermission[]
  notifications?: { condition: string; type: Notification['type'] }[]
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

#### System Widgets

| Widget | Data |
|---|---|
| CPU | Usage %, per-core breakdown, load average |
| Memory | Used / total, swap, segmented donut chart |
| Disk | Per-mount usage %, read/write throughput |
| Network | Upload/download speed, total traffic |
| Temperature | CPU temp (where available) |
| Uptime | System uptime, human-readable |
| Weather | Open-Meteo, no API key. Current + 5-day forecast. |

#### Integration Widgets

| Widget | Details |
|---|---|
| Pi-hole | Total queries, blocked %, blocklist count, enable/disable toggle |
| RSS Feed | User-configurable feeds. Title, source, timestamp. Auth supported. |
| Links / Bookmarks | Named links with icons, grouped by category |
| Docker | Container status, CPU + RAM per container, restart button. Opt-in socket. |
| Service Health | HTTP/Ping checks for self-hosted services. Response time + status badge. |
| Speedtest | On-demand speed test + 30-result history chart. Rate-limited 1/5min. |
| Calendar | CalDAV feed or local events. Upcoming events view. |

---

### 6.4 API Design

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

**AI Assistant:**
The AI Assistant uses the Vercel AI SDK (`ai` package) with a unified provider
abstraction supporting Ollama (local, fully offline via `ollama-ai-provider`),
OpenAI (`@ai-sdk/openai`), and Anthropic (`@ai-sdk/anthropic`).
Streaming responses via Hono SSE (`streamSSE` helper). The searchbar AI mode
consumes the same streaming endpoint. API keys are stored server-side in
encrypted form (`credentials` table) and never exposed to the browser.

**Runtime note (v5.0):**
Auth is local-only. No tier enforcement — all features available to all users.

---

### 6.5 Design System — Celestial Wish

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

### 6.6 Docker

Target: `docker run -p 3000:3000 -v phavo-data:/data phabioo/phavo`

- Single-container
- Multi-arch: amd64 + arm64 (Raspberry Pi 3/4/5)
- Docker Hub: `phabioo/phavo` — tagged `:VERSION` + `:latest`
- Volume `phavo-data` persists database, config, and plugins
- Runs as non-root user
- Read-only filesystem except for `phavo-data` volume
- **TLS — three modes:**
  - Self-signed (default) — generated on first start
  - Custom cert — user provides cert + key via volume
  - Let's Encrypt/ACME — for publicly reachable instances

### 6.7 Platform Abstraction

All server code uses environment variables — no hardcoded paths or ports.

| Variable | Default (Docker) | Purpose |
|---|---|---|
| `PHAVO_DB_PATH` | `/data/phavo.db` | libSQL location |
| `PHAVO_DATA_DIR` | `/data` | Parent for all data |
| `PHAVO_PORT` | `3000` | HTTP port |
| `PHAVO_SECRET` | auto-generated | AES key source. Optional — auto-generated and persisted on first start if not set. |

**Iron rule:** Never use `/data/` as a literal string. Always `process.env.PHAVO_DATA_DIR`.

---

## 7. Future Direction

These are anecdotal future ideas. No timeline, no committed scope, no stubs.

- **Desktop apps** — Tauri wrapper for Linux, macOS, Windows
- **Widget Marketplace** — Community plugin distribution
- **Plugin ecosystem expansion** — richer SDK and distribution workflow for third-party widgets

---

## 8. Security

### 8.1 Auth

- Local username + password (Argon2id), local-only runtime mode.
- Session: DB-backed, cookie-token based (random 32-byte session ID, not JWT).
- Optional TOTP 2FA.

### 8.2 Data Security

- AES-256-GCM encryption + HKDF key derivation for widget credentials at rest.
- CSRF double-submit protection on all non-GET mutations.
- Per-IP rate limiting with endpoint-specific rules.
- SSRF guard on all user-provided URLs.
- Subprocess safety: `execFile` only, never `exec`.

### 8.3 Client-Side Hardening

- No debug endpoints in production.
- No telemetry. No analytics. No background network calls.

### 8.4 Rate Limits

| Endpoint | Limit | Window |
|---|---|---|
| `POST /api/v1/auth/login` | 10 requests | 5 min per IP + per account |
| `POST /api/v1/auth/*` | 30 requests | 1 min per IP |
| Integration endpoints | 60 requests | 1 min per session |
| `GET /api/v1/update/check` | 1 request | 1 hour per session |
| `POST /api/v1/config` | 20 requests | 1 min per session |

### 8.5 What Is Intentionally Not Hardened

- Users reading their own data from the volume — they own the hardware.
- Network interception between browser and local instance — local network, user's trust.
- Plugin source inspection — transparency is a feature.

---

## 9. Plugin System

### 9.1 First-Party Structure

First-party widgets adopt the plugin file structure internally.
Third-party `.phwidget` ZIP bundle format is supported for user uploads.

### 9.2 Plugin File Structure

```
my-widget.phwidget (ZIP)
├── manifest.json       # id, name, version, permissions, configSchema, ...
├── handler.ts          # Hono route handler (server-side)
└── Widget.svelte       # Svelte component (frontend)
```

### 9.3 Plugin Security

- Import allowlist: `@phavo/types`, `@phavo/agent`, `@phavo/plugin-sdk`, `hono`,
  `zod`, Node/Bun built-ins. No arbitrary npm packages.
- `plugin_data` table: key-value persistence, 10MB quota per plugin.
- Upload rate limit: 5 complete uploads per 10 minutes per session.
- Permissions declared in `manifest.json`, shown to user at install time.

### 9.4 Local Dev Mode

`PHAVO_PLUGIN_DEV_DIR` env var enables hot-reload from a local directory.
Dev env only — not available in production builds.

---

## 10. Success Metrics (v1.0 Launch)

- 500+ Docker Hub pulls in first month
- 100+ GitHub stars within 60 days
- Setup completion rate ≥ 80%
- < 5 critical bug reports in first 2 weeks
- Positive reception on r/selfhosted, r/homelab, Product Hunt

---

## 11. Launch Checklist (v1.0)

- [x] Docker Hub — `phabioo/phavo` public + GitHub Secrets set
- [x] Hetzner Mail — MX + SPF + DKIM in Cloudflare
- [x] GitHub — `phabioo/phavo`
- [x] Version management — release scripts + Docker CI working
- [ ] MA–MC milestones complete
- [ ] `bun run release:minor` → v1.0.0 → Docker CI → `phabioo/phavo:1.0.0`
- [ ] Pi 4/5 arm64 smoke test — fresh docker compose up, all 14 widgets
- [ ] phavo.net landing page live (hero screenshot from MA)
- [ ] Launch channels: r/selfhosted, r/homelab, Product Hunt, Hacker News Show HN

---

## Appendix — Key Decisions

| # | Decision |
|---|---|
| 1 | **Open source (MIT):** All features free to all users. Single edition: Celestial Edition. |
| 2 | **Fully offline:** No account infrastructure. Auth is local-only. |
| 3 | **No telemetry:** No data sent anywhere. No toggle needed. |
| 4 | **Design: Celestial Wish:** Atmospheric dark, Soft Gold primary, Teal secondary. |
| 5 | **Fonts via @fontsource:** Geist + Geist Mono. Google Fonts CDN never used. |
| 6 | **Icons via `<Icon>` abstraction:** Never `lucide-svelte` direct imports. |
| 7 | **No hardcoded values in @phavo/ui:** CSS tokens only. Iron rule, no exceptions. |
| 8 | **Glassmorphism Pi fallback:** `max-resolution: 1.5dppx` disables backdrop-filter. |
| 9 | **Plugin import allowlist enforced at load time:** Arbitrary npm blocked. |
| 10 | **`plugin_data` quota:** 10MB per plugin_id, enforced server-side. |
| 11 | **Version management:** Single source in root `package.json`. Vite injects `PHAVO_VERSION`. |
| 12 | **Future direction:** Desktop packaging, marketplace ideas, and plugin ecosystem expansion are anecdotal directions, not roadmap items. |

---

*Phavo · phavo.net · github.com/phabioo/phavo*
