# PHAVO — Dev Start Commands

## Stellar Mode (free tier)

```bash
PHAVO_DEV_MOCK_AUTH=true PHAVO_SECRET=dev-secret PHAVO_ENV=development PHAVO_PORT=3000 PHAVO_DATA_DIR=./apps/web/.dev-data PHAVO_DEV_HOST=0.0.0.0 /Users/fabio/.bun/bin/bun run --cwd apps/web dev -- --host 0.0.0.0
```

## Celestial Mode (paid tier)

```bash
PHAVO_DEV_MOCK_AUTH=true PHAVO_SECRET=dev-secret PHAVO_ENV=development PHAVO_PORT=3000 PHAVO_DATA_DIR=./apps/web/.dev-data PHAVO_DEV_HOST=0.0.0.0 PHAVO_DEV_TIER=celestial /Users/fabio/.bun/bin/bun run --cwd apps/web dev -- --host 0.0.0.0
```
