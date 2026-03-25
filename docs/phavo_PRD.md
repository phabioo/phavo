# Phavo — Product Requirements Document

**Version:** 1.6  
**Date:** 2026-03-25  
**Status:** Active — Final for Phase 1 Scaffold  
**Owner:** phabioo

---

## 1. Product Overview

Phavo is a modular, self-hosted personal dashboard for both tech-savvy users (homelab, IT professionals, Raspberry Pi) and everyday consumers who want a clean, extensible overview of their digital world. It ships first as a web dashboard (Phase 1), then expands to desktop (Phase 2), mobile (Phase 3), and cloud (Phase 4).

The core promise: **beautiful by default, infinitely extensible, yours to own — and built with security at every layer.**

### Product Tiers

| | Phavo Free | Phavo Standard | Phavo Local |
|---|---|---|---|
| Price | €0 | €7.99 one-time | €19.99 one-time |
| Widgets | Core system + weather | All launch widgets | All launch widgets |
| Tabs | 1 | Unlimited | Unlimited |
| Auth | phavo.io account | phavo.io account | Local user account |
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

**Important:** Tier enforcement (widget access, tab limits, branding) is done entirely server-side via phavo.io — not through code locks in the client. This means the AGPL codebase does not contain bypassable paywalls. The Free tier restrictions are enforced at the phavo.io licence validation endpoint. A self-compiled AGPL build without a phavo.io account gets Free tier behaviour by default. This model mirrors tools like Umami and Plausible: open source drives adoption and community, the commercial licence and phavo.io account converts power users.

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
- Publish phavo.io landing page before launch
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
  agent/      @phavo/agent — Bun daemon for system metrics

Design:     Figma → Design Tokens → Tailwind CSS v4
Components: shadcn-svelte
API:        Hono
Auth:       Better Auth (Phase 1 — local accounts + phavo.io OAuth)
Database:   libSQL (local) → Turso (Phase 4, cloud)
Docker:     multi-arch (amd64 + arm64 for Raspberry Pi)
CI/CD:      GitHub Actions
```

---

## 6. Phase 1 — Web Dashboard

### 6.1 Summary

A SvelteKit web application served via Docker (or direct Bun process). Users access it via browser at their local IP or custom domain. All dashboard data stays local.

**Free tier:** phavo.io account required. License validated on each login. Core widgets only, 1 tab, Phavo branding visible.

**Standard tier:** phavo.io account required. License validated on each login. **72-hour offline grace period:** if phavo.io is unreachable, the last validated session stays active for 72 hours. After that, login is blocked until connectivity is restored. Grace period resets on every successful validation.

**Local tier:** Local user account (username + password) created during setup. License key validated once against phavo.io on first activation and stored locally. Fully offline after activation — no phone-home ever again.

### 6.2 Core Features

#### Setup Assistant — Quick Setup

For users who want to get started immediately. Accessible from the welcome screen as the default path for Persona B.

**Flow (3 steps):**
1. Auth — phavo.io sign in / register (Free or Standard), or local account creation + license key (Local)
2. Weather location — optional, skippable
3. Done — dashboard loads with a sensible default layout (system widgets + weather + links)

All further configuration is accessible at any time from the dashboard and settings.

#### Setup Assistant — Full Setup

For users who want a tailored experience from the start.

**Flow:**
1. Welcome screen with Phavo branding
2. Tier selection — "Sign in with phavo.io" (Free / Standard) or "Create local account" (Local)
3. Auth — phavo.io login + licence validation, or local username/password + licence key
4. Dashboard name input
5. Weather location (optional — skippable)
6. Navigation tab builder (add, rename, reorder, delete)
7. Widget selection from registry
8. Widget-to-tab assignment
9. Widget-specific configuration (Pi-hole credentials, RSS URLs)
10. Done → save config → dashboard loads

#### Dashboard Layout
- Drag-and-drop widget positioning (grid system)
- Widget sizes: S / M / L / XL steps with grid snapping
- Multiple named tabs with per-tab widget assignment (Standard + Local; Free: 1 tab)
- Layout persisted to database per tab
- Sidebar navigation (collapsible, fixed position)
- Live clock in header
- Mobile-responsive — fully usable on smartphones (≥ 375px) and tablets
- **Widget drawer:** + button in dashboard header opens a panel to add or remove widgets at any time, no setup re-run required

#### Update Mechanism
- Header badge appears when a new version is available
- Clicking opens an in-dashboard update panel: current version, new version, full changelog
- The panel shows the exact update command for the user's install method (Docker Compose snippet, direct Bun command) — copy-paste ready
- For Docker Compose users: a one-click option can trigger the update if Phavo has access to the Docker socket (opt-in, documented security implications)
- Accessible at any time via Settings → About

#### Widget System
Auto-discovered from the backend registry. The manifest drives the setup flow, dashboard loader, and widget drawer.

**Widget contract (`@phavo/types`):**
```typescript
interface WidgetDefinition {
  id: string
  name: string
  description: string
  category: 'system' | 'consumer' | 'integration' | 'utility'
  tier: 'free' | 'standard'           // 'free' widgets available on all tiers
  minSize: { w: number; h: number }
  defaultSize: { w: number; h: number }
  sizes: ('S' | 'M' | 'L' | 'XL')[]
  configSchema?: ZodSchema
  dataEndpoint: string
  refreshInterval: number             // ms
  // Optional: widgets declare which conditions trigger notifications
  notifications?: {
    condition: string   // human-readable description
    type: Notification['type']
  }[]
}
```

#### Settings Page
- Re-run setup assistant (Quick or Full)
- Manage tabs (add, rename, delete)
- Per-widget configuration without re-running setup
- Import / Export config (JSON)
- Licence management: upgrade, view key, deactivate instance
- Account: phavo.io session or local password change
- About + update panel

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
| Spotify | Requires OAuth relay on phavo.io. Now playing, album art, playback controls. Spotify Premium required for control. |

---

### 6.4 Free Tier Conversion Strategy

The Free tier is the primary acquisition channel. Conversion levers built into the product:

- **Widget drawer upgrade prompt:** When a Free user tries to add a Standard widget (Pi-hole, RSS, Links), they see: "Upgrade to Standard to unlock all widgets — €7.99 one-time."
- **Tab limit prompt:** Attempting to add a second tab on Free shows the upgrade prompt.
- **Phavo branding:** Small "Powered by Phavo" badge in dashboard footer on Free. Removable on Standard and Local.
- **No feature degradation:** Free tier stays free indefinitely. Phavo does not reduce the Free offering to force upgrades.
- **Standard → Local upgrade path:** Pay the €12.00 difference via the phavo.io account portal. No repurchase.

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

**phavo.io infrastructure endpoints (hosted, not local):**
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

**Philosophy:** Clean near-black dark UI. No gradients, no blur, no glass-morphism. Solid borders, flat surfaces, high contrast. Based on phaboard's visual language, refined via Figma post-launch.

**Typography:** Inter (UI) · JetBrains Mono (data values)

**Figma decoupling strategy:** Code is built first using phaboard's colors as token values. Figma refinements drop into `theme.css` — zero component changes needed.

**Iron rule:**
```css
/* ✅ Always */
background: var(--color-bg-surface);
color: var(--color-text-primary);

/* ❌ Never */
background: #222120;
color: #d4d2c8;
```

**Token system (`packages/ui/src/theme.css`):**
```css
:root[data-theme="dark"] {
  --color-bg-base:        #1a1918;
  --color-bg-surface:     #222120;
  --color-bg-elevated:    #2a2928;
  --color-border:         #3a3936;
  --color-border-subtle:  #2e2d2b;
  --color-text-primary:   #d4d2c8;
  --color-text-secondary: #888780;
  --color-text-muted:     #5f5e5a;
  --color-accent:         #0f6e56;
  --color-accent-subtle:  #085041;
  --radius-sm:            6px;
  --radius-md:            10px;
  --radius-lg:            14px;
}
```

**Themes:** Dark only at launch. Each future theme is one CSS block — no component changes.

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

---

## 7. Phase 2 — Desktop App

*Post Phase 1.*

Tauri 2.0 wrapping the same SvelteKit frontend.

- System Tray + Menubar widget
- Native OS notifications
- Local file system access
- **Auto-update via Tauri Updater** — signed updates pulled from GitHub Releases, verified and installed automatically. No terminal, no Docker, no manual steps. Replaces the Phase 1 copy-paste snippet with a seamless background update experience for all users.
- Desktop-exclusive widgets (clipboard history, local app launcher)

**Platforms:** macOS, Windows, Linux  
**Distribution:** phavo.io, Homebrew Cask, Mac App Store (stretch)

---

## 8. Phase 3 — Mobile Apps

*Post Phase 2.*

Tauri 2.0 Mobile — same `@phavo/ui` components compiled natively.

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
- **Public demo instance** on phavo.io

---

## 10. Monetization

### Pricing

| Tier | Price | Model |
|---|---|---|
| Free | €0 | Forever free — core system widgets, weather, 1 tab, Phavo branding |
| Standard | €7.99 | One-time — all widgets, unlimited tabs, no branding |
| Local | €19.99 | One-time — all widgets, unlimited tabs, fully offline, no branding |
| Standard → Local upgrade | €12.00 | Pay the difference, no repurchase |
| Phase 2 Desktop | TBD | Bundled or small upgrade fee for existing licence holders |
| Phase 4 Cloud | ~€4.99/month | Subscription — sync, marketplace, multi-device |
| Marketplace | Free listing | Optional Pro widgets, rev-share TBD |

**Launch pricing:** Time-limited launch discount for the first 30 days (e.g. Standard €4.99, Local €12.99) to drive early sales and reviews. Price increases are announced in advance.

**Refund policy:** 14-day money-back guarantee on all paid tiers, no questions asked. Handled via Gumroad. Communicated clearly on the pricing page and at checkout.

**Cloud subscription value proposition (Phase 4):** The ~€4.99/month cloud plan must be clearly differentiated from the one-time Standard licence in all marketing. Key differentiators: multi-device sync, widget marketplace access, automatic backups, hosted instance (no self-hosting needed). Without this clarity, users will question paying monthly more than the one-time purchase after 2 months.

### Standard / Free licence model
- Sold via Gumroad
- User links licence key to phavo.io account
- Validated on every login; 72-hour offline grace period if phavo.io is unreachable
- No device fingerprinting — follows the account, reinstalls are free

### Local licence model
- Sold via Gumroad at a higher price reflecting offline capability
- One-time activation against phavo.io; stored in Docker volume thereafter
- Bound to volume identifier — survives container rebuilds, not hardware-based
- Second activation requires deactivating the first via phavo.io portal
- One re-activation grace for hardware replacement
- Fully offline after initial activation

---

## 11. Marketing

*Detailed launch campaign to be planned when v1.0 is ready. The following must be in place before launch:*

### phavo.io Landing Page (required before launch)
- Hero: screenshot or short screen recording of the live dashboard
- Feature highlights: widgets, responsive design, setup flow, Free tier CTA
- Pricing table: Free / Standard / Local clearly compared with feature checklist
- "Get started free" as primary CTA
- Changelog and roadmap teaser

### Documentation (required before launch)
- Installation guide (Docker, direct Bun)
- Widget reference
- Setup assistant walkthrough (Quick and Full)
- FAQ: "What happens if phavo.io is down?", "How do I go offline?", "Can I self-host without a phavo.io account?"
- Hosted at docs.phavo.io

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
- **2FA (TOTP):** Available on all tiers — phavo.io accounts and local accounts alike. Standard TOTP (RFC 6238), compatible with any authenticator app (Authy, 1Password, Google Authenticator). Optional, not enforced. Setup via QR code in account settings. Backup codes generated at 2FA setup.
- **Brute-force protection:** Login rate-limited per IP and per account — 10 attempts before a 5-minute lockout. Applies to both phavo.io and local logins.
- **CSRF protection:** All state-changing API endpoints require a CSRF token. Enforced by Hono middleware.

### 12.2 Data Encryption

- **Credentials at rest:** All sensitive values (Pi-hole tokens, RSS Basic Auth credentials, Bearer tokens, future OAuth tokens) encrypted with AES-256-GCM in libSQL. Encryption key derived from a server-side secret stored in the Docker volume, separate from the database file.
- **Config exports:** Credentials excluded by default. Optional inclusion uses AES-256-GCM encryption with a user-provided passphrase — the passphrase is never stored or transmitted.
- **HTTPS / TLS:** All traffic between browser and Phavo encrypted in transit. TLS 1.2 minimum, TLS 1.3 preferred. Built-in certificate management (Let's Encrypt, self-signed, or custom cert). HTTP redirects to HTTPS automatically once HTTPS is configured.
- **phavo.io communication:** All local app → phavo.io API calls over TLS with standard CA validation. No certificate pinning (would break every 90 days with Let's Encrypt rotation).

### 12.3 External Data & Privacy

- **RSS feed fetching:** Fetched server-side by `@phavo/agent`, not in the browser. This means external feed servers see the IP of the Phavo host, not the user's browser. Users should be aware of this when using public cloud hosts.
- **No telemetry by default:** Phavo collects no telemetry, no analytics, no error reporting from the local app without explicit user opt-in.
- **phavo.io anonymous analytics:** Anonymised, aggregated usage data is collected on phavo.io (which widget categories are popular, setup completion rates). No PII, no per-user tracking. Collected data is listed explicitly in the privacy policy. Users can opt out from the phavo.io account settings.
- **Minimal phavo.io data retention:** phavo.io stores only email address, hashed password, licence key association, and active instance count per account. No dashboard layout, no widget config, no content is ever sent to phavo.io.
- **DSGVO / GDPR compliance:** phavo.io privacy policy published before launch. Right to erasure (account deletion removes all phavo.io data). Data processing agreement (DPA) available on request for business users.

### 12.4 Infrastructure & Supply Chain

- **Dependency scanning:** GitHub Dependabot enabled for all packages in the monorepo — automatic PRs for security updates. `bun audit` runs in CI on every push and PR.
- **CI/CD security:** GitHub Actions workflows pin all action versions to a commit SHA (not a tag). No third-party actions without explicit review. Secrets managed via GitHub Encrypted Secrets, never in code.
- **Docker image scanning:** Container image scanned for known CVEs on every build (e.g. via Trivy in CI). Images published only if scan passes.
- **Signed releases:** All Docker images and binary releases signed. Checksums published with every release on GitHub and phavo.io.
- **Minimal Docker image:** Based on a distroless or minimal Alpine base image. Only the runtime dependencies needed — no package manager, no shell, no unnecessary tools in the production image.

### 12.5 Responsible Disclosure

Phavo operates a responsible disclosure programme from day one:

- **Security policy:** `SECURITY.md` in the public repo and a dedicated page at `phavo.io/security` describing the process.
- **Disclosure email:** `security@phavo.io` — monitored by the maintainer. PGP key published for encrypted reports.
- **Response commitment:** Acknowledgement within 48 hours, status update within 7 days, fix timeline communicated within 14 days.
- **CVE coordination:** Critical vulnerabilities coordinated with GitHub Security Advisories before public disclosure.
- **Hall of fame:** Researchers who report valid vulnerabilities listed on `phavo.io/security` (with their permission).
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
| Telemetry | None by default; phavo.io analytics anonymised + aggregated only |

---

## 14. Out of Scope (Phase 1)

- Cloud sync (Phase 4)
- Widget marketplace (Phase 4)
- Multi-user / team accounts
- Mobile native apps (Phase 3)
- Desktop native features (Phase 2)
- **Native installer for Windows / macOS** (Phase 2 — desktop app solves this)
- Plugin/widget SDK (schema defined, no public SDK)
- Light theme (token system ready, theme not designed)
- Spotify widget (Phase 1.x — pending OAuth relay)
- Public demo instance (built just before v1.0 launch, not during Phase 1 development)
- Open source release (post v1.0)

---

## 15. Decisions

| # | Decision |
|---|---|
| 1 | **Spotify OAuth:** Cloud relay `phavo.io/api/oauth/spotify/callback`. Stateless, DSGVO-compliant. Phase 1.x. |
| 2 | **Licence & auth:** Three tiers. Free/Standard: phavo.io login + 72h offline grace. Local: one-time activation + Docker volume identifier, fully offline. |
| 3 | **RSS auth:** Basic Auth + Bearer token, encrypted in libSQL. At launch. |
| 4 | **Widget resize:** S / M / L / XL steps, grid snapping. |
| 5 | **Theme:** Dark only at launch. Token system ready for future themes. |
| 6 | **Figma timing:** Code first, Figma later. No hardcoded values in `@phavo/ui`. |
| 7 | **Access protection:** Free/Standard: phavo.io login. Local: local username + password. No unauthenticated access. |
| 8 | **Mobile (Phase 1):** Responsive web app ≥ 375px. Native apps Phase 3. |
| 9 | **Updates:** In-dashboard panel with version badge. Phase 1 (Docker): copy-paste command snippet, optional Docker socket for one-click (opt-in). Phase 2 (Desktop/Installer): Tauri Updater — signed, automatic, no terminal required. |
| 10 | **Pi-hole:** At launch. Core widget for Persona A. |
| 11 | **Links / Bookmarks:** At launch. Core widget for Persona B. |
| 12 | **Setup:** Quick Setup (3 steps) + Full Setup (10 steps). Both accessible from welcome screen. |
| 13 | **Freemium:** Free tier — core system widgets + weather, 1 tab, Phavo branding. No time limit. |
| 14 | **Pricing:** Free €0 · Standard €7.99 · Local €19.99 · Upgrade €12.00. Launch discount recommended. |
| 15 | **Open source:** AGPL-3.0 + commercial dual licence, released after v1.0. |
| 16 | **Export credentials:** Excluded by default; optionally included as passphrase-encrypted blob. |
| 17 | **Widget drawer:** + button in header — add/remove widgets at any time post-setup. |
| 18 | **2FA:** TOTP-based, optional on all tiers. Backup codes generated at setup. |
| 19 | **HTTPS:** Self-signed cert by default (works everywhere). Let's Encrypt as advanced opt-in for public-facing domains. Custom cert supported. TLS 1.2 min, HTTP → HTTPS redirect once configured. |
| 20 | **RSS fetching:** Server-side via `@phavo/agent` (not browser-direct). Feed server sees Phavo host IP only. |
| 21 | **Telemetry:** None from local app. phavo.io analytics anonymised + aggregated only. Opt-out available. |
| 22 | **Responsible disclosure:** `security@phavo.io` + `SECURITY.md`. 48h acknowledgement SLA. No legal threats for good-faith research. |
| 23 | **Dependency scanning:** Dependabot + `bun audit` in CI. Docker image scanned via Trivy on every build. |
| 24 | **Docker hardening:** Non-root user, read-only filesystem except data volume, distroless/Alpine base image. |
| 25 | **Open source enforcement:** AGPL-3.0 with server-side tier enforcement via phavo.io. No code-level locks — a self-compiled AGPL build defaults to Free tier behaviour. |
| 26 | **Installer:** No native installer in Phase 1. Docker only. Phase 2 desktop app solves the Persona B installation barrier on Windows/macOS. |
| 27 | **Demo:** Built just before v1.0 launch, once the dashboard is stable. Not during Phase 1 development. |
| 28 | **Refund policy:** 14-day money-back guarantee on all paid tiers via Gumroad. |
| 29 | **Free tier offline grace:** 24 hours (shorter than Standard's 72h — incentivises upgrade). |
| 30 | **TLS default:** Self-signed cert generated on first start (works for all home/local installs). Let's Encrypt as advanced opt-in for public-facing domains only. Certificate pinning removed — standard CA validation used. |
| 32 | **Notification system:** Collapsible panel from right side, bell icon in header with unread badge. In-memory history per process lifetime. Notifications are clickable and deep-link to widgets or settings. All widgets (including future third-party) can push via shared `notify()` from `@phavo/types`. Built-in triggers: disk >90%, CPU temp >80°C, Pi-hole unreachable, RSS failing, update available. |

---

## 16. Success Metrics (Phase 1)

- 200 phavo.io account registrations within 60 days of launch
- 100 paid licence sales (Standard + Local) within 60 days
- Free → paid conversion rate ≥ 5% (baseline); ≥ 15% (stretch goal)
- Docker Hub: 500+ pulls in first month
- Setup completion rate ≥ 80%
- < 5 critical bug reports in first 2 weeks

---

*Phavo · phavo.io · github.com/phabioo/phavo*
