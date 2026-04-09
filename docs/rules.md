# PHAVO — Rules

> Non-negotiable development rules for every agent and contributor.
> These rules exist because violating them has caused regressions in the past.
> Read completely before writing any code.

---

## Core Principle

PHAVO is a **product-grade UI**, not a prototype.
Every change must improve clarity, improve consistency, and align with the Celestial Wish design system.

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

## 7. No Network Calls at Runtime

The app is fully offline. No outbound calls at runtime except user-initiated actions.

**Allowed outbound calls:**
- `GET /api/v1/update/check` — user-initiated, 1h server-side cache
- Weather API (Open-Meteo) — per widget poll cycle
- RSS feed URLs — per widget poll cycle
- Pi-hole API — per widget poll cycle

**Never:**
- phavo.net for any purpose at runtime
- telemetry, analytics, or any background phone-home
- Any call not explicitly triggered by the user or a widget data fetch

---

## 8. Windows / Bun Workspace Scripts

On Windows, Bun's implicit bin resolution in workspaces is broken.
`package.json` scripts call local tool entrypoints directly.
Never modify these back to implicit calls — they will silently break on Windows.

---

## 9. Glassmorphism Always Needs a Fallback

Every use of `backdrop-filter: blur()` must include a Pi 3/4 fallback.

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
}
```

`max-resolution: 1.5dppx` catches Raspberry Pi 3/4 at 1080p without GPU backdrop-filter support. Pi 5 still gets glass.

---

## 10. Widget Rules

- Widgets are always **presentational** — no self-fetching
- Data flows: store → widget component. Never widget → API
- All 4 size variants (S/M/L/XL) must be implemented with meaningful content differentiation
- Category labels are ALL CAPS with `letter-spacing: 0.1em`
- XL cards get `.nebula-*` background + `<WishStar>` in bottom-right corner
- Widget tray shows **S-size previews only**

---

## 11. Layout Rules

- No hidden elements affecting layout flow
- No ghost columns or overflow hacks
- BentoGrid is 12-column — never override with arbitrary positioning
- If overflow exists: find root cause, never mask with `overflow: hidden`

---

## 12. No Micro-Tuning When Broken

If something is visually wrong:
- Do NOT tweak values endlessly
- REBUILD the composition

"Improved" is not done. Fixed is done.

---

## 13. No Partial Implementations

Never leave:
- Imported components that are never used
- Computed values that are never rendered
- Event handlers wired to nothing
- TODO comments without a linked issue

If you add code, it must be complete and reachable.

---

## 14. Anti-Patterns

Never:
- Use `overflow: hidden` to "fix" a layout bug
- Scale broken components instead of fixing them
- Mix multiple UI paradigms in the same component
- Introduce a new library without an explicit decision in the docs
- Add `@ts-ignore` without a comment explaining why it's unavoidable
- Use `console.log` in committed code
- Write `style=""` with hardcoded color values on any element in `@phavo/ui`

---

## 15. Definition of Done

A task is complete ONLY when ALL of these pass:

- [ ] `bun run typecheck` exits 0
- [ ] `bun run lint` exits 0
- [ ] No regressions in other components
- [ ] No hardcoded values introduced
- [ ] Visually correct against `docs/design.md` at 375px, 768px, 1440px
- [ ] Svelte 5 Runes patterns used correctly (no legacy slots, no writable stores)

---

*docs/rules.md · Phavo · phavo.net*
