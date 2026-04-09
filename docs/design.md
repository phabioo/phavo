# PHAVO — Celestial Wish Design System
## Definitive Reference v2.0

> This document supersedes all previous design notes.
> All values are extracted directly from the Celestial Wish mockup source code.
> Every agent working on PHAVO UI must follow this document exactly.
> When in doubt: this document wins over any other reference.

---

## 1. Color Palette — Exact Values

All tokens live in `packages/ui/src/theme.css` inside the `@theme {}` block.

### Surface Tiers (background → foreground)
```
#0a0e1a  --color-surface-dim           Page background / deepest void
#0f131f  --color-surface               Main content area
#171b28  --color-surface-low           Sidebar, secondary panels, CPU/RSS/Calendar cards
#1b1f2c  --color-surface-card          Memory/Network widget cards (default)
#262a37  --color-surface-high          Weather/elevated cards
#313442  --color-surface-highest       Footer pill, tooltip backgrounds
#353946  --color-surface-bright        Glass overlays, header blur
```

### Primary — Soft Yellow (hero stats, wordmark, active calendar date)
```
#ffffff  --color-primary               Base primary (white) — used for main text headings
#f9e287  --color-primary-fixed         GOLD/YELLOW — hero stat numbers, wordmark, active dates
#dcc66e  --color-primary-fixed-dim     Muted gold — secondary accents, WishStar
#221b00  --color-on-primary-fixed      Text on gold backgrounds
```

### Secondary — Wish Teal (active nav, system online, progress fills, charts)
```
#4ddcc6  --color-secondary             Teal — active nav text, charts, highlights
#00b4a0  --color-secondary-container   Deep teal — active nav background
#6ef9e2  --color-secondary-fixed       Bright teal
#4ddcc6  --color-secondary-fixed-dim   Teal dim
#00201b  --color-on-secondary
#003f37  --color-on-secondary-container
```

### Tertiary — Cosmic Purple (ambient glow, nebula accents)
```
#cebdff  --color-tertiary-fixed-dim    Purple ambient glow source color
#e8ddff  --color-tertiary-fixed
#6d51bc  --color-on-tertiary-container
```

### Text
```
#dfe2f3  --color-on-surface            Primary text (warm white-blue)
#cdc6b3  --color-on-surface-variant    Body text, labels, secondary info
#97907f  --color-outline               Faint text, separators
#4b4738  --color-outline-variant       Ghost border color
```

### Semantic
```
#ffb4ab  --color-error
#93000a  --color-error-container
```

---

## 2. Background System

### Page background
```css
html, body {
  background: radial-gradient(circle at 50% 50%, #171b28 0%, #0a0e1a 100%);
  min-height: 100vh;
}
```

### Ambient Cosmic Glows — MANDATORY, FIXED POSITIONED
These two elements create the "cosmic night" atmosphere.
They MUST be rendered as fixed-position divs at the root layout level,
behind all content (z-index: 0, pointer-events: none).

```svelte
<!-- In +layout.svelte, inside app-shell, before any content -->

<!-- Bottom-right: Cosmic Purple glow -->
<div class="ambient-glow ambient-glow-purple"></div>

<!-- Top-left: Wish Teal glow -->
<div class="ambient-glow ambient-glow-teal"></div>
```

```css
.ambient-glow {
  position: fixed;
  border-radius: 50%;
  pointer-events: none;
  z-index: 0;
}

.ambient-glow-purple {
  bottom: -10%;
  right: -10%;
  width: 50vw;
  height: 50vw;
  background: color-mix(in srgb, var(--color-tertiary-fixed-dim) 5%, transparent);
  filter: blur(120px);
}

.ambient-glow-teal {
  top: -10%;
  left: -10%;
  width: 40vw;
  height: 40vw;
  background: color-mix(in srgb, var(--color-secondary-fixed-dim) 5%, transparent);
  filter: blur(100px);
}
```

---

## 3. Typography

**Font stack:** Geist (self-hosted via @fontsource) — no Google Fonts CDN.
Geist is thinner than Manrope. Compensate with larger sizes and higher weights.

### Scale

| Role | Size | Weight | Letter-spacing | Color |
|---|---|---|---|---|
| Page hero heading | 36px | 300 | -0.02em | --color-on-surface |
| Hero heading accent (username) | 36px | 700 | -0.02em | --color-primary-fixed |
| Hero stat number | 72px | 700 | -0.03em | --color-primary-fixed |
| Hero stat unit | 30px | 300 | 0 | --color-on-surface-variant |
| Widget title | 18px | 600 | -0.01em | --color-on-surface |
| Category label | 12px | 700 | 0.1em | --color-on-surface-variant |
| Body text | 14px | 400 | 0 | --color-on-surface-variant |
| Small label / metadata | 10px | 700 | 0.1em | --color-on-surface-variant |
| Mono / data values | 14px | 700 | 0.06em | --color-on-surface |

**Base font size: 14px** (was 13px — increase for 2K monitor readability).

Category labels: ALWAYS uppercase + letter-spacing: 0.1em.

---

## 4. Layout Shell

### App Shell structure
```
<div class="ambient-glow-purple" />   ← fixed, z:0
<div class="ambient-glow-teal" />     ← fixed, z:0
<aside class="sidebar" />             ← fixed, z:50
<div class="app-main">                ← margin-left: 240px
  <header class="phavo-header" />     ← sticky, z:40
  <main class="app-content" />        ← overflow: visible (NEVER hidden)
</div>
```

**CRITICAL:** No element in the layout chain between `html` and the
widget grid may have `overflow: hidden`. This kills the nebula gradients.
Use `overflow: visible` or leave unset.

### Sidebar
- Width: 240px expanded / 64px collapsed
- Background: `--color-surface` (#0f131f)
- No border — tonal separation only

**PHAVO Wordmark:**
- Color: `--color-primary-fixed` (#f9e287) — bright warm yellow
- Font: Geist 900 (black weight), 18px, letter-spacing: -0.02em

**Nav items — inactive:**
- Color: rgba(255,255,255,0.3) — slate-ish
- Hover: color `--color-primary-fixed` + bg rgba(255,255,255,0.05)

**Nav items — ACTIVE (use TEAL, not gold):**
- Color: `--color-secondary` (#4ddcc6)
- Background: color-mix(in srgb, var(--color-secondary) 10%, transparent)
- Right border: 2px solid `--color-secondary`

**Upgrade card:**
- Background: `--color-surface-card`
- CTA button: pill, gradient `--color-primary-fixed → --color-primary-fixed-dim`

### Header
Grid layout: `grid-template-columns: 1fr auto 1fr` — guarantees mathematical centering.

**Left:** Dashboard name + Edition pill
- Dashboard name: uppercase, font-weight 700, letter-spacing 0.08em, color `--color-primary-fixed`
- Edition pill: tiny pill, `--color-surface-highest` bg, `--color-on-surface-variant` text

**Center:** Search bar (max-width 440px)
- Background: `--color-surface-dim` (#0a0e1a)
- Bottom border only: 1px solid `--color-outline-variant` at 15% opacity
- No border-radius on the input itself
- Focus: bottom border transitions to `--color-secondary-fixed`

**Right:** Info pill + System status pill + actions
- Info pill (clock · weather): glass pill, `--color-surface-highest` 40% bg + blur(20px)
- System Online pill: `color-mix(in srgb, --color-secondary 10%, transparent)` bg, `--color-secondary` text + pulsing dot
- Offline pill: `color-mix(in srgb, --color-error 10%, transparent)` bg, `--color-error` text, no pulse
- Add widget button: mono uppercase, subtle hover
- Bell: icon button, `--color-on-surface-variant`

Header background: `color-mix(in srgb, #0a0e1a 60%, transparent)` + `backdrop-filter: blur(20px)`

---

## 5. Widget Cards

### Radius
All cards: `border-radius: 2rem` (32px)

### Background tiers (intentionally varied per widget type)
- System metric widgets (CPU, RSS, Calendar): `--color-surface-low` (#171b28)
- Data widgets (Memory, Network): `--color-surface-card` (#1b1f2c)
- Ambient widgets (Weather): `--color-surface-high` (#262a37)

### Hover
```css
transition: transform 0.3s ease;
&:hover { transform: scale(1.02); }
```

### Content padding: 32px (2rem) on all sides

### Category label (widget type string)
```css
font-size: 12px;
font-weight: 700;
text-transform: uppercase;
letter-spacing: 0.1em;
color: var(--color-on-surface-variant);
```

### Hero stat (primary value)
```css
font-size: 72px;
font-weight: 700;
color: var(--color-primary-fixed);
letter-spacing: -0.03em;
line-height: 1;
```

### Star field texture (on CPU / large cards)
```css
background-image: radial-gradient(circle, rgba(255,255,255,0.2) 1px, transparent 1px);
background-size: 50px 50px;
opacity: 0.1;
```
Applied as an absolute inset pseudo-element on XL cards.

### Neon glow on hero stats
```css
/* Gold glow */
filter: drop-shadow(0 0 20px rgba(249, 226, 135, 0.3));

/* Teal glow */
filter: drop-shadow(0 0 20px rgba(77, 220, 198, 0.2));
```

### Progress bars (Celestial style)
- Track: rgba(255,255,255,0.05)
- Fill: gradient from `--color-secondary` to `--color-primary-fixed`
- Height: 6px, border-radius: full

---

## 6. Footer Pill

```css
/* Container */
.footer-pill {
  display: inline-flex;
  align-items: center;
  gap: 24px;
  padding: 12px 32px;
  border-radius: 9999px;
  background: var(--color-surface-highest);
  border: 1px solid rgba(255, 255, 255, 0.1);
  font-size: 10px;
  font-weight: 700;
  font-family: var(--font-mono);
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--color-on-surface-variant);
}

/* PHAVO brand text inside pill */
.footer-brand {
  color: var(--color-primary-fixed);
}

/* Separator dots */
.footer-dot {
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: color-mix(in srgb, var(--color-primary-fixed) 40%, transparent);
}
```

Content: `POWERED BY · PHAVO · {TIER} EDITION · VERSION X.X.X · {DEVICE}`

---

## 7. Nebula Glows (on-card gradients)

Applied as `background-image` on specific widget cards.
Must NOT conflict with the card's `background` (use `background-image` only).

```css
.nebula-gold {
  background-image: radial-gradient(
    ellipse 60% 40% at 90% 100%,
    color-mix(in srgb, var(--color-primary-fixed-dim) 15%, transparent),
    transparent
  );
}
.nebula-teal {
  background-image: radial-gradient(
    ellipse 50% 35% at 10% 0%,
    color-mix(in srgb, var(--color-secondary-fixed-dim) 12%, transparent),
    transparent
  );
}
.nebula-purple {
  background-image: radial-gradient(
    ellipse 45% 35% at 85% 10%,
    color-mix(in srgb, var(--color-tertiary-fixed-dim) 10%, transparent),
    transparent
  );
}
```

**CRITICAL:** Nebula glows use `background-image`. Any parent with
`overflow: hidden` will clip them. Layout chain must use `overflow: visible`.

---

## 8. Immutable Rules

1. ZERO hardcoded hex/rgb/rgba in `@phavo/ui` — CSS tokens only
2. No `overflow: hidden` anywhere in the layout chain (kills nebula glows)
3. Never `border` for layout — tonal surface tier shifts only
4. Fonts via `@fontsource` only — no Google Fonts CDN
5. Icons via `<Icon>` abstraction — never `lucide-svelte` direct imports
6. Nav active state: TEAL (`--color-secondary`), not gold
7. Hero stats: `--color-primary-fixed` (#f9e287), not `--color-primary`
8. PHAVO wordmark: `--color-primary-fixed` (#f9e287)
9. Ambient glows: always present in layout, fixed positioned, z:0
10. `svelte.config.js` must never have `compilerOptions: { runes: true }`
11. Tier identifiers in code: `stellar` / `celestial` only
