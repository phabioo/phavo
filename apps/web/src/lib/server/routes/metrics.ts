import {
  getCpu,
  getDisk,
  getMemory,
  getNetwork,
  getTemperature,
  getUptime,
  getWeather,
} from '@phavo/agent';
import { err, ok } from '@phavo/types';
import type { Hono } from 'hono';
import { cached } from '$lib/server/agent.js';
import { parseConfigEntries } from '$lib/server/config-helpers.js';
import { db } from '$lib/server/db.js';
import type { AppVariables } from '$lib/server/middleware/auth.js';
import { requireSession } from '$lib/server/middleware/auth.js';

export function registerMetricsRoutes(app: Hono<{ Variables: AppVariables }>): void {
  // System metrics — free+ (requireSession)
  app.get('/cpu', requireSession(), async (c) => {
    try {
      const data = await cached('cpu', 5000, getCpu);
      return c.json(ok(data));
    } catch {
      return c.json(ok({ usage: 0, cores: [], loadAvg: [0, 0, 0], speed: 0, model: 'Unknown' }));
    }
  });

  app.get('/memory', requireSession(), async (c) => {
    try {
      const data = await cached('memory', 5000, getMemory);
      return c.json(ok(data));
    } catch {
      return c.json(ok({ used: 0, total: 0, free: 0, swap: { used: 0, total: 0 } }));
    }
  });

  app.get('/disk', requireSession(), async (c) => {
    try {
      const data = await cached('disk', 5000, getDisk);
      return c.json(ok(data));
    } catch {
      return c.json(ok([]));
    }
  });

  app.get('/network', requireSession(), async (c) => {
    try {
      const data = await cached('network', 5000, getNetwork);
      return c.json(ok(data));
    } catch {
      return c.json(ok({ uploadSpeed: 0, downloadSpeed: 0, totalSent: 0, totalReceived: 0 }));
    }
  });

  app.get('/temperature', requireSession(), async (c) => {
    try {
      const data = await cached('temperature', 10000, getTemperature);
      return c.json(ok(data));
    } catch {
      return c.json(ok({ cpuTemp: null, unit: '°C' }));
    }
  });

  app.get('/uptime', requireSession(), async (c) => {
    try {
      const data = await cached('uptime', 30000, getUptime);
      return c.json(ok(data));
    } catch {
      return c.json(ok({ seconds: 0, formatted: 'Unknown' }));
    }
  });

  // Integration widgets — weather is free+
  app.get('/weather', requireSession(), async (c) => {
    try {
      const rows = await db.query.config.findMany();
      const config = parseConfigEntries(rows);
      const requestedLatitude = Number(c.req.query('latitude'));
      const requestedLongitude = Number(c.req.query('longitude'));
      const hasConfiguredLocation = Boolean(
        config.location?.latitude && config.location?.longitude,
      );
      const latitude = Number.isFinite(requestedLatitude)
        ? requestedLatitude
        : (config.location?.latitude ?? 52.52);
      const longitude = Number.isFinite(requestedLongitude)
        ? requestedLongitude
        : (config.location?.longitude ?? 13.405);
      const cacheKey = `weather:${latitude}:${longitude}`;
      const data = await cached(cacheKey, 300000, () => getWeather(latitude, longitude));
      return c.json(ok({ ...data, locationDefault: !hasConfiguredLocation }));
    } catch {
      return c.json(err('Weather data unavailable'), 500);
    }
  });
}
