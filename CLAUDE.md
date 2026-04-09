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

---

## Monorepo Structure

```
phavo/
├── apps/
│   ├── web/          ← SvelteKit web app (the ONLY active runtime)
│   ├── desktop/      ← Tauri stub (inactive, v1.1+)
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
  .glass { background: var(--color-surface-container-high); backdrop-filter: none; }
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

---

## Database

SQLite via Drizzle + libSQL. Migrations in `packages/db/src/migrations/`.
Core tables: `users`, `sessions`, `config`, `tabs`, `widget_instances`,
`credentials`, `license_activation`, `plugin_data`

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
| `CLAUDE.md` | This file — agent entry point |

---

## Known Pre-existing Issues (do not fix without context)

1. `lucide-svelte` not installed in `packages/ui` — causes one typecheck warning
   unrelated to app functionality. Fix: `cd packages/ui && bun add lucide-svelte`
2. 89 CRLF line-ending warnings from Windows git checkout — known, ignored.

---

## Definition of Done

A task is complete ONLY when:
- [ ] `bun run typecheck` exits 0
- [ ] `bun run lint` exits 0
- [ ] No regressions in other components
- [ ] No hardcoded values introduced
- [ ] Visually correct against `docs/design.md` spec

"It works" is not done. "It's correct" is done.
