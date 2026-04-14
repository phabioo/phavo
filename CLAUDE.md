# PHAVO — CLAUDE.md

> Mandatory reading for every AI agent working on this codebase.
> Read this file completely before touching any code.
> All referenced documents live in `docs/`.

---

## What PHAVO Is

PHAVO is a modular, self-hosted personal dashboard. It runs locally — no cloud
required, no account required. One binary, one Docker container, your data stays
on your hardware. All features are available to all users — open source under
the MIT license.

There are no subscriptions. There is no phavo.net account backend.
Auth is local-only with local session enforcement.

Current product edition name: **Celestial Edition**.

## Versioning Policy

Two-digit scheme: MAJOR.MINOR (e.g. v0.8, v1.0, v1.1)
Third digit .PATCH only for urgent hotfixes (e.g. v1.0.1)

- v0.x — Pre-release development
- v1.0 — First public release (MA + MB + MC complete)
- v1.x — Post-release feature milestones

Current version: 0.8.5

---

## Monorepo Structure

```
phavo/
├── apps/
│   ├── web/          ← SvelteKit web app (the ONLY active runtime)
├── packages/
│   ├── ui/           ← @phavo/ui — shared Svelte components + theme.css
│   ├── db/           ← @phavo/db — Drizzle schema, migrations, crypto
│   ├── types/        ← @phavo/types — shared TypeScript types
│   └── agent/        ← @phavo/agent — metrics collectors, integrations
├── docs/             ← All project documentation
│   ├── prd.md
│   ├── archspec.md
│   ├── roadmap.html
│   ├── design.md     ← Celestial Wish Design System (authoritative)
│   └── rules.md
├── CLAUDE.md         ← You are here
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
| Auth | Better Auth (local-only) |
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

### 4. Windows / Bun Workspace Scripts
On Windows, Bun's implicit bin resolution in workspaces is broken.
`package.json` scripts call local tool entrypoints directly.
**Never** modify these back to implicit calls — they will break on Windows.

### 5. Runtime Network Boundaries
The app is local-first. Outbound calls must remain explicit and scoped:
- user-initiated update check (`GET /api/v1/update/check`, 1h cache)
- integration/data calls (Weather, RSS, Pi-hole)

Never add telemetry, analytics, or background phone-home behavior.

### 6. Tailwind v4 Dual-Valid
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

**Pi Performance Fallback** (required in every `@phavo/ui` component):
```css
@media (prefers-reduced-motion: reduce), (max-resolution: 1.5dppx) {
  /* backdrop-filter → opaque surface token */
  .glass { background: var(--color-surface-high); backdrop-filter: none; }
  /* also disable: will-change, hover scale transforms, ambient blur glows */
}
```
Covers: `backdrop-filter`, `will-change: transform`, hover `scale()`, ambient blur glows (`filter: blur(100px+)`). Pi 5 is NOT caught — it still gets glass.

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
| `widgets.ts` | Widget manifest, instances, config |
| `tabs.ts` | Pages CRUD |
| `metrics.ts` | CPU, memory, disk, network, temp, uptime, weather |
| `integrations.ts` | Pi-hole, RSS, links |
| `ai.ts` | AI provider config, chat |
| `notifications.ts` | Notification queue, mark-read, clear-all |
| `system.ts` | Health, version, update check |

---

## Widget System

Available widgets (14):
- **System (7):** CPU, Memory, Disk, Network, Temperature, Uptime, Weather
- **Integration (7):** Pi-hole, RSS Feed, Links/Bookmarks, Docker, Service Health, Speedtest, Calendar

Widget sizes and BentoGrid spans:
| Size | colSpan | rowSpan | Content depth |
|---|---|---|---|
| S | 1 | 1 | Compact stat only |
| M | 2 | 2 | Header + hero stat + one secondary element |
| L | 4 | 4 | Header + hero stat + meaningful expanded content |
| XL | 8 | 4 | Reserved — exists in WidgetSize but NO widget registers it |

> **Note:** XL exists in the `WidgetSize` type but is intentionally inactive —
> no widget currently registers it. Reserved for future use. Do not add XL to `availableSizes` arrays.

BentoGrid columns: **8** (desktop ≥1024px) · **4** (tablet 640–1023px) · **2** (mobile <640px)
Row height: `clamp(120px, 7vw, 160px)` desktop/tablet · `clamp(80px, 20vw, 120px)` mobile
L rowSpan is capped at **3** on mobile/tablet (full 4 rows only on desktop).

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
`credentials`, `notifications`

Migrations:
| File | Change |
|---|---|
| `0000_initial.sql` | Bootstrap |
| `0001_spicy_clea.sql` | Core schema: users, sessions, config, tabs, widget_instances, credentials |
| `0002_keen_luminals.sql` | Auth tables |
| `0003_auth_mode_rename.sql` | Legacy auth mode rename in pre-v1 schema history |
| `0004_notifications.sql` | Add `notifications` table (DB-persisted, survives restarts) |
| `0005_local_auth_offline_license.sql` | Local-only auth normalization (rebuild sessions) |
| `0006_plugin_data.sql` | Add `plugin_data` table (Speedtest history) |
| `0007_remove_tier.sql` | Remove `tier` column from sessions, drop obsolete activation table |

Sensitive widget config: AES-256-GCM encrypted in `widget_instances.config_encrypted`.
Secrets: `credentials` table, keyed by widget instance path.

---

## Docs Index

| File | Purpose |
|---|---|
| `docs/prd.md` | Product Requirements Document |
| `docs/archspec.md` | Architecture Specification |
| `docs/roadmap.html` | Development roadmap to v1.0 |
| `docs/design.md` | Celestial Wish Design System (full spec) |
| `docs/rules.md` | Development rules and anti-patterns |
| `docs/widget-guide.md` | Widget development guide |
| `docs/svelte-audit.md` | Svelte audit report |
| `docs/dev-commands.md` | Cross-platform dev commands |
| `CLAUDE.md` | This file — agent entry point |

See `docs/rules.md` for engineering rules.

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
| `apps/web/src/lib/widgets/config-schemas.ts` | Shared widget config Zod schemas |
| `apps/web/src/lib/components/settings/` | Settings page components (master-detail) |
| `packages/ui/src/components/Button.svelte` | Button component (primary pill, secondary ghost, tertiary text-only) |

---

## Dev Commands

```bash
PHAVO_SECRET=dev-secret PHAVO_PORT=3000 PHAVO_DATA_DIR=./data \
  ~/.bun/bin/bun run --cwd apps/web dev -- --host 0.0.0.0
```

**Checks:**
```bash
bun run typecheck   # Svelte + TypeScript
bun run lint         # Biome
```

---

## Known Pre-existing Issues (do not fix without context)

1. Settings dropdown menus clip with settings cards (z-index issue, manual fix pending)
2. a11y_interactive_supports_focus warning on WishStar drag handle (deferred)

---

## Definition of Done

A task is complete ONLY when:
- [ ] `bun run typecheck` exits 0
- [ ] `bun run lint` exits 0
- [ ] No regressions in other components
- [ ] No hardcoded values introduced
- [ ] Visually correct against `docs/design.md` spec

"It works" is not done. "It's correct" is done.
