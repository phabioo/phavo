# Phavo — Product Requirements Document

**Version:** 2.7  
**Date:** 2026-03-26  
**Status:** Active — Sessions 1–9 planned · Feature-complete · Pre-Launch  
**Owner:** phabioo

**Changelog v2.7:** Version management (single source of truth, release scripts, CHANGELOG.md, Docker CI). Web presence plan (phavo.net landing, docs.phavo.net, email addresses). Docker Hub setup documented. Infrastructure decisions added. CLAUDE.md v2.0 reference.

**Changelog v2.5 (archived):** Decisions 33–41 merged into main decisions table (no more split). SRI section updated to Geist font. `WidgetDefinition.version` vs `schemaVersion` clarified. `configSchemaVersion` column added to `widgetInstances` schema. CLAUDE.md references corrected.

**Changelog v2.4 (archived):** Settings → Widgets tab redesigned as master/detail layout (list + search + filter on left, config panel on right). No per-widget tabs. Decision 57 added.

---

## 1. Product Overview

Phavo is a modular, self-hosted personal dashboard for both tech-savvy users (homelab, IT professionals, Raspberry Pi) and everyday consumers who want a clean, extensible overview of their digital world. It ships first as a web dashboard (Phase 1), then expands to desktop (Phase 2), mobile (Phase 3), and cloud (Phase 4).

The core promise: **beautiful by default, infinitely extensible, yours to own — and built with security at every layer.**

### Product Tiers

| | Phavo Free | Phavo Standard | Phavo Local |
|---|---|---|---|
| Price | €0 | €8.99 one-time | €24.99 one-time | €39.99 one-time |
| Widgets | Core system + weather | All launch widgets | All launch widgets |
| Tabs | 1 | Unlimited | Unlimited |
| Auth | phavo.net account | phavo.net account | Local user account |
| 2FA | Optional (TOTP) | Optional (TOTP) | Optional (TOTP) |
| Internet required | Yes (login) | Yes (login) | No (after activation) |
| Offline grace period | 24 hours | 72 hours | Not applicable |
| Phavo branding | Visible | Removable | Removable |
| HTTPS | Built-in (self-signed default) | Built-in | Built-in |
| Refund | 14-day guarantee | 14-day guarantee | 14-day guarantee |
| Target user | Try-before-buy, homelab intro | Persona B, most users | Privacy-focused, air-gapped |
| Upgrade path | → Standard or Local | → Local (pay difference) | — |

### Open Source Strategy

After v1.0 ships, the core codebase will be released under a dual licence:
- **AGPL-3.0** for open source / self-hosted use
- **Commercial licence** for the paid tiers (Standard, Local)

**Important:** Tier enforcement (widget access, tab limits, branding) is done entirely server-side via phavo.net — not through code locks in the client. This means the AGPL codebase does not contain bypassable paywalls. The Free tier restrictions are enforced at the phavo.net licence validation endpoint. A self-compiled AGPL build without a phavo.net account gets Free tier behaviour by default. This model mirrors tools like Umami and Plausible: open source drives adoption and community, the commercial licence and phavo.net account converts power users.

---

## 2. Background & Context

Phavo is the successor to **phaboard** — a locally-hosted Node.js/Svelte dashboard running on a Raspberry Pi. Phaboard proved the concept: modular widgets, system metrics, Pi-hole integration. Phavo rebuilds it from scratch with a production-grade stack, a proper business model, and a multi-platform roadmap.

**Why a full rewrite:** The phaboard codebase (Express, vanilla CSS, flat JSON config) does not support the scale of what Phavo needs to become. The new stack (SvelteKit, Tailwind v4, Hono, Drizzle, Tauri) is chosen to support all four phases from a single monorepo without architectural debt.

**Existing tools and their gap:**

| Tool | Weakness |
|---|---|
| Dashy / Homepage | Config via YAML only, no GUI |
| Glance | Minimal, no widget marketplace |
| Übersicht | macOS only, dead community |
| iStat Menus | System monitoring only, not extensible |

Phavo's differentiator: **polished GUI, guided setup, resizable widgets, open widget schema, free tier to try, multi-platform.**

---

## 3. Goals

### Primary Goals (Phase 1)
- Ship a self-hosted web dashboard with a curated set of launch widgets
- Deliver both a Quick Setup and a full guided setup experience
- Establish a clean widget schema and plugin API as the foundation for the ecosystem
- Launch a Free tier to drive adoption, convert to paid via Standard and Local
- Generate initial revenue; validate product-market fit

### Secondary Goals (Phase 1)
- Build a CSS token system that enables theming from day one
- Lay the Turborepo/Bun monorepo foundation for Phase 2–4
- Publish phavo.net landing page before launch
- Establish documentation and a support channel at launch

### Non-Goals (Phase 1)
- Cloud sync or multi-user support (Phase 4)
- Widget marketplace (Phase 4)
- Mobile or desktop native apps (Phase 2–3)
- Multi-user / team accounts
- Public demo instance (built just before v1.0 launch — not during Phase 1 development cycle)
- Open source release (post v1.0)

---

## 4. Target Users

### Persona A — The Homelab Enthusiast
- IT professional, developer, or power user
- Runs a Raspberry Pi, home server, or NAS
- Wants system metrics, Pi-hole stats, and service monitoring in one place
- Comfortable with Docker, self-hosting, and basic configuration
- Values reliability, performance data, and extensibility
- **Entry point:** Free tier → upgrades to Standard or Local for full widget set

### Persona B — The Informed Consumer
- Non-technical but digitally fluent
- Wants a personal dashboard: weather, news, music, bookmarks
- No interest in YAML or CLI setup
- Values design quality and ease of use
- May not own a server — runs Phavo on a home machine or NAS via Docker
- **Phase 1 limitation:** Docker knowledge required. A native installer (Phase 2 desktop app) removes this barrier.
- **Entry point:** Sees demo or screenshot, buys Standard directly

---

## 5. Techstack

```
Monorepo:   Turborepo + Bun Workspaces
Language:   TypeScript (strict)
Linting:    Biome

apps/
  web/        SvelteKit (Phase 1 — web dashboard)
  desktop/    Tauri 2.0 (Phase 2 — macOS, Windows, Linux)
  mobile/     Tauri 2.0 Mobile (Phase 3 — iOS, iPadOS, Android)

packages/
  ui/         @phavo/ui — Svelte 5 (Runes) component library
  db/         @phavo/db — Drizzle ORM + libSQL
  types/      @phavo/types — shared TypeScript types & schemas
  agent/      @phavo/agent — system metrics library (Phase 1: imported directly by SvelteKit server; Phase 4: standalone Bun daemon with IPC)

Design:     Figma → Design Tokens → Tailwind CSS v4
Components: shadcn-svelte
API:        Hono
Auth:       Better Auth (Phase 1 — local accounts + phavo.net OAuth)
Database:   libSQL (local) → Turso (Phase 4, cloud)
Docker:     multi-arch (amd64 + arm64 for Raspberry Pi)
CI/CD:      GitHub Actions
```

---

## 6. Phase 1 — Web Dashboard

### 6.1 Summary

A SvelteKit web application served via Docker (or direct Bun process). Users access it via browser at their local IP or custom domain. All dashboard data stays local.

**Free tier:** phavo.net account required. License validated on each login. Core widgets only, 1 tab, Phavo branding visible.

**Standard tier:** phavo.net account required. License validated on each login. **72-hour offline grace period:** if phavo.net is unreachable, the last validated session stays active for 72 hours. After that, login is blocked until connectivity is restored. Grace period resets on every successful validation.

**Local tier:** Local user account (username + password) created during setup. License key validated once against phavo.net on first activation and stored locally. Fully offline after activation — no phone-home ever again.

### 6.2 Core Features

#### Setup Assistant — Quick Setup

For users who want to get started immediately. Accessible from the welcome screen as the default path for Persona B.

**Flow (3 steps):**
1. Auth — phavo.net sign in / register (Free or Standard), or local account creation + license key (Local)
2. Weather location — optional, skippable
3. Done — dashboard loads with a sensible default layout (system widgets + weather). Standard/Local users additionally get a Links widget pre-configured.

All further configuration is accessible at any time from the dashboard and settings.

#### Setup Assistant — Full Setup

For users who want a tailored experience from the start. Accessible from the welcome screen via "Customise my setup". Each step has a back button and a progress indicator (1/10).

**Flow:**

1. **Welcome** — Phavo logo, tagline, two CTAs: "Quick Setup (2 min)" → Quick Setup, "Full Setup" → continue
2. **Tier selection** — Three cards: Free / Standard / Local with feature comparison. Selecting a tier determines the auth screen. Free/Standard → phavo.net OAuth. Local → local account form.
3. **Auth**
   - *Free/Standard:* "Sign in with phavo.net" button → OAuth redirect. On return: licence validated, tier confirmed, continue.
   - *Local:* Username + password + confirm-password fields + licence key field. Argon2id hashing server-side. Activation JWT fetched from phavo.net.
4. **Dashboard name** — Text input, default "My Dashboard". Validates: 1–40 chars.
5. **Weather location** — City search with geocode autocomplete (Open-Meteo geocoding API). Skippable. Shows live weather preview after selection.
6. **Tab builder** — Add/rename/reorder/delete tabs. Default: one tab named "Home". Free tier: add button disabled after first tab (shows upgrade prompt, but first tab always created).
7. **Widget selection** — Grid of widget cards from the manifest. Standard widgets shown locked for Free users (same teaser logic as the drawer). Multi-select. Confirmation of tier-appropriate widgets only.
8. **Widget-to-tab assignment** — Drag widgets onto tab slots. Simple list assignment on mobile.
9. **Widget configuration** — Only for widgets that have a `configSchema`. Rendered per-widget:
   - Pi-hole: URL + token + "Test connection"
   - RSS: feed URL(s) + optional auth
   - Links: quick-add a few bookmarks (expandable later in Settings)
   - Weather: auto-filled from step 5 unless overridden
   - Widgets with no config: shown as "Ready — no configuration needed"
10. **Done** — Animated success screen. "Go to dashboard →" button. Config saved via `POST /api/v1/config` + widget instances persisted.

**State persistence:** Each completed step is saved to `sessionStorage` so a browser refresh does not lose progress. On dashboard load, if `setupComplete = false`, user is redirected to `/setup` at the last incomplete step.

#### Dashboard Layout
- Drag-and-drop widget positioning (grid system)
- Widget sizes: S / M / L / XL steps with grid snapping
- Multiple named tabs with per-tab widget assignment (Standard + Local; Free: 1 tab)
- Layout persisted to database per tab
- Sidebar navigation (collapsible, fixed position)
- Live clock in header
- Mobile-responsive — fully usable on smartphones (≥ 375px) and tablets. Breakpoints: **mobile** < 640px · **tablet** 640–1024px · **desktop** > 1024px.
  - **Mobile:** Sidebar collapses to a bottom navigation bar (tab icons only). Widget grid becomes single-column. Widget sizes S/M collapse to full-width. Header shows only logo + bell + hamburger menu.
  - **Tablet:** Sidebar collapses to icon-only rail (48px). 2-column grid. Full header visible.
  - **Desktop:** Full sidebar (240px), multi-column grid, full header.
  - Settings and Setup pages stack vertically on mobile — no horizontal tab list.
  - Touch targets minimum 44×44px (WCAG 2.1 AA).
  - No horizontal scroll at any breakpoint.
- **Widget drawer:** + button in dashboard header opens a panel to add or remove widgets at any time, no setup re-run required

#### Update Mechanism
- Header badge appears when a new version is available
- Clicking opens an in-dashboard update panel: current version, new version, full changelog
- The panel shows the exact update command for the user's install method (Docker Compose snippet, direct Bun command) — copy-paste ready
- For Docker Compose users: a one-click option can trigger the update if Phavo has access to the Docker socket (opt-in, documented security implications)
- Accessible at any time via Settings → About

#### Widget System

Auto-discovered from the backend registry. The manifest drives the setup flow, dashboard loader, widget drawer, and — critically — the settings UI. Every aspect of a widget's behaviour, configuration, and presentation is declared in its `WidgetDefinition`. No widget requires a hardcoded UI panel.

**Widget contract (`@phavo/types`) — canonical definition:**
```typescript
interface WidgetDefinition {
  id: string                           // globally unique, reverse-DNS: "io.phavo.cpu"
  name: string
  description: string
  version: string                      // semver
  author: string                       // "phavo" for built-ins, developer name for plugins
  category: 'system' | 'consumer' | 'integration' | 'utility' | 'custom'
  tier: 'free' | 'standard'           // 'free' widgets available on all tiers
  minSize: { w: number; h: number }
  defaultSize: { w: number; h: number }
  sizes: ('S' | 'M' | 'L' | 'XL')[]
  configSchema?: ZodSchema            // drives auto-rendered Settings panel
  dataEndpoint: string                // relative path served by the widget's Hono handler
  refreshInterval: number             // ms; minimum enforced: 1000ms
  permissions: WidgetPermission[]     // declared capabilities — see Section 16.4
  notifications?: {
    condition: string
    type: Notification['type']
  }[]
}

// Teaser-only variant sent to browser for locked/unentitled widgets:
interface WidgetTeaserDefinition {
  id: string
  name: string
  description: string
  tier: 'free' | 'standard'
  locked: true
  // No dataEndpoint, configSchema, or permissions — never exposed to unentitled tiers
}
```

**Widget states — every widget instance is in exactly one state at all times:**

| State | Meaning | UI |
|---|---|---|
| `loading` | Data fetch in progress | Skeleton animation |
| `active` | Data fetched successfully | Renders data |
| `unconfigured` | Has `configSchema` but no saved config | Yellow badge "Configure" → opens Settings |
| `error` | Data endpoint returned error | Error message + retry button |
| `stale` | Last fetch succeeded but refresh failing | Shows last data with warning indicator |
| `locked` | User's tier doesn't include this widget | Should not appear on dashboard (only in drawer) |

The `unconfigured` state is the most important: when a widget is added to the dashboard that requires configuration (Pi-hole URL, RSS feeds, etc.) but hasn't been configured yet, it must show a clear inline prompt rather than an empty or broken state.

**Schema-driven Settings UI (auto-rendering):**

Every widget with a `configSchema` automatically gets a config panel in Settings → Widgets. The panel is rendered by a generic `<SchemaRenderer>` component — no per-widget custom UI code required.

`<SchemaRenderer>` reads the Zod schema and renders appropriate form fields:

| Zod type | Rendered as |
|---|---|
| `z.string().url()` | URL input with validation indicator |
| `z.string().min(1)` | Text input |
| `z.string().meta({ credential: true })` | Password input (masked), never pre-filled after save |
| `z.string().meta({ label: '...' })` | Uses label as field label |
| `z.enum([...])` | Select dropdown |
| `z.boolean()` | Toggle switch |
| `z.array(z.object({...}))` | Repeatable row group (add/remove rows) |
| `z.number().min().max()` | Number input with range |

**Special handling:**
- Fields marked `.meta({ credential: true })` → stored in `credentials` table (AES-256-GCM), displayed as masked after save, never returned from API
- Fields marked `.meta({ testEndpoint: '/api/v1/pihole/test' })` → renders a "Test connection" button that fires the endpoint inline
- Arrays of objects (e.g. RSS feeds) → rendered as a list with add/remove rows and per-row expansion for nested fields

**Widget drawer — categories and discovery:**

The widget drawer groups widgets by `category` with filter chips: All · System · Consumer · Integration · Utility. Third-party plugin widgets appear under their declared category automatically — no code change needed in the drawer.

For plugin widgets loaded from `/data/plugins/`:
- Server restart required to pick up new plugins
- On startup, if new plugins were found: a notification is pushed ("3 new widgets available — open widget drawer")
- Plugin widgets appear in the drawer with a "Plugin" badge distinguishing them from built-in widgets

**Widget drawer preview:**
Clicking a widget card in the drawer (before adding it) shows an expanded preview:
- Widget name, description, category, size options
- If `configSchema` exists: a collapsed "Requires configuration" note listing field names
- For locked/teaser widgets: upgrade prompt with pricing

**Widget versioning:**
When a widget's `configSchema` changes between versions:
- Additive changes (new optional fields): existing instances load fine, new fields get default values
- Breaking changes (removed/renamed required fields): instance enters `unconfigured` state, user is prompted to reconfigure
- Version tracked in `WidgetDefinition.version` (semver); breaking changes require a minor version bump minimum. Note: `WidgetDefinition.version` tracks the *widget's own version* and is used for config migration. The separate `schemaVersion` field in plugin manifests tracks *plugin SDK API compatibility* — these are distinct concepts

#### Settings Page

Settings is a full-page route (`/settings`) with a left-side tab list. Active tab is persisted to URL hash for deep-linking (e.g. `/settings#about` from the notification click).

**Tab: General**
- Dashboard name (editable text field)
- Weather location (editable, with geocode lookup)
- Re-run Quick Setup or Full Setup (buttons that navigate to `/setup`)

**Tab: Tabs**
- List of all tabs with drag-to-reorder
- Rename inline, delete with confirmation
- Add tab button (blocked with upgrade prompt on Free tier if count = 1)

**Tab: Widgets**

A single dedicated tab for all widget configuration. Never one tab per widget. Layout is a two-panel master/detail:

```
┌─────────────────────────────────────────────────────────────────┐
│  Settings → Widgets                                             │
├─────────────────────┬───────────────────────────────────────────┤
│  🔍 Search widgets  │                                           │
│                     │  Pi-hole                                  │
│  ● Pi-hole      ⚠  │  ─────────────────────────────────────   │
│  ● RSS Feed     ✓  │  Integration · Standard                   │
│  ● Links        ✓  │                                           │
│  ● CPU          ✓  │  [Mini widget preview card]               │
│  ● Memory       ✓  │                                           │
│  ● Weather      ✓  │  ─────────────────────────────────────   │
│  ● My Plugin  🔌 ⚠│  Configuration                            │
│                     │                                           │
│  Filter:            │  Pi-hole URL                             │
│  [All ▾]            │  ┌────────────────────────────┐          │
│                     │  │ http://pi.hole             │  ✓       │
│                     │  └────────────────────────────┘          │
│                     │                                           │
│                     │  API Token                               │
│                     │  ┌────────────────────────────┐          │
│                     │  │ ••••••••••••••••           │  Reset   │
│                     │  └────────────────────────────┘          │
│                     │                                           │
│                     │  [Test connection]  [Save]               │
└─────────────────────┴───────────────────────────────────────────┘
```

**Left panel — widget list:**
- Search input (filters by name, category, description in real-time)
- Each row shows: widget name, status indicator (✓ active / ⚠ unconfigured / ✗ error), plugin badge (🔌) for external widgets
- Category filter dropdown: All / System / Consumer / Integration / Utility
- Clicking a row selects it and loads the detail panel on the right
- Widgets without `configSchema` are still listed (showing status only — no config form)
- On mobile: full-screen list → tap → full-screen detail (back button to return to list)

**Right panel — widget detail:**
- Widget name + category + tier badge
- Mini preview card (same `<WidgetCard>` component used on dashboard, rendered at reduced scale with live or last-known data)
- Current state badge with human-readable explanation
- If `configSchema` exists: `<SchemaRenderer>` renders the config form
- If no `configSchema`: "This widget has no configuration — it works automatically"
- For plugin widgets: link to README.md + plugin version
- "Remove all instances from dashboard" button (destructive, requires confirmation)

**No individual tabs per widget.** The list scales to any number of widgets — 10 built-in, 50 plugins, it doesn't matter. The Settings page tab bar stays clean.

**Tab: Import / Export**
- Export button → triggers `GET /api/v1/config/export` → downloads `phavo-config-export.json`
- "Include credentials" toggle → prompts for passphrase before export
- Import: file picker + drag-and-drop → validates JSON client-side before submitting to `POST /api/v1/config/import`
- Import preview: shows what will change before confirming
- Warning: import overwrites current layout

**Tab: Licence**
- Current tier badge (Free / Standard / Local)
- **Free tier:** Upgrade banner — "Unlock all widgets for €8.99 one-time" with direct link to phavo.net checkout
- **Standard tier:** Licence key (masked), linked phavo.net account email, "Upgrade to Local (€12.00)" link, deactivate button
- **Local tier:** Licence key (masked), instance ID, activation date, deactivate button (requires online connection)
- Re-enter / replace licence key field for key transfers

**Tab: Account**
- phavo.net users: display email, "Sign out" button, link to phavo.net account portal for password changes
- Local users: change username, change password form (current + new + confirm)
- 2FA: enable/disable TOTP — QR code display, backup code download

**Tab: About**
- Current Phavo version
- Update status: "Up to date" or "v1.x.x available — see changelog"
- Changelog panel (expandable): rendered from GitHub Releases API response
- Update command snippet (Docker Compose / Bun) — copy-paste ready
- Optional: one-click update button if Docker socket is mounted (opt-in)
- Links: GitHub, docs.phavo.net, Discord, security@phavo.net

#### Notification System

A collapsible notification panel anchored to the right side of the dashboard. Accessible via a bell icon in the header with an unread badge counter.

**Behaviour:**
- Collapsed by default. Bell icon in header shows a badge with the count of unread notifications.
- Clicking the bell slides the panel open from the right without pushing the dashboard content — it overlays.
- Notifications are grouped by type and sorted newest-first.
- Each notification is clickable and deep-links to the relevant widget or settings page (e.g. "Disk at 91%" scrolls to the Disk widget, "Update available" opens Settings → About).
- Notifications persist in a history for the lifetime of the running Phavo process (in-memory). On restart, history is cleared. Future: persist to DB in Phase 4.
- Marking all as read clears the badge counter but keeps the history visible.

**Notification types:**

| Type | Source | Example |
|---|---|---|
| `update` | Phavo core | "Phavo v1.2.0 is available — see changelog" |
| `widget-error` | Any widget | "Pi-hole unreachable — check credentials" |
| `widget-warning` | Any widget | "Disk /dev/sda1 at 91% capacity" |
| `system-alert` | @phavo/agent | "CPU temperature above 80°C" |
| `info` | Phavo core | "Setup completed successfully" |

**Widget API for notifications:**

All widgets (including future third-party widgets) can push notifications via a shared `notify()` function from `@phavo/types`. This is the extension point for external widgets.

```typescript
// In @phavo/types
export interface Notification {
  id: string
  type: 'update' | 'widget-error' | 'widget-warning' | 'system-alert' | 'info'
  title: string
  body: string
  widgetId?: string        // links to widget if applicable
  settingsTab?: string     // links to settings tab if applicable
  timestamp: number        // unix ms
  read: boolean
}

// Callable by any widget or core module
export type NotifyFn = (notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => void
```

**Built-in notification triggers (Phase 1):**
- Disk usage > 90% on any mount → `widget-warning`
- CPU temperature > 80°C → `system-alert`  
- Pi-hole unreachable after 3 failed polls → `widget-error`
- RSS feed failing consistently → `widget-error`
- Phavo update available → `update`
- Setup completed → `info`



**File formats:**
- Config exports use the `.phavo` file extension (`phavo-export-2026-03-27.phavo`)
- Widget packages (Phase 1.x) use the `.phwidget` file extension — a ZIP-based bundle containing the Svelte component, `manifest.json`, and optional assets

**Credential handling:** Pi-hole tokens, RSS credentials, and all sensitive values are excluded from exports by default. A separate prompt offers to include them, encrypted with a user-provided passphrase. On import, widgets with missing credentials show a "configure me" prompt.

---

### 6.3 Launch Widgets

#### Free Tier Widgets

| Widget | Data |
|---|---|
| CPU | Usage %, per-core breakdown, load average |
| Memory | Used / total, swap |
| Disk | Per-mount usage %, read/write throughput |
| Network | Upload/download speed, total traffic |
| Temperature | CPU temp (where available) |
| Uptime | System uptime, human-readable |
| Weather | Open-Meteo, no API key. Current conditions + 5-day forecast. |

#### Standard / Local Widgets (all Free widgets + the following)

| Widget | Details |
|---|---|
| Pi-hole | Total queries, blocked %, blocklist count, enable/disable toggle. URL + API token configured in settings. |
| RSS Feed | User-configurable feed URLs. Title, source, timestamp. Multiple feeds per instance. Supports Basic Auth + Bearer token for private feeds (e.g. Feedbin, self-hosted RSS bridges). |
| Links / Bookmarks | Named links with optional icons, grouped by user-defined categories. Opens URL in new tab. |

#### Post-Launch Widgets (Phase 1.x)

| Widget | Notes |
|---|---|
| Spotify | Requires OAuth relay on phavo.net. Now playing, album art, playback controls. Spotify Premium required for control. |

---

### 6.4 Free Tier Conversion Strategy

The Free tier is the primary acquisition channel. Conversion levers built into the product:

- **Widget drawer upgrade prompt:** When a Free user opens the widget drawer, Standard widgets are visible but locked — shown with a lock icon and the label "Standard". Clicking one triggers: "Upgrade to Standard to unlock all widgets — €8.99 one-time." This works via a **split manifest**: `GET /api/v1/widgets` returns full definitions for entitled widgets, plus teaser entries `{ id, name, description, tier, locked: true }` for locked ones. Teaser entries contain no `dataEndpoint`, `configSchema`, or `permissions` — only enough to render the upgrade prompt. Security-relevant fields are never sent to the browser for unentitled tiers.
- **Tab limit prompt:** Attempting to add a second tab on Free shows the upgrade prompt.
- **Phavo branding:** Small "Powered by Phavo" badge in dashboard footer on Free. Removable on Standard and Local.
- **No feature degradation:** Free tier stays free indefinitely. Phavo does not reduce the Free offering to force upgrades.
- **Standard → Local upgrade path:** Pay the €12.00 difference via the phavo.net account portal. No repurchase.

---

### 6.5 API Design

All endpoints follow a consistent response envelope:

```typescript
{ ok: true, data: T }   // success
{ ok: false, error: string }  // error
```

**Local app endpoints (launch):**
```
GET  /api/v1/config
GET  /api/v1/config/export            — full dashboard config as JSON (credentials excluded by default)
POST /api/v1/config/import            — validate + apply imported config JSON
POST /api/v1/config
GET  /api/v1/widgets

GET  /api/v1/system
GET  /api/v1/cpu
GET  /api/v1/memory
GET  /api/v1/disk
GET  /api/v1/network
GET  /api/v1/temperature
GET  /api/v1/uptime
GET  /api/v1/weather
GET  /api/v1/pihole
POST /api/v1/pihole/test
GET  /api/v1/rss
GET  /api/v1/links

POST /api/v1/auth/login
POST /api/v1/auth/logout
GET  /api/v1/auth/session

GET  /api/v1/update/check
POST /api/v1/update/apply
```

**phavo.net infrastructure endpoints (hosted, not local):**
```
POST /api/license/validate        — Free/Standard: on each login
POST /api/license/activate        — Local: once on first setup
POST /api/license/deactivate
POST /api/license/upgrade         — Standard → Local

POST /api/oauth/spotify/callback  — Phase 1.x Spotify relay
```

**Post-launch (Phase 1.x — Spotify):**
```
GET  /api/v1/spotify/status
POST /api/v1/spotify/auth
POST /api/v1/spotify/control
```

---

### 6.6 Design System

**Philosophy:** Pure black dark UI. Maximum contrast, no gradients, no blur, no glass-morphism. Flat surfaces, precise borders, editorial typography. Inspired by Apple's spatial density and Vercel's technical clarity.

**Typography:** Geist (UI) · Geist Mono (data values, code, metrics)
Loaded via Google Fonts: `family=Geist:wght@300;400;500;600&family=Geist+Mono:wght@400;500`

**Figma decoupling strategy:** Code is built first using token values. Figma refinements drop into `theme.css` — zero component changes needed.

**Iron rule:**
```css
/* ✅ Always */
background: var(--color-bg-surface);
color: var(--color-text-primary);
font-family: var(--font-ui);

/* ❌ Never */
background: #0a0a0a;
color: #f5f5f7;
font-family: 'Geist', sans-serif;
```

**Token system (`packages/ui/src/theme.css`):**
```css
@import url('https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600&family=Geist+Mono:wght@400;500&display=swap');

:root, :root[data-theme="dark"] {
  --font-ui:              'Geist', -apple-system, BlinkMacSystemFont, sans-serif;
  --font-mono:            'Geist Mono', 'SF Mono', monospace;

  --color-bg-base:        #000000;
  --color-bg-surface:     #0a0a0a;
  --color-bg-elevated:    #141414;
  --color-bg-hover:       #1c1c1e;
  --color-border:         #2a2a2a;
  --color-border-subtle:  #1c1c1c;
  --color-border-strong:  #3a3a3a;
  --color-text-primary:   #f5f5f7;
  --color-text-secondary: #86868b;
  --color-text-muted:     #48484a;
  --color-accent:         #d4922a;
  --color-accent-subtle:  #b07820;
  --color-accent-t:       rgba(212,146,42,.10);
  --color-accent-text:    #d4922a;
  --radius-sm:            6px;
  --radius-md:            10px;
  --radius-lg:            14px;
}
```

**Accent usage:** Amber/gold (#d4922a) is used for interactive elements, progress bars, status indicators, and the "Powered by Phavo" branding badge. It provides strong contrast on pure black without feeling aggressive.

**Themes:** Dark only at launch. Each future theme is one CSS block — no component changes. Light theme token values are defined but not activated.

**i18n:** All strings in `en.json` from day one. New languages need no code changes.

---

### 6.7 Docker

Target: `docker run -p 3000:3000 -p 3443:3443 -v phavo-data:/data phavo/phavo`

- Single-container
- Multi-arch: amd64 + arm64 (Raspberry Pi 4/5)
- Docker Hub + GHCR
- Volume `phavo-data` persists database, config, and Local tier activation token
- **Runs as non-root user** — dedicated `phavo` system user inside the container
- **Read-only filesystem** except for the `phavo-data` volume mount
- **HTTPS / TLS — three modes, configured in settings:**
  - **Self-signed (default):** Generated automatically on first start. Works for all local network installs including Raspberry Pi behind NAT. Browser shows a one-time security warning; user accepts or installs the cert in their trust store. This is the default and covers the vast majority of installs.
  - **Custom cert (recommended for advanced users):** User provides their own cert + key files via the volume. Works with wildcard certs, internal CAs, and reverse proxy setups.
  - **Let's Encrypt / ACME (advanced):** Automatic certificate provisioning for instances reachable via a public domain with port 80/443 accessible. Not suitable for typical home installs behind NAT without port forwarding. Requires a public domain pointed at the host.
- **Reverse proxy:** Phavo works behind Nginx, Caddy, or Traefik — documented in the install guide. Users who already run a reverse proxy can use HTTP internally and terminate TLS at the proxy.

### 6.8 Platform Abstraction (Phase 1 — required for Phase 2 compatibility)

All Phase 1 code must use environment variables instead of hardcoded platform-specific paths and ports. This is the single prerequisite for reusing the same `apps/web/` codebase inside a Tauri desktop app without modification.

**Environment variables — defined in `packages/types/src/env.ts`:**

| Variable | Default (Docker) | Tauri value | Purpose |
|---|---|---|---|
| `PHAVO_DB_PATH` | `/data/phavo.db` | OS app data dir + `/phavo.db` | libSQL database file location |
| `PHAVO_DATA_DIR` | `/data` | OS app data dir | Parent dir for DB, certs, plugins, instance ID |
| `PHAVO_PORT` | `3000` | Dynamic free port | HTTP server port |
| `PHAVO_HTTPS_PORT` | `3443` | Not used (Tauri = localhost only) | HTTPS port |
| `PHAVO_ENV` | `docker` | `tauri` | Platform identifier — drives installMethod |

**`installMethod` config key** — derived from `PHAVO_ENV` on first start, stored in `config` table:

| `PHAVO_ENV` | `installMethod` | Update panel shows |
|---|---|---|
| `docker` | `docker-compose` | Docker Compose snippet |
| `bun` | `bun-direct` | Bun CLI snippet |
| `tauri` | `tauri` | "Updates are handled automatically by the app" |

**Iron rule:** Never use `/data/` as a literal string anywhere in `packages/` or `apps/web/src/lib/server/`. Always read from `process.env.PHAVO_DATA_DIR`.

---

## 7. Phase 2 — Desktop App

*Post Phase 1 launch.*

### 7.1 Architektur

Tauri 2.0 wrapped den bestehenden SvelteKit/Hono-Server als eingebetteten **Sidecar-Prozess**. Der Bun-Server läuft unsichtbar im Hintergrund; Tauri öffnet ein WebView-Fenster das auf `localhost:<dynamicPort>` zeigt. Für den User sieht es aus wie eine native App — kein Docker, kein Terminal, kein Browser-Tab.

```
Tauri Shell (Rust)
  ├── WebView  →  zeigt apps/web/ SvelteKit Frontend (unverändert)
  └── Sidecar  →  startet Bun-Server (apps/web/) im Hintergrund
                   PHAVO_ENV=tauri
                   PHAVO_DATA_DIR=~/Library/Application Support/phavo/  (macOS)
                   PHAVO_PORT=<dynamisch freier Port>
```

**Keine Code-Änderungen an `apps/web/`** — die Platform-Abstraction-Schicht aus §6.8 ist die einzige Voraussetzung. Docker und Tauri-App teilen denselben Server-Code.

### 7.2 Features

- **System Tray + Menubar** — Phavo-Icon im Tray, Dashboard per Klick öffnen/schließen
- **Auto-Update via Tauri Updater** — signierte Updates von GitHub Releases, automatisch im Hintergrund installiert. Kein Terminal, kein Docker-Pull. User bestätigt nur den Restart.
- **Native OS Notifications** — via Tauri Notification API, ersetzt/ergänzt das In-App-Panel
- **Autostart** — optional beim OS-Login starten (Einstellung in Settings → General)
- **Desktop-exclusive Widgets** — Clipboard History, Local App Launcher (Phase 2.x)

### 7.3 Installer & Distribution

| Platform | Format | Distribution |
|---|---|---|
| macOS | `.dmg` (universal: Apple Silicon + Intel) | phavo.net, Homebrew Cask |
| Windows | `.msi` + NSIS `.exe` | phavo.net, winget (stretch) |
| Linux | `.deb`, `.AppImage`, `.rpm` | phavo.net, AUR (stretch) |

Build-Befehl: `bun tauri build` — erzeugt alle Formate via GitHub Actions CI (matrix: macos-latest, windows-latest, ubuntu-latest).

**Code-Signing:**
- macOS: Apple Developer ID Certificate (notarisiert via Xcode Notarization)
- Windows: Code Signing Certificate (EV cert empfohlen für SmartScreen)
- Linux: GPG-signierte Packages

### 7.4 Update-Mechanismus (Tauri Updater)

```
apps/desktop/src-tauri/tauri.conf.json:
{
  "updater": {
    "active": true,
    "endpoints": ["https://phavo.net/api/updates/{{target}}/{{arch}}/{{current_version}}"],
    "dialog": true,
    "pubkey": "<embedded-public-key>"
  }
}
```

phavo.net hostet einen einfachen Update-Endpoint der auf GitHub Releases antwortet. Signierung: Ed25519 (Tauri Standard). Private Key liegt ausschließlich in GitHub Actions Secrets.

### 7.5 Datenpfade pro OS

| OS | `PHAVO_DATA_DIR` |
|---|---|
| macOS | `~/Library/Application Support/phavo/` |
| Windows | `%APPDATA%\phavo\` |
| Linux | `~/.local/share/phavo/` |

Tauri stellt diese Pfade via `tauri::api::path::app_data_dir()` bereit. Der Sidecar-Prozess erhält den Pfad als Umgebungsvariable beim Start.

**Platforms:** macOS 12+, Windows 10+, Ubuntu 20.04+  
**Distribution:** phavo.net (primary), Homebrew Cask, winget (stretch)

---

## 8. Phase 3 — Mobile Apps

*Post Phase 2.*

Tauri 2.0 Mobile — same `@phavo/ui` components rendered via Tauri's mobile WebView (WKWebView on iOS, WebView on Android). Touch-optimized layout adapts the existing Svelte components — no rewrite required.

- Touch-optimized layout
- Push notifications
- iOS, iPadOS, Android

---

## 9. Phase 4 — Cloud + Agent

*Long-term roadmap.*

- **Turso** — cloud libSQL, multi-device sync
- **Better Auth** extended — OAuth 2.0, 2FA, team accounts
- **Widget Marketplace** — community + Pro widgets
- **Phavo Agent** — local Bun daemon, sends encrypted metrics to cloud
- **E2E encryption** — TLS, DSGVO-compliant
- **Public demo instance** on phavo.net

---

## 10. Monetization

### Pricing

| Tier | Price | Model |
|---|---|---|
| Free | €0 | Forever free — core system widgets, weather, 1 tab, Phavo branding |
| Standard | €8.99 | One-time — all widgets, unlimited tabs, no branding |
| Local | €24.99 | One-time — all widgets, unlimited tabs, fully offline, no branding |
| Ultra | €39.99 | One-time — all widgets + exclusive Ultra, unlimited tabs, fully offline, 1yr feature updates |
| Standard → Local upgrade | €12.00 | Pay the difference, no repurchase |
| Phase 2 Desktop | TBD | Bundled or small upgrade fee for existing licence holders |
| Phase 4 Cloud | ~€4.99/month | Subscription — sync, marketplace, multi-device |
| Marketplace | Free listing | Optional Pro widgets, rev-share TBD |

**Launch pricing:** Time-limited launch discount for the first 30 days (e.g. Standard €4.99, Local €12.99) to drive early sales and reviews. Price increases are announced in advance.

**Refund policy:** 14-day money-back guarantee on all paid tiers, no questions asked. Handled via Gumroad. Communicated clearly on the pricing page and at checkout.

**Cloud subscription value proposition (Phase 4):** The ~€4.99/month cloud plan must be clearly differentiated from the one-time Standard licence in all marketing. Key differentiators: multi-device sync, widget marketplace access, automatic backups, hosted instance (no self-hosting needed). Without this clarity, users will question paying monthly more than the one-time purchase after 2 months.

### Standard / Free licence model
- Sold via Gumroad
- User links licence key to phavo.net account
- Validated on every login; 72-hour offline grace period if phavo.net is unreachable
- No device fingerprinting — follows the account, reinstalls are free

### Local licence model
- Sold via Gumroad at a higher price reflecting offline capability
- One-time activation against phavo.net; stored in Docker volume thereafter
- Bound to volume identifier — survives container rebuilds, not hardware-based
- Second activation requires deactivating the first via phavo.net portal
- One re-activation grace for hardware replacement
- Fully offline after initial activation

---

## 11. Marketing

*Detailed launch campaign to be planned when v1.0 is ready. The following must be in place before launch:*

### phavo.net Landing Page (required before launch)
- Hero: screenshot or short screen recording of the live dashboard
- Feature highlights: widgets, responsive design, setup flow, Free tier CTA
- Pricing table: Free / Standard / Local clearly compared with feature checklist
- "Get started free" as primary CTA
- Changelog and roadmap teaser

### Documentation (required before launch)
- Installation guide (Docker, direct Bun)
- Widget reference
- Setup assistant walkthrough (Quick and Full)
- FAQ: "What happens if phavo.net is down?", "How do I go offline?", "Can I self-host without a phavo.net account?"
- Hosted at docs.phavo.net

### Support Channels (required before launch)
- **GitHub Issues** — bugs and feature requests
- **Discord** — community, setup help, widget sharing, announcements
- **Support email** — licence issues

### Launch Channels (at v1.0)
- r/selfhosted (500k), r/homelab (400k), r/pihole — Persona A
- Product Hunt — Persona B, general visibility
- Hacker News Show HN — developer audience
- Short demo video (30–60s) for YouTube / TikTok / X

---

## 12. Security

Security is a first-class concern in Phavo — not an afterthought. Users trust Phavo with system metrics, credentials, and integration tokens. The following requirements apply across all tiers and phases.

### 12.1 Authentication & Session Security

- **Password hashing:** All local passwords hashed with Argon2id (via Better Auth). No MD5, no SHA-1, no bcrypt.
- **Session tokens:** Cryptographically random, stored as HttpOnly + Secure + SameSite=Strict cookies. Never in localStorage.
- **Session expiry:** Configurable idle timeout (default: 7 days). Sessions invalidated on logout and password change.
- **2FA (TOTP):** Available on all tiers — phavo.net accounts and local accounts alike. Standard TOTP (RFC 6238), compatible with any authenticator app (Authy, 1Password, Google Authenticator). Optional, not enforced. Setup via QR code in account settings. Backup codes generated at 2FA setup.
- **Brute-force protection:** Login rate-limited per IP and per account — 10 attempts before a 5-minute lockout. Applies to both phavo.net and local logins.
- **CSRF protection:** All state-changing API endpoints require a CSRF token. Enforced by Hono middleware.

### 12.2 Data Encryption

- **Credentials at rest:** All sensitive values (Pi-hole tokens, RSS Basic Auth credentials, Bearer tokens, future OAuth tokens) encrypted with AES-256-GCM in libSQL. Encryption key derived from a server-side secret stored in the Docker volume, separate from the database file.
- **Config exports:** Credentials excluded by default. Optional inclusion uses AES-256-GCM encryption with a user-provided passphrase — the passphrase is never stored or transmitted.
- **HTTPS / TLS:** All traffic between browser and Phavo encrypted in transit. TLS 1.2 minimum, TLS 1.3 preferred. Built-in certificate management (Let's Encrypt, self-signed, or custom cert). HTTP redirects to HTTPS automatically once HTTPS is configured.
- **phavo.net communication:** All local app → phavo.net API calls over TLS with standard CA validation. No certificate pinning (would break every 90 days with Let's Encrypt rotation).

### 12.3 External Data & Privacy

- **RSS feed fetching:** Fetched server-side by `@phavo/agent`, not in the browser. This means external feed servers see the IP of the Phavo host, not the user's browser. Users should be aware of this when using public cloud hosts.
- **No telemetry by default:** Phavo collects no telemetry, no analytics, no error reporting from the local app without explicit user opt-in.
- **phavo.net anonymous analytics:** Anonymised, aggregated usage data is collected on phavo.net (which widget categories are popular, setup completion rates). No PII, no per-user tracking. Collected data is listed explicitly in the privacy policy. Users can opt out from the phavo.net account settings.
- **Minimal phavo.net data retention:** phavo.net stores only email address, hashed password, licence key association, and active instance count per account. No dashboard layout, no widget config, no content is ever sent to phavo.net.
- **DSGVO / GDPR compliance:** phavo.net privacy policy published before launch. Right to erasure (account deletion removes all phavo.net data). Data processing agreement (DPA) available on request for business users.

### 12.4 Infrastructure & Supply Chain

- **Dependency scanning:** GitHub Dependabot enabled for all packages in the monorepo — automatic PRs for security updates. `bun audit` runs in CI on every push and PR.
- **CI/CD security:** GitHub Actions workflows pin all action versions to a commit SHA (not a tag). No third-party actions without explicit review. Secrets managed via GitHub Encrypted Secrets, never in code.
- **Docker image scanning:** Container image scanned for known CVEs on every build (e.g. via Trivy in CI). Images published only if scan passes.
- **Signed releases:** All Docker images and binary releases signed. Checksums published with every release on GitHub and phavo.net.
- **Minimal Docker image:** The build stage uses `oven/bun:1-alpine`. The production runtime stage uses `oven/bun:1-alpine` with the shell explicitly removed post-copy (`RUN apk del busybox`) and only Bun runtime files present — no package manager, no unnecessary tools. A fully distroless base is the Phase 2 hardening target; Alpine with shell removal is the Phase 1 pragmatic baseline.

### 12.5 Responsible Disclosure

Phavo operates a responsible disclosure programme from day one:

- **Security policy:** `SECURITY.md` in the public repo and a dedicated page at `phavo.net/security` describing the process.
- **Disclosure email:** `security@phavo.net` — monitored by the maintainer. PGP key published for encrypted reports.
- **Response commitment:** Acknowledgement within 48 hours, status update within 7 days, fix timeline communicated within 14 days.
- **CVE coordination:** Critical vulnerabilities coordinated with GitHub Security Advisories before public disclosure.
- **Hall of fame:** Researchers who report valid vulnerabilities listed on `phavo.net/security` (with their permission).
- **No legal threats:** Phavo explicitly commits not to pursue legal action against researchers acting in good faith.

### 12.6 Security in the Widget System

- **No arbitrary code execution:** Widgets do not execute arbitrary JavaScript from external sources. Widget definitions are server-side only; the frontend renders data, not code.
- **Content Security Policy (CSP):** Strict CSP headers on all dashboard pages. Inline scripts disallowed. External resources allowlisted explicitly.
- **RSS content sanitisation:** RSS feed content (titles, descriptions) sanitised with a strict allowlist before rendering — no raw HTML injection.
- **Links widget:** URLs validated against an allowlist of schemes (`https://`, `http://` explicitly allowed; `javascript:`, `data:` and other schemes blocked).
- **Pi-hole token storage:** Pi-hole API token never exposed to the frontend. All Pi-hole API calls proxied through `@phavo/agent` on the server side.
- **Future widget review:** When the widget marketplace launches (Phase 4), all community widgets go through a security review before listing. Sandboxing strategy for third-party widget code to be defined in Phase 4.

---

## 13. Non-Functional Requirements

| Requirement | Target |
|---|---|
| Initial page load | < 1s on local network |
| Widget data refresh | Configurable (default: 5s system, 60s weather/RSS) |
| Docker image size | < 200MB |
| Arm64 support | Required (Raspberry Pi 4/5) |
| TypeScript | Strict, no `any` |
| Accessibility | WCAG 2.1 AA |
| i18n readiness | All strings in `en.json` from day one |
| Browser support | Last 2 versions of Chrome, Firefox, Safari |
| Mobile responsiveness | ≥ 375px screens |
| Session security | HttpOnly + Secure + SameSite=Strict cookies, configurable idle timeout (default 7 days) |
| Password hashing | Argon2id |
| Credential storage | AES-256-GCM encrypted at rest in libSQL |
| TLS | TLS 1.2 minimum, TLS 1.3 preferred, built-in cert management |
| CSRF | Token required on all state-changing endpoints |
| Brute force | 10 attempts → 5-minute lockout per IP and per account |
| Dependency scanning | Dependabot + `bun audit` in CI on every push |
| Docker hardening | Non-root user, read-only filesystem except data volume |
| Update check | GitHub Releases API, max once/hour, cached |
| Offline grace period | Free: 24h · Standard: 72h — after last successful login validation |
| Telemetry | None by default; phavo.net analytics anonymised + aggregated only |

---

## 14. Out of Scope (Phase 1)

- Cloud sync (Phase 4)
- Widget marketplace (Phase 4)
- Multi-user / team accounts
- Mobile native apps (Phase 3)
- Desktop native features (Phase 2)
- **Native installer for Windows / macOS** (Phase 2 — desktop app solves this)
- Plugin/widget SDK public release (schema defined in Phase 1; Local Plugin API + `@phavo/plugin-sdk` planned for Phase 1.x — see Section 17)
- Light theme (token system ready, theme not designed)
- Spotify widget (Phase 1.x — pending OAuth relay)
- Public demo instance (built just before v1.0 launch, not during Phase 1 development)
- Open source release (post v1.0)

---

## 15. Decisions

> **Note on numbering:** Decisions 1–32 cover core product and Phase 1–2 architecture. Decisions 33–41 are security hardening decisions (originally in §17.8 — merged here for completeness). Decisions 42+ cover platform, plugin, and design decisions.

| # | Decision |
|---|---|
| 1 | **Spotify OAuth:** Cloud relay `phavo.net/api/oauth/spotify/callback`. Stateless, DSGVO-compliant. Phase 1.x. |
| 2 | **Licence & auth:** Four tiers. Free: phavo.net login + **24h** offline grace. Standard: phavo.net login + **72h** offline grace. Local: one-time activation, fully offline. Ultra: one-time activation, fully offline + exclusive widgets + 1yr updates. |
| 3 | **RSS auth:** Basic Auth + Bearer token, encrypted in libSQL. At launch. |
| 4 | **Widget resize:** S / M / L / XL steps, grid snapping. |
| 5 | **Theme:** Dark only at launch. Token system ready for future themes. |
| 6 | **Figma timing:** Code first, Figma later. No hardcoded values in `@phavo/ui`. |
| 7 | **Access protection:** Free/Standard: phavo.net login. Local: local username + password. No unauthenticated access. |
| 8 | **Mobile (Phase 1):** Responsive web app ≥ 375px. Native apps Phase 3. |
| 9 | **Updates:** In-dashboard panel with version badge. Phase 1 (Docker): copy-paste command snippet, optional Docker socket for one-click (opt-in). Phase 2 (Desktop/Installer): Tauri Updater — signed, automatic, no terminal required. |
| 10 | **Pi-hole:** At launch. Core widget for Persona A. |
| 11 | **Links / Bookmarks:** At launch. Core widget for Persona B. |
| 12 | **Setup:** Quick Setup (3 steps) + Full Setup (10 steps). Both accessible from welcome screen. |
| 13 | **Freemium:** Free tier — core system widgets + weather, 1 tab, Phavo branding. No time limit. |
| 14 | **Pricing:** Free €0 · Standard €8.99 · Local €24.99 · Ultra €39.99. Launch discount recommended. Superseded by Decision 62. |
| 15 | **Open source:** AGPL-3.0 + commercial dual licence, released after v1.0. |
| 16 | **Export credentials:** Excluded by default; optionally included as passphrase-encrypted blob. |
| 17 | **Widget drawer:** + button in header — add/remove widgets at any time post-setup.
#### Command Palette (Cmd+K / Ctrl+K)

A universal search and action interface accessible from anywhere in the dashboard.

**Trigger:** Cmd+K (macOS) / Ctrl+K (Windows/Linux) — global keyboard shortcut in the root layout.

**Capabilities:**

1. **Local search** — searches the current dashboard in real-time:
   - Widgets (by name, category)
   - Settings tabs (navigates directly)
   - Notifications (shows unread count)
   - Actions ("Add Widget", "Export Config", "Open Settings")

2. **Web search** — user-configurable search engine:
   - Default: DuckDuckGo
   - Options: Google, Brave, Startpage, custom URL template
   - Configured in Settings → General

3. **AI chat** — inline AI assistant:
   - Ollama (localhost — fully offline, perfect for Local tier)
   - OpenAI (API key in Settings → General)
   - Anthropic Claude (API key in Settings → General)
   - Simple prompt → response inline in the panel
   - No history stored, no context from dashboard data (Phase 1.x)
   - API keys stored server-side in `credentials` table — never in frontend

**Iron rule:** AI API calls are always made server-side via `POST /api/v1/ai/chat`. API keys never reach the browser.

**UI:** Full-width modal overlay, keyboard-navigable (arrow keys + Enter), Escape to close. Results grouped by category (Dashboard, Web, AI).

 |
| 18 | **2FA:** TOTP-based, optional on all tiers. Backup codes generated at setup. |
| 19 | **HTTPS:** Self-signed cert by default (works everywhere). Let's Encrypt as advanced opt-in for public-facing domains. Custom cert supported. TLS 1.2 min, HTTP → HTTPS redirect once configured. |
| 20 | **RSS fetching:** Server-side via `@phavo/agent` (not browser-direct). Feed server sees Phavo host IP only. |
| 21 | **Telemetry:** None from local app. phavo.net analytics anonymised + aggregated only. Opt-out available. |
| 22 | **Responsible disclosure:** `security@phavo.net` + `SECURITY.md`. 48h acknowledgement SLA. No legal threats for good-faith research. |
| 23 | **Dependency scanning:** Dependabot + `bun audit` in CI. Docker image scanned via Trivy on every build. |
| 24 | **Docker hardening:** Non-root user, read-only filesystem except data volume, distroless/Alpine base image. |
| 25 | **Open source enforcement:** AGPL-3.0 with server-side tier enforcement via phavo.net. No code-level locks — a self-compiled AGPL build defaults to Free tier behaviour. |
| 26 | **Installer:** No native installer in Phase 1. Docker only. Phase 2 desktop app solves the Persona B installation barrier on Windows/macOS. |
| 27 | **Demo:** Built just before v1.0 launch, once the dashboard is stable. Not during Phase 1 development. |
| 28 | **Refund policy:** 14-day money-back guarantee on all paid tiers via Gumroad. |
| 29 | **Free tier offline grace:** 24 hours (shorter than Standard's 72h — incentivises upgrade). |
| 30 | **TLS default:** Self-signed cert generated on first start (works for all home/local installs). Let's Encrypt as advanced opt-in for public-facing domains only. Certificate pinning removed — standard CA validation used. |
| 31 | **Docker update (Phase 1):** Update panel shows copy-paste command snippet. Docker socket access for one-click update is opt-in with documented security implications. Phase 2 replaces this with Tauri Updater — fully automatic, signed, no user action beyond confirming. |
| 32 | **Notification system:** Collapsible panel from right side, bell icon in header with unread badge. In-memory history per process lifetime. Notifications are clickable and deep-link to widgets or settings. All widgets (including future third-party) can push via shared `notify()` from `@phavo/types`. Built-in triggers: disk >90%, CPU temp >80°C, Pi-hole unreachable, RSS failing, update available. |
| 33 | **Tier enforcement per-endpoint:** `requireTier()` middleware on every Standard/Local API route. Tier re-read from session record in DB on every request — never from cookie payload or client headers. |
| 34 | **Opaque session tokens:** 32-byte random session ID, no JWT, no decodable tier claim in cookie. |
| 35 | **Tier not in config table:** No user-editable DB column controls tier. Tier flows only via phavo.net validation → session record → middleware. |
| 36 | **Local activation token signing:** Signed JWT from phavo.net, verified against embedded public key on every server start. Manual DB edits detected and rejected. |
| 37 | **Tier-filtered widget manifest:** `GET /api/v1/widgets` returns full definitions for entitled widgets and teaser entries (`WidgetTeaserDefinition`) for locked widgets. Standard dataEndpoints and permissions never reach the browser for Free users. |
| 38 | **No tier in client payload:** SvelteKit layout load never serialises tier to the client. Upgrade prompts are cosmetic UX only — server enforces access independently. |
| 39 | **SRI on external resources:** Subresource Integrity hashes applied to externally loaded resources (fonts, CDN assets). Not applied to self-hosted bundle files — SRI provides no protection against server-side file tampering on the same origin. |
| 40 | **Plugin permission system:** Third-party widgets must declare permissions at install time. Undeclared capabilities denied at runtime by middleware wrapper. |
| 41 | **Plugin import allowlist:** Phase 1.x plugins statically analysed at load time. Imports outside the allowlist cause the plugin to be rejected — not loaded. |
| 42 | **Platform abstraction:** No hardcoded `/data/` paths or ports in server code. All path/port values read from `PHAVO_DB_PATH`, `PHAVO_DATA_DIR`, `PHAVO_PORT`, `PHAVO_HTTPS_PORT`, `PHAVO_ENV`. Phase 1 Docker defaults applied if env vars absent. |
| 43 | **`installMethod` detection:** Derived from `PHAVO_ENV` on first start, stored in `config` table. Values: `'docker-compose'` \| `'bun-direct'` \| `'tauri'`. Drives which update UI is shown. |
| 44 | **Tauri Sidecar:** Phase 2 wraps `apps/web/` Bun server as a Tauri sidecar. No changes to `apps/web/` required — platform abstraction (Decision 42) is the only prerequisite. |
| 45 | **Tauri Updater:** Ed25519-signed updates via phavo.net endpoint. Private key in GitHub Actions Secrets only. Auto-install with user confirmation dialog. |
| 46 | **Tauri data paths:** OS app data dir provided by `tauri::api::path::app_data_dir()`, passed to sidecar as `PHAVO_DATA_DIR` env var. macOS: `~/Library/Application Support/phavo/`, Windows: `%APPDATA%\phavo\`, Linux: `~/.local/share/phavo/`. |
| 47 | **Plugin API versioning:** `WidgetDefinition` schema is versioned via `schemaVersion` field in `manifest.json`. Breaking changes require a major `@phavo/plugin-sdk` version bump. Compatibility matrix in `packages/types/src/plugin-compat.ts`. Old-schema plugins load with a deprecation warning in Phase 1.x, are rejected in Phase 4 Marketplace. |
| 48 | **SDK docs prerequisite:** `@phavo/plugin-sdk` is not published until `docs.phavo.net/plugins` minimum viable docs are live. A developer must be able to build and deploy a working plugin in under 30 minutes from zero. |
| 49 | **Plugin pricing cap:** Marketplace widgets priced by developers within phavo.net-enforced limits: free, one-time up to €9.99, or subscription up to €2.99/month. Higher pricing requires explicit approval. |
| 50 | **Font:** Geist (UI) + Geist Mono (data values). Loaded via Google Fonts. CSS variables `--font-ui` and `--font-mono` — never hardcoded font names in components. |
| 51 | **Accent colour:** Amber/gold (#d4922a) replaces teal (#0f6e56). Chosen for strong contrast on pure black, editorial feel, differentiation from typical green-heavy homelab tools. |
| 52 | **Schema-driven Settings UI:** `<SchemaRenderer>` component renders Settings panels from `configSchema` automatically. No per-widget custom Settings code. New widgets get a Settings panel for free. |
| 53 | **Widget states:** Five states: `loading`, `active`, `unconfigured`, `error`, `stale`. `unconfigured` is the default for any widget with a `configSchema` that has no saved config — shows inline "Configure" prompt. |
| 54 | **Plugin discovery notification:** On server start, if new plugins were found in `/data/plugins/` since last start, a notification is pushed to the dashboard notification panel. |
| 55 | **Widget drawer categories:** Filter chips (All · System · Consumer · Integration · Utility) in the drawer. Third-party plugins appear in their declared category automatically. |
| 56 | **Widget schema versioning:** Additive schema changes are safe. Breaking changes (remove/rename required fields) trigger `unconfigured` state on existing instances. Widget `version` field uses semver; breaking changes require minor bump minimum. |
| 57 | **Settings → Widgets layout:** Single tab with master/detail layout — scrollable widget list (left) with search + category filter, config panel (right). No individual tab per widget. Scales to unlimited widgets without polluting the Settings tab bar. Mobile: full-screen list → tap → full-screen detail. |
| 58 | **Config file format:** Dashboard config exports use `.phavo` extension. The format is JSON with an envelope `{ version, exportedAt, config, credentials? }`. Credentials are optionally included as a PBKDF2-SHA256 → AES-256-GCM encrypted blob. |
| 59 | **Widget package format:** Third-party widget packages use `.phwidget` extension. ZIP-based bundle containing `manifest.json`, Svelte component, and optional assets. Defined in Phase 1.x when plugin system ships. |
| 60 | **Command Palette:** Cmd+K global shortcut. Three modes: local dashboard search, web search (configurable engine), AI chat (Ollama/OpenAI/Claude). API keys server-side only, never in frontend. |
| 61 | **AI chat server-side:** All AI API calls go through `POST /api/v1/ai/chat`. API keys stored in `credentials` table. Client never sees keys. Ollama at localhost:11434 for Local tier offline use. |
| 62 | **Pricing model revision:** Four tiers — Free (€0), Standard (€8.99 one-time), Local (€24.99 one-time), Ultra (€39.99 one-time). Standard adds unlimited tabs + all widgets + no branding. Local adds full offline + local account. Ultra adds exclusive widgets + 1yr feature updates. |
| 63 | **Domain:** phavo.net (registered via Cloudflare). All references to phavo.net are invalid. |
| 64 | **Production audit:** 13 issues fixed before v1.0 — CSRF gap, SSRF, missing Secure flag, unvalidated POST /config, non-transactional import, missing external API Zod validation, unbounded notification queue, default secret acceptance, missing configSchemaVersion, health check without DB verify, unbounded TOTP map, redundant dbReady awaits, wrong docker tmpfs path. |
| 65 | **fetchWithCsrf utility:** All client-side mutation requests use `fetchWithCsrf()` from `apps/web/src/lib/utils/api.ts`. Automatically injects X-CSRF-Token on POST/PUT/DELETE/PATCH. GET requests unaffected. |

---

## 16. Widget Plugin Framework

### 16.1 Vision

The widget schema defined in Phase 0 is the seed of a full plugin ecosystem. The goal is to let any developer — from solo homelabbers to SaaS companies — build, distribute, and monetise Phavo widgets without touching the Phavo core. The framework is designed in three stages that map directly to the product roadmap.

| Stage | Phase | What ships |
|---|---|---|
| **Schema** | Phase 0–1 | `WidgetDefinition` type + `dataEndpoint` contract. Internal use only. |
| **Local Plugin API** | Phase 1.x | Self-hosted widgets loaded from a local directory. No phavo.net required. |
| **Marketplace** | Phase 4 | Signed, reviewed widgets distributed via phavo.net. Revenue-sharing. |

### 16.2 Widget Contract (canonical definition)

Every widget — built-in or third-party — must conform to the `WidgetDefinition` schema from `@phavo/types`. The canonical definition is specified in Section 6.2. Key fields relevant to the plugin framework:

- **`id`** — globally unique, reverse-DNS recommended: `"io.phavo.cpu"`, `"com.example.mywidget"`
- **`version`** — semver, required for all plugins; built-in widgets use the Phavo release version
- **`author`** — `"phavo"` for built-ins, the developer's phavo.net username for marketplace widgets
- **`permissions[]`** — every plugin must declare all capabilities it needs (see Section 16.4); built-in widgets use the same system for consistency
- **`tier`** — `'free'` or `'standard'`; third-party plugins shipped via the marketplace can be listed as `'free'` or `'standard'`, but cannot define new tiers

**Iron rule:** The full `WidgetDefinition` is server-side only. The client receives only the rendered data response from `dataEndpoint` — never the full definition. For unentitled tiers, only a `WidgetTeaserDefinition` (see Section 6.2) is returned — no `dataEndpoint`, no `configSchema`, no `permissions`.

### 16.3 Local Plugin API (Phase 1.x)

Local plugins are the bridge between the internal widget schema and the public SDK. They run entirely on the self-hosted Phavo instance — no phavo.net connection needed.

**How it works:**

1. Developer creates a widget package following the Phavo plugin spec (documented at `docs.phavo.net/plugins`)
2. Plugin is placed in the `phavo-data` volume under `/data/plugins/<plugin-id>/`
3. On startup, `WidgetRegistry` scans `/data/plugins/`, validates each `manifest.json` against the `WidgetDefinition` schema, and registers valid plugins
4. Plugin's Hono handler is mounted at `/api/v1/plugins/<plugin-id>/`
5. Plugin's Svelte component is dynamically imported and rendered inside `<WidgetCard>`

**Plugin package structure:**
```
my-widget/
├── manifest.json        # WidgetDefinition (JSON, validated at load time)
├── handler.ts           # Hono route handler — data fetching + business logic
├── Widget.svelte        # Svelte 5 component — rendering only, no data fetching
├── config.schema.json   # Zod-compatible JSON schema for user config
└── README.md
```

**Constraints enforced at load time:**
- `manifest.json` must pass full Zod validation — invalid manifests are rejected with a logged error, the plugin is not loaded
- Plugin ID must match the directory name exactly
- `handler.ts` may only import from an allowlist: `@phavo/types`, `@phavo/agent`, `hono`, `zod`, and Node/Bun built-ins. No arbitrary npm packages (Phase 1.x — full npm support gated behind Phase 4 marketplace review)
- `Widget.svelte` may only use CSS variables from `@phavo/ui/theme.css` — no inline styles, no hardcoded colours (same iron rule as built-in widgets)
- Plugins cannot write to the database schema directly — they interact with the DB only via the `@phavo/db` public API
- Config values entered by users are validated against `configSchema` server-side before being stored

### 16.4 Widget Permissions System

Every plugin must declare which capabilities it needs. Undeclared capabilities are denied at runtime. This is the primary defence against malicious plugins.

```typescript
type WidgetPermission =
  | 'network:outbound'        // make external HTTP requests
  | 'network:local'           // reach LAN hosts (e.g. Pi-hole, local APIs)
  | 'db:read'                 // read from phavo database
  | 'db:write'                // write to phavo database
  | 'credentials:read'        // read user-stored encrypted credentials
  | 'fs:read'                 // read files from /data/plugins/<own-id>/ only
  | 'notify'                  // push notifications via shared notify()
  | 'agent:metrics'           // access @phavo/agent system metric functions
```

Permissions are shown to the user in the plugin installation UI ("This widget wants to: make outbound network requests, read your credentials"). The user must explicitly approve before the plugin activates.

### 16.5 Sandboxing Strategy

**Phase 1.x (Local plugins):** Plugins run in the same Bun process as the SvelteKit server. Sandboxing is enforced via:
- Import allowlist checked at plugin load time (static analysis of `handler.ts` imports)
- Permission system enforced by a middleware wrapper around every plugin's Hono handler
- Plugin Svelte components rendered inside an isolated `<WidgetCard>` — no access to parent component state, no `bind:` on global stores
- No `eval()`, no `new Function()`, no dynamic `import()` with runtime-constructed paths — detected and rejected at load time

**Phase 4 (Marketplace plugins):** Full process-level sandboxing via Bun's `--smol` worker threads or a dedicated subprocess per plugin, with IPC-only communication. Design deferred to Phase 4. Marketplace plugins additionally go through a mandatory security review before listing.

### 16.6 Plugin SDK (Phase 1.x)

A minimal SDK published as `@phavo/plugin-sdk` on npm. This is the **only public surface** of the Phavo plugin system — it intentionally exposes nothing that can bypass tier enforcement or access data outside declared permissions.

```typescript
// Full SDK export surface
export { defineWidget }        // typed helper wrapping WidgetDefinition, validates at call time
export { createHandler }       // Hono factory with permission middleware pre-wired
export type { WidgetContext }  // { db, config, credentials, notify } — scoped to declared permissions
export type { WidgetDefinition, WidgetTeaserDefinition, WidgetPermission }
export { z }                   // re-exported Zod for config schema authoring
export { PluginError }         // typed error class for structured error responses
```

**`WidgetContext` — what handlers receive:**
```typescript
interface WidgetContext {
  db:          PluginDbApi        // scoped read/write — only if 'db:read'/'db:write' declared
  config:      PluginConfigApi    // read own widget instance config
  credentials: PluginCredApi      // decrypt named credentials — only if 'credentials:read' declared
  notify:      NotifyFn           // push notifications — only if 'notify' declared
  agent:       PluginAgentApi     // system metrics — only if 'agent:metrics' declared
}
```

**Developer workflow:**
```bash
bun create phavo-widget my-widget   # scaffold from official template (published on npm)
cd my-widget
bun run dev                         # hot-reload against a local Phavo instance
bun run validate                    # static analysis: import allowlist + permission audit
bun run build                       # compile handler.ts + validate Widget.svelte
# Result: dist/ directory ready to copy to /data/plugins/my-widget/
# Phase 4: bun run publish → submit to marketplace
```

**`bun create phavo-widget` template structure:**
```
my-widget/
├── manifest.json          # WidgetDefinition — filled with sensible defaults
├── handler.ts             # Example: fetches external API, returns typed data
├── Widget.svelte          # Example: renders data with CSS variables, skeleton state
├── config.schema.json     # Example: one text field "apiUrl"
├── README.md              # Template with required sections: description, permissions, config
├── package.json           # devDependencies: @phavo/plugin-sdk only
└── tsconfig.json          # extends @phavo/types tsconfig, strict: true
```

### 16.7 Phase 4 — Marketplace

When the Widget Marketplace launches:

- All marketplace widgets are **signed** with the author's phavo.net developer key
- Widgets go through **automated security review** (static analysis, import scanning, permission audit) and **manual review** for Pro-tier widgets
- Installation is one-click from the dashboard widget drawer — no manual file copy
- Revenue sharing: 70% to developer, 30% to phavo.net platform fee (subject to change before Phase 4)
- Pricing options for marketplace widgets: free, one-time purchase, or subscription (handled by phavo.net payments)
- Community widgets are free to list; Pro widgets require a developer account on phavo.net
- **Marketplace widget pricing range:** free – €9.99 one-time – max €2.99/month subscription (enforced by phavo.net checkout)

### 16.8 Non-Goals for the Plugin System

- No light DOM access from plugin components to the Phavo shell (no `document.querySelector` outside the widget's own shadow root)
- No server-side rendering of arbitrary plugin HTML (plugins render only via the `<WidgetCard>` slot contract)
- No plugin-to-plugin communication in Phase 1.x (considered for Phase 4)
- No CLI-based remote plugin installation in Phase 1 (copy to volume only)
- No npm package imports in Phase 1.x handlers (only allowlisted packages — see §16.3)

### 16.9 Plugin API Versioning Strategy

The `WidgetDefinition` schema is a public API surface. Once `@phavo/plugin-sdk` is published, breaking changes require a migration path.

**Versioning rules:**

| Change type | Example | Treatment |
|---|---|---|
| Additive (new optional field) | Add `badge?: string` to manifest | Safe — old plugins load fine |
| Additive (new permission type) | Add `'fs:write'` to `WidgetPermission` | Safe — undeclared permissions denied |
| Breaking (rename/remove field) | Rename `dataEndpoint` → `endpoint` | Requires major SDK version bump |
| Breaking (new required field) | Make `permissions` non-optional | Requires migration + deprecation period |

**SDK versioning:**
- `@phavo/plugin-sdk` follows semver strictly
- Major version = breaking `WidgetDefinition` change
- The plugin loading pipeline checks `manifest.json` against the current schema version
- Plugins built against an older SDK major version: loaded with a deprecation warning in Phase 1.x, rejected in Phase 4 Marketplace

**Compatibility matrix (tracked in `packages/types/src/plugin-compat.ts`):**
```typescript
// Maps manifest schemaVersion → minimum @phavo/plugin-sdk version
export const PLUGIN_COMPAT: Record<string, string> = {
  '1': '1.0.0',   // current
  // '2': '2.0.0' — added when breaking schema change ships
}
```

Plugins declare their schema version in `manifest.json` as `"schemaVersion": "1"`. Missing → defaults to `"1"`.

### 16.10 Developer Documentation (docs.phavo.net/plugins)

Required before `@phavo/plugin-sdk` is published. Minimum viable docs at Phase 1.x launch:

| Page | Content |
|---|---|
| `/plugins` | Overview, 3-minute quickstart, link to template |
| `/plugins/getting-started` | Prerequisites, `bun create phavo-widget`, local dev loop |
| `/plugins/manifest` | All `manifest.json` fields, types, constraints, examples |
| `/plugins/permissions` | Each permission explained, when to request it, security implications |
| `/plugins/handler` | `WidgetContext` API reference, error handling, caching patterns |
| `/plugins/component` | `Widget.svelte` contract, CSS variables available, skeleton/error states |
| `/plugins/examples` | Three reference implementations: simple API fetch, LAN device, system metric |
| `/plugins/faq` | "Why can't I import npm packages?", "How do I store secrets?", "How do updates work?" |

**Docs are required before the SDK is published.** No SDK without docs — a widget developer should be able to build and deploy a working plugin in under 30 minutes from zero.

---

## 17. Dashboard Hardening — Tamper Resistance

### 17.1 Threat Model

The primary threat is a technically capable user who either:
1. **Inspects and replays API responses** — intercepts the session cookie and crafts requests to access Standard/Local endpoints from a Free account
2. **Modifies the client-side JavaScript bundle** — patches the compiled Svelte output to remove feature gates in the UI
3. **Directly edits the libSQL database file** — changes the stored tier value to `'standard'` or `'local'`
4. **Forks the AGPL codebase and removes tier checks** — builds a version without any restrictions

Phavo's architecture is designed so that **options 1–3 yield nothing**, and **option 4 is explicitly permitted** under the AGPL licence (a self-built fork gets Free tier behaviour from phavo.net anyway — see Decision 25).

### 17.2 Server-Side Tier Enforcement on Every Request

Every API endpoint that serves Standard/Local-only data enforces tier access server-side, independently of what the client sends. This is the central hardening principle.

**Implementation — Hono middleware:**

```typescript
// packages/types/src/auth.ts (already defined)
type Tier = 'free' | 'standard' | 'local'

// apps/web/src/lib/server/middleware/requireTier.ts
export function requireTier(minimum: Tier) {
  return async (c: Context, next: Next) => {
    const session = c.get('session')           // set by auth middleware
    if (!session) return c.json(err('Unauthorized'), 401)

    const tierRank: Record<Tier, number> = { free: 0, standard: 1, local: 2 }
    if (tierRank[session.tier] < tierRank[minimum]) {
      return c.json(err('Upgrade required'), 403)
    }
    await next()
  }
}
```

**Applied to every protected endpoint:**
```typescript
app.get('/pihole',    requireTier('standard'), async (c) => { ... })
app.get('/rss',       requireTier('standard'), async (c) => { ... })
app.get('/links',     requireTier('standard'), async (c) => { ... })
app.post('/config',   requireSession(),        async (c) => { ... })
```

The tier embedded in the session cookie is **never trusted directly**. On every request the `requireTier` middleware re-reads the tier from the validated session record in libSQL — not from a cookie field, not from a client header. A user cannot elevate their tier by modifying a cookie value.

### 17.3 Session Integrity

- **Session record is the source of truth.** The tier stored in the `sessions` table in libSQL is set exclusively by the server during login/licence validation. It cannot be changed by any client-accessible API.
- **Session token is opaque.** The cookie value is a cryptographically random string (32 bytes, base64url). It contains no decodable payload — no JWT, no tier claim, nothing a user can decode and modify.
- **Tier re-validation on login.** Every login event triggers a fresh phavo.net licence validation (Free/Standard) or local activation check (Local). The tier in the session record is overwritten with the freshly validated value — any manually edited DB value is overwritten at next login.
- **Session invalidation on tier change.** If a licence upgrade or downgrade is processed via phavo.net, the current session is invalidated and the user is required to log in again. This ensures the new tier is written from a fresh validation, not inherited.

### 17.4 Database Tamper Resistance

The libSQL database file lives at `/data/phavo.db` inside the Docker volume. A user with volume access can theoretically edit it directly with a SQLite client. Phavo mitigates this:

- **Tier not stored in config table.** The tier is derived exclusively from the active session (which comes from phavo.net validation or Local activation) — not from a `config` key-value pair that a user could trivially edit.
- **Activation token integrity.** For Local tier, the activation token stored in `/data/phavo.db` is a signed JWT issued by phavo.net, containing: `{ instanceId, tier, activatedAt, sig }`. The signature uses an asymmetric key — the public key is embedded in the Phavo binary at build time (pinned). On every server start, the activation token is re-verified against the embedded public key. A manually edited token fails signature verification and is rejected → instance falls back to Free behaviour.
- **No tier column in user table.** There is no `tier` column in the `users` or `config` tables that a user could edit to elevate themselves. Tier flows only through: phavo.net validation → session record → request middleware.

### 17.5 Client-Side Hardening

Client-side code is intentionally designed so that bypassing it provides no server-side benefit. Nonetheless, several measures reduce the attack surface:

- **No tier data in the HTML payload.** The SvelteKit layout server load function passes only `{ loggedIn: boolean, dashboardName: string }` to the client. The user's tier is **never** serialised into the initial HTML or any client-accessible store. Widget availability is determined server-side by the widget manifest response (see below).
- **Widget manifest is tier-filtered server-side.** `GET /api/v1/widgets` returns only the widgets the authenticated user's tier is entitled to. A Free user receives only the 7 free widgets in the manifest — the Standard widget definitions are never sent to the browser. The client cannot render a widget it has no definition for.
- **Upgrade prompts are cosmetic.** The "Upgrade to Standard" UI shown in the widget drawer is a UX hint, not a security gate. Removing it from the client bundle has zero effect — the server still returns `403` for any Standard endpoint called by a Free session.
- **Subresource Integrity on external resources.** SRI hashes are applied to externally loaded assets (Geist + Geist Mono from Google Fonts, or self-hosted via `@fontsource`). SRI is intentionally **not** applied to Phavo's own self-hosted JS/CSS bundles — on a self-hosted server, an attacker with filesystem access can modify both the bundle file and the HTML file containing the hash simultaneously, so SRI provides no meaningful protection against server-side tampering on the same origin.
- **No debug endpoints in production.** The Hono router registers no diagnostic or admin routes in production builds. `NODE_ENV` is set to `production` in the Docker image; any `dev`-only route registration is gated behind an environment check.

### 17.6 Rate Limiting on Tier-Sensitive Endpoints

All endpoints that enforce tier access are additionally rate-limited to prevent enumeration and brute-force probing:

| Endpoint group | Rate limit | Window |
|---|---|---|
| `POST /api/v1/auth/login` | 10 requests | 5 minutes per IP + per account |
| `POST /api/v1/auth/*` | 30 requests | 1 minute per IP |
| `GET /api/v1/pihole`, `rss`, `links` | 60 requests | 1 minute per session |
| `GET /api/v1/update/check` | 1 request | 1 hour per session (cached) |
| `POST /api/v1/config` | 20 requests | 1 minute per session |

Rate limiting is implemented as in-memory counters in Phase 1 (acceptable for single-instance self-hosted). Phase 4 Cloud migrates to a Turso-persisted distributed rate limiter, consistent with the existing Phase 4 database stack — no additional Redis dependency introduced.

### 17.7 What Is Intentionally Not Hardened

Phavo does not attempt to prevent:

- **AGPL forking without tier checks.** This is a legitimate use under the licence. A self-built fork that removes all tier logic gets Free tier data from phavo.net anyway, because the licence key validation is server-side on phavo.net infrastructure.
- **Users reading their own data from the volume.** The `/data` volume is theirs. They own the hardware. Phavo does not encrypt the entire database — only credentials at rest (AES-256-GCM). Reading your own widget layout from SQLite is not a threat.
- **Network interception between browser and local Phavo instance.** On a local network, a user could run a MitM proxy against their own traffic. This is not a realistic attack on a self-hosted tool running on `localhost` or a trusted home network. TLS is still enforced to protect against accidental exposure on shared networks.

### 17.8 Decisions Added

| # | Decision |
|---|---|
| 33 | **Tier enforcement per-endpoint:** `requireTier()` middleware on every Standard/Local API route. Tier re-read from session record in DB on every request — never from cookie payload or client headers. |
| 34 | **Opaque session tokens:** 32-byte random session ID, no JWT, no decodable tier claim in cookie. |
| 35 | **Tier not in config table:** No user-editable DB column controls tier. Tier flows only via phavo.net validation → session record → middleware. |
| 36 | **Local activation token signing:** Signed JWT from phavo.net, verified against embedded public key on every server start. Manual DB edits detected and rejected. |
| 37 | **Tier-filtered widget manifest:** `GET /api/v1/widgets` returns full definitions for entitled widgets and teaser entries (`WidgetTeaserDefinition`) for locked widgets. Standard dataEndpoints and permissions never reach the browser for Free users. |
| 38 | **No tier in client payload:** SvelteKit layout load never serialises tier to the client. Upgrade prompts are cosmetic UX only — server enforces access independently. |
| 39 | **SRI on external resources:** Subresource Integrity hashes applied to externally loaded resources (fonts, CDN assets). Not applied to self-hosted bundle files — SRI provides no protection against server-side file tampering on the same origin. |
| 40 | **Plugin permission system:** Third-party widgets must declare permissions at install time. Undeclared capabilities denied at runtime by middleware wrapper. |
| 41 | **Plugin import allowlist:** Phase 1.x plugins statically analysed at load time. Imports outside the allowlist cause the plugin to be rejected — not loaded. |

---

## 18. Success Metrics (Phase 1)

- 200 phavo.net account registrations within 60 days of launch
- 100 paid licence sales (Standard + Local) within 60 days
- Free → paid conversion rate ≥ 5% (baseline); ≥ 15% (stretch goal)
- Docker Hub: 500+ pulls in first month
- Setup completion rate ≥ 80%
- < 5 critical bug reports in first 2 weeks

---

## Appendix — Changelog

### v1.8 (2026-03-26) — Consistency pass

| # | Issue | Fix |
|---|---|---|
| 1 | Quick Setup default layout included Links (Standard-only widget) for Free users | Step 3 now loads system widgets + weather for Free; Links added only for Standard/Local |
| 2 | Widget drawer upgrade prompt contradicted tier-filtered manifest (can't show widgets that are never sent) | Introduced `WidgetTeaserDefinition` — locked widgets sent as name/description/tier only, no `dataEndpoint` or `permissions` |
| 3 | `WidgetDefinition` defined twice with different fields (`version`, `author`, `permissions`, `notifications`, `category` diverged) | One canonical definition in §6.2; §16.2 now references it instead of duplicating |
| 4 | Decision #31 missing; Decision #32 used for two unrelated decisions | Added Decision 31 (Docker update); Hardening decisions renumbered 33–41 |
| 5 | Decision 2 stated Free offline grace as 72h (should be 24h) | Corrected to Free: 24h · Standard: 72h |
| 6 | SRI on self-hosted bundle claimed to prevent bundle tampering — incorrect (same-origin HTML + bundle can both be modified) | SRI scoped to external resources only; explanation added |
| 7 | "No shell" claim contradicted `oven/bun:1-alpine` base (Alpine has `/bin/sh`) | Pragmatic baseline: Alpine + post-copy shell removal; distroless noted as Phase 2 target |
| 8 | Phase 4 rate limiting referenced Redis — not in defined stack | Replaced with Turso-persisted rate limiter, consistent with Phase 4 DB stack |
| 9 | Tauri Mobile described as "natively compiled" — incorrect (WebView-based) | Corrected to "rendered via Tauri's mobile WebView (WKWebView / Android WebView)" |
| 10 | §16.2 code comment referenced `see 17.4` (wrong section after renumbering) | Resolved by §16.2 rewrite — no longer contains the stale reference |
| 11 | `@phavo/agent` described as "Bun daemon" in Techstack — it is a library in Phase 1 | Clarified: library in Phase 1, standalone daemon only in Phase 4 |
| 12 | Import/Export feature specified in §6.2 but no API endpoints defined in §6.5 | Added `GET /api/v1/config/export` and `POST /api/v1/config/import` to API table |


| 61 | **Version management:** Single source of truth in root `package.json`. Vite injects `PHAVO_VERSION` at build time. Release scripts (`release:patch/minor/major`) bump version, commit, tag, push — triggering Docker CI and GitHub Release automatically. |
| 62 | **Docker Hub:** Public repository `phavo/phavo`. Tagged as `:latest` on every main push and `:VERSION` on every release tag. Multi-arch (amd64 + arm64) via GitHub Actions buildx. Docker Hub account uses `docker@phavo.net`. |
| 63 | **Email infrastructure:** Hetzner Webhosting S for mail hosting. MX records via Cloudflare. Addresses: `docker@`, `security@`, `hello@`, `noreply@` phavo.net. |
| 64 | **Web presence:** phavo.net (landing) on Hetzner Webhosting. docs.phavo.net on GitHub Pages or Netlify. DNS and CDN via Cloudflare. www.phavo.net CNAME redirects to apex. |
| 65 | **Dashboard auto-update:** `GET /api/v1/update/check` polls GitHub Releases API (1h cache). Header badge appears on new version. Update panel shows changelog. `POST /api/v1/update/apply` runs `docker compose pull && docker compose up -d` for docker-compose installs. |

---

*Phavo · phavo.net · github.com/phabioo/phavo*
