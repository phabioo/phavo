# PHAVO Agent Instructions

Read these files before making any code changes:

1. `RULES.md`
2. `CONTEXT.md`
3. `docs/phavo_PRD_v3.2.md`
4. `docs/phavo_arch_spec_v2.1.html`

If a prompt mentions a specific area, read the relevant section in the PRD / Arch Spec first.

## Priority order

1. Actual repo code
2. `RULES.md`
3. `CONTEXT.md`
4. PRD / Arch Spec
5. User task prompt

If documentation conflicts with current repo code, **code wins**.

## Working style

- Inspect affected files first
- Explain the plan briefly before making changes
- Make the **smallest possible patch**
- Avoid unrelated refactors
- Preserve existing architecture and naming patterns
- Do not "clean up" unrelated code in passing
- When unsure, follow the pattern already used in the repo

## Core architectural rules

- Never add route logic directly to `apps/web/src/routes/api/v1/[...path]/+server.ts`
- API routes belong in `apps/web/src/lib/server/routes/`
- All API responses must use the standard envelope:
  - `return c.json(ok(data))`
  - `return c.json(err('message'), status)`
- Never bypass `requireSession()` / `requireTier()`
- Tier must come **only** from `session.tier`
- Never read or write tier from config, frontend state, or any other source
- Never store credentials in widget config or config tables
- Credentials must use the `credentials` table with AES-256-GCM encryption
- Widget components are presentational only
- Widgets must never fetch their own data
- Preserve store-driven widget data flow
- Plugins must use the existing plugin structure and sandbox rules
- Never create `packages/ui/src/widgets/`
- Shared UI shells/components belong in `packages/ui/src/components/`

## UI / design rules

- Use the post-M4 design system
- Use shared shells like `WidgetCard` for new or updated widget UI
- Use Tailwind v4 utilities and theme tokens
- Never hardcode:
  - hex colors
  - `/data/` paths
  - ports
  - font names
- Use Geist / Geist Mono only through the existing token/theme system
- Use icons only via `<Icon name="..." />`
- Do not use Material Symbols, Font Awesome, or direct Lucide imports in app code
- Keep `lucide-svelte` as a direct dependency of `packages/ui`

## Svelte / frontend safety rules

- Follow the Svelte 5 hydration rules from `RULES.md`
- Never introduce top-level `$effect` in hydrated components
- Never use `$app/state` inside `$state()` initializers
- Never add `compilerOptions: { runes: true }` to `svelte.config.js`
- Use `fetchWithCsrf()` for all non-GET frontend mutations

## Security rules

- Always keep SSRF protections for user-supplied URLs
- Always use `execFile()` instead of `exec()` for subprocesses
- Never expose stack traces in API responses
- Keep dev/mock auth behind production-safe guards
- Ed25519 is for signing/verification only, never for encryption

## Task execution rules

Before changing code:
1. Read this file
2. Read `RULES.md`
3. Read `CONTEXT.md`
4. Inspect the relevant implementation files
5. Briefly state the intended patch scope

When changing code:
- Touch only files necessary for the task
- Do not rename/move files unless required
- Do not introduce new dependencies unless absolutely necessary
- Do not rewrite working code just to make it "cleaner"

After changing code, always run:

```bash
bun run typecheck
bun run lint
```

If either fails:
- fix the issue if it is caused by the current task
- otherwise report clearly what failed and why

## Output expectations

When finishing a task, report:
- which files were changed
- what was changed
- whether `bun run typecheck` passed
- whether `bun run lint` passed
- any risks, follow-ups, or known blockers

## PHAVO-specific reminders

- Domain is `phavo.net`, not `phavo.io`
- Auth modes are `'phavo-net' | 'local'`
- Tiers are `'standard' | 'pro' | 'local'`
- `TIER_RANK = { standard: 0, pro: 1, local: 2 }`
- First-party widgets use plugin structure under:
  - `packages/plugin-sdk/src/widgets/<id>/`
- Settings architecture currently uses `Account` for account + security / TOTP
- Do not reintroduce a separate `Security` tab unless product/docs are intentionally changed together

## Default behaviour for ambiguous tasks

If the request is broad or risky:
- do analysis first
- propose a minimal implementation plan
- avoid large refactors unless explicitly requested
