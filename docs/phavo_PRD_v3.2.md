# Phavo — Product Requirements Document

**Version:** 3.2  
**Date:** 2026-03-26  
**Status:** Active — Sessions 1–9 planned · Feature-complete · Pre-Launch  
**Owner:** getphavo

**Changelog v3.2:** Pro→Local upgrade removed (two separate product lines, no cross-upgrade). Setup Wizard steps 7/7b swapped (Plugin Install now Step 7, Widget Select now Step 7b). Standard→Pro upgrade via button in Settings → Licence. IBackupProvider formally defined. plugin_data 10MB limit. Plugin upload: 5 complete uploads/10min. Theme signing: unsigniert. Milestone order revised. New widgets: Docker, Service Health, Speedtest, Calendar. Desktop Installer roadmap added (Linux v1.1, macOS v1.2, Windows v1.3). Widget Store as store.phavo.net. First-party widgets: plugin structure without bundle format in v1.0. Ecosystem features marked as traction-dependent.

---

## 1. Product Overview

Phavo is a modular, self-hosted personal dashboard. **Positioning: "Your personal dashboard, done right."**

Phavo targets two core personas: homelab/self-hosting users who want a polished dashboard without YAML or config files, and non-technical users who want a personal daily dashboard without setup complexity. Both share the same core need — a dashboard that works beautifully without friction — and differ only in their entry point.

Phavo ships first as a web dashboard (Phase 1), then expands to desktop (Phase 2), mobile (Phase 3), and cloud (Phase 4).

The core promise: **beautiful by default, infinitely extensible, yours to own — and built with security at every layer.**

### Product Tiers

| | Phavo Standard | Phavo Pro | Phavo Local |
|---|---|---|---|
| Price | €0 | €8.99 one-time (launch €5.99) | €24.99 one-time (launch €16.99) |
| Widgets | Core system + weather | All launch widgets | All launch widgets |
| Tabs | 1 | Unlimited | Unlimited |
| Auth | phavo.net account | phavo.net account | Local user account |
| 2FA | Optional (TOTP) | Optional (TOTP) | Optional (TOTP) |
| Internet required | Yes (login) | Yes (login) | No (after activation) |
| Offline grace period | 24 hours | 72 hours | Not applicable |
| Phavo branding | Visible | Removable | Removable |
| HTTPS | Built-in (self-signed default) | Built-in | Built-in |
| Refund | 14-day guarantee | 14-day guarantee | 14-day guarantee |
| Target user | Try-before-buy, homelab intro | Most users, best value | Privacy-focused, air-gapped |
| Upgrade path | → Pro or Local | — | — |

### Open Source Strategy

Open source release is **deferred to post-v1.0**. The codebase is currently closed source (all rights reserved). After v1.0 ships and the product proves commercial viability, a dual-licence release (AGPL-3.0 + commercial) will be evaluated.

**Rationale:** Tier enforcement is done entirely server-side via phavo.net — not through code locks. Releasing AGPL before a stable server-side enforcement infrastructure is in place would undermine the commercial model. This decision is revisited after v1.0 launch.

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

Phavo's differentiator: **polished GUI, guided setup, resizable widgets, extensible plugin system, standard tier to try for free, multi-platform.**

---

## 3. Goals

### Primary Goals (Phase 1)
- Ship a self-hosted web dashboard with a curated set of launch widgets
- Deliver both a Quick Setup and a full guided setup experience
- Establish a clean widget schema and plugin API as the foundation for the ecosystem
- Launch a Standard (free) tier to drive adoption, convert to paid via Pro and Local
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
- **Entry point:** Standard tier → upgrades to Pro or Local for full widget set

### Persona B — The Informed Consumer
- Non-technical but digitally fluent
- Wants a personal dashboard: weather, news, music, bookmarks
- No interest in YAML or CLI setup
- Values design quality and ease of use
- May not own a server — runs Phavo on a home machine or NAS via Docker
- **Phase 1 limitation:** Docker knowledge required. A native installer (Phase 2 desktop app) removes this barrier.
- **Entry point:** Sees demo or screenshot, buys Pro directly

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

**Standard tier (free):** phavo.net account required. License validated on each login. Core widgets only, 1 tab, Phavo branding visible.

**Pro tier:** phavo.net account required. License validated on each login. **72-hour offline grace period** — if phavo.net is unreachable, the last validated session stays active for 72 hours. Grace period resets on every successful validation.

**Local tier:** Local user account (username + password) created during setup. License key validated once against phavo.net on first activation and stored locally. Fully offline after activation — no phone-home ever again.

### 6.2 Core Features

#### Setup Assistant — Quick Setup

For users who want to get started immediately. Accessible from the welcome screen as the default path for Persona B.

**Flow (3 steps):**
1. Auth — phavo.net sign in / register (Standard or Pro), or local account creation + license key (Local)
2. Weather location — optional, skippable
3. Done — dashboard loads with a sensible default layout (system widgets + weather). Pro/Local users additionally get a Links widget pre-configured.

All further configuration is accessible at any time from the dashboard and settings.

#### Setup Assistant — Full Setup

For users who want a tailored experience from the start. Accessible from the welcome screen via "Customise my setup". Each step has a back button and a progress indicator (1/10).

**Flow:**

1. **Welcome** — Phavo logo, tagline, two CTAs: "Quick Setup (2 min)" → Quick Setup, "Full Setup" → continue
2. **Tier selection** — Three cards: Standard (Free) / Pro / Local with feature comparison. Selecting a tier determines the auth screen. Standard/Pro → phavo.net OAuth. Local → local account form.
3. **Auth**
   - *Standard/Pro:* "Sign in with phavo.net" button → OAuth redirect. On return: licence validated, tier confirmed, continue.
   - *Local:* Username + password + confirm-password fields + licence key field. Argon2id hashing server-side. Activation JWT fetched from phavo.net.
4. **Dashboard name** — Text input, default "My Dashboard". Validates: 1–40 chars.
5. **Weather location** — City search with geocode autocomplete (Open-Meteo geocoding API). Skippable. Shows live weather preview after selection.
6. **Tab builder** — Add/rename/reorder/delete tabs. Default: one tab named "Home". Standard tier: add button disabled after first tab with upgrade prompt (first tab always created).
7. **Plugin installation (optional)** — "Want to add third-party widgets?" step with file picker and drag-and-drop for `.phwidget` files. Permissions shown per plugin. User approves or skips. Skip available. Installed plugins are immediately available in the next step.
7b. **Widget selection** — Dynamic grid of widget cards loaded from the plugin registry manifest, including any plugins installed in Step 7. Pro widgets shown locked for Standard users (same teaser logic as the drawer). Multi-select. Confirmation of tier-appropriate widgets only.

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
- Multiple named tabs with per-tab widget assignment (Pro + Local; Standard: 1 tab)
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
  tier: 'standard' | 'pro'       // 'standard' widgets available on all tiers
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
  tier: 'standard' | 'pro'
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

For plugin widgets:
- **First-party plugins** (built-in): always available, no installation needed
- **User plugins**: uploaded via Settings → Widgets → Upload Plugin, appear in drawer immediately after approval (hot-reload, no restart)
- Plugin widgets appear in the drawer with a "Plugin" badge 🔌
- On startup, if new `.phwidget` files were placed manually in `/data/plugins/`, a notification is pushed ("New plugins detected — review in Settings")

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
- Add tab button (blocked with upgrade prompt on Standard tier when at 1 tab limit)

**Tab: Widgets**

A single dedicated tab for all widget configuration. Never one tab per widget. Layout is a two-panel master/detail:

```
┌─────────────────────────────────────────────────────────────────┐
│  Settings → Widgets                                             │
├─────────────────────┬───────────────────────────────────────────┤
│  🔍 Search widgets  │                                           │
│                     │  Pi-hole                                  │
│  ● Pi-hole      ⚠  │  ─────────────────────────────────────   │
│  ● RSS Feed     ✓  │  Integration · Pro                        │
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

**Tab: Backup & Export**
- **Export** — triggers `GET /api/v1/config/export` → downloads `phavo-backup-YYYY-MM-DD.phavo`
- "Include credentials" toggle → prompts for passphrase before export (PBKDF2-SHA256 → AES-256-GCM)
- **Import** — file picker + drag-and-drop for `.phavo` files → validates client-side → submits to `POST /api/v1/config/import`
- Import preview: shows what will change before confirming; warning if overwriting current layout
- **BackupProvider interface:** Phase 1 uses `LocalBackupProvider` (manual export/import). Phase 4 `CloudBackupProvider` implements the same `IBackupProvider` interface. No code changes needed in Phase 4 — only a new provider.

```typescript
// packages/types/src/backup.ts
interface IBackupProvider {
  export(config: DashboardConfig, options: BackupExportOptions): Promise<Blob>
  import(blob: Blob, passphrase?: string): Promise<DashboardConfig>
  listBackups?(): Promise<BackupEntry[]>   // optional — CloudBackupProvider only
  deleteBackup?(id: string): Promise<void> // optional — CloudBackupProvider only
}
```

**Tab: Licence**
- Current tier badge (Free / Pro / Local)
- **Standard tier:** Upgrade banner — "Upgrade to Phavo Pro — €8.99 one-time (€5.99 at launch)" with direct link to phavo.net checkout
- **Pro tier:** Licence key (masked), linked phavo.net account email, "Refresh licence" button (re-validates with phavo.net and updates session tier — use after upgrading on phavo.net), deactivate button
- **Local tier:** Licence key (masked), instance ID, activation date, deactivate button (requires online connection)
- Re-enter / replace licence key field for key transfers

**Tab: Account**
- phavo.net users: display email, "Sign out" button, link to phavo.net account portal for password changes
- Local users: change username, change password form (current + new + confirm)
- 2FA: enable/disable TOTP — QR code display, backup code download

**Tab: Plugins**

Manage installed `.phwidget` plugins and `.phtheme` themes.

- Upload Plugin: drag-and-drop or file picker for `.phwidget` files; permissions shown; user confirms; hot-reload
- Installed plugins list: name, version, author, status (active/error), permissions granted
- Delete plugin: removes from `/data/plugins/`, widget instances enter error state
- Theme management: upload `.phtheme`, select active theme, delete themes
- Plugin discovery: notification badge if new plugins were placed manually in volume

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
- Notifications persist in a history for the lifetime of the running Phavo process (in-memory). On restart, history is cleared. Persisted to DB in Milestone 3 (Notification System redesign).
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
- Config exports/backups use the `.phavo` file extension (`phavo-backup-2026-03-27.phavo`)
- Widget plugins use the `.phwidget` file extension — a ZIP-based bundle (see §16)
- Themes use the `.phtheme` file extension — a ZIP-based bundle (see §6.6)

**Credential handling:** Pi-hole tokens, RSS credentials, and all sensitive values are excluded from exports by default. A separate prompt offers to include them, encrypted with a user-provided passphrase. On import, widgets with missing credentials show a "configure me" prompt.

---

### 6.3 Launch Widgets

#### Standard Tier Widgets

| Widget | Data |
|---|---|
| CPU | Usage %, per-core breakdown, load average |
| Memory | Used / total, swap |
| Disk | Per-mount usage %, read/write throughput |
| Network | Upload/download speed, total traffic |
| Temperature | CPU temp (where available) |
| Uptime | System uptime, human-readable |
| Weather | Open-Meteo, no API key. Current conditions + 5-day forecast. |

#### Pro / Local Widgets (all Standard widgets + the following)

| Widget | Details |
|---|---|
| Pi-hole | Total queries, blocked %, blocklist count, enable/disable toggle. URL + API token configured in settings. |
| RSS Feed | User-configurable feed URLs. Title, source, timestamp. Multiple feeds per instance. Supports Basic Auth + Bearer token for private feeds (e.g. Feedbin, self-hosted RSS bridges). |
| Links / Bookmarks | Named links with optional icons, grouped by user-defined categories. Opens URL in new tab. |

#### Pro / Local Additional Widgets — New for v1.0

| Widget | Details |
|---|---|
| Docker | Container status (running/stopped/paused), CPU + RAM per container, restart button. Requires Docker socket access (opt-in, documented security implications). |
| Service Health | HTTP/Ping health checks for self-hosted services (NAS, Router, Gitea, etc.). Configurable URL list, response time, status badge. |
| Speedtest | On-demand internet speed test + historical chart. Uses librespeed or similar. |
| Calendar | Local calendar or CalDAV feed. Upcoming events view. |

#### Post-Launch Widgets (Phase 1.x)

| Widget | Notes |
|---|---|
| Spotify | Requires OAuth relay on phavo.net. Now playing, album art, playback controls. Spotify Premium required for control. |

---

### 6.4 Standard Tier Conversion Strategy

The Standard tier is the primary acquisition channel. Conversion levers built into the product:

- **Widget drawer upgrade prompt:** When a Standard user opens the widget drawer, Pro widgets are visible but locked — shown with a lock icon and the label "LOCKED". Clicking one triggers: "Upgrade to Phavo Pro to unlock all widgets — €8.99 one-time." This works via a **split manifest**: `GET /api/v1/widgets` returns full definitions for entitled widgets, plus teaser entries `{ id, name, description, tier, locked: true }` for locked ones. Teaser entries contain no `dataEndpoint`, `configSchema`, or `permissions` — only enough to render the upgrade prompt. Security-relevant fields are never sent to the browser for unentitled tiers.
- **Tab limit prompt:** Attempting to add a second tab on Standard shows the upgrade prompt.
- **Phavo branding:** Small "Powered by Phavo" badge in dashboard footer on Standard. Removable on Pro and Local.
- **No feature degradation:** Standard tier stays free indefinitely. Phavo does not reduce the Standard offering to force upgrades.
- **Two separate product lines:** Account Variant (Standard/Pro) and Local Variant are separate purchases. There is no cross-upgrade path — users who want Local must purchase it directly. This is clearly communicated at point of sale to avoid confusion.

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

GET  /api/v1/plugins                    — list installed plugins + status
POST /api/v1/plugins/upload             — upload .phwidget file (multipart)
DELETE /api/v1/plugins/:pluginId        — remove plugin
GET  /api/v1/plugins/:pluginId/status   — health + error info
GET  /api/v1/plugins/:pluginId/*        — plugin's own endpoints (namespaced)
```

**phavo.net infrastructure endpoints (hosted, not local):**
```
POST /api/license/validate        — Standard/Pro: on each login
POST /api/license/activate        — Local: once on first setup
POST /api/license/deactivate

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

**Theme system:**

Dark only at launch. The token system is designed so adding a new theme requires no component changes — only a new CSS block overriding the tokens.

**Extended token set (complete, for theme compatibility):**
```css
:root[data-theme="dark"] {
  /* — Colours — */
  --color-bg-base, --color-bg-surface, --color-bg-elevated, --color-bg-hover
  --color-border, --color-border-subtle, --color-border-strong
  --color-text-primary, --color-text-secondary, --color-text-muted
  --color-accent, --color-accent-subtle, --color-accent-t, --color-accent-text

  /* — Shape — */
  --radius-sm: 6px; --radius-md: 10px; --radius-lg: 14px; --radius-xl: 20px;

  /* — Elevation — */
  --shadow-sm: 0 1px 2px rgba(0,0,0,.3);
  --shadow-md: 0 4px 12px rgba(0,0,0,.4);
  --shadow-lg: 0 8px 24px rgba(0,0,0,.5);

  /* — Spacing scale — */
  --space-1: 4px; --space-2: 8px; --space-3: 12px; --space-4: 16px;
  --space-6: 24px; --space-8: 32px; --space-12: 48px;

  /* — Typography — */
  --font-ui: 'Geist', -apple-system, sans-serif;
  --font-mono: 'Geist Mono', 'SF Mono', monospace;
  --font-size-xs: 11px; --font-size-sm: 12px; --font-size-md: 13px;
  --font-size-lg: 15px; --font-size-xl: 18px;
}
```

**`.phtheme` format (Phase 1.x — post launch):**

Themes are distributed as `.phtheme` ZIP bundles, installed via Settings → Appearance:
```
my-theme.phtheme (ZIP)
├── manifest.json    # id, name, version, author, description, preview.png, signature
├── theme.css        # required: CSS variable overrides for :root[data-theme="<id>"]
├── icons/           # optional: SVG files per icon name (e.g. icons/cpu.svg)
└── fonts/           # optional: WOFF2 font files
```

Icon abstraction: `<Icon name="cpu" />` component checks the active theme for `icons/cpu.svg` first, falls back to Lucide. Multiple themes can be installed; user selects active theme in Settings → Appearance (like browser themes).

**Theme signing:** User-uploaded `.phtheme` bundles are unsigned in Phase 1 (consistent with user plugin policy). The `signature` field in `manifest.json` is validated only for first-party themes. Marketplace themes (Phase 4) require signing.

**Note:** Token extension (border-radii, shadows, spacing scale) is a dedicated session before Milestone 4 (Graphic Polish). Dark theme remains the only designed theme at v1.0 launch.

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

*Post Phase 1 launch. Prioritised over mobile — Responsive Web covers tablet/phone use cases adequately. Desktop installer removes the Docker barrier for Persona B.*

**Installer Roadmap:**
- **v1.1** — Linux: `.deb` + AppImage via Tauri. No signing required.
- **v1.2** — macOS: Apple Developer ID + Notarisierung (99$/year). ⚠️ Apple Developer Program registration required before this milestone — review process can take several days.
- **v1.3** — Windows: Standard cert or unsigned (SmartScreen warning acceptable for homelab audience).

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

## 9.5 Widget & Theme Store (Phase 4 — Traction-Dependent)

> **Prerequisite:** These features are planned but not guaranteed. Implementation depends on v1.0 achieving sufficient user adoption and commercial traction. No development effort will be directed here until v1.0 proves product-market fit.

The Widget Store is the distribution channel for third-party `.phwidget` plugins and `.phtheme` themes.

**In-App Store (Standard + Pro users):**
- Accessible directly from the widget drawer ("Browse Store" button) and Settings → Plugins
- Search, filter by category, read description + permissions, install with one click
- Free plugins: no account needed beyond existing phavo.net account
- Paid plugins: purchased via phavo.net checkout (Gumroad or native payments)
- Revenue share: 70% to developer, 30% to phavo.net

**Web Store (Local users):**
- Available at `store.phavo.net` (Phase 4) — separate subdomain from phavo.net
- Free plugins: downloadable as `.phwidget` file without account
- Paid plugins: require phavo.net account (for Store only — Local dashboard auth remains offline)
- User downloads `.phwidget` file and uploads via Settings → Widgets → Upload Plugin

**Plugin pricing (enforced by phavo.net):**
- Free
- One-time: max €9.99 (higher requires explicit approval)
- Subscription: max €2.99/month

**Theme pricing:**
- Same model as plugins — free, one-time, or subscription
- Themes for Local users available as signed `.phtheme` files from the web store

---

## 10. Monetization

### Pricing

| Tier | Price | Model |
|---|---|---|
| Standard | €0 | Forever free — core system widgets, weather, 1 tab, Phavo branding |
| Pro | €8.99 (Launch €5.99) | One-time — all widgets, unlimited tabs, no branding, all 1.x updates |
| Local | €24.99 (Launch €16.99) | One-time — fully offline, all widgets, unlimited tabs, no branding, all 1.x updates |
| ~~Ultra~~ | ~~€39.99~~ | *Post-v1.0 — planned premium tier with exclusive widgets and 1-year feature update guarantee. Not available at launch.* |
| Phase 2 Desktop | TBD | Bundled or small upgrade fee for existing licence holders |
| Phase 4 Cloud | €3.99/month | Subscription — sync, marketplace, multi-device |
| Marketplace | Free listing | Optional Pro widgets, rev-share TBD |

**Launch pricing:** Time-limited launch discount for the first 30 days — Pro €5.99 (reg. €8.99), Local €16.99 (reg. €24.99). Price increases are announced in advance with at least 7 days notice.

**Refund policy:** 14-day money-back guarantee on all paid tiers, no questions asked. Handled via Gumroad. Communicated clearly on the pricing page and at checkout.

**Cloud subscription value proposition (Phase 4):** The €3.99/month cloud plan must be clearly differentiated from the one-time Pro licence in all marketing. Key differentiators: multi-device sync, widget marketplace access, automatic cloud backups, hosted instance (no self-hosting needed).

### Standard / Pro licence model
- Standard is free, no purchase needed — phavo.net account required
- Pro sold via Gumroad; licence key linked to phavo.net account
- Validated on every login; Standard: 24h offline grace, Pro: 72-hour offline grace if phavo.net is unreachable
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
- Feature highlights: widgets, responsive design, setup flow, Standard tier CTA
- Pricing table: Free / Pro / Local clearly compared with feature checklist
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

- **Credentials at rest:** All sensitive values (Pi-hole tokens, RSS Basic Auth credentials, Bearer tokens, future OAuth tokens) encrypted with **AES-256-GCM** in libSQL. Encryption key derived via HKDF-SHA256 from `PHAVO_SECRET` (a server-side secret stored in the Docker volume, separate from the database file). Note: Ed25519 is used elsewhere in Phavo for digital signatures only (JWT verification, plugin signing) — it is not an encryption algorithm and plays no role in credential protection.
- **Config exports:** Credentials excluded by default. Optional inclusion uses AES-256-GCM encryption with a user-provided passphrase — the passphrase is never stored or transmitted.
- **HTTPS / TLS:** All traffic between browser and Phavo encrypted in transit. TLS 1.2 minimum, TLS 1.3 preferred. Built-in certificate management (Let's Encrypt, self-signed, or custom cert). HTTP redirects to HTTPS automatically once HTTPS is configured.
- **phavo.net communication:** All local app → phavo.net API calls over TLS with standard CA validation. No certificate pinning (would break every 90 days with Let's Encrypt rotation).

### 12.3 External Data & Privacy

- **RSS feed fetching:** Fetched server-side by `@phavo/agent`, not in the browser. This means external feed servers see the IP of the Phavo host, not the user's browser. Users should be aware of this when using public cloud hosts.
- **Opt-in telemetry:** Standard and Pro users are shown a one-time toggle at first launch ("Help improve Phavo with anonymous usage data"). Local Variant has no telemetry and no toggle — it is never collected. Collected data: active widget type IDs, tier, platform, Phavo version. No credentials, no user behaviour, no IP address.
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
| Offline grace period | Standard: 24h · Pro: 72h — after last successful login validation |
| Telemetry | Opt-in for Standard/Pro (toggle at first launch); never for Local. phavo.net analytics anonymised + aggregated only. |

---

## 14. Out of Scope (Phase 1)

- Cloud sync (Phase 4)
- Widget marketplace (Phase 4)
- Multi-user / team accounts
- Mobile native apps (Phase 3)
- Desktop native features (Phase 2)
- **Native installer for Windows / macOS** (Phase 2 — desktop app solves this)
- `@phavo/plugin-sdk` npm publish (Phase 4 — SDK exists in Phase 1 as internal package; published on npm when Marketplace launches)
- Plugin/widget SDK docs at docs.phavo.net/plugins (required before npm publish)
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
| 2 | **Licence & auth (v1.0):** Three tiers. Standard (free): phavo.net login + **24h** offline grace. Pro (paid): phavo.net login + **72h** offline grace. Local (paid): one-time activation, fully offline. Ultra deferred to post-v1.0. Superseded/updated by Decision 62. |
| 3 | **RSS auth:** Basic Auth + Bearer token, encrypted in libSQL. At launch. |
| 4 | **Widget resize:** S / M / L / XL steps, grid snapping. |
| 5 | **Theme:** Dark only at launch. Token system ready for future themes. |
| 6 | **Figma timing:** Code first, Figma later. No hardcoded values in `@phavo/ui`. |
| 7 | **Access protection:** Standard/Pro: phavo.net login. Local: local username + password. No unauthenticated access. |
| 8 | **Mobile (Phase 1):** Responsive web app ≥ 375px. Native apps Phase 3. |
| 9 | **Updates:** In-dashboard panel with version badge. Phase 1 (Docker): copy-paste command snippet, optional Docker socket for one-click (opt-in). Phase 2 (Desktop/Installer): Tauri Updater — signed, automatic, no terminal required. |
| 10 | **Pi-hole:** At launch. Core widget for Persona A. |
| 11 | **Links / Bookmarks:** At launch. Core widget for Persona B. |
| 12 | **Setup:** Quick Setup (3 steps) + Full Setup (10 steps). Both accessible from welcome screen. |
| 13 | **Freemium:** Standard tier (free, €0) — core system widgets + weather, 1 tab, Phavo branding visible. No time limit. Replaces what was previously called "Free tier". |
| 14 | **Pricing (original):** Free €0 · Standard €8.99 · Local €24.99 · Ultra €39.99. Superseded by Decision 62. Current: Standard (free) €0, Pro €8.99 (launch €5.99), Local €24.99 (launch €16.99), Ultra post-v1.0. |
| 15 | **Open source:** Deferred to post-v1.0. Codebase is closed source at launch. Dual-licence (AGPL-3.0 + commercial) to be evaluated after v1.0 proves commercial viability. |
| 16 | **Export credentials:** Excluded by default; optionally included as passphrase-encrypted blob. |
| 17 | **Widget drawer:** + button in header — add/remove widgets at any time post-setup, no setup re-run required. |
| 18 | **2FA:** TOTP-based, optional on all tiers. Backup codes generated at setup. |
| 19 | **HTTPS:** Self-signed cert by default (works everywhere). Let's Encrypt as advanced opt-in for public-facing domains. Custom cert supported. TLS 1.2 min, HTTP → HTTPS redirect once configured. |
| 20 | **RSS fetching:** Server-side via `@phavo/agent` (not browser-direct). Feed server sees Phavo host IP only. |
| 21 | **Telemetry:** Opt-in only. Standard and Pro users are shown a toggle at first launch ("Help improve Phavo by sharing anonymous usage data"). Local Variant: no telemetry, no toggle, never. Collected anonymously: active widget types, tier, platform, Phavo version. Sent via background job once daily (random 0–4h offset from first start). No IP, no user behaviour, no credentials. |
| 22 | **Responsible disclosure:** `security@phavo.net` + `SECURITY.md`. 48h acknowledgement SLA. No legal threats for good-faith research. |
| 23 | **Dependency scanning:** Dependabot + `bun audit` in CI. Docker image scanned via Trivy on every build. |
| 24 | **Docker hardening:** Non-root user, read-only filesystem except data volume, distroless/Alpine base image. |
| 25 | **Tier enforcement:** Server-side via phavo.net — no code-level locks in the client. Standard tier restrictions enforced at the phavo.net licence validation endpoint. Local tier uses Ed25519 asymmetric cryptographic license validation with embedded public key in binary. |
| 26 | **Installer:** No native installer in Phase 1. Docker only. Phase 2 desktop app solves the Persona B installation barrier on Windows/macOS. |
| 27 | **Demo:** Built just before v1.0 launch, once the dashboard is stable. Not during Phase 1 development. |
| 28 | **Refund policy:** 14-day money-back guarantee on all paid tiers via Gumroad. |
| 29 | **Standard tier offline grace:** 24 hours (shorter than Pro's 72h — incentivises upgrade). |
| 30 | **TLS default:** Self-signed cert generated on first start (works for all home/local installs). Let's Encrypt as advanced opt-in for public-facing domains only. Certificate pinning removed — standard CA validation used. |
| 31 | **Docker update (Phase 1):** Update panel shows copy-paste command snippet. Docker socket access for one-click update is opt-in with documented security implications. Phase 2 replaces this with Tauri Updater — fully automatic, signed, no user action beyond confirming. |
| 32 | **Notification system:** Collapsible panel from right side, bell icon in header with unread badge. In-memory history per process lifetime. Notifications are clickable and deep-link to widgets or settings. All widgets (including future third-party) can push via shared `notify()` from `@phavo/types`. Built-in triggers: disk >90%, CPU temp >80°C, Pi-hole unreachable, RSS failing, update available. |
| 33 | **Tier enforcement per-endpoint:** `requireTier()` middleware on every Pro/Local API route. Tier re-read from session record in DB on every request — never from cookie payload or client headers. |
| 34 | **Opaque session tokens:** 32-byte random session ID, no JWT, no decodable tier claim in cookie. |
| 35 | **Tier not in config table:** No user-editable DB column controls tier. Tier flows only via phavo.net validation → session record → middleware. |
| 36 | **Local activation token signing:** Signed JWT from phavo.net, verified against embedded public key on every server start. Manual DB edits detected and rejected. |
| 37 | **Tier-filtered widget manifest:** `GET /api/v1/widgets` returns full definitions for entitled widgets and teaser entries (`WidgetTeaserDefinition`) for locked widgets. Pro dataEndpoints and permissions never reach the browser for Standard users. |
| 38 | **No tier in client payload:** SvelteKit layout load never serialises tier to the client. Upgrade prompts are cosmetic UX only — server enforces access independently regardless of what client sends. |
| 39 | **SRI on external resources:** Subresource Integrity hashes applied to externally loaded resources (fonts, CDN assets). Not applied to self-hosted bundle files — SRI provides no protection against server-side file tampering on the same origin. |
| 40 | **Plugin permission system (Phase 1):** All widgets (built-in and third-party) must declare permissions in manifest.json. User sees and approves permissions at install time. Undeclared capabilities denied at runtime by middleware wrapper. |
| 41 | **Plugin import allowlist (Phase 1):** Plugins statically analysed at load time. Allowlisted imports: `@phavo/types`, `@phavo/agent`, `@phavo/plugin-sdk`, `hono`, `zod`, Node/Bun built-ins. Imports outside allowlist → plugin rejected, error logged. No arbitrary npm packages until Phase 4 marketplace review. |
| 42 | **Platform abstraction:** No hardcoded `/data/` paths or ports in server code. All path/port values read from `PHAVO_DB_PATH`, `PHAVO_DATA_DIR`, `PHAVO_PORT`, `PHAVO_HTTPS_PORT`, `PHAVO_ENV`. Phase 1 Docker defaults applied if env vars absent. |
| 43 | **`installMethod` detection:** Derived from `PHAVO_ENV` on first start, stored in `config` table. Values: `'docker-compose'` \| `'bun-direct'` \| `'tauri'`. Drives which update UI is shown. |
| 44 | **Tauri Sidecar:** Phase 2 wraps `apps/web/` Bun server as a Tauri sidecar. No changes to `apps/web/` required — platform abstraction (Decision 42) is the only prerequisite. |
| 45 | **Tauri Updater:** Ed25519-signed updates via phavo.net endpoint. Private key in GitHub Actions Secrets only. Auto-install with user confirmation dialog. |
| 46 | **Tauri data paths:** OS app data dir provided by `tauri::api::path::app_data_dir()`, passed to sidecar as `PHAVO_DATA_DIR` env var. macOS: `~/Library/Application Support/phavo/`, Windows: `%APPDATA%\phavo\`, Linux: `~/.local/share/phavo/`. |
| 47 | **Plugin API versioning:** `WidgetDefinition` schema versioned via `schemaVersion` in `manifest.json`. Breaking changes require a major `@phavo/plugin-sdk` version bump. Compatibility matrix in `packages/types/src/plugin-compat.ts`. Old-schema plugins load with deprecation warning, are rejected in Phase 4 Marketplace. |
| 48 | **SDK publishing:** `@phavo/plugin-sdk` published on npm in Phase 4 when Marketplace launches. In Phase 1, SDK lives in `packages/plugin-sdk/` and is used internally. Docs at `docs.phavo.net/plugins` required before npm publish. Developer must be able to build and deploy a working plugin in under 30 minutes. |
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
| 59 | **Widget package format (Phase 1):** `.phwidget` — ZIP-based bundle containing `manifest.json`, `widget.js` (pre-compiled), `handler.ts`, and optional assets. First-party plugins in `/app/builtin-plugins/` (read-only, in Docker image). User plugins uploaded via Settings → Widgets → Upload Plugin, stored in `/data/plugins/`. Hot-reload on upload, no server restart needed. |
| 60 | **Command Palette:** Cmd+K global shortcut. Three modes: local dashboard search, web search (configurable engine), AI chat (Ollama/OpenAI/Claude). API keys server-side only, never in frontend. |
| 61 | **AI chat server-side:** All AI API calls go through `POST /api/v1/ai/chat`. API keys stored in `credentials` table. Client never sees keys. Ollama at localhost:11434 for Local tier offline use. |
| 62 | **Pricing model (v1.0):** Two separate product lines — Account Variant (Standard free €0 + Pro €8.99/launch €5.99) and Local Variant (€24.99/launch €16.99). No cross-upgrade path between product lines. Standard→Pro: pay at checkout on phavo.net, then use "Refresh licence" button in Settings → Licence. Phase 4 subscription: €3.99/month. All 1.x updates included in one-time prices. Grandfathering: Pro buyers receive advance notice before Phase 4; Phase 4 features not in one-time price. Major version (e.g. v2.0) upgrade for Local: ~€12.99. Open source deferred to post-v1.0. |
| 63 | **Domain:** phavo.net (registered via Cloudflare). All previous references to phavo.io are invalid. |
| 64 | **Production audit:** 13 issues fixed before v1.0 — CSRF gap, SSRF, missing Secure flag, unvalidated POST /config, non-transactional import, missing external API Zod validation, unbounded notification queue, default secret acceptance, missing configSchemaVersion, health check without DB verify, unbounded TOTP map, redundant dbReady awaits, wrong docker tmpfs path. |
| 65 | **fetchWithCsrf utility:** All client-side mutation requests use `fetchWithCsrf()` from `apps/web/src/lib/utils/api.ts`. Automatically injects X-CSRF-Token on POST/PUT/DELETE/PATCH. GET requests unaffected. |
| 66 | **plugin_data table:** Plugins store persistent data via key-value store in the Phavo DB. Schema: `(plugin_id TEXT, key TEXT, value TEXT, PRIMARY KEY (plugin_id, key))`. Plugins cannot create new tables. |
| 67 | **Setup page dynamic loading:** Widget selection (now Step 7b) loads dynamically from `GET /api/v1/widgets` — not hardcoded. Plugin installation (Step 7, optional) comes first so newly installed plugins appear automatically in Step 7b. |
| 68 | **Opt-in telemetry:** Standard + Pro: one-time toggle at first launch. Local Variant: no telemetry ever. Data: widget type IDs, tier, platform, Phavo version. Daily background job, 0–4h random offset. No IP, no user behaviour, no credentials. |
| 69 | **BackupProvider interface:** `LocalBackupProvider` (Phase 1) = manual .phavo export/import. `CloudBackupProvider` (Phase 4) = automatic cloud backups. Same `IBackupProvider` interface — no Phase 4 code changes needed beyond a new provider. |
| 70 | **Plugin update check:** Manual only in Phase 1 — user uploads new `.phwidget` via Settings → Plugins. Phase 4 Marketplace adds automatic update notifications and one-click updates. |
| 71 | **Grandfathering policy:** Pro buyers at launch receive all 1.x updates. Before Phase 4 launches, they receive advance notice that Phase 4 features (Marketplace, Sync, Hosted Instance) require the €3.99/month subscription. Pro one-time price never retroactively increases. |
| 72 | **Local major version upgrades:** Local licence includes all 1.x updates and security patches. Major version upgrades (e.g. v1.x → v2.0) are offered at ~€12.99 upgrade price — direct purchase, not a cross-product upgrade. No forced upgrade — v1.x continues to work indefinitely. |
| 73 | **Rate limiting (full):** Login 10req/5min per IP+account; TOTP 5req/5min; metrics 60req/min; config import 5req/10min; all other 120req/min. `PHAVO_TRUST_PROXY=true` to trust X-Forwarded-For behind reverse proxy. In-memory Phase 1; Turso-backed Phase 4. |
| 74 | **Theme system:** Dark only at v1.0. Token system extended with radius, shadow, spacing, font-face tokens for theme compatibility. `.phtheme` ZIP format (Phase 1.x): manifest.json + theme.css + optional icons/ + fonts/. `<Icon name="..." />` abstraction layer. Multiple themes installable, user selects active theme. Token extension is a dedicated session (separate from Milestone 4). |
| 75 | **First-party widget loading (v1.0):** Launch widgets are developed in plugin structure (`packages/plugin-sdk/src/widgets/`) using `createHandler()` from SDK but loaded via `registry.register()` directly — no ZIP bundle format in v1.0. v1.1 adds bundle build-step without changing widget logic. Internal `_source: 'builtin'` flag, never sent to client. |
| 75b | **New launch widgets:** Docker Container Status, Service Health Check, Speedtest, Calendar added to Pro/Local tier for v1.0. Total: 7 Standard + 7 Pro/Local = 14 launch widgets. |
| 76 | **Ed25519 scope:** Ed25519 is used exclusively for **signing/verification** — never for encryption. Three signing uses: (1) activation JWT from phavo.net, (2) Tauri update packages. First-party plugin bundle signing deferred to v1.1 when ZIP format is introduced. Data encryption is always AES-256-GCM. |
| 76 | **Ed25519 scope:** Ed25519 is used exclusively for **signing/verification** — never for encryption. Three signing uses: (1) activation JWT from phavo.net, (2) Tauri update packages. First-party plugin bundle signing deferred to v1.1 when ZIP format is introduced. Data encryption is always AES-256-GCM. | Ed25519 is used exclusively for **signing/verification** — never for encryption. Three signing uses: (1) activation JWT from phavo.net, (2) first-party plugin bundles at Docker build time, (3) Tauri update packages. Data encryption is always AES-256-GCM (credentials at rest, config exports). These are distinct systems and must not be conflated. |
| 77 | **Activation JWT key rotation:** Two Ed25519 public keys are embedded in the Phavo binary (current + next). When phavo.net rotates its signing key, the new public key is pre-distributed in a Phavo release before the old key is retired. Overlap period: minimum 90 days. This ensures existing installs continue to verify their activation JWT during the transition. Key rotation is triggered only if the private key is compromised or on a scheduled annual basis. |
| 78 | **Plugin signing key rotation:** The Ed25519 private key for first-party plugin signing lives exclusively in GitHub Actions Secrets. If compromised: (1) revoke old key, (2) generate new keypair, (3) update GitHub Secret, (4) ship a Phavo release that embeds the new public key + re-signs all builtin plugins. User-installed plugins are unsigned in Phase 1 — users accept responsibility at install time by reviewing permissions. |

---

## 16. Widget Plugin Framework

### 16.1 Vision

The widget schema defined in Phase 0 is the seed of a full plugin ecosystem. The goal is to let any developer — from solo homelabbers to SaaS companies — build, distribute, and monetise Phavo widgets without touching the Phavo core. The framework is designed in three stages that map directly to the product roadmap.

| Stage | Phase | What ships |
|---|---|---|
| **Schema + SDK** | Phase 1 | `WidgetDefinition` type + `@phavo/plugin-sdk` (internal). Plugin system fully operational. |
| **Local Plugin API** | Phase 1 | `.phwidget` ZIP bundles. First-party in image, user plugins in volume. Hot-reload. |
| **Marketplace** | Phase 4 | Signed, reviewed widgets distributed via phavo.net. Revenue-sharing. |

### 16.2 Widget Contract (canonical definition)

Every widget — built-in or third-party — must conform to the `WidgetDefinition` schema from `@phavo/types`. The canonical definition is specified in Section 6.2. Key fields relevant to the plugin framework:

- **`id`** — globally unique, reverse-DNS recommended: `"io.phavo.cpu"`, `"com.example.mywidget"`
- **`version`** — semver, required for all plugins; built-in widgets use the Phavo release version
- **`author`** — `"phavo"` for built-ins, the developer's phavo.net username for marketplace widgets
- **`permissions[]`** — every plugin must declare all capabilities it needs (see Section 16.4); built-in widgets use the same system for consistency
- **`tier`** — `'standard'` or `'pro'`; third-party plugins can be listed as either, but cannot define new tiers

**Iron rule:** The full `WidgetDefinition` is server-side only. The client receives only the rendered data response from `dataEndpoint` — never the full definition. For unentitled tiers, only a `WidgetTeaserDefinition` (see Section 6.2) is returned — no `dataEndpoint`, no `configSchema`, no `permissions`.

### 16.3 Plugin Loading Pipeline (Phase 1)

Plugins run entirely on the self-hosted Phavo instance. Two plugin locations:

**First-party plugins** — shipped with Phavo, loaded directly by the server:
- Location: `packages/plugin-sdk/src/widgets/` in the monorepo (one directory per widget)
- Contain all launch widgets: CPU, Memory, Disk, Network, Temperature, Uptime, Weather, Pi-hole, RSS, Links, Docker, Service Health, Speedtest, Calendar
- Written using `createHandler()` from `@phavo/plugin-sdk` — same SDK as third-party developers (dogfooding)
- v1.0: Loaded via `registry.register()` directly — no ZIP bundle format
- v1.1: Build-step added to produce `.phwidget` bundles from same source — no widget logic changes needed
- Internal `_source: 'builtin'` flag distinguishes from user plugins at runtime (never sent to client)
- Cannot be deleted by users

**User plugins** — uploaded via Settings → Widgets → Upload Plugin:
- Location: `/data/plugins/` in the Docker volume
- Uploaded as `.phwidget` ZIP files via drag-and-drop or file picker in Settings → Plugins
- Two-phase upload: validate (extract permissions for approval) → confirm (activate)
- Hot-reload on upload — no server restart required
- Permission approval shown to user before activation
- Plugin appears in widget drawer immediately after approval
- Rate limit: 5 complete uploads per 10 minutes

**`.phwidget` bundle structure (ZIP archive):**
```
my-widget.phwidget (ZIP)
├── manifest.json    # plugin metadata, permissions, configSchema, phavoRequires
├── widget.js        # pre-compiled Svelte component (no runtime compiler needed)
├── handler.ts       # Hono route handler — data fetching + business logic
└── README.md        # optional but recommended
```

**`manifest.json` schema:**
```json
{
  "id": "com.example.my-widget",
  "name": "My Widget",
  "version": "1.0.0",
  "schemaVersion": "1",
  "phavoRequires": ">=1.1.0",
  "author": "developer-name",
  "category": "system",
  "description": "What this widget does",
  "tier": "standard",
  "sizes": ["S", "M", "L", "XL"],
  "permissions": ["network:outbound"],
  "configSchema": { },
  "dataEndpoint": "/api/v1/plugins/com.example.my-widget/data",
  "signature": "ed25519:..."
}
```

**Plugin data persistence:** Plugins store data via a key-value API backed by a `plugin_data` table in the Phavo DB (`plugin_id`, `key`, `value` — plugins cannot define new DB tables). Quota: **10MB per plugin_id**, enforced server-side in `ctx.store.set()` — returns error if exceeded.

**Constraints enforced at load time:**
- `manifest.json` must pass full Zod validation — invalid manifests are rejected, plugin not loaded, error logged
- `handler.ts` imports must be on allowlist: `@phavo/types`, `@phavo/agent`, `@phavo/plugin-sdk`, `hono`, `zod`, Node/Bun built-ins
- `widget.js` may only use CSS variables from `@phavo/ui/theme.css` — no inline styles, no hardcoded colours
- No `eval()`, no `new Function()`, no dynamically constructed `import()` paths
- Plugins cannot define new DB tables — key-value store only

**Plugin error handling:**
- Plugin that fails to load → Error state widget in dashboard + notification pushed ("Plugin X failed to load: [reason]")
- Plugin that throws at runtime → Error state on that widget instance + notification
- Failed plugin does not crash the Phavo process — other widgets continue normally

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

### 16.6 Plugin SDK (`@phavo/plugin-sdk`)

Lives in `packages/plugin-sdk/` in the monorepo. Used internally by Phavo to build first-party plugins. Published as `@phavo/plugin-sdk` on npm in Phase 4 when Marketplace launches.

**Phase 1 scope:** Types + Zod schemas, `createManifest()`, `defineWidget()` helper. No dev CLI (Phase 1.x).

This is the **only public surface** of the Phavo plugin system — it intentionally exposes nothing that can bypass tier enforcement or access data outside declared permissions.

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
# Result: my-widget.phwidget ZIP ready to upload via Settings → Plugins
# Phase 4: bun run publish → submit to marketplace
```

**`bun create phavo-widget` template structure:**
```
my-widget/
├── manifest.json          # WidgetDefinition — filled with sensible defaults
├── handler.ts             # Example: fetches external API, returns typed data
├── widget.js              # Pre-compiled Svelte component (built by bun run build)
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
- No plugin-to-plugin communication in Phase 1 (considered for Phase 4)
- No CLI-based remote plugin installation in Phase 1 (upload via Settings UI or copy to volume manually)
- No arbitrary npm package imports in Phase 1 handlers (only allowlisted packages — see §16.3)

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
- Plugins built against an older SDK major version: loaded with a deprecation warning, rejected in Phase 4 Marketplace

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

**Docs are required before npm publish in Phase 4.** During Phase 1, docs help first-party developers build plugins. A widget developer should be able to build and deploy a working plugin in under 30 minutes from zero.

---

## 17. Dashboard Hardening — Tamper Resistance

### 17.1 Threat Model

The primary threat is a technically capable user who either:
1. **Inspects and replays API responses** — intercepts the session cookie and crafts requests to access Pro/Local endpoints from a Standard (free) account
2. **Modifies the client-side JavaScript bundle** — patches the compiled Svelte output to remove feature gates in the UI
3. **Directly edits the libSQL database file** — changes the stored tier value to `'pro'` or `'local'`
Phavo's architecture is designed so that **options 1–3 yield nothing**. Open source release is post-v1.0 — see Decision 15.

### 17.2 Server-Side Tier Enforcement on Every Request

Every API endpoint that serves Standard/Local-only data enforces tier access server-side, independently of what the client sends. This is the central hardening principle.

**Implementation — Hono middleware:**

```typescript
// packages/types/src/auth.ts (already defined)
type Tier = 'standard' | 'pro' | 'local'

// apps/web/src/lib/server/middleware/requireTier.ts
export function requireTier(minimum: Tier) {
  return async (c: Context, next: Next) => {
    const session = c.get('session')           // set by auth middleware
    if (!session) return c.json(err('Unauthorized'), 401)

    const tierRank: Record<Tier, number> = { standard: 0, pro: 1, local: 2 }
    if (tierRank[session.tier] < tierRank[minimum]) {
      return c.json(err('Upgrade required'), 403)
    }
    await next()
  }
}
```

**Applied to every protected endpoint:**
```typescript
app.get('/pihole',    requireTier('pro'),     async (c) => { ... })
app.get('/rss',       requireTier('pro'),     async (c) => { ... })
app.get('/links',     requireTier('pro'),     async (c) => { ... })
app.post('/ai/chat',  requireTier('pro'),     async (c) => { ... })
app.post('/config',   requireSession(),        async (c) => { ... })
```

The tier embedded in the session cookie is **never trusted directly**. On every request the `requireTier` middleware re-reads the tier from the validated session record in libSQL — not from a cookie field, not from a client header. A user cannot elevate their tier by modifying a cookie value.

### 17.3 Session Integrity

- **Session record is the source of truth.** The tier stored in the `sessions` table in libSQL is set exclusively by the server during login/licence validation. It cannot be changed by any client-accessible API.
- **Session token is opaque.** The cookie value is a cryptographically random string (32 bytes, base64url). It contains no decodable payload — no JWT, no tier claim, nothing a user can decode and modify.
- **Tier re-validation on login.** Every login event triggers a fresh phavo.net licence validation (Standard/Pro) or local activation check (Local). The tier in the session record is overwritten with the freshly validated value — any manually edited DB value is overwritten at next login.
- **Session invalidation on tier change.** If a licence upgrade or downgrade is processed via phavo.net, the current session is invalidated and the user is required to log in again. This ensures the new tier is written from a fresh validation, not inherited.

### 17.4 Database Tamper Resistance

The libSQL database file lives at `/data/phavo.db` inside the Docker volume. A user with volume access can theoretically edit it directly with a SQLite client. Phavo mitigates this:

- **Tier not stored in config table.** The tier is derived exclusively from the active session (which comes from phavo.net validation or Local activation) — not from a `config` key-value pair that a user could trivially edit.
- **Activation token integrity.** For Local tier, the activation token stored in `/data/phavo.db` is a JWT **signed with Ed25519** (sign/verify only — not encryption). Issued by phavo.net, payload: `{ instanceId, tier, licenseKey, activatedAt, iss }`. Two Ed25519 public keys are embedded in the Phavo binary at build time (current + next), enabling key rotation without breaking existing installs. On every server start the token is re-verified against the embedded keys. A manually edited token fails signature verification → instance falls back to Standard (free) behaviour.
- **No tier column in user table.** There is no `tier` column in the `users` or `config` tables that a user could edit to elevate themselves. Tier flows only through: phavo.net validation → session record → request middleware.

### 17.5 Client-Side Hardening

Client-side code is intentionally designed so that bypassing it provides no server-side benefit. Nonetheless, several measures reduce the attack surface:

- **No tier data in the HTML payload.** The SvelteKit layout server load function passes only `{ loggedIn: boolean, dashboardName: string }` to the client. The user's tier is **never** serialised into the initial HTML or any client-accessible store. Widget availability is determined server-side by the widget manifest response (see below).
- **Widget manifest is tier-filtered server-side.** `GET /api/v1/widgets` returns only the widgets the authenticated user's tier is entitled to. A Standard user receives only the 7 standard widgets — Pro widget definitions are never sent to the browser. The client cannot render a widget it has no definition for.
- **Upgrade prompts are cosmetic.** The "Upgrade to Pro" UI shown in the widget drawer is a UX hint, not a security gate. Removing it from the client bundle has zero effect — the server still returns `403` for any Pro endpoint called by a Standard session.
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

- **Users reading their own data from the volume.** The `/data` volume is theirs. They own the hardware. Phavo does not encrypt the entire database — only credentials at rest (AES-256-GCM). Reading your own widget layout from SQLite is not a threat.
- **Network interception between browser and local Phavo instance.** On a local network, a user could run a MitM proxy against their own traffic. This is not a realistic attack on a self-hosted tool running on `localhost` or a trusted home network. TLS is still enforced to protect against accidental exposure on shared networks.
- **Plugin source inspection.** Users can unzip a `.phwidget` file and read its contents. This is intentional — transparency is a feature. The permission system ensures declared capabilities are enforced regardless.

### 17.8 Decisions Added

| # | Decision |
|---|---|
| 33 | **Tier enforcement per-endpoint:** `requireTier()` middleware on every Pro/Local API route. Tier re-read from session record in DB on every request — never from cookie payload or client headers. |
| 34 | **Opaque session tokens:** 32-byte random session ID, no JWT, no decodable tier claim in cookie. |
| 35 | **Tier not in config table:** No user-editable DB column controls tier. Tier flows only via phavo.net validation → session record → middleware. |
| 36 | **Local activation token signing:** Signed JWT from phavo.net, verified against embedded public key on every server start. Manual DB edits detected and rejected. |
| 37 | **Tier-filtered widget manifest:** `GET /api/v1/widgets` returns full definitions for entitled widgets and teaser entries (`WidgetTeaserDefinition`) for locked widgets. Pro dataEndpoints and permissions never reach the browser for Standard users. |
| 38 | **No tier in client payload:** SvelteKit layout load never serialises tier to the client. Upgrade prompts are cosmetic UX only — server enforces access independently regardless of what client sends. |
| 39 | **SRI on external resources:** Subresource Integrity hashes applied to externally loaded resources (fonts, CDN assets). Not applied to self-hosted bundle files — SRI provides no protection against server-side file tampering on the same origin. |
| 40 | **Plugin permission system (Phase 1):** All widgets (built-in and third-party) must declare permissions in manifest.json. User sees and approves permissions at install time. Undeclared capabilities denied at runtime by middleware wrapper. |
| 41 | **Plugin import allowlist (Phase 1):** Plugins statically analysed at load time. Allowlisted imports: `@phavo/types`, `@phavo/agent`, `@phavo/plugin-sdk`, `hono`, `zod`, Node/Bun built-ins. Imports outside allowlist → plugin rejected, error logged. No arbitrary npm packages until Phase 4 marketplace review. |

---

## 18. Success Metrics (Phase 1)

- 200 phavo.net account registrations (Standard + Pro) within 60 days of launch
- 100 paid licence sales (Pro + Local) within 60 days
- Standard → Pro/Local conversion rate ≥ 5% (baseline); ≥ 15% (stretch goal)
- Docker Hub: 500+ pulls in first month
- Setup completion rate ≥ 80%
- < 5 critical bug reports in first 2 weeks

---

## Appendix — Key Decisions Reference

This section lists decisions not found inline in the sections above. All decisions are numbered sequentially — see the relevant section for context.

| # | Decision |
|---|---|
| 61 | **Version management:** Single source of truth in root `package.json`. Vite injects `PHAVO_VERSION` at build time. `release:patch/minor/major` scripts bump, commit, tag, push — triggering Docker CI and GitHub Release automatically. |
| 62 | **Docker Hub:** Public repository `getphavo/phavo`. Tagged `:VERSION + :latest` on tag push. Multi-arch (amd64 + arm64). Account `docker@phavo.net`. |
| 63 | **Email infrastructure:** Hetzner Webhosting S. MX + SPF + DKIM via Cloudflare. Addresses: `docker@`, `security@`, `hello@`, `noreply@` phavo.net. |
| 64 | **Web presence:** phavo.net on Hetzner. docs.phavo.net on GitHub Pages or Netlify. github.phavo.net → Cloudflare redirect to github.com/getphavo/phavo. store.phavo.net (Phase 4, traction-dependent). DNS via Cloudflare. |
| 65 | **Dashboard auto-update:** `GET /api/v1/update/check` polls GitHub Releases API (1h cache). Header badge on new version. `POST /api/v1/update/apply` runs `execFile('docker', ['compose', 'pull'])` for docker-compose installs. |
| 66 | **plugin_data table:** Plugins store persistent data via key-value store. Schema: `(plugin_id TEXT, key TEXT, value TEXT, PRIMARY KEY (plugin_id, key))`. Plugins cannot create new tables. |
| 67 | **Setup page dynamic loading:** Widget selection loads from `GET /api/v1/widgets` — not hardcoded. Third-party plugins appear automatically. Step 7b allows installing `.phwidget` plugins during setup. |
| 68 | **Opt-in telemetry:** Standard + Pro: one-time toggle at first launch. Local Variant: no telemetry ever. Data: widget type IDs, tier, platform, version. Daily background job, 0–4h random offset. No IP, no behaviour, no credentials. |
| 69 | **BackupProvider interface:** `LocalBackupProvider` (Phase 1) = manual .phavo export/import. `CloudBackupProvider` (Phase 4) = automatic cloud backups. Same `IBackupProvider` interface — no Phase 4 code changes needed beyond new provider. |
| 70 | **Plugin update check:** Manual only in Phase 1 — user uploads new `.phwidget` via Settings → Plugins. Phase 4 Marketplace adds automatic update notifications. |


---

| 79 | **Revised milestone order (v1.0):** 1. Notification Redesign, 2. Additional Widgets (Docker/Service Health/Speedtest/Calendar), 3. Security Testing, 4. Graphic Polish, 5. Web Presence, 6. Local Variant. Rationale: visual polish is the primary marketing asset; notifications must match dashboard aesthetic before polish pass. |
| 80 | **Desktop Installer roadmap:** v1.1 Linux (.deb + AppImage, no signing), v1.2 macOS (Apple Developer ID, 99$/year — register before milestone), v1.3 Windows (unsigned or standard cert, SmartScreen warning acceptable for homelab audience). Mobile deferred — responsive web sufficient. |
| 81 | **No cross-upgrade between product lines:** Account Variant (Standard/Pro) and Local Variant are separate purchases. No Pro→Local upgrade path. Communicated clearly at point of sale. Standard→Pro upgrade: phavo.net checkout + "Refresh licence" button in Settings. |
| 82 | **plugin_data quota:** 10MB per plugin_id, enforced server-side in ctx.store.set(). Returns structured error if exceeded. |
| 83 | **Plugin upload rate limit:** 5 complete uploads (validate + confirm pairs) per 10 minutes per session. |
| 84 | **Theme signing:** User-uploaded .phtheme bundles are unsigned in Phase 1, consistent with user plugin policy. Marketplace themes (Phase 4) require signing. |
| 85 | **Ecosystem features are traction-dependent:** Widget Store, Developer Accounts, Revenue Share, SDK npm publish, Marketplace Review, Plugin pricing caps — all conditional on v1.0 proving product-market fit. |

---

*Phavo · phavo.net · github.com/getphavo/phavo*
