# Changelog

## [0.8.5] - 2026-04-14

### Infrastructure

- **Docker workflow secret names corrected** — renamed `DOCKERHUB_USERNAME`/`DOCKERHUB_TOKEN` to `DOCKER_HUB_USERNAME`/`DOCKER_HUB_TOKEN` to match the configured repository secrets
- **Release workflow permissions fixed** — added `permissions: contents: write` so `softprops/action-gh-release` can create releases without a 403 error

---

## [0.8.4] - 2026-04-14

### Bug Fixes

- **Setup registration fixed** — first-run setup now calls `POST /api/v1/auth/register` (new endpoint) instead of `/auth/login`. Register is public, first-run-only (returns 403 if any user already exists), creates the user + session in one request
- **DB migration crash on fresh install fixed** — replaced Drizzle's built-in `migrate()` with a custom `runMigrations()` that uses `client.executeMultiple()` (`db.exec()` path), bypassing a bug in `@libsql/client` where DDL statements incorrectly return `SQLITE_OK` through the prepare→run path
- **Migration 0005 `RENAME TO` fixed** — replaced all `ALTER TABLE … RENAME TO` statements with DROP/CREATE/INSERT/DROP patterns to avoid the libsql DDL error on fresh installs
- **Login/register response shape fixed** — success responses now return `ok({})` instead of `ok(null)`, preventing a `TypeError` in the client that caused a spurious "network error" and triggered the user-already-exists guard on retry
- **`@tailwindcss/vite` "Invalid declaration" overlay fixed** — configured the Tailwind generate plugins in `vite.config.ts` to skip Svelte component `<style>` blocks (`?svelte&type=style&lang.css`). The scanner was tokenising TypeScript type-import identifiers (e.g. `UptimeMetrics`, `WidgetSize`) as CSS class candidates

### Infrastructure

- Upgrade `@libsql/client` to `^0.15.0`
- Add `drizzle-orm` workspace override (`0.45.1`) to prevent duplicate package instances from conflicting type definitions
- Dev data directory corrected: `PHAVO_DATA_DIR=./data` resolves to `apps/web/data` when using `--cwd apps/web` (was double-nesting to `apps/web/apps/web/.dev-data`)

---

## [0.8.3] - 2026-04-12

### Repository & Open-Source Cleanup

- Migrate repository to `github.com/phabioo/phavo`
- Update copyright from Fabio to phabioo across source files
- Update `.gitignore` and `.dockerignore` for public release (exclude AI planning artifacts, screenshots, generated folders)
- Update vulnerability reporting instructions in `SECURITY.md`
- Update all links in `README.md` to point to the new repository

---

## [0.8.2] - 2026-04-12

### Docs & Release Hygiene

- Ignore AI planning and screenshot artifact folders under `docs/` in both `.gitignore` and `.dockerignore`
- Bump workspace and runtime version references to `0.8.2`
- Preserve `Celestial Edition` as UI naming while keeping the repo aligned to the MIT single-edition model

## [0.8.1] - 2026-04-11

### Performance & Infrastructure

- Pi 3/4 GPU fallbacks across all `@phavo/ui` components: `backdrop-filter`, `will-change`, hover scale transforms, and ambient blur glows disabled via `@media (max-resolution: 1.5dppx)`
- Core metrics polling intervals doubled (CPU/Memory/Disk/Network 5s→10s, Temperature 10s→15s)
- Widget polling start staggered (1500ms × index) to spread server CPU load on boot
- Agent response cache capped at 200 entries; rate-limiter bucket map capped at 500 entries
- Sidebar `font-weight` reduced from 900 to 700 (eliminates unused font variant)
- Dockerfile: production `node_modules` pruned after build; add `.dockerignore`; remove unused `EXPOSE 3443`
- `docker-compose.yml`: remove unimplemented `PHAVO_TLS_MODE`/`PHAVO_DOMAIN` vars
- Docs: Pi fallback rule expanded in `rules.md`; archspec polling pattern updated; `CLAUDE.md` aligned

## [0.8.0] - 2026-04-10

### Major Changes

#### Authentication & Licensing
- **BREAKING:** Migrate from phavo.net OAuth to local-only authentication (username + password)
- Implement offline Ed25519 signature verification for Celestial tier licenses
- Remove all phavo.net account backend dependencies
- authMode enum now only accepts 'local' (phavo-net removed)
- Add server startup re-verification of stored license keys

#### Database Migrations
- **0005_local_auth_offline_license.sql:** Clean legacy auth modes, restructure license_activation table
- **0006_plugin_data.sql:** Add plugin_data table for widget persistent storage

#### Server Infrastructure
- Add Gumroad webhook handler for purchase automation and license key delivery
- Implement Ed25519 license key generator (generateLicenseKey utility)
- Add provider abstraction for AI SDK (createOllama, createOpenAI, createAnthropic)
- Expand notification routes (create, bulk operations, mute, delete)

### UI/UX Improvements
- Add tertiary button variant (text-only minimal style) - replaces ghost buttons
- Simplify setup flow: remove OAuth choice, consolidate to local auth only
- Update tier messaging throughout: Stellar (free) / Celestial (paid)
- BentoGrid responsive improvements: 6-col tablet (640px+), 12-col desktop (1024px+)
- Fix glassmorphism fallback for Raspberry Pi 3/4
- Standardize motion tokens across all transitions (60ms stagger for widget entrance)

### Accessibility
- NotificationPanel: Add actionable cards with keyboard support (Enter/Space)
- HeaderSearch: Convert search results to semantic buttons with proper roles
- Input/Select/Switch: Improve ARIA labels, error messaging, focus states
- Sidebar: Refactor page deletion affordances with better keyboard navigation

### Component Standardization
- Remove all hardcoded hex/rgb/hsl color values - use CSS tokens only
- Button component: primary pill, secondary ghost, tertiary text-only variants
- Update all color references to use theme tokens (--color-primary, --color-error, etc.)

### Widget System
- Add config-schemas.ts: Centralized Zod schemas for Pi-hole, RSS, Links, Docker, etc.
- Add widget-rendering.ts: Component registry, heading presets, icon mapping
- Update all 14 widgets to use configuration schemas and theme tokens

### AI Integration Foundation (Celestial Tier)
- Add dependencies: ai, @ai-sdk/openai, @ai-sdk/anthropic, ollama-ai-provider
- Prepare streaming endpoint POST /api/v1/ai/chat via Hono SSE
- Store AI provider API keys encrypted in credentials table
- Support for Ollama (local), OpenAI, Anthropic, and custom providers

### Documentation
- **archspec.html:** Update to v3.2 - document AI SDK integration, clarify local-only auth
- **design.md:** Update to v2.1 - add header scroll-state styling, motion token rules
- **prd.md:** Update to v4.1 - clarify local runtime, add AI assistant details
- **roadmap.html:** Update progress to ~82% - mark MA complete, MB in progress
- **rules.md:** Add AI SDK rules, clarify network boundaries, add source of truth section
- **widget-guide.md:** Document motion token usage, WidgetCard behavior updates
- **dev-commands.md:** Add Windows PowerShell/CMD variants, Gumroad webhook setup
- **NEW svelte-audit.md:** Comprehensive audit of 53 Svelte files with findings and recommendations

### Dependencies
- Add: ai ^6.0.156, @ai-sdk/openai, @ai-sdk/anthropic, @ai-sdk/google, ollama-ai-provider
- Update: better-auth ^1

### Breaking Changes
- authMode: 'phavo-net' removed - only 'local' valid at runtime
- Tier strings: use 'stellar'/'celestial' (not 'free'/'standard')
- License activation: Requires Ed25519 signature (not JWT from phavo.net)
- Session schema: graceUntil column removed
- Button variant: 'ghost' should be replaced with 'tertiary' in new code

### Migration Required
- Run 0005_local_auth_offline_license.sql to clean auth tables
- Run 0006_plugin_data.sql to create plugin persistence table
- Re-verify all existing license keys using offline Ed25519 verification
- Update any phavo.net OAuth integrations to use local auth

### Files Changed
- 89 files modified, 3,448 insertions(+), 1,731 deletions(-)
- 7 new files added (license-generator.ts, webhook.ts, config-schemas.ts, widget-rendering.ts, svelte-audit.md, migrations)

---

## [1.0.0] - 2026-03-28

### Added
- Full web dashboard with 7 free-tier widgets
- Command Palette (Cmd+K) with local search, web search, and AI assistant
- Setup Wizard (Quick + Full)
- Settings with 7 tabs
- Import / Export (.phavo format)
- Pi-hole, RSS, Links integrations (Standard+)
- Mobile responsive ≥375px
- Docker multi-arch (amd64 + arm64)
- CSP headers, rate limiting, CSRF protection
- Auto-generated PHAVO_SECRET on first start
