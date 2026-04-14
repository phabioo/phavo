# PHAVO — Dev Start Commands

PHAVO has a single fully featured local development mode. There are no tiers,
activation steps, or edition-specific startup variants.

PHAVO_SECRET is optional — if not set, auto-generated on first start. Set it
in dev commands for reproducible crypto keys across restarts (otherwise
credential encryption keys change each time the dev-data directory is fresh).

## macOS / Linux

```bash
PHAVO_SECRET=dev-secret PHAVO_PORT=3000 PHAVO_DATA_DIR=./data ~/.bun/bin/bun run --cwd apps/web dev -- --host 0.0.0.0
```

---

## Windows (PowerShell)

```powershell
$env:PHAVO_SECRET="dev-secret"; $env:PHAVO_PORT="3000"; $env:PHAVO_DATA_DIR="./data"; & "$env:USERPROFILE\.bun\bin\bun.exe" run --cwd apps/web dev -- --host 0.0.0.0
```

## Windows (CMD)

```cmd
set PHAVO_SECRET=dev-secret && set PHAVO_PORT=3000 && set PHAVO_DATA_DIR=./data && %USERPROFILE%\.bun\bin\bun.exe run --cwd apps/web dev -- --host 0.0.0.0
```

---

## Checks

### macOS / Linux
```bash
~/.bun/bin/bun run typecheck
~/.bun/bin/bun run lint
```

### Windows (PowerShell)
```powershell
& "$env:USERPROFILE\.bun\bin\bun.exe" run typecheck
& "$env:USERPROFILE\.bun\bin\bun.exe" run lint
```
