# Phavo

> Modular, self-hosted personal dashboard — beautiful by default, yours to own.

<!-- Hero screenshot pending — coming with v1.0 launch -->

Phavo is a production-grade self-hosted dashboard built on a modern TypeScript stack. It ships as a single Docker container, runs on any Linux server or Raspberry Pi, and stays focused on the web runtime today.

PHAVO is free and open source under the MIT license. All features are available to all users in the current Celestial Edition.

---

## ✨ Features

- **Command Palette** — `Cmd+K` / `Ctrl+K` to search widgets, navigate settings, run actions, search the web, or ask an AI assistant (Ollama, OpenAI, Claude)
- **Guided setup** — Quick Setup (3 steps) or Full Setup (10 steps), both fully wired
- **System monitoring** — CPU, memory, disk, network, temperature, uptime
- **Integrations** — Pi-hole, RSS feeds, links/bookmarks, weather (Open-Meteo, no API key needed)
- **Import / Export** — full dashboard config as `.phavo` file with optional passphrase-encrypted credentials
- **Secure by default** — AES-256-GCM credential storage, CSRF protection, Argon2id passwords, per-IP rate limiting, CSP headers
- **Single Docker container** — multi-arch (amd64 + arm64), runs on Raspberry Pi
- **Fully offline capable** — no internet required after installation

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

| Widget | Data |
|---|---|
| CPU | Usage %, per-core breakdown, load average, model name |
| Memory | Used / total RAM and swap |
| Disk | Per-mount usage %, read/write throughput |
| Network | Upload/download speed, total traffic |
| Temperature | CPU temperature (where available) |
| Uptime | System uptime, human-readable |
| Weather | Current conditions + 5-day forecast via Open-Meteo (no API key needed) |
| Pi-hole | Queries, blocked %, blocklist count, enable/disable toggle |
| RSS Feed | Multiple feeds, Basic Auth + Bearer token for private feeds |
| Links | Named bookmarks with icons, grouped by category |
| Docker | Container list, status, start/stop controls |
| Service Health | HTTP/TCP endpoint monitoring |
| Speedtest | On-demand bandwidth measurement |
| Calendar | Upcoming events from CalDAV / iCal |

---

## ⌨️ Command Palette

Press `Cmd+K` (macOS) or `Ctrl+K` (Windows/Linux) from anywhere in the dashboard.

- **Local search** — instantly find and navigate to widgets, settings, tabs, and actions
- **Web search** — search with your preferred engine (DuckDuckGo by default, configurable)
- **AI assistant** — ask questions using Ollama (fully local/offline), OpenAI, or Anthropic Claude

AI API keys are stored server-side in encrypted form and never exposed to the browser.

---

## ️ Roadmap

| Track | Status | Description |
|---|---|---|
| **v1.0** | In progress | Web dashboard, all widgets, Command Palette, Docker multi-arch, launch hardening |
| **Future Direction** | No timeline | Desktop wrapper, marketplace, and optional sync remain anecdotal ideas only |

---

## 🛠️ Tech Stack

```
Monorepo:   Turborepo + Bun Workspaces
Language:   TypeScript (strict)
Linting:    Biome

apps/
  web/        SvelteKit + Hono API (Phase 1 — web dashboard)

packages/
  @phavo/ui       Svelte 5 (Runes) component library
  @phavo/db       Drizzle ORM + libSQL + AES-256-GCM crypto
  @phavo/types    Shared TypeScript types & Zod schemas
  @phavo/agent    System metrics library

Auth:       Better Auth (local-only, Argon2id)
AI:         Vercel AI SDK (ai + ollama-ai-provider / @ai-sdk/openai / @ai-sdk/anthropic)
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
- **2FA:** TOTP optional

No telemetry is sent from the local app.

To report a vulnerability, see [SECURITY.md](SECURITY.md) or email **fabio@phabio.net**.

---

## 📁 Repository Structure

```
phavo/
├── apps/
│   ├── web/          # SvelteKit web dashboard (Phase 1)
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

# Quick start dashboard in dev mock auth mode (Windows)
bun run dev:mock

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

With `PHAVO_DEV_MOCK_AUTH=true`, you are automatically logged in as a dev user.

---

## ⚖️ License

Phavo is open source under the [MIT License](LICENSE).

---

## 🔗 Links

- Website: [phavo.net](https://phavo.net)
- Docs: [docs.phavo.net](https://docs.phavo.net)
- Issues: [github.com/getphavo/phavo/issues](https://github.com/getphavo/phavo/issues)

---

*Phavo · phavo.net · github.com/getphavo/phavo*
