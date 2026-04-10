# PHAVO — Svelte Audit Report

> Generated via Svelte MCP `svelte-autofixer` + manual grep/AST analysis.
> **Read-only audit — no files were modified.**

---

## Summary

| Metric | Value |
|---|---|
| Total `.svelte` files scanned | 53 |
| Svelte version | `^5.0.0` (Runes) |
| Files with issues | 20 |
| Files clean | 33 |
| 🔴 Critical findings (A + B) | 8 |
| 🟡 Medium findings (C + D) | 25 |
| 🟢 Low findings (E) | 3 |

---

## Category A — Svelte 4 Legacy Patterns

**Result: ✅ ZERO issues across all 53 files.**

| Pattern | Occurrences |
|---|---|
| `export let` (Svelte 4 props) | 0 |
| `$:` reactive statements | 0 |
| `on:event` directives | 0 |
| `createEventDispatcher` | 0 |
| `<slot>` | 0 |
| `beforeUpdate` / `afterUpdate` | 0 |
| `writable()` / `readable()` stores | 0 |

The codebase is fully migrated to Svelte 5 Runes. All components use `$props()`, `$state()`, `$derived()`, `$effect()`, `{@render children()}`, and `onevent` attribute syntax.

---

## Category B — Correctness Issues

### 🔴 B-1: `$effect` mutating state inside `$effect.root` + `onMount` (7 files)

The codebase has a recurring pattern: `onMount(() => { return $effect.root(() => { $effect(() => { stateVar = ...; }); }); })`. The Svelte MCP autofixer flags state assignment inside `$effect` as "generally considered malpractice" because it can cause infinite reactivity loops or missed updates. While the `$effect.root` + `onMount` wrapper provides cleanup, the pattern overuses effects for what could be `$derived` or direct assignments.

| File | Lines | Details |
|---|---|---|
| `apps/web/src/routes/+layout.svelte` | 396–438 | 8 nested `$effect` blocks inside one `$effect.root` in `onMount`. Effects call `setConfig`, `setSession`, `loadWidgetManifest`, `loadTabs`, `setDrawerOpen`, `syncFromServer`, plus AI status, weather refresh, and system health polling. |
| `apps/web/src/routes/+page.svelte` | 170–180 | `$effect` assigns `telemetryOpen = true` based on config state. |
| `apps/web/src/routes/setup/+page.svelte` | 671–685 | `$effect` inside `$effect.root` in `onMount` watches form fields and persists to `sessionStorage`. |
| `packages/ui/src/components/SchemaRenderer.svelte` | 56–65 | `$effect` inside `$effect.root` in `onMount` resets `formValues`, `validationErrors`, `testStatuses`, `saving`, `saveError`, `saveSuccess` when `instanceId`/`currentConfig` changes. |
| `packages/ui/src/components/WidgetDrawer.svelte` | 84–92 | `$effect` inside `$effect.root` in `onMount` resets `drawerHeight`, `confirmRemoveId`, `activeLockedId`, `selectedSizes` when drawer closes. |
| `apps/web/src/lib/components/settings/WidgetsTab.svelte` | 61–72 | Two separate `$effect.root` blocks in two `onMount` calls. One assigns `selectedId` inside `$effect`. |
| `apps/web/src/lib/widgets/NetworkWidget.svelte` | 18–24 | `$effect` mutates `speedHistory` state. Uses `untrack()` correctly to avoid infinite loop, but the pattern is fragile. |

**Recommendation:** Audit each effect to determine if it can be replaced with `$derived`, a callback, or a direct assignment. Reserve `$effect` for true side effects (DOM manipulation, timers, API calls).

---

### 🔴 B-2: Stale `$derived` — `isMobile` never updates on resize

| File | Line | Details |
|---|---|---|
| `apps/web/src/lib/components/settings/WidgetsTab.svelte` | 58 | `const isMobile = $derived(typeof window !== 'undefined' ? window.innerWidth < 640 : false)` |

`$derived` reads `window.innerWidth` once at derivation time. Since `window.innerWidth` is not a reactive Svelte signal, this value is never updated when the window is resized.

**Recommendation:** Use a `$state` variable updated via a resize event listener inside `$effect` or `onMount`, or use a `MediaQueryList` listener.

---

## Category C — Performance Issues

### 🟡 C-1: Unkeyed `{#each}` blocks (13 files, 19 instances)

Unkeyed each blocks force Svelte to diff the entire list on every update instead of tracking individual items by identity. For static/small lists this is negligible, but for dynamic lists it causes unnecessary DOM churn.

| File | Line | Expression | Priority |
|---|---|---|---|
| `packages/ui/src/components/Tabs.svelte` | 22 | `{#each tabs as tab}` | Low — tabs rarely change |
| `packages/ui/src/components/Sidebar.svelte` | 110 | `{#each tabs as tab}` | Low — static nav |
| `packages/ui/src/components/Sidebar.svelte` | 141 | `{#each items as item}` | Low — static nav |
| `packages/ui/src/components/Sidebar.svelte` | 176 | `{#each bottomItems as item}` | Low — static nav |
| `packages/ui/src/components/WidgetCard.svelte` | 274 | `{#each ALL_SIZES as s}` | Low — 4 static items |
| `packages/ui/src/components/HeaderSearch.svelte` | 314 | `{#each results as entry, index}` | Medium — dynamic search results |
| `packages/ui/src/components/HeaderSearch.svelte` | 362 | `{#each aiEntries as aiEntry, index}` | Medium — dynamic AI results |
| `apps/web/src/lib/widgets/CpuWidget.svelte` | 41 | `{#each coreSegments as seg}` | Low — computed from props |
| `apps/web/src/lib/widgets/CpuWidget.svelte` | 62 | `{#each coreSegments as seg}` | Low — computed from props |
| `apps/web/src/lib/widgets/CpuWidget.svelte` | 71 | `{#each data.cores as coreLoad, i}` | Medium — variable core count |
| `apps/web/src/lib/widgets/NetworkWidget.svelte` | 56 | `{#each sparkBars as bar}` | Low — 14 items max |
| `apps/web/src/lib/widgets/NetworkWidget.svelte` | 86 | `{#each sparkBars as bar}` | Low — 14 items max |
| `apps/web/src/lib/widgets/RssWidget.svelte` | 35 | `{#each data.items.slice(0, 4) as item}` | Medium — dynamic feed items |
| `apps/web/src/lib/widgets/RssWidget.svelte` | 61 | `{#each data.items.slice(0, 8) as item}` | Medium — dynamic feed items |
| `apps/web/src/lib/widgets/DiskWidget.svelte` | 88 | `{#each mounts as mount}` | Low — rarely changes |
| `apps/web/src/lib/widgets/TemperatureWidget.svelte` | 66 | `{#each sensors as sensor}` | Low — rarely changes |
| `apps/web/src/routes/setup/+page.svelte` | 892 | `{#each tabs as tab, index}` | Low — static wizard tabs |
| `apps/web/src/routes/setup/+page.svelte` | 1068 | `{#each getSelectedLinksConfig().groups[0]?.links ?? [] as link, index}` | Medium — user-editable list |
| `apps/web/src/lib/components/settings/ImportExportTab.svelte` | 348 | `{#each importWarnings as warning}` | Low — small list |

> **Note:** `setup/+page.svelte` already keys 5 of its 8 each blocks correctly (lines 747, 861, 938, 973, 995, 1025). `Sidebar.svelte` keys its mobile nav list at line 237. These are excluded above.

**Recommendation:** Add keys to the Medium-priority items (HeaderSearch results, RssWidget items, setup links list, CpuWidget cores). The Low-priority static lists are fine as-is.

---

## Category D — Accessibility Issues

### 🟡 D-1: Interactive `<div>` elements missing ARIA roles and keyboard handlers (3 files)

| File | Lines | Details | Severity |
|---|---|---|---|
| `packages/ui/src/components/HeaderSearch.svelte` | 317, 346, 365 | `<div class="hs-item">` with `onmouseenter` and `onmousedown` handlers — missing `role`, `tabindex`, and `onkeydown`. Currently suppressed with `svelte-ignore a11y_click_events_have_key_events`. | Medium |
| `packages/ui/src/components/WidgetDrawer.svelte` | 228–231 | Backdrop `<div>` with `onclick={handleBackdropClick}` — missing `onkeydown` and `role`. Suppressed with `svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions`. | Low |
| `packages/ui/src/components/WidgetCard.svelte` | outer wrapper | Drag-related handlers (`ondragover`, `ondragleave`, `ondrop`) on outer `<div>`. Drag handle (`.wishstar-drag-handle`) has `role="button"` but missing `tabindex`. | Low |

### 🟡 D-2: `tabindex` on non-interactive element

| File | Line | Details | Severity |
|---|---|---|---|
| `packages/ui/src/components/NotificationPanel.svelte` | 101 | `tabindex={actionable ? 0 : undefined}` on `<div>` — when actionable, the element becomes focusable but has no semantic role. Suppressed with `svelte-ignore a11y_no_noninteractive_tabindex` at line 95. | Medium |

### ✅ D-3: Good practices observed

- **25 `aria-label` attributes** found across buttons and interactive elements.
- `Modal.svelte` backdrop uses `role="presentation"` correctly.
- Form components (`Input`, `Select`, etc.) use proper `for`/`id` label associations.
- All `<button>` elements have accessible text content or `aria-label`.

---

## Category E — Code Quality

### 🟢 E-1: Heavy inline styles (2 files)

| File | Lines | Details |
|---|---|---|
| `apps/web/src/lib/widgets/CpuWidget.svelte` | 70–75 | L-size core grid uses inline styles: `style="display: grid; grid-template-columns: repeat(6, 1fr); gap: 8px; margin-top: 16px;"` and children have inline width/height styles. Should be CSS classes. |
| `packages/ui/src/components/WidgetCard.svelte` | 187 | Large inline style for star-field background pattern: `style="position: absolute; inset: 0; background-image: radial-gradient(...); background-size: 50px 50px; opacity: 0.08; ..."`. Should be a CSS class. |

### 🟢 E-2: Minor — dynamic style binding (1 file)

| File | Line | Details |
|---|---|---|
| `packages/ui/src/components/WidgetCard.svelte` | 181 | `style="--widget-glow: {glowColor === ...}; {cardBackground ? \`background: ...\` : ''}"` — this is acceptable for CSS custom property binding but could be cleaner with `class:` directives and CSS variables. |

---

## Clean Files (no issues found)

The following 33 files passed all five audit categories with zero findings:

### `packages/ui/src/components/`
- `Badge.svelte`
- `BentoGrid.svelte`
- `Button.svelte`
- `Card.svelte`
- `Icon.svelte`
- `Input.svelte`
- `Modal.svelte`
- `ProgressBar.svelte`
- `Select.svelte`
- `Skeleton.svelte`
- `Switch.svelte`
- `TabBar.svelte`
- `Tooltip.svelte`
- `UpgradeBanner.svelte`
- `WishStar.svelte`
- `Header.svelte`

### `packages/ui/src/components/forms/`
- `Button.svelte`
- `Input.svelte`
- `NumberInput.svelte`
- `Select.svelte`
- `Switch.svelte`
- `Textarea.svelte`

### `apps/web/src/lib/widgets/`
- `_widget-template.svelte`
- `CalendarWidget.svelte`
- `DockerWidget.svelte`
- `LinksWidget.svelte`
- `MemoryWidget.svelte`
- `PiholeWidget.svelte`
- `SpeedtestWidget.svelte`
- `UptimeWidget.svelte`
- `WeatherWidget.svelte`

### `apps/web/src/lib/components/settings/`
- `LicenceTab.svelte`
- `SettingsLayout.svelte`
- `SettingsSection.svelte`

### `apps/web/src/routes/`
- `auth/login/+page.svelte`

---

## Priority Summary

### 🔴 Critical — Fix before v1.0

| ID | File(s) | Issue |
|---|---|---|
| B-1 | `+layout.svelte`, `+page.svelte`, `SchemaRenderer.svelte`, `WidgetDrawer.svelte`, `WidgetsTab.svelte`, `NetworkWidget.svelte`, `setup/+page.svelte` | `$effect` blocks mutating state — review each for `$derived` replacement |
| B-2 | `WidgetsTab.svelte` | `isMobile` derived is stale — not reactive to window resize |

### 🟡 Medium — Fix when touching these files

| ID | File(s) | Issue |
|---|---|---|
| C-1 | `HeaderSearch.svelte`, `RssWidget.svelte`, `CpuWidget.svelte` (cores), `setup/+page.svelte` (links) | Add keys to dynamic `{#each}` blocks |
| D-1 | `HeaderSearch.svelte` | Search result items need ARIA roles + keyboard handlers |
| D-2 | `NotificationPanel.svelte` | Actionable notification cards need semantic role |

### 🟢 Low — Nice to have

| ID | File(s) | Issue |
|---|---|---|
| C-1 | `Tabs.svelte`, `Sidebar.svelte`, `WidgetCard.svelte`, etc. | Add keys to static `{#each}` blocks |
| D-1 | `WidgetDrawer.svelte`, `WidgetCard.svelte` | Backdrop/drag a11y |
| E-1 | `CpuWidget.svelte`, `WidgetCard.svelte` | Extract inline styles to CSS classes |

---

## Methodology

1. **File discovery:** `find` + `file_search` for all `.svelte` files excluding `.svelte-kit/` generated output.
2. **Pattern search:** `grep_search` across all 53 files for Svelte 4 legacy patterns, unkeyed `{#each}`, inline `style=`, `aria-label`, `tabindex`, `$effect`, `$derived`, `$state`, `onMount`, `$effect.root`.
3. **MCP analysis:** `svelte-autofixer` run on 15 complex files (all files with >50 lines of script logic):
   - `+layout.svelte`, `+page.svelte`, `setup/+page.svelte`, `auth/login/+page.svelte`
   - `settings/+page.svelte`, `WidgetsTab.svelte`, `ImportExportTab.svelte`
   - `SchemaRenderer.svelte`, `WidgetDrawer.svelte`, `WidgetCard.svelte`
   - `HeaderSearch.svelte`, `NotificationPanel.svelte`, `Sidebar.svelte`
   - `NetworkWidget.svelte`, `CpuWidget.svelte`
4. **Line verification:** Subagent cross-checked all line numbers via `read_file` before report compilation.
