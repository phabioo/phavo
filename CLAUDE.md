# PHAVO — CLAUDE.md

> Mandatory reading for every AI agent working on this codebase.
> Read this file completely before touching any code.
> All referenced documents live in `docs/`.

---

## What PHAVO Is

PHAVO is a modular, self-hosted personal dashboard. It runs locally — no cloud
required, no account required. One binary, one Docker container, your data stays
on your hardware.

**Two tiers:**
- **Stellar** (free) — base widgets, 1 page (Home)
- **Celestial** (paid, one-time) — all widgets, unlimited pages, AI assistant

There are no subscriptions. There is no phavo.net account backend. The Celestial
license key is a self-verifying Ed25519-signed payload — the app validates it
offline against an embedded public key. phavo.net is never contacted at runtime.

## Versioning Policy

Two-digit scheme: MAJOR.MINOR (e.g. v0.8, v1.0, v1.1)
Third digit .PATCH only for urgent hotfixes (e.g. v1.0.1)

- v0.x — Pre-release development
- v1.0 — First public release (MA + MB + MC complete)
- v1.x — Post-release feature milestones

Current version: 0.8.0

---

## Monorepo Structure

```
phavo/
├── apps/
│   ├── web/          ← SvelteKit web app (the ONLY active runtime)
│   ├── desktop/      ← Tauri stub (inactive, post-v1.0)
│   └── mobile/       ← stub (inactive, future)
├── packages/
│   ├── ui/           ← @phavo/ui — shared Svelte components + theme.css
│   ├── db/           ← @phavo/db — Drizzle schema, migrations, crypto
│   ├── types/        ← @phavo/types — shared TypeScript types
│   └── agent/        ← @phavo/agent — metrics collectors, integrations
├── docs/             ← All project documentation
│   ├── prd.md
│   ├── archspec.html
│   ├── roadmap.html
│   ├── design.md     ← Celestial Wish Design System (authoritative)
│   └── rules.md
├── CLAUDE.md         ← You are here
└── RULES.md          ← Symlink or copy of docs/rules.md for legacy tooling
```

---

## Tech Stack (non-negotiable)

| Layer | Technology |
|---|---|
| Frontend | SvelteKit + Svelte 5 Runes |
| Styling | Tailwind v4 (`@theme` block in `packages/ui/src/theme.css`) |
| Components | shadcn-svelte + Bits UI |
| Icons | `<Icon>` abstraction — **never** `lucide-svelte` direct imports |
| Fonts | Geist + Geist Mono via `@fontsource` — **never** Google Fonts CDN |
| Backend | Hono (mounted via SvelteKit catch-all) |
| ORM | Drizzle + libSQL (SQLite) |
| Auth | Better Auth, local-only mode |
| Runtime | Bun |
| Monorepo | Turborepo |
| Linter | Biome (replaces ESLint + Prettier) |

---

## Critical Rules — Read Every One

### 1. Runes Config
**NEVER** add `compilerOptions: { runes: true }` to `svelte.config.js`.
This forces lucide-svelte's Svelte 4 legacy components into runes mode and breaks them.
Runes are enabled per-file via `<script>` context — not globally.

### 2. Icons
Always use the `<Icon>` component from `@phavo/ui`:
```svelte
import { Icon } from '@phavo/ui';
<Icon name="cpu" />
```
Never import from `lucide-svelte` directly.

### 3. CSS Tokens — Iron Rule
**Zero hardcoded hex/rgb/hsl values in `@phavo/ui`.**
All values come from CSS tokens defined in `packages/ui/src/theme.css`.
If you need a color, find the token. If no token exists, add one to `theme.css` first.

### 4. Tier Identifiers
Tiers in code are `stellar` and `celestial`. No other strings.
- Do NOT use: `free`, `standard`, `pro`, `local`
- The `requireTier()` middleware uses these strings
- The DB schema enum uses these strings

### 5. Windows / Bun Workspace Scripts
On Windows, Bun's implicit bin resolution in workspaces is broken.
`package.json` scripts call local tool entrypoints directly.
**Never** modify these back to implicit calls — they will break on Windows.

### 6. No Network Calls at Runtime
The app is fully offline after installation. No API calls to phavo.net,
no telemetry, no update pings without explicit user action.
Exception: `GET /api/v1/update/check` — user-initiated only, with 1h cache.

### 7. Tailwind v4 Dual-Valid
The `@theme` block in `theme.css` makes all tokens available both as:
- Tailwind utility classes: `bg-surface`, `text-primary`
- CSS variables: `var(--color-surface)`, `var(--color-primary)`
Both are valid. Use whichever is clearest for the context.

---

## Design System — Celestial Wish

The design language is **Celestial Wish** — atmospheric dark, editorial typography,
tonal depth (no borders for layout). Full spec: `docs/design.md`.

**Key visual decisions:**
- Base surface: `#0f131f` (Deep Celestial Blue family)
- Primary accent: `#dcc66e` (Soft Gold) — used for PHAVO wordmark, hero stats, active nav
- Secondary: `#3fc8a0` (Teal) — progress fills, system online indicator
- Tertiary: `#a89cf5` (Cosmic Purple) — gradient accents, nebula glows
- Typography: Geist 300–500 only, Geist Mono for data/code/labels
- Widget category labels: ALL CAPS, `letter-spacing: 0.1em`
- Glassmorphism: `backdrop-filter: blur(20px)` with Pi 3/4 fallback

**Pi Performance Fallback:**
```css
@media (prefers-reduced-motion: reduce), (max-resolution: 1.5dppx) {
  .glass { background: var(--color-surface-high); backdrop-filter: none; }
}
```

---

## API Architecture

Single SvelteKit catch-all mounts Hono:
`apps/web/src/routes/api/v1/[...path]/+server.ts`

All API responses use the uniform envelope:
- Success: `{ ok: true, data: ... }`
- Error: `{ ok: false, error: "..." }`

Middleware stack per request: `auth → csrf → rate-limit → handler`

Key route modules:
| Module | Responsibility |
|---|---|
| `auth.ts` | Login, session, logout, TOTP |
| `widgets.ts` | Widget manifest (tier-filtered), instances, config |
| `tabs.ts` | Pages CRUD |
| `metrics.ts` | CPU, memory, disk, network, temp, uptime, weather |
| `integrations.ts` | Pi-hole, RSS, links |
| `license.ts` | Celestial key activation/deactivation |
| `ai.ts` | AI provider config, chat |
| `notifications.ts` | Notification queue, mark-read, clear-all |
| `system.ts` | Health, version, update check |

---

## Widget System

Widget tier assignments:
- **Stellar:** CPU, Memory, Disk, Network, Uptime, Temperature, Weather
- **Celestial:** All Stellar + Docker, Service Health, Speedtest, Calendar, RSS, Pi-hole, Links

Widget sizes and BentoGrid spans:
| Size | colSpan | rowSpan |
|---|---|---|
| S | 3 | 1 |
| M | 4 | 2 |
| L | 6 | 2 |
| XL | 8 | 3 |

> **Note:** XL exists in the `WidgetSize` type but is intentionally inactive —
> no widget currently registers it. Reserved for future use.

Widgets are always **presentational** — no self-fetching.
Data flows: store → widget component. Never widget → API.

### WidgetCard Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `size` | `WidgetSize` | — | `'S' \| 'M' \| 'L' \| 'XL'` |
| `colSpan` | `number` | from size | Grid column span |
| `rowSpan` | `number` | from size | Grid row span |
| `glowColor` | `'gold' \| 'teal'` | `'gold'` | Sets `--widget-glow` CSS variable |
| `showControls` | `boolean` | `true` | Resize/remove buttons. Set `false` in Drawer & Settings previews. |
| `clipContent` | `boolean` | `true` | Clips overflow. Set `false` in Drawer cards for glow bleed. |
| `staggerIndex` | `number` | — | Entrance animation delay: `staggerIndex * 60ms` |
| `draggable` | `boolean` | `false` | Enables WishStar drag handle |
| `availableSizes` | `WidgetSize[]` | — | Which sizes this widget supports |
| `loading` | `boolean` | `false` | Shows skeleton state |
| `error` | `string \| null` | `null` | Shows error state with message |

> **Non-dashboard contexts:** Always pass `showControls={false} clipContent={false}`
> when using WidgetCard outside the BentoGrid (e.g. WidgetDrawer previews, Settings).

---

## Motion Tokens

Defined in `:root` of `packages/ui/src/theme.css` (outside `@theme` — not tree-shaken).

| Token | Value | Use |
|---|---|---|
| `--motion-micro` | `150ms ease` | Hover highlights, focus rings, icon transitions |
| `--motion-component` | `300ms cubic-bezier(0.32, 0.72, 0, 1)` | Drawer open/close, panel slide-in, card entrance |
| `--motion-page` | `200ms ease` | Route transitions, view switches |

All three collapse to `0ms` under `prefers-reduced-motion: reduce`.
**Never hardcode duration values** — always use `var(--motion-*)` tokens.

---

## Database

SQLite via Drizzle + libSQL. Migrations in `packages/db/src/migrations/`.
Core tables: `users`, `sessions`, `config`, `tabs`, `widget_instances`,
`credentials`, `license_activation`, `plugin_data`, `notifications`

Migrations:
| File | Change |
|---|---|
| `0000_initial.sql` | Bootstrap |
| `0001_spicy_clea.sql` | Core schema: users, sessions, config, tabs, widget_instances, credentials, license_activation |
| `0002_keen_luminals.sql` | Auth tables |
| `0003_auth_mode_rename.sql` | Rename authMode `phavo-io` → `local` |
| `0004_notifications.sql` | Add `notifications` table (DB-persisted, survives restarts) |

Sensitive widget config: AES-256-GCM encrypted in `widget_instances.config_encrypted`.
Secrets: `credentials` table, keyed by widget instance path.

---

## Docs Index

| File | Purpose |
|---|---|
| `docs/prd.md` | Product Requirements Document |
| `docs/archspec.html` | Architecture Specification |
| `docs/roadmap.html` | Development roadmap to v1.0 |
| `docs/design.md` | Celestial Wish Design System (full spec) |
| `docs/rules.md` | Development rules and anti-patterns |
| `docs/widget-guide.md` | Widget development guide |
| `CLAUDE.md` | This file — agent entry point |

### Key Files

| File | Purpose |
|---|---|
| `packages/ui/src/theme.css` | All CSS tokens (`@theme` block + motion + utilities) |
| `packages/ui/src/components/WidgetCard.svelte` | Widget card wrapper (all sizes, states, drag) |
| `packages/ui/src/components/NotificationPanel.svelte` | Right-side slide-in notification drawer |
| `packages/ui/src/components/WidgetDrawer.svelte` | Bottom sheet for adding widgets |
| `packages/ui/src/components/WishStar.svelte` | 4-pointed SVG star (drag handle) |
| `apps/web/src/lib/stores/notifications.svelte.ts` | Notification store (Svelte 5 Runes) |
| `apps/web/src/lib/widgets/_widget-template.svelte` | Starting point for new widgets |
| `apps/web/src/lib/components/settings/` | Settings page components (master-detail) |

---

## Dev Commands

**Stellar tier (default):**
```bash
PHAVO_DEV_MOCK_AUTH=true PHAVO_SECRET=dev-secret PHAVO_ENV=development \
  PHAVO_PORT=3000 PHAVO_DATA_DIR=./apps/web/.dev-data \
  bun run --cwd apps/web dev -- --host 0.0.0.0
```

**Celestial tier:**
```bash
PHAVO_DEV_MOCK_AUTH=true PHAVO_SECRET=dev-secret PHAVO_ENV=development \
  PHAVO_PORT=3000 PHAVO_DATA_DIR=./apps/web/.dev-data \
  PHAVO_DEV_TIER=celestial \
  bun run --cwd apps/web dev -- --host 0.0.0.0
```

**Checks:**
```bash
bun run typecheck   # Svelte + TypeScript
bun run lint         # Biome
```

---

## Known Pre-existing Issues (do not fix without context)

1. 89 CRLF line-ending warnings from Windows git checkout — known, ignored.

---

## Definition of Done

A task is complete ONLY when:
- [ ] `bun run typecheck` exits 0
- [ ] `bun run lint` exits 0
- [ ] No regressions in other components
- [ ] No hardcoded values introduced
- [ ] Visually correct against `docs/design.md` spec

"It works" is not done. "It's correct" is done.
