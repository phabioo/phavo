# PHAVO — CONTEXT.md (Updated)

## Current State

PHAVO is in late M4 phase (UI completion + stabilization).

Completed:
- Core dashboard system
- Widget system + registry
- API + backend architecture
- Tailwind v4 + token system
- Sidebar navigation (migrated from tabs)
- Bottom widget tray (in progress refinement)

Recent Fix Phases:
- M4-Fix-A → Dashboard parity
- M4-Fix-B → Navigation + drawer + sidebar state
- M4-Fix-C → Layout + settings integration
- M4-Fix-D → Visual cohesion + widget tray direction
- M4-Fix-E → Shell cleanup + settings completion
- M4-Fix-F → Density + header polish
- M4-Fix-G → Hard visual correction (current phase)

## Current Focus

The project is now in:
👉 **Final visual + UX consolidation phase**

Remaining work is NOT architectural.
It is:
- visual consistency
- component system alignment
- layout correctness
- interaction polish

## Key UI Principles

- Black / amber design language
- Clean, dense, premium dashboard feel
- No generic UI (no “default web app look”)
- Consistent surfaces (cards everywhere)
- Sidebar-driven navigation (no duplicate navigation systems)

## Widget Philosophy

- Widgets are the core product unit
- Dashboard = composition of widgets
- Widget Tray = staging area for widgets (NOT picker list)

## Widget Tray (Important)

The widget tray:
- opens from bottom
- is a **large surface**
- contains **small widget previews (S-size only)**
- acts as **placement source**, not a menu

## Settings Philosophy

Settings are:
- NOT plain forms
- built using the same surface system as widgets
- visually consistent with dashboard

Each section:
- card-based
- structured
- component-driven

## Navigation Model

Sidebar is the single source of truth.

Structure:
- Dashboard
- Dashboard pages
- General
- Widgets
- Backup & Export
- Licence
- Account
- Plugins
- About

No nested settings navigation duplication.

## Known Problem Areas (Current)

- Widget tray density + structure
- Header right cluster composition
- Overflow edge cases
- Topbar blending
- Settings component consistency

## Development Priority

1. Fix visual correctness (not just code correctness)
2. Remove inconsistencies
3. Ensure component reuse
4. Avoid introducing new systems

