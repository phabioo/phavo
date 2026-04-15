# Phavo

> Modular, self-hosted personal dashboard — beautiful by default, yours to own.

<!-- Hero screenshot pending — coming with v1.0 launch -->

Phavo is a production-grade self-hosted dashboard built on a modern TypeScript stack. It ships as a single Docker container, runs on any Linux server or Raspberry Pi, and stays focused on the web runtime today.

PHAVO is free and open source under the MIT license. All features are available to all users in the current Celestial Edition.

---

## 🤖 Built with AI — and I'm upfront about it

I want to be transparent right from the start: **I did not write this code myself.** Phavo was built almost entirely using AI coding tools — primarily [Claude Code](https://claude.ai/code) (Anthropic) alongside a few other AI models.

My background is in IT systems integration — I completed a formal vocational IT apprenticeship (the German *Fachinformatiker Systemintegration*, roughly equivalent to an IT systems specialist qualification) focused on infrastructure, networks, and systems. In other words: I know my way around servers and configs, but I'm not a programmer. Phavo started as a personal hobby project born out of two things coming together: I'd been looking at the existing self-hosted dashboard options for a while and none of them quite clicked for me — not because they're bad projects (they're not, and the people behind them are doing great work), but they just didn't match what I personally wanted from a dashboard. At the same time, I was curious about AI coding tools and wanted to find out for myself how far you can actually get with them if you know what you want to build. A dashboard felt like the perfect test case. Turns out, pretty far.

My contribution was everything around the code: defining what to build, designing the architecture, writing the specs and documentation, making product decisions, and testing the result. The actual code was written by AI, directed by me. Think of it less like "I coded this" and more like "I planned and supervised this."

I'm telling you this because you deserve to know what you're running. The code is all here, fully auditable. If something looks like it was written by a very capable but occasionally overly verbose language model — that's because it was. Feel free to refactor, improve, or raise issues as you would with any open source project. I welcome it.

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
  phabioo/phavo
```

Then open [http://localhost:3000](http://localhost:3000). The setup wizard guides you through the rest.

### Docker Compose (recommended)

```yaml
services:
  phavo:
    image: phabioo/phavo:latest
    ports:
      - "3000:3000"
    volumes:
      - phavo-data:/data
    # Optional: set explicitly for Kubernetes or multi-instance deployments.
    # If unset, Phavo auto-generates and persists a secret on first start.
    # environment:
    #   - PHAVO_SECRET=your-random-string-here
    restart: unless-stopped

volumes:
  phavo-data:
```

> **Note:** `PHAVO_SECRET` is optional. If not set, Phavo auto-generates a secret and persists it in the data volume on first start. Set it explicitly for Kubernetes or when migrating between machines.

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

To report a vulnerability, see [SECURITY.md](SECURITY.md).

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

# Start dev server (Windows PowerShell)
$env:PHAVO_SECRET="dev-secret"; $env:PHAVO_PORT="3000"
$env:PHAVO_DATA_DIR="./data"; & "$env:USERPROFILE\.bun\bin\bun.exe" run --cwd apps/web dev -- --host 0.0.0.0

# Start dev server (macOS/Linux)
PHAVO_SECRET=dev-secret PHAVO_PORT=3000 PHAVO_DATA_DIR=./data \
  ~/.bun/bin/bun run --cwd apps/web dev -- --host 0.0.0.0

# Typecheck
bun run typecheck

# Lint
bun run lint
```

PHAVO_SECRET is optional — if not set, auto-generated on first start. Set it for reproducible crypto keys across restarts.

---

## ⚖️ License

Phavo is open source under the [MIT License](LICENSE).

---

## 🔗 Links

- Issues: [github.com/phabioo/phavo/issues](https://github.com/phabioo/phavo/issues)

---

*Phavo · github.com/phabioo/phavo*
