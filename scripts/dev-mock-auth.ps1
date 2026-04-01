$ErrorActionPreference = 'Stop'

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
Set-Location $repoRoot

if (-not $env:PHAVO_DEV_MOCK_AUTH) { $env:PHAVO_DEV_MOCK_AUTH = 'true' }
if (-not $env:PHAVO_SECRET) { $env:PHAVO_SECRET = 'dev-secret' }
if (-not $env:PHAVO_ENV) { $env:PHAVO_ENV = 'development' }
if (-not $env:PHAVO_PORT) { $env:PHAVO_PORT = '3000' }
if (-not $env:PHAVO_DATA_DIR) { $env:PHAVO_DATA_DIR = './apps/web/.dev-data' }
if (-not $env:PHAVO_DEV_HOST) { $env:PHAVO_DEV_HOST = '0.0.0.0' }

Write-Host 'Starting Phavo dashboard in dev mock auth mode...'
Write-Host "PHAVO_DEV_MOCK_AUTH=$($env:PHAVO_DEV_MOCK_AUTH) PHAVO_ENV=$($env:PHAVO_ENV) PHAVO_PORT=$($env:PHAVO_PORT) PHAVO_DEV_HOST=$($env:PHAVO_DEV_HOST)"

bun run --cwd apps/web dev -- --host $env:PHAVO_DEV_HOST
