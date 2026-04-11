# PHAVO — Rules

> Non-negotiable development rules for every agent and contributor.
> These rules exist because violating them has caused regressions in the past.
> Read completely before writing any code.

---

## Core Principle

PHAVO is a **product-grade UI**, not a prototype.
Every change must improve clarity, improve consistency, and align with the Celestial Wish design system.

## Source of Truth

When documents disagree, resolve and align to this precedence:

1. `CLAUDE.md` for architecture/runtime invariants and stack rules
2. `docs/design.md` for visual/tokens/motion rules
3. `docs/prd.md` for product scope and release requirements
4. `docs/roadmap.html` for execution status only (never for normative architecture)

Any mismatch found during implementation must be corrected in docs as part of the same change set.

---

## 1. CSS Token Iron Rule

**Zero hardcoded hex, rgb, rgba, or hsl values in `@phavo/ui`.**

```css
/* ✅ Always */
background: var(--color-surface-card);
color: var(--color-on-surface);
box-shadow: 0 0 20px color-mix(in srgb, var(--color-primary) 15%, transparent);

/* ❌ Never */
background: #1b1f2c;
color: #e8e1d6;
box-shadow: 0 0 20px rgba(220,198,110,0.15);
```

If a token doesn't exist for what you need, add it to `packages/ui/src/theme.css` first, then use it. Never shortcut.

---

## 2. No Borders for Layout

Do not use `1px solid` borders for sectioning or spatial hierarchy.
Boundaries are defined by surface tier shifts (background color changes).

```css
/* ✅ Always — tonal separation */
.sidebar  { background: var(--color-surface-low); }
.content  { background: var(--color-surface); }

/* ❌ Never — border as layout tool */
.sidebar  { border-right: 1px solid #2a2a2a; }
```

**Allowed exceptions:**
- `outline-variant` at 15% opacity as accessibility ghost border (when a container is indistinguishable from its parent without any visual cue)
- Focus rings on interactive elements (WCAG requirement)
- WidgetCard `stale` state top-stripe (2px, `--color-outline`)
- Active nav item left indicator (2px, `--color-primary`)

---

## 3. Icon Rule

Always use the `<Icon>` component from `@phavo/ui`. Never import from `lucide-svelte` directly.

```svelte
<!-- ✅ Always -->
import { Icon } from '@phavo/ui';
<Icon name="cpu" size={16} />

<!-- ❌ Never -->
import { Cpu } from 'lucide-svelte';
<Cpu size={16} />
```

Direct imports force lucide-svelte's Svelte 4 components into the bundle without the abstraction layer, breaking theme compatibility and future icon swapping.

---

## 4. Font Rule

Fonts are self-hosted via `@fontsource/geist` and `@fontsource/geist-mono`.
**Never import from Google Fonts CDN.**

```css
/* ✅ Always — in theme.css */
@import '@fontsource/geist/300.css';
@import '@fontsource/geist/400.css';
@import '@fontsource/geist/500.css';
@import '@fontsource/geist-mono/400.css';
@import '@fontsource/geist-mono/500.css';

/* ❌ Never */
@import url('https://fonts.googleapis.com/css2?family=Geist...');
```

The CSP does not allowlist `fonts.googleapis.com`. Any CDN font import will silently fail in production.

---

## 5. Svelte 5 Runes — Config Rule

**Never add `compilerOptions: { runes: true }` to `svelte.config.js`.**

This forces all Svelte components — including lucide-svelte's legacy Svelte 4 components — into runes mode, breaking them. Runes are opt-in per file via `<script>` context, not global.

```js
// ✅ svelte.config.js — correct
const config = { kit: { adapter: adapter() } };

// ❌ svelte.config.js — breaks lucide-svelte
const config = {
  compilerOptions: { runes: true },
  kit: { adapter: adapter() }
};
```

---

## 6. Tier Identifiers

Tier strings in all code, DB, and UI are `stellar` and `celestial`. No others.

```typescript
// ✅
requireTier('celestial')
tier: 'stellar' | 'celestial'
"STELLAR EDITION" / "CELESTIAL EDITION"

// ❌ — these strings no longer exist in PHAVO
'free' / 'standard' / 'pro' / 'local'
```

If you see any of the forbidden strings in non-comment code, fix them.

---

## 7. Runtime Network Boundaries

The app should stay local-first. Outbound calls at runtime must be explicit and scoped.

**Allowed outbound calls:**
- `GET /api/v1/update/check` — user-initiated, 1h server-side cache
- Weather API (Open-Meteo) — per widget poll cycle
- RSS feed URLs — per widget poll cycle
- Pi-hole API — per widget poll cycle

**Never:**
- telemetry, analytics, or any background phone-home
- Any call not explicitly triggered by the user or a widget data fetch

---

## 8. Windows / Bun Workspace Scripts

On Windows, Bun's implicit bin resolution in workspaces is broken.
`package.json` scripts call local tool entrypoints directly.
Never modify these back to implicit calls — they will silently break on Windows.

---

## 9. Pi 3/4 Performance Fallback

Every `@phavo/ui` component must include a Pi 3/4 fallback block. The media query covers:
`prefers-reduced-motion: reduce` (a11y) and `max-resolution: 1.5dppx` (Pi 3/4 at 1080p without GPU compositor).

**What to disable in the fallback:**
- `backdrop-filter: blur()` — replace with an opaque background token
- `will-change: transform` — reset to `will-change: auto`
- hover `transform: scale()` — remove the scale
- ambient blur glows (`filter: blur(100px+)`) — hide entirely (`display: none` or `opacity: 0`)

```css
/* ✅ Always */
.glass {
  background: color-mix(in srgb, var(--color-surface-bright) 50%, transparent);
  backdrop-filter: blur(20px);
}
@media (prefers-reduced-motion: reduce), (max-resolution: 1.5dppx) {
  .glass {
    background: var(--color-surface-high);
    backdrop-filter: none;
  }
  .card:hover { transform: none; }
  .glow-ambient { display: none; }
}
```

Pi 5 has a GPU compositor and is NOT caught by `max-resolution: 1.5dppx` — it still gets glass.

---

## 10. Widget Rules

- Widgets are always **presentational** — no self-fetching
- Data flows: store → widget component. Never widget → API
- S/M/L size variants must be implemented with meaningful content differentiation
- **XL is inactive** — exists in `WidgetSize` type but no widget registers it. Do not add XL to any `availableSizes` array.
- `showControls={false} clipContent={false}` required in non-BentoGrid contexts (WidgetDrawer, Settings)
- `staggerIndex` prop controls entrance animation delay (`staggerIndex * 60ms`)
- Category labels are ALL CAPS with `letter-spacing: 0.1em`
- Widget tray shows **S-size previews only**

---

## 11. Gold vs Teal — Color Role Rules

| Color | Role | Use for |
|---|---|---|
| **Gold** (`--color-primary-fixed`) | Editorial | Hero stat numbers, wordmark, CTA buttons, active calendar date, WishStar |
| **Teal** (`--color-secondary`) | Data viz | Progress bars, donut charts, sparklines, bar charts, swap bars, focus rings |

```svelte
<!-- ✅ Hero stat — always gold -->
<span class="hero-stat hero-glow" style="color: var(--color-primary-fixed)">{value}%</span>

<!-- ✅ Progress bar fill — always teal -->
<div class="fill" style="background: var(--color-secondary)"></div>

<!-- ❌ Never mix: teal hero stats or gold progress bars -->
```

---

## 12. WidgetCard Non-Dashboard Contexts

When using `<WidgetCard>` outside the BentoGrid (WidgetDrawer previews, Settings):

```svelte
<!-- ✅ Always in Drawer / Settings -->
<WidgetCard showControls={false} clipContent={false} ... />

<!-- ❌ Never omit these in non-dashboard contexts -->
<WidgetCard ... />
```

`showControls={false}` hides resize/remove buttons.
`clipContent={false}` allows glow bleed outside the card boundary.

---

## 13. Motion Tokens

**Never hardcode duration or easing values.** Always use `var(--motion-*)` tokens.

```css
/* ✅ Always */
transition: background var(--motion-micro);
transition: transform var(--motion-component);

/* ❌ Never */
transition: background 150ms ease;
transition: transform 0.3s cubic-bezier(...);
```

| Token | Value | Use |
|---|---|---|
| `--motion-micro` | `150ms ease` | Hover, focus, icon transitions |
| `--motion-component` | `300ms cubic-bezier(0.32, 0.72, 0, 1)` | Panel slide, card entrance |
| `--motion-page` | `200ms ease` | Route transitions |

All collapse to `0ms` under `prefers-reduced-motion: reduce`.

---

## 14. Settings Pages

Settings uses a master-detail layout. Always:

- Wrap detail content in `.settings-cards-grid` (two-column card grid)
- Hero/status card: uses `.settings-hero-card` (gold bg accent)
- Form card: uses `.settings-form-card`
- Full-width card: add `.settings-card-full` class
- Input focus ring: always `--color-secondary` (teal), never gold

---

## 15. Layout Rules

- No hidden elements affecting layout flow
- No ghost columns or overflow hacks
- BentoGrid is 12-column — never override with arbitrary positioning
- If overflow exists: find root cause, never mask with `overflow: hidden`

---

## 16. No Micro-Tuning When Broken

If something is visually wrong:
- Do NOT tweak values endlessly
- REBUILD the composition

"Improved" is not done. Fixed is done.

---

## 17. No Partial Implementations

Never leave:
- Imported components that are never used
- Computed values that are never rendered
- Event handlers wired to nothing
- TODO comments without a linked issue

If you add code, it must be complete and reachable.

---

## 18. Anti-Patterns

Never:
- Use `overflow: hidden` to "fix" a layout bug
- Scale broken components instead of fixing them
- Mix multiple UI paradigms in the same component
- Introduce a new library without an explicit decision in the docs
- Add `@ts-ignore` without a comment explaining why it's unavoidable
- Use `console.log` in committed code
- Write `style=""` with hardcoded color values on any element in `@phavo/ui`

---

## 19. AI SDK Rules

- Use Vercel AI SDK (`ai` package) for all AI features
- Provider abstraction: `createOllama()` / `createOpenAI()` / `createAnthropic()`
- Streaming via `streamText()` + Hono `streamSSE` — never buffer full response
- Local Ollama: `baseURL` configurable via `PHAVO_OLLAMA_URL` env var
- API keys stored encrypted in `credentials` table — never exposed to browser
- AI features are Celestial-tier only — always behind `requireTier('celestial')`

---

## 20. Definition of Done

A task is complete ONLY when ALL of these pass:

- [ ] `bun run typecheck` exits 0
- [ ] `bun run lint` exits 0
- [ ] No regressions in other components
- [ ] No hardcoded values introduced
- [ ] Visually correct against `docs/design.md` at 375px, 768px, 1440px
- [ ] Svelte 5 Runes patterns used correctly (no legacy slots, no writable stores)

---

*docs/rules.md · Phavo · phavo.net*
