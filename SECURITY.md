# Security Policy

## Supported Versions

| Version | Supported |
|---|---|
| 1.x (latest) | ✅ Security updates |
| < 1.0 | ❌ No support |

---

## Reporting a Vulnerability

**Please do not report security vulnerabilities via GitHub Issues.**

Send your report to: **security@phavo.net**

You can expect:
- **Acknowledgement within 48 hours**
- A fix or mitigation plan within 14 days for critical issues
- Credit in the release notes if you wish (optional)

We do not pursue legal action against researchers who report vulnerabilities in good faith.

---

## Security Model

### Authentication

- **Local tier:** Passwords hashed with Argon2id (memory: 64MB, iterations: 3, parallelism: 4)
- **phavo.net tier:** OAuth via phavo.net — no password stored locally
- **Session tokens:** 32-byte cryptographically random tokens, stored as HttpOnly + Secure + SameSite=Strict cookies
- **Session timing:** Sessions are only created after full authentication — TOTP verification completes before any session row is written to the DB
- **2FA:** TOTP (RFC 6238) optional on all tiers, compatible with any TOTP app
- **Brute-force protection:** 10 failed attempts triggers a 5-minute per-IP lockout; attempt map is capped at 10,000 entries with periodic pruning

### Credential Storage

All sensitive values (Pi-hole API tokens, RSS feed credentials, AI API keys) are stored encrypted at rest:

- **Algorithm:** AES-256-GCM
- **Key derivation:** HKDF-SHA256 from `PHAVO_SECRET` environment variable
- **Storage:** `credentials` table in local SQLite database
- **Frontend:** Credentials are never returned to the browser — only a `configured: true` boolean flag

### PHAVO_SECRET

The `PHAVO_SECRET` environment variable is required in production. The server exits immediately on startup if it is missing, empty, or left as the default `change-me` value. In development, the secret can be auto-generated — a log message instructs you to back up the generated file.

### Transport Security

- Session and CSRF cookies use the `Secure` flag in production
- `SameSite=Strict` on all cookies
- Content-Security-Policy headers with nonce-based script whitelisting on all pages
- Configure a reverse proxy (nginx, Caddy) for TLS termination in production

### CSRF Protection

All state-changing API calls (POST, PUT, PATCH, DELETE) require a valid `X-CSRF-Token` header. Tokens are derived via HMAC-SHA256 from the session ID and `PHAVO_SECRET`. The CSRF cookie uses `SameSite=Strict`.

### SSRF Protection

All user-supplied URLs (Pi-hole API endpoint, Ollama URL, any configurable remote) are validated via `assertNotCloudMetadata()` before any server-side `fetch()` call. Blocked targets include:

- AWS instance metadata (`169.254.169.254`)
- GCP metadata (`metadata.google.internal`, `metadata.goog`)
- AWS IPv6 metadata (`fd00:ec2::254`)
- Link-local IPv4 ranges (`169.254.x.x`)
- URLs with embedded credentials
- Non-HTTP(S) schemes

Local network addresses (e.g. `192.168.x.x`) are intentionally allowed — Pi-hole and Ollama legitimately run on local networks.

### Rate Limiting

Per-IP in-memory rate limiting on all endpoints:

| Endpoint group | Limit |
|---|---|
| Login | 10 req / 5 min |
| TOTP | 5 req / 5 min |
| Metrics endpoints | 60 req / min |
| Config import | 5 req / 10 min |
| All other endpoints | 120 req / min |

Set `PHAVO_TRUST_PROXY=true` if running behind a reverse proxy that sets `X-Forwarded-For`.

### Tier Enforcement

Tier is stored in the `sessions` DB table and re-validated on every request by `authMiddleware`. It is never read from cookies, request headers, or the config table. The widget manifest strips `dataEndpoint`, `configSchema`, and `permissions` from entries returned to unentitled tiers.

### Subprocess Security

All subprocess calls use `execFile()` with an explicit argument array — never `exec()` with a shell string — to prevent shell injection.

### Docker Hardening

- Non-root user (`phavo`, UID 1001) inside the container
- Read-only root filesystem with tmpfs mounts for writable paths
- No privileged mode required
- Docker `HEALTHCHECK` on `GET /api/v1/health`
- `PHAVO_SECRET` must be set to a non-default value — server exits on startup otherwise

---

## Known Limitations

- **Login rate limiting is in-memory** — resets on container restart. A distributed deployment should add a Redis-backed limiter.
- **No Subresource Integrity on self-hosted bundles** — SRI is applied to externally loaded fonts only. Same-origin file tampering is out of scope for SRI.
- **`style-src 'unsafe-inline'`** — required for Svelte's runtime style injection. Tracked for future removal when SvelteKit supports nonce-based styles.

---

## Dependency Scanning

- **Dependabot** enabled for npm and Docker dependencies
- **`bun audit`** runs in CI on every push
- **Trivy** scans the Docker image on every build

---

## Scope

In scope for vulnerability reports:
- Authentication and session management
- Credential storage and encryption
- Tier enforcement bypass
- CSRF bypass
- SSRF via user-supplied URLs
- SQL injection (Drizzle ORM parameterised queries used throughout)
- XSS in dashboard or setup wizard
- Shell injection via subprocess calls

Out of scope:
- Vulnerabilities requiring physical access to the host
- Self-signed TLS certificate warnings (by design for local installs)
- Brute-forcing a weak `PHAVO_SECRET` (user's responsibility to set a strong value)
- Issues in dependencies not yet fixed upstream

---

*Phavo · phavo.net · security@phavo.net*
