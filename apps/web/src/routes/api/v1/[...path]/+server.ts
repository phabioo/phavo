import { err } from '@phavo/types';
import type { RequestEvent } from '@sveltejs/kit';
import { Hono } from 'hono';
import { type AppVariables, authMiddleware } from '$lib/server/middleware/auth.js';
import { csrfMiddleware } from '$lib/server/middleware/csrf.js';
import {
  checkIpRateLimit,
  DEFAULT_RULE,
  getClientIp,
  IMPORT_RULE,
  METRICS_RULE,
  TOTP_RULE,
} from '$lib/server/middleware/rate-limit.js';
import { registerAiRoutes } from '$lib/server/routes/ai.js';
import { registerAuthRoutes } from '$lib/server/routes/auth.js';
import { registerConfigRoutes } from '$lib/server/routes/config.js';
import { registerIntegrationRoutes } from '$lib/server/routes/integrations.js';
import { registerLicenseRoutes } from '$lib/server/routes/license.js';
import { registerMetricsRoutes } from '$lib/server/routes/metrics.js';
import { registerNotificationRoutes } from '$lib/server/routes/notifications.js';
import { registerSystemRoutes } from '$lib/server/routes/system.js';
import { registerTabRoutes } from '$lib/server/routes/tabs.js';
import { registerWidgetRoutes } from '$lib/server/routes/widgets.js';

const app = new Hono<{ Variables: AppVariables }>().basePath('/api/v1');

// â”€â”€â”€ Global middleware â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// authMiddleware validates the session cookie on every non-public request.
// csrfMiddleware validates the X-CSRF-Token header on state-changing requests.
app.use('*', authMiddleware);
app.use('*', csrfMiddleware);

// rateLimitMiddleware: applied after auth so we have the full path.
// /auth/login has its own rate limiting in the handler (checkRateLimit).
// /health is public and not rate-limited here.
app.use('*', async (c, next) => {
  const path = c.req.path;
  // Public paths handled elsewhere â€” skip.
  if (path === '/api/v1/health' || path === '/api/v1/auth/login') {
    return next();
  }

  const ip = getClientIp(c.req);

  // Select the applicable rule based on route.
  let rule = DEFAULT_RULE;
  if (path === '/api/v1/auth/totp') {
    rule = TOTP_RULE;
  } else if (
    path === '/api/v1/cpu' ||
    path === '/api/v1/memory' ||
    path === '/api/v1/disk' ||
    path === '/api/v1/network' ||
    path === '/api/v1/temperature' ||
    path === '/api/v1/uptime' ||
    path === '/api/v1/weather'
  ) {
    rule = METRICS_RULE;
  } else if (path === '/api/v1/config/import') {
    rule = IMPORT_RULE;
  }

  const result = checkIpRateLimit(`${ip}:${path}`, rule);
  if (!result.allowed) {
    const retryAfterSec = Math.ceil((result.retryAfterMs ?? 60_000) / 1000);
    return c.json(err('Rate limit exceeded'), 429, {
      'Retry-After': String(retryAfterSec),
    });
  }

  return next();
});

// â”€â”€â”€ Route modules â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
registerSystemRoutes(app);
registerNotificationRoutes(app);
registerMetricsRoutes(app);
registerIntegrationRoutes(app);
registerTabRoutes(app);
registerWidgetRoutes(app);
registerConfigRoutes(app);
registerLicenseRoutes(app);
registerAuthRoutes(app);
registerAiRoutes(app);

// â”€â”€â”€ SvelteKit adapter â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function honoHandler(event: RequestEvent): Response | Promise<Response> {
  return app.fetch(event.request);
}

export const GET = (event: RequestEvent) => honoHandler(event);
export const POST = (event: RequestEvent) => honoHandler(event);
export const PUT = (event: RequestEvent) => honoHandler(event);
export const PATCH = (event: RequestEvent) => honoHandler(event);
export const DELETE = (event: RequestEvent) => honoHandler(event);
