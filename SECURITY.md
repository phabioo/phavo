# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.8.x   | :white_check_mark: |

## Reporting a Vulnerability

If you discover a security vulnerability, please report it responsibly.

**Do not open a public GitHub issue for security vulnerabilities.**

Instead, please email: **fabio@phabio.net**

You should receive an acknowledgment within 48 hours. We will work with you to
understand the issue and coordinate a fix before any public disclosure.

## Scope

PHAVO is a self-hosted dashboard that runs on your local network. Security
considerations include:

- **Authentication**: Local password-based auth with optional TOTP 2FA
- **Session management**: HttpOnly cookies with CSRF protection
- **Data encryption**: AES-256-GCM for sensitive widget configuration
- **Network boundaries**: No telemetry, no phone-home; outbound calls are
  user-initiated only (weather API, RSS feeds, update checks)

## Best Practices for Self-Hosting

- Change the default `PHAVO_SECRET` before deploying
- Use HTTPS (TLS) in production
- Keep your instance updated to the latest version
- Restrict network access to trusted users
