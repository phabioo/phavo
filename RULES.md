# PHAVO — RULES.md (Updated)

## Core Principle

PHAVO is a **product-grade UI**, not a prototype.

Every change must:
- improve clarity
- improve consistency
- align with PHAVO design system

---

## 1. No Micro-Tuning When Broken

If something is visually wrong:
❌ do NOT tweak values endlessly  
✅ REBUILD the composition

---

## 2. No Generic UI

Avoid:
- default inputs
- generic layouts
- “admin dashboard” look

Everything must feel PHAVO-native.

---

## 3. Single Source of Truth

- Sidebar = navigation
- Widgets = content units
- Tokens = design system

Do NOT duplicate systems.

---

## 4. Widget Rules

- Widgets are always presentational
- No self-fetching
- Sizes must be respected (S/M/L/XL)

Widget tray:
- ONLY S-size previews
- grid-based
- dense and structured

---

## 5. Layout Rules

- No hidden elements affecting layout
- No ghost columns
- No overflow bugs

If overflow exists:
👉 find root cause, do NOT mask it

---

## 6. Header Rules

- Must feel like overlay, not a bar
- Right side = structured cluster
- No floating elements

---

## 7. Settings Rules

- No plain text pages
- Everything must be card/surface-based
- Consistent typography hierarchy
- Buttons must follow PHAVO design

---

## 8. Visual Consistency

All components must share:
- radius system
- spacing system
- color tokens
- typography

No exceptions.

---

## 9. Anti-Patterns

Never:

- “fix” UI with overflow hidden
- scale broken components instead of fixing them
- mix multiple UI paradigms
- introduce new libraries without decision
- leave partial implementations

---

## 10. Definition of Done

A task is complete ONLY if:

- visual issue is gone
- layout is stable
- design is consistent
- no regressions introduced

“Improved” is NOT enough.

It must be:
- fixed
- rebuilt
- correct
