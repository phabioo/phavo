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
- **Session tokens:** 32-byte cryptographically random tokens, stored as HttpOnly + SameSite=Strict cookies
- **2FA:** TOTP (RFC 6238) optional on all tiers, compatible with any TOTP app
- **Brute-force protection:** 10 failed attempts triggers a 5-minute per-IP and per-account lockout

### Credential Storage

All sensitive values (Pi-hole API tokens, RSS feed credentials, AI API keys) are stored encrypted at rest:

- **Algorithm:** AES-256-GCM
- **Key derivation:** HKDF-SHA256 from `PHAVO_SECRET` environment variable
- **Storage:** `credentials` table in local SQLite database
- **Frontend:** Credentials are never returned to the browser — only a `configured: true` boolean flag

### Transport Security

- Session and CSRF cookies use `Secure` flag in production
- `SameSite=Strict` on all cookies
- Content-Security-Policy headers on all pages
- HTTP-to-HTTPS redirect when HTTPS is configured

### CSRF Protection

All state-changing API calls (POST, PUT, PATCH, DELETE) require a valid `X-CSRF-Token` header. Tokens are derived via HMAC-SHA256 from the session ID and `PHAVO_SECRET`.

### Rate Limiting

Per-IP in-memory rate limiting:
- Login: 10 requests / 5 minutes (separate from global limiter)
- TOTP: 5 requests / 5 minutes
- Metrics endpoints: 60 requests / minute
- Config import: 5 requests / 10 minutes
- All other endpoints: 120 requests / minute

### Tier Enforcement

Tier is stored in the `sessions` DB table and re-validated on every request by `authMiddleware`. It is never read from cookies, request headers, or the config table. The widget manifest strips `dataEndpoint`, `configSchema`, and `permissions` from entries returned to unentitled tiers.

### Docker Hardening

- Non-root user (`phavo`, UID 1001) inside the container
- Read-only filesystem with tmpfs for `/tmp`
- No privileged mode required
- `PHAVO_SECRET` must be set to a non-default value in production — server exits on startup otherwise

---

## Known Limitations

- **Login rate limiting is in-memory** — resets on container restart. A distributed deployment should add a Redis-backed limiter.
- **SSRF via Pi-hole test endpoint** — only cloud metadata endpoints (169.254.169.254 etc.) are blocked. Local network addresses are intentionally allowed since Pi-hole typically runs on the local network.
- **No Subresource Integrity on self-hosted bundles** — SRI protects against CDN compromise but not same-origin file tampering, so it is only applied to externally loaded fonts.

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

Out of scope:
- Vulnerabilities requiring physical access to the host
- Self-signed TLS certificate warnings (by design for local installs)
- Brute-forcing a weak `PHAVO_SECRET` (user's responsibility to set a strong value)
- Issues in dependencies not yet fixed upstream

---

*Phavo · phavo.net · security@phavo.net*
