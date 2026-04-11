# PHAVO — Dev Start Commands

PHAVO has a single fully featured local development mode. There are no tiers,
activation steps, or edition-specific startup variants.

## macOS / Linux

```bash
PHAVO_DEV_MOCK_AUTH=true PHAVO_SECRET=dev-secret PHAVO_ENV=development PHAVO_PORT=3000 PHAVO_DATA_DIR=./apps/web/.dev-data ~/.bun/bin/bun run --cwd apps/web dev -- --host 0.0.0.0
```

---

## Windows (PowerShell)

```powershell
$env:PHAVO_DEV_MOCK_AUTH="true"; $env:PHAVO_SECRET="dev-secret"; $env:PHAVO_ENV="development"; $env:PHAVO_PORT="3000"; $env:PHAVO_DATA_DIR="./apps/web/.dev-data"; & "$env:USERPROFILE\.bun\bin\bun.exe" run --cwd apps/web dev -- --host 0.0.0.0
```

## Windows (CMD)

```cmd
set PHAVO_DEV_MOCK_AUTH=true && set PHAVO_SECRET=dev-secret && set PHAVO_ENV=development && set PHAVO_PORT=3000 && set PHAVO_DATA_DIR=./apps/web/.dev-data && %USERPROFILE%\.bun\bin\bun.exe run --cwd apps/web dev -- --host 0.0.0.0
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
