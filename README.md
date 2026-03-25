# Phavo

> Modular, self-hosted personal dashboard — beautiful by default, infinitely extensible, yours to own.

Phavo is the successor to **phaboard**, rebuilt from scratch with a production-grade stack, a proper business model, and a multi-platform roadmap. It ships as a web dashboard first, then expands to desktop, mobile, and cloud.

---

## ✨ Features

- **Drag-and-drop widget layout** — resizable S / M / L / XL grid with snap
- **Guided setup** — Quick Setup (3 steps) or Full Setup (10 steps)
- **System monitoring** — CPU, memory, disk, network, temperature, uptime
- **Integrations** — Pi-hole, RSS feeds, weather (Open-Meteo, no API key needed)
- **Secure by default** — AES-256-GCM credential storage, HTTPS out of the box, Argon2id passwords
- **Self-hosted** — single Docker container, multi-arch (amd64 + arm64 for Raspberry Pi)
- **Fully offline capable** — Local tier requires no internet after initial activation

---

## 🚀 Quick Start

```bash
docker run -p 3000:3000 -p 3443:3443 -v phavo-data:/data phavo/phavo
```

Then open [https://localhost:3000](https://localhost:3000) in your browser. On first launch, the setup wizard guides you through the rest.

### Docker Compose

```yaml
services:
  phavo:
    image: phavo/phavo:latest
    ports:
      - "3000:3000"
      - "3443:3443"
    volumes:
      - phavo-data:/data
    environment:
      - PHAVO_SECRET=change-me-in-production
    restart: unless-stopped

volumes:
  phavo-data:
```

---

## 🧩 Widgets

### Free Tier
| Widget | Data |
|---|---|
| CPU | Usage %, per-core breakdown, load average |
| Memory | Used / total, swap |
| Disk | Per-mount usage %, read/write throughput |
| Network | Upload/download speed, total traffic |
| Temperature | CPU temp (where available) |
| Uptime | System uptime, human-readable |
| Weather | Current conditions + 5-day forecast (Open-Meteo) |

### Standard & Local Tier
| Widget | Details |
|---|---|
| Pi-hole | Queries, blocked %, blocklist count, enable/disable toggle |
| RSS Feed | Multiple feeds, Basic Auth + Bearer token for private feeds |
| Links | Named bookmarks with icons, grouped by category |

---

## 💳 Pricing

| | Free | Standard | Local |
|---|---|---|---|
| Price | €0 | €7.99 one-time | €19.99 one-time |
| Widgets | Core system + weather | All launch widgets | All launch widgets |
| Tabs | 1 | Unlimited | Unlimited |
| Auth | phavo.io account | phavo.io account | Local account |
| Offline | 24h grace | 72h grace | Fully offline |
| Branding | Visible | Removable | Removable |

**Standard → Local upgrade:** pay the €12.00 difference, no repurchase needed.  
**14-day money-back guarantee** on all paid tiers.

---

## 🗺️ Roadmap

| Phase | Status | Description |
|---|---|---|
| **0 — Foundation** | Now | Turborepo monorepo, Figma design system, shared packages, widget schema |
| **1 — Web Dashboard** | Launch target | SvelteKit dashboard, all launch widgets, Docker multi-arch |
| **2 — Desktop App** | After Phase 1 | Tauri 2.0 · macOS, Windows, Linux · system tray · auto-update |
| **3 — Mobile Apps** | After Phase 2 | Tauri 2.0 Mobile · iOS, iPadOS, Android |
| **4 — Cloud + Agent** | Long-term | Turso, multi-user, widget marketplace, Phavo Agent daemon |

---

## 🛠️ Tech Stack

```
Monorepo:   Turborepo + Bun Workspaces
Language:   TypeScript (strict)
Linting:    Biome

apps/
  web/        SvelteKit (Phase 1)
  desktop/    Tauri 2.0 (Phase 2)
  mobile/     Tauri 2.0 Mobile (Phase 3)

packages/
  @phavo/ui       Svelte 5 (Runes) component library
  @phavo/db       Drizzle ORM + libSQL
  @phavo/types    Shared TypeScript types & Zod schemas
  @phavo/agent    Bun daemon for system metrics

Design:     Figma → Design Tokens → Tailwind CSS v4
API:        Hono
Auth:       Better Auth
Database:   libSQL (local) → Turso (Phase 4)
Docker:     multi-arch (amd64 + arm64)
CI/CD:      GitHub Actions
```

---

## 🔒 Security

- **Passwords:** Argon2id hashing via Better Auth
- **Sessions:** HttpOnly + Secure + SameSite=Strict cookies, 7-day idle timeout
- **Credentials at rest:** AES-256-GCM encryption in libSQL (Pi-hole tokens, RSS auth, etc.)
- **HTTPS:** Built-in TLS — self-signed by default, Let's Encrypt or custom cert supported
- **Brute-force protection:** 10 attempts → 5-minute lockout per IP and account
- **2FA:** TOTP optional on all tiers, compatible with any authenticator app
- **No telemetry** from the local app by default

To report a vulnerability, see [SECURITY.md](SECURITY.md) or email **security@phavo.io**.

---

## 📁 Repository Structure

```
phavo/
├── apps/
│   ├── web/          # SvelteKit web dashboard (Phase 1)
│   ├── desktop/      # Tauri 2.0 desktop app (Phase 2)
│   └── mobile/       # Tauri Mobile (Phase 3)
├── packages/
│   ├── ui/           # @phavo/ui — component library
│   ├── db/           # @phavo/db — Drizzle + libSQL
│   ├── types/        # @phavo/types — shared types & schemas
│   └── agent/        # @phavo/agent — system metrics daemon
├── turbo.json
├── docker-compose.yml
└── Dockerfile
```

---

## 🧑‍💻 Development

**Prerequisites:** [Bun](https://bun.sh) ≥ 1.1.0

```bash
# Install dependencies
bun install

# Start dev server
bun run dev

# Typecheck all packages
bun run typecheck

# Lint
bun run lint
```

---

## ⚖️ License

After v1.0 ships, Phavo will be dual-licensed:

- **AGPL-3.0** for open source / self-hosted use
- **Commercial licence** for the paid tiers (Standard, Local)

A self-compiled AGPL build without a phavo.io account defaults to Free tier behaviour. Tier enforcement is done server-side via phavo.io — there are no code-level locks in the client.

---

## 🔗 Links

- Website: [phavo.io](https://phavo.io)
- Docs: [docs.phavo.io](https://docs.phavo.io)
- Discord: community support & announcements
- Issues: [github.com/phabioo/phavo/issues](https://github.com/phabioo/phavo/issues)

---

*Phavo · phabioo · phavo.io*
