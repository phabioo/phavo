# Phavo

> Modular, self-hosted personal dashboard — beautiful by default, yours to own.

Phavo is a production-grade self-hosted dashboard built on a modern TypeScript stack. It ships as a single Docker container, runs on any Linux server or Raspberry Pi, and expands to desktop and mobile in future phases.

---

## ✨ Features

- **Command Palette** — `Cmd+K` / `Ctrl+K` to search widgets, navigate settings, run actions, search the web, or ask an AI assistant (Ollama, OpenAI, Claude)
- **Guided setup** — Quick Setup (3 steps) or Full Setup (10 steps), both fully wired
- **System monitoring** — CPU, memory, disk, network, temperature, uptime
- **Integrations** — Pi-hole, RSS feeds, links/bookmarks, weather (Open-Meteo, no API key needed)
- **Import / Export** — full dashboard config as `.phavo` file with optional passphrase-encrypted credentials
- **Secure by default** — AES-256-GCM credential storage, CSRF protection, Argon2id passwords, per-IP rate limiting, CSP headers
- **Single Docker container** — multi-arch (amd64 + arm64), runs on Raspberry Pi
- **Fully offline capable** — Local tier requires no internet after initial activation

---

## 🚀 Quick Start

```bash
docker run -p 3000:3000 \
  -v phavo-data:/data \
  -e PHAVO_SECRET=your-secret-here \
  -e PHAVO_ENV=production \
  getphavo/phavo
```

Then open [http://localhost:3000](http://localhost:3000). The setup wizard guides you through the rest.

### Docker Compose (recommended)

```yaml
services:
  phavo:
    image: getphavo/phavo:latest
    ports:
      - "3000:3000"
    volumes:
      - phavo-data:/data
    environment:
      - PHAVO_SECRET=change-me-to-a-random-string   # required — min 32 chars
      - PHAVO_ENV=production
    restart: unless-stopped

volumes:
  phavo-data:
```

> **Important:** `PHAVO_SECRET` must be set to a random string of at least 32 characters. The server exits on startup in production if this is missing or left as the default value.

---

## 🧩 Widgets

### Free Tier
| Widget | Data |
|---|---|
| CPU | Usage %, per-core breakdown, load average, model name |
| Memory | Used / total RAM and swap |
| Disk | Per-mount usage %, read/write throughput |
| Network | Upload/download speed, total traffic |
| Temperature | CPU temperature (where available) |
| Uptime | System uptime, human-readable |
| Weather | Current conditions + 5-day forecast via Open-Meteo (no API key needed) |

### Standard & Local Tier
| Widget | Details |
|---|---|
| Pi-hole | Queries, blocked %, blocklist count, enable/disable toggle |
| RSS Feed | Multiple feeds, Basic Auth + Bearer token for private feeds |
| Links | Named bookmarks with icons, grouped by category |

---

## ⌨️ Command Palette

Press `Cmd+K` (macOS) or `Ctrl+K` (Windows/Linux) from anywhere in the dashboard.

- **Local search** — instantly find and navigate to widgets, settings, tabs, and actions
- **Web search** — search with your preferred engine (DuckDuckGo by default, configurable)
- **AI assistant** — ask questions using Ollama (fully local/offline), OpenAI, or Anthropic Claude (Standard+ tier)

AI API keys are stored server-side in encrypted form and never exposed to the browser.

---

## 💳 Pricing

| | Free | Standard | Local |
|---|---|---|---|
| Price | €0 | €8.99 one-time | €24.99 one-time |
| Widgets | Core system + weather | All widgets | All widgets |
| Tabs | 1 | Unlimited | Unlimited |
| AI assistant | — | ✅ | ✅ |
| Auth | phavo.net account | phavo.net account | Local account |
| Offline | 24h grace | 72h grace | Fully offline forever |
| Branding | "Powered by Phavo" | Removable | Removable |

**Standard → Local upgrade:** pay the €16.00 difference, no repurchase needed.
**14-day money-back guarantee** on all paid tiers via Gumroad.

---

## 🗺️ Roadmap

| Phase | Status | Description |
|---|---|---|
| **1 — Web Dashboard** | ✅ Complete | SvelteKit dashboard, all widgets, Command Palette, Docker multi-arch |
| **2 — Desktop App** | Planned | Tauri 2.0 · macOS, Windows, Linux · system tray · auto-update |
| **3 — Mobile Apps** | Planned | Tauri 2.0 Mobile · iOS, iPadOS, Android |
| **4 — Cloud + Marketplace** | Long-term | Multi-user, widget marketplace, Phavo Agent daemon |

---

## 🛠️ Tech Stack

```
Monorepo:   Turborepo + Bun Workspaces
Language:   TypeScript (strict)
Linting:    Biome

apps/
  web/        SvelteKit + Hono API (Phase 1 — web dashboard)
  desktop/    Tauri 2.0 (Phase 2, stub)
  mobile/     Tauri 2.0 Mobile (Phase 3, stub)

packages/
  @phavo/ui       Svelte 5 (Runes) component library
  @phavo/db       Drizzle ORM + libSQL + AES-256-GCM crypto
  @phavo/types    Shared TypeScript types & Zod schemas
  @phavo/agent    System metrics library

Auth:       Custom (Argon2id + phavo.net OAuth)
Database:   libSQL (local SQLite)
Docker:     Multi-arch (amd64 + arm64)
CI/CD:      GitHub Actions
```

---

## 🔒 Security

- **Passwords:** Argon2id hashing
- **Credentials at rest:** AES-256-GCM encryption (Pi-hole tokens, RSS auth, AI API keys)
- **Sessions:** HttpOnly + Secure + SameSite=Strict cookies, configurable timeout
- **CSRF:** HMAC double-submit token on all mutations
- **Rate limiting:** Per-IP in-memory limiting on all endpoints
- **CSP:** Content-Security-Policy with nonce-based script whitelisting
- **SSRF protection:** All user-supplied URLs validated against cloud metadata endpoints before fetch
- **Brute-force protection:** 10 attempts → 5-minute lockout per IP
- **2FA:** TOTP optional on all tiers

No telemetry is sent from the local app.

To report a vulnerability, see [SECURITY.md](SECURITY.md) or email **security@phavo.net**.

---

## 📁 Repository Structure

```
phavo/
├── apps/
│   ├── web/          # SvelteKit web dashboard (Phase 1)
│   ├── desktop/      # Tauri 2.0 desktop app (Phase 2, stub)
│   └── mobile/       # Tauri Mobile (Phase 3, stub)
├── packages/
│   ├── ui/           # @phavo/ui — Svelte 5 component library
│   ├── db/           # @phavo/db — Drizzle + libSQL + crypto
│   ├── types/        # @phavo/types — shared types & schemas
│   └── agent/        # @phavo/agent — system metrics
├── docs/             # PRD, Arch Spec, Roadmap
├── turbo.json
├── docker-compose.yml
└── Dockerfile
```

---

## 🧑‍💻 Development

**Prerequisites:** [Bun](https://bun.sh) ≥ 1.3.0

```bash
# Install dependencies
bun install

# Start dev server (Windows PowerShell)
$env:PHAVO_DEV_MOCK_AUTH="true"; $env:PHAVO_SECRET="dev-secret"
$env:PHAVO_PORT="3000"; $env:PHAVO_ENV="development"
$env:PHAVO_DATA_DIR="./apps/web/.dev-data"; bun run dev

# Start dev server (macOS/Linux)
PHAVO_DEV_MOCK_AUTH=true PHAVO_SECRET=dev-secret \
  PHAVO_PORT=3000 PHAVO_ENV=development \
  PHAVO_DATA_DIR=./apps/web/.dev-data bun run dev

# Typecheck
bun run typecheck

# Lint
bun run lint
```

With `PHAVO_DEV_MOCK_AUTH=true`, you are automatically logged in as a Free tier user. Edit `apps/web/src/lib/server/mock-auth.ts` to test Standard or Local tier.

---

## ⚖️ License

After v1.0 ships, Phavo will be dual-licensed:

- **AGPL-3.0** for open source / self-hosted use
- **Commercial licence** included with Standard and Local tier purchases

A self-compiled AGPL build without a phavo.net account defaults to Free tier behaviour. Tier enforcement is server-side via phavo.net — no code-level locks in the client.

---

## 🔗 Links

- Website: [phavo.net](https://phavo.net)
- Docs: [docs.phavo.net](https://docs.phavo.net)
- Issues: [github.com/getphavo/phavo/issues](https://github.com/getphavo/phavo/issues)

---

*Phavo · phavo.net · github.com/getphavo/phavo*
