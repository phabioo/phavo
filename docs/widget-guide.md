# PHAVO — Widget Development Guide

> This document is the authoritative reference for building widgets.
> Every agent and contributor must follow it exactly.
> A widget built correctly from this guide requires zero visual bugfixes.
> Updated for runtime v0.8.0 and current WidgetCard behavior.

---

## 1. Design Rules for Widgets

### Color Layer System

Two color layers. Never mix them.

| Layer | Color | Used for |
|---|---|---|
| **Editorial** | `--color-primary-fixed` (Soft Gold) | Hero numbers, text labels, icons, category labels, WishStar |
| **Data Visualization** | `--color-secondary` (Teal) | Progress bars, donut charts, sparklines, bar charts, swap bars |

**Rule:** Hero stat numbers are always gold. Charts and fills are always teal.

### Glow System

All hero numbers get `class="hero-glow"` — this provides a soft gold
drop-shadow that bleeds beyond the card boundary. No other glow classes.

Icons in the top-right corner automatically receive the glow through
`class="widget-icon"` — no extra work needed.

### No overflow: hidden on widget wrappers

Widget wrapper elements must NOT have `overflow: hidden`.
Only add `overflow: hidden` to specific chart/bar containers that need
content clipping (e.g., `.disk-bar-track`, `.net-chart`).

The two-layer WidgetCard architecture handles card clipping at the
inner wrapper level.

---

## 2. WidgetCard Props Reference

Every widget is rendered inside `<WidgetCard>` from `@phavo/ui`.
WidgetCard handles: background, border-radius, hover scale, drag handle
(WishStar), S/M/L resize controls, all 5 widget states.

| Prop | Type | Default | Description |
|---|---|---|---|
| `instanceId` | `string` | — | Required. The widget instance ID from the store. |
| `size` | `WidgetSize` | — | `'S' \| 'M' \| 'L' \| 'XL'` |
| `colSpan` | `number` | from size | Grid column span |
| `rowSpan` | `number` | from size | Grid row span |
| `availableSizes` | `WidgetSize[]` | — | Which sizes this widget supports. |
| `glowColor` | `'gold' \| 'teal'` | `'gold'` | Sets `--widget-glow` CSS variable. |
| `showControls` | `boolean` | `true` | Resize/remove buttons. Set `false` in Drawer & Settings. |
| `clipContent` | `boolean` | `true` | Clips overflow. Set `false` in Drawer for glow bleed. |
| `staggerIndex` | `number` | — | Entrance animation delay: `staggerIndex * 60ms`. |
| `loading` | `boolean` | `false` | Shows skeleton state. |
| `error` | `string \| null` | `null` | Shows error state with message. |
| `draggable` | `boolean` | `false` | Enables WishStar drag handle. |
| `onSizeChange` | `(size) => void` | — | Called when user clicks a resize button. |
| `onRemove` | `(id) => void` | — | Called when user removes the widget. |
| `onSwapDrop` | `(id) => void` | — | Called when another widget is dropped on this one. |
| `children` | `Snippet` | — | The widget content rendered inside the card. |

**`staggerIndex` usage:** When rendering multiple widgets in the BentoGrid,
pass `staggerIndex={i}` (loop index) for sequential card pop-in animation.
Each card delays by `staggerIndex * 60ms`.

Animation timing must use motion tokens from `packages/ui/src/theme.css`
(`--motion-micro`, `--motion-component`, `--motion-page`) instead of hardcoded values.

**Non-dashboard contexts:** Always pass `showControls={false} clipContent={false}`
when using WidgetCard outside the BentoGrid (e.g. WidgetDrawer previews, Settings).

**In +page.svelte, always pass:**
```svelte
<WidgetCard
  {instanceId}
  {size}
  glowColor="gold"
  availableSizes={def.sizes}
  loading={status === 'loading'}
  error={status === 'error' ? errorMessage : null}
  draggable={true}
  onSizeChange={(s) => widgetStore.resize(instanceId, s)}
  onRemove={(id) => widgetStore.remove(id)}
  onSwapDrop={(draggedId) => widgetStore.swap(instanceId, draggedId)}
>
  <YourWidget data={widgetData} {size} />
</WidgetCard>
```

---

## 3. Widget Component Structure

### Required props

Every widget component must accept exactly these props:

```typescript
interface Props {
  data: YourDataType | null;
  size: 'S' | 'M' | 'L' | 'XL';
}
```

### Size branch pattern

Use exclusive `{#if}/{:else if}/{:else}` blocks. Never CSS display:none.

> **Note:** XL exists in the `WidgetSize` type but is intentionally inactive —
> no widget currently registers it. Only implement S/M/L branches.

```svelte
{#if size === 'S'}
  <!-- Compact: category label + single stat only -->
{:else if size === 'M'}
  <!-- Standard: header + hero stat + one secondary element -->
{:else}
  <!-- L: Extended — header + hero stat + chart or list -->
{/if}
```

Each branch is completely self-contained. No shared markup between branches.

### L-size differentiation

L-size must have **meaningful content beyond M** — not just the same content in more space.
Examples of correct L-size differentiation:

| Widget | M-size | L-size (added content) |
|---|---|---|
| Network | Speed stat + single bar | Speed stat + bandwidth bars (upload/download) |
| Disk | Usage % + single progress | Usage % + per-mount breakdown list |
| Uptime | Single value + label | 4-column unit breakdown (days/hours/min/sec) |
| Temperature | CPU temp value | CPU temp + per-sensor list |

### Widget header (M/L only)

All M/L branches must start with a header:

```svelte
<div class="widget-header">
  <span class="widget-category-label">CATEGORY NAME</span>
  <Icon name="icon-name" size={18} class="widget-icon" />
</div>
```

`widget-category-label` and `widget-icon` are global utilities from
`theme.css`. Do NOT redeclare them in the widget's `<style>` block.

Category label is always ALL CAPS. It describes the data type, not the
widget name (e.g., "PROCESSOR UNIT", not "CPU Widget").

### Hero stat (M/L)

The primary value always gets `hero-glow` and gold color:

```svelte
<span class="your-hero-class hero-glow">
  {value}<span class="your-unit-class">unit</span>
</span>
```

```css
.your-hero-class {
  font-size: 72px;         /* M/L: 72px */
  font-weight: 700;
  color: var(--color-primary-fixed);   /* always gold */
  letter-spacing: -0.03em;
  line-height: 1;
}

.your-unit-class {
  font-size: 30px;
  font-weight: 300;
  color: var(--color-on-surface-variant);
}
```

### S-size stat

S-size shows only: category label + main stat. Nothing else.

```svelte
{#if size === 'S'}
<div class="widget-s">
  <span class="widget-category-label">CATEGORY</span>
  <span class="widget-s-value hero-glow">
    {value}<span class="widget-s-unit">unit</span>
  </span>
</div>
```

```css
.widget-s {
  display: flex;
  flex-direction: column;
  justify-content: center;
  height: 100%;
  padding: var(--space-4);
  gap: var(--space-1);
}

.widget-s-value {
  font-size: 32px;
  font-weight: 700;
  color: var(--color-primary-fixed);
  letter-spacing: -0.02em;
}

.widget-s-unit {
  font-size: 16px;
  font-weight: 300;
  color: var(--color-on-surface-variant);
}
```

### Data visualizations (bars, charts, donuts)

Always teal. Always `overflow: hidden` on the track/container only.

```css
/* Progress bar */
.progress-track {
  height: 6px;
  background: color-mix(in srgb, var(--color-primary) 5%, transparent);
  border-radius: 9999px;
  overflow: hidden;          /* ← overflow:hidden HERE, not on wrapper */
}

.progress-fill {
  height: 100%;
  background: linear-gradient(
    to right,
    var(--color-secondary),
    color-mix(in srgb, var(--color-secondary) 60%, var(--color-primary-fixed))
  );
  border-radius: 9999px;
}
```

### Metadata labels

```css
.widget-meta-label {
  /* Already defined globally in theme.css — do not redefine */
  /* font-size: 10px, font-weight: 700, uppercase, letter-spacing: 0.08em */
  /* color: var(--color-on-surface-variant) */
}
```

---

## 4. CSS Rules

### Tokens only — no hardcoded values

```css
/* ✅ */
color: var(--color-primary-fixed);
background: var(--color-surface-card);

/* ❌ */
color: #dcc66e;
background: #1b1f2c;
```

### No overflow: hidden on widget root or wrappers

```css
/* ✅ Only on specific chart containers */
.progress-track { overflow: hidden; }
.chart-container { overflow: hidden; }

/* ❌ Never on the widget root */
.my-widget { overflow: hidden; }
.my-widget-m { overflow: hidden; }
```

### Global utilities — do not redeclare in widgets

These classes are defined in `theme.css` and available everywhere.
Import by using the class name — no CSS needed in the widget:

```
.widget-category-label   — category text (PROCESSOR UNIT etc.)
.widget-header           — flex row for category + icon
.widget-icon             — top-right icon with gold glow
.widget-meta-label       — small uppercase data labels
.widget-meta-text        — small secondary text
.hero-glow               — gold drop-shadow filter on numbers
```

---

## 5. Icons

Always import from `@phavo/ui`, never from `lucide-svelte` directly:

```svelte
import { Icon } from '@phavo/ui';

<Icon name="cpu" size={18} class="widget-icon" />
```

Standard icon mapping (use these exact names):

| Widget | Icon name |
|---|---|
| CPU | `cpu` |
| Memory | `server` |
| Disk | `hard-drive` |
| Network | `activity` |
| Temperature | `thermometer` |
| Uptime | `clock` |
| Weather | `cloud` |
| Docker | `container` |
| Service Health | `shield` |
| Speedtest | `gauge` |
| Calendar | `calendar` |
| RSS | `rss` |
| Pi-hole | `shield` |
| Links | `link` |

---

## 6. Svelte 5 Runes

All widgets use Svelte 5 Runes. No legacy patterns.

```svelte
<script lang="ts">
  import { Icon } from '@phavo/ui';

  interface Props {
    data: MyDataType | null;
    size: 'S' | 'M' | 'L' | 'XL';
  }

  let { data, size }: Props = $props();

  // Derived values
  const primaryValue = $derived(data?.value ?? 0);
  const formattedValue = $derived(primaryValue.toFixed(1));

  // Side effects (use sparingly)
  $effect(() => {
    // e.g., history tracking
  });
</script>
```

**Never use:**
- `export let` (use `$props()`)
- `$:` reactive declarations (use `$derived()`)
- `writable()` stores (use `$state()`)
- `@ts-ignore`
- `console.log` in committed code

---

## 7. Widget Registry Entry

Every widget needs a registry entry in
`apps/web/src/lib/server/widget-registry.ts`:

```typescript
{
  id: 'my-widget',
  name: 'My Widget',
  description: 'What this widget shows',
  version: '1.0.0',
  author: 'phavo',
  category: 'system',           // 'system' | 'consumer' | 'integration' | 'utility'
  tier: 'stellar',              // 'stellar' | 'celestial' — NEVER 'free' or 'standard'
  sizes: ['S', 'M', 'L'],
  defaultSize: { w: 4, h: 3 }, // M size default
  dataEndpoint: '/api/v1/metrics/my-widget',
  refreshInterval: 3000,
  permissions: [],
}
```

---

## 8. Definition of Done for a New Widget

A widget is complete when ALL of these are true:

- [ ] `bun run typecheck` exits 0
- [ ] `bun run lint` exits 0
- [ ] S/M/L branches use `{#if}/{:else if}/{:else}` — no CSS display:none
- [ ] S branch shows only: category label + stat with `hero-glow`
- [ ] M/L branches have `.widget-header` with category label + `<Icon>`
- [ ] L-size has meaningful content differentiation from M (chart, list, or breakdown)
- [ ] Hero numbers use `color: var(--color-primary-fixed)` + `hero-glow` class
- [ ] Data visualizations use `color: var(--color-secondary)` (teal)
- [ ] No `overflow: hidden` on widget root or layout wrappers
- [ ] Zero hardcoded hex/rgb/rgba values
- [ ] No legacy Svelte patterns (`export let`, `$:`, `writable()`)
- [ ] Registry entry added with correct `tier` ('stellar' or 'celestial')
- [ ] No XL in `availableSizes` array (reserved, inactive)
- [ ] Registered in `+page.svelte` widget render switch

**Widget template:** `apps/web/src/lib/widgets/_widget-template.svelte`
**Config schemas:** `apps/web/src/lib/widgets/config-schemas.ts` — shared Zod schemas for widget configuration
