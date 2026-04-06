# PHAVO — M4-Fix-H1c: Tray Insets, Header Layout Isolation, and Small-Window Responsiveness (GPT-5.4 Version)

Read before coding:
- CONTEXT.md
- RULES.md
- docs/phavo_PRD_v3.2.md
- docs/phavo_arch_spec_v2.1.html

---

## Scope

This is a **small H1c follow-up pass**.

Do NOT touch settings rewrite work here.  
Do NOT redesign the dashboard.  
Do NOT introduce new libraries.

Only fix these remaining issues:

1. widget tray still visually closes flush to the left and right instead of keeping proper canvas gutters
2. widget tiles still overflow below the tray frame
3. search dropdown now opens correctly, but causes the other topbar pills to shift downward
4. in smaller window sizes, the bottom/mobile navigation only shows some items and hides the rest
5. in smaller window sizes, the topbar pills break the intended visual layout

---

## Intent

This is a **targeted responsive shell/layout correction pass**.

The remaining issues are not architecture problems.  
They are composition and responsive layout problems.

Fix them cleanly and minimally.

---

## 1. Widget Tray Must Keep Proper Left AND Right Gutters

### Problem
The tray is no longer touching the sidebar directly, but it still visually closes too tightly to the left and right edges of the canvas.

### Required
On desktop:
- tray must be inset from the left by sidebar width + visible canvas gutter
- tray must also keep a clear right gutter
- tray should visually align with the main dashboard canvas, not span edge-to-edge

### Important
This is not just a left-offset problem.
The tray needs a balanced inset composition.

### Acceptance
At normal desktop widths, the tray has clear left and right breathing room and looks anchored to the same content canvas as the dashboard.

---

## 2. Tray Body Must Fully Contain the Bottom Row of Tiles

### Problem
Tiles still fall out of the tray at the bottom.

### Required
- tray body height must be correctly bounded
- tray inner scroll area must fully contain all preview rows
- bottom row must stay inside tray frame
- there must be enough bottom padding for the last row and any shadow/border treatment
- tile/grid sizing must be corrected rather than hiding overflow

### Acceptance
No tile visually crosses the bottom border of the tray.
The final visible row remains fully contained inside the tray surface.

---

## 3. Search Dropdown Must Be Layout-Isolated from the Other Header Pills

### Problem
The search bar/dropdown now opens as one connected surface, but the other pills in the topbar move down with it, which breaks the visual concept.

### Required
The search open/dropdown behavior must be layout-isolated.

This means:
- the dropdown must behave like an overlay or absolutely-positioned extension of the search control
- it must NOT push or pull the other header pills vertically
- the time/weather/Add Widget/Alerts cluster must stay on its baseline and remain visually stable

### Important
Do not undo the connected-surface fix.
Keep the search + dropdown visually connected, but prevent sibling layout reflow.

### Acceptance
Opening search does not move the other topbar pills.

---

## 4. Small-Window / Mobile Nav Must Expose All Items

### Problem
When the window is small and the nav collapses to the bottom/mobile pattern, only four items are visible and the remaining items are inaccessible.

### Required
All nav destinations must remain reachable at smaller widths.

Valid solutions:
- horizontally scrollable bottom nav
- a compact overflow pattern
- another repo-consistent responsive solution

### Rules
- do not remove destinations
- do not create dead/inaccessible navigation items
- preserve current route behavior

### Acceptance
At smaller window sizes, all nav items can still be accessed.

---

## 5. Small-Window Header Layout Must Have a Dedicated Compact Mode

### Problem
At smaller window sizes, the header pills become awkwardly arranged and break the intended PHAVO visual structure.

### Required
Introduce a cleaner responsive header mode for smaller widths.

Possible approach:
- search occupies full/first row
- status/action pills form a stable compact secondary row
- or another PHAVO-consistent compact layout

### Requirements
- pills remain aligned and intentional
- no awkward wrapping that looks broken
- time/weather/Add Widget/Alerts still feel like one coherent group
- search remains readable and usable

### Important
This is not just a spacing tweak.
Treat smaller window width as a distinct layout mode.

### Acceptance
At smaller desktop widths, the header still looks deliberate and premium, not broken.

---

## Explicitly Out of Scope

Do NOT:
- rewrite settings pages here
- change tray data logic again unless necessary for layout
- redesign navigation IA
- redesign notifications
- introduce new libraries
- do broad unrelated refactors

---

## Likely Files

Modify only what is necessary. Likely files include:
- `packages/ui/src/components/WidgetDrawer.svelte`
- `packages/ui/src/components/Header.svelte`
- `packages/ui/src/components/HeaderSearch.svelte`
- `apps/web/src/routes/+layout.svelte`
- any small nav/shell component already responsible for responsive bottom navigation

---

## Execution Order

### Phase 1 — Tray geometry correction
- fix left and right tray gutters
- fix bottom-row containment

### Phase 2 — Header layout isolation
- keep search connected to dropdown
- prevent sibling pill movement
- define smaller-window compact header mode

### Phase 3 — Small-window nav access
- make all nav items reachable in bottom/mobile nav

### Phase 4 — Validation
- test normal desktop width
- test smaller desktop width
- open/close search
- open tray
- verify bottom/mobile nav access
- typecheck
- lint

---

## Acceptance Criteria

### Tray
- clear left and right desktop gutters
- bottom row fully contained
- tray still feels like PHAVO bottom surface

### Header
- opening search does not move the other pills
- smaller-width header remains clean and intentional
- pills do not break visual rhythm

### Navigation
- all items remain accessible in smaller-width bottom/mobile nav
- no dead/missing destinations

### Technical
- no settings rewrite from this prompt
- no regressions in tray preview behavior
- no new architecture introduced

---

## Validation

Run:
```bash
bun run typecheck
bun run lint
```

Clearly distinguish:
- new issues introduced by this patch
- pre-existing unrelated repo issues

Also manually verify:
- normal desktop width
- smaller desktop width
- search open/close
- tray open/close
- bottom/mobile nav with all destinations

---

## Deliverables

Provide:
1. files changed
2. what was fixed
3. how bottom/mobile nav access is now handled
4. validation results

Be concise and concrete.
