# PHAVO — Dev Start Commands

## macOS / Linux

### Stellar Mode (free tier)

```bash
PHAVO_DEV_MOCK_AUTH=true PHAVO_SECRET=dev-secret PHAVO_ENV=development PHAVO_PORT=3000 PHAVO_DATA_DIR=./apps/web/.dev-data ~/.bun/bin/bun run --cwd apps/web dev -- --host 0.0.0.0
```

### Celestial Mode (paid tier)

```bash
PHAVO_DEV_MOCK_AUTH=true PHAVO_SECRET=dev-secret PHAVO_ENV=development PHAVO_PORT=3000 PHAVO_DATA_DIR=./apps/web/.dev-data PHAVO_DEV_TIER=celestial ~/.bun/bin/bun run --cwd apps/web dev -- --host 0.0.0.0
```

---

## Windows (PowerShell)

### Stellar Mode (free tier)

```powershell
$env:PHAVO_DEV_MOCK_AUTH="true"; $env:PHAVO_SECRET="dev-secret"; $env:PHAVO_ENV="development"; $env:PHAVO_PORT="3000"; $env:PHAVO_DATA_DIR="./apps/web/.dev-data"; & "$env:USERPROFILE\.bun\bin\bun.exe" run --cwd apps/web dev -- --host 0.0.0.0
```

### Celestial Mode (paid tier)

```powershell
$env:PHAVO_DEV_MOCK_AUTH="true"; $env:PHAVO_SECRET="dev-secret"; $env:PHAVO_ENV="development"; $env:PHAVO_PORT="3000"; $env:PHAVO_DATA_DIR="./apps/web/.dev-data"; $env:PHAVO_DEV_TIER="celestial"; & "$env:USERPROFILE\.bun\bin\bun.exe" run --cwd apps/web dev -- --host 0.0.0.0
```

### Windows (CMD)

#### Stellar
```cmd
set PHAVO_DEV_MOCK_AUTH=true && set PHAVO_SECRET=dev-secret && set PHAVO_ENV=development && set PHAVO_PORT=3000 && set PHAVO_DATA_DIR=./apps/web/.dev-data && %USERPROFILE%\.bun\bin\bun.exe run --cwd apps/web dev -- --host 0.0.0.0
```

#### Celestial
```cmd
set PHAVO_DEV_MOCK_AUTH=true && set PHAVO_SECRET=dev-secret && set PHAVO_ENV=development && set PHAVO_PORT=3000 && set PHAVO_DATA_DIR=./apps/web/.dev-data && set PHAVO_DEV_TIER=celestial && %USERPROFILE%\.bun\bin\bun.exe run --cwd apps/web dev -- --host 0.0.0.0
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

---

## Gumroad Webhook

Configure in Gumroad Dashboard → Settings → Advanced → Webhooks:
- URL: `https://phavo.net/api/v1/webhooks/gumroad`
- Events: Sale

The endpoint verifies `X-Gumroad-Signature` using HMAC-SHA256
with `PHAVO_GUMROAD_WEBHOOK_SECRET`.

On successful purchase, the webhook generates an Ed25519 license key
and writes it to the sale via the Gumroad API. Gumroad includes
the key in its standard purchase receipt email to the buyer.
No separate mail server is required.

**Required env vars (phavo.net server only):**
- `PHAVO_GUMROAD_WEBHOOK_SECRET` — from Gumroad Dashboard → Settings → Advanced → Webhooks
- `PHAVO_LICENSE_PRIVATE_KEY` — Ed25519 private key, base64-encoded PEM
- `PHAVO_GUMROAD_API_KEY` — from Gumroad Dashboard → Settings → Advanced → Applications
