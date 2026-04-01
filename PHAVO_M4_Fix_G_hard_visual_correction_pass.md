# PHAVO — M4-Fix-G: Hard Visual Correction Pass (DO NOT MICRO-TUNE)

Read before coding:
- CONTEXT.md
- RULES.md
- docs/phavo_PRD_v3.2.md
- docs/phavo_arch_spec_v2.1.html

---

## Intent (CRITICAL)

This is NOT a polish pass.

This is a **visual correction pass**.

Several issues were already “adjusted” in the previous iteration but are still clearly visible in the UI.

You must:
- fix them **visually and structurally**
- not just tweak values (padding, opacity, radius, etc.)

If a problem is still visible after a small adjustment →  
**REPLACE THE COMPOSITION instead of tuning it again.**

---

## Ground Truth

Treat the provided screenshots as **source of truth**.

A fix is ONLY valid if:
- the visual issue is no longer observable
- not just “technically improved”

---

## HARD RULES

- Do NOT stop at small CSS tweaks if the issue persists
- Do NOT rely on `overflow: hidden` as a primary fix
- Do NOT just scale things down (e.g. tray) — restructure them
- Do NOT claim a fix without eliminating the visual symptom
- Do NOT keep broken layouts and “massage” them

---

# 1. Widget Tray — MUST BE RECOMPOSED (NOT SCALED)

### Problem
Tray still looks like:
- a compressed dashboard
- overcrowded
- visually chaotic

### Required (NON-NEGOTIABLE)
Rebuild the tray layout:

- Tray = **distinct surface layer**
- Inside = **structured grid of S-size widget tiles**
- NOT a scaled version of dashboard cards

### Implementation expectations

- Define a **fixed preview tile component** (S-size only)
- Enforce:
  - uniform height
  - uniform padding
  - uniform typography scale
- Grid:
  - dense
  - aligned
  - predictable columns
- No mixed sizes
- No leftover layout logic from dashboard cards

### End state

Tray must look like:
- a clean widget library grid
- not like a broken dashboard clone

If current implementation fights you → replace it.

---

# 2. Header Right Cluster — MUST BE REBUILT

### Problem
Still feels unstructured and visually loose.

### Required

Recompose the entire right cluster:

Order:
1. time
2. weather
3. Add Widget
4. bell

### Requirements

- consistent vertical alignment
- consistent spacing system
- unified visual weight
- no floating / misaligned elements

### Important

This is not spacing tuning.

If needed:
→ wrap in a dedicated layout container and rebuild alignment.

---

# 3. Search Bar — FULL COMPONENT ALIGNMENT

### Problem
Now pill-shaped, but still not fully integrated.

### Required

Search must behave like a **first-class PHAVO control**:

- same visual language as Add Widget
- same density
- same border logic
- same interaction feel

If current component cannot reach this → refactor it.

---

# 4. Overflow Bug — ROOT CAUSE FIX (MANDATORY)

### Problem
Right scrollbar still appears in smaller window sizes.

### Required

You MUST:
1. identify the exact element causing overflow
2. explain it briefly (in summary)
3. fix it at the source

### Forbidden

- blind `overflow-x: hidden`
- max-width hacks without understanding cause

### Acceptance

- no horizontal scrollbar at any normal desktop width
- layout remains stable

---

# 5. Topbar Edge — MUST DISAPPEAR VISUALLY

### Problem
Topbar still has a visible boundary.

### Required

Topbar must:
- blend into background
- feel like a soft overlay
- NOT read as a hard strip

### If gradients are insufficient:
→ adjust layering strategy, not just opacity

---

# 6. Settings Pages — COMPONENT SYSTEM FIX (NOT COSMETIC)

### Problem
Still feels like:
- text inside cards
- inconsistent UI system
- partial PHAVO styling

### Required

Rebuild settings sections as **real UI components**:

Each section must have:
- proper card structure
- internal spacing system
- clear hierarchy:
  - title
  - description
  - content
  - actions

### Buttons

- must match PHAVO button system exactly
- no generic button styling

### Text

- consistent hierarchy across ALL pages
- no raw/plain text blocks

### If needed:
→ create shared settings components instead of patching each page

---

# 7. Sidebar — VERIFY, NOT ASSUME

Required order:

1. Dashboard
2. General
3. Widgets
4. Backup & Export
5. Licence
6. Account
7. Plugins
8. About

If already correct:
→ leave unchanged

If not:
→ fix

---

# Execution Strategy (MANDATORY)

You must follow this order:

### Phase 1 — Tray rebuild
### Phase 2 — Header reconstruction
### Phase 3 — Overflow root fix
### Phase 4 — Topbar blending
### Phase 5 — Settings component system
### Phase 6 — Validation

---

# Validation (STRICT)

Run:
```bash
bun run typecheck
bun run lint
```

Then verify:

- no horizontal scrollbars
- tray visually clean and grid-based
- header cluster aligned and readable
- topbar edge not visible
- settings pages consistent and component-driven

---

# Output Requirements

Provide:

1. Files changed
2. What was REBUILT vs what was adjusted
3. Root cause of overflow
4. Confirmation of each acceptance criterion

Be explicit.

Do NOT say “improved”.

Say:
- fixed
- replaced
- rebuilt

---

# Final Reminder

If a visual issue is still visible:
→ the task is NOT complete

Do not stop at partial improvements.
