import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { schema } from '@phavo/db';
import { err, ok } from '@phavo/types';
import { desc, eq } from 'drizzle-orm';
import type { Hono } from 'hono';
import { z } from 'zod';
import { db } from '$lib/server/db.js';
import { activateLocalLicense } from '$lib/server/license.js';
import type { AppVariables } from '$lib/server/middleware/auth.js';
import { requireSession } from '$lib/server/middleware/auth.js';
import { paths } from '$lib/server/paths.js';
import { generateSessionToken, setSessionCookies } from './_auth-helpers.js';

function readOrCreateInstanceIdentifier(): string {
  try {
    if (existsSync(paths.instanceId)) {
      return readFileSync(paths.instanceId, 'utf-8').trim();
    }

    const instanceIdentifier = crypto.randomUUID();
    writeFileSync(paths.instanceId, instanceIdentifier);
    return instanceIdentifier;
  } catch {
    return crypto.randomUUID();
  }
}

export function registerLicenseRoutes(app: Hono<{ Variables: AppVariables }>): void {
  app.post('/license/activate', requireSession(), async (c) => {
    try {
      const session = c.get('session');
      if (!session) return c.json(err('Unauthorized'), 401);

      let rawBody: unknown;
      try {
        rawBody = await c.req.json();
      } catch {
        return c.json(err('Invalid request body'), 400);
      }

      const requestBody = z.object({ licenseKey: z.string().min(1) }).safeParse(rawBody);
      if (!requestBody.success) {
        return c.json(err('Invalid licence key'), 400);
      }

      const instanceIdentifier = readOrCreateInstanceIdentifier();
      const activation = await activateLocalLicense(
        requestBody.data.licenseKey,
        instanceIdentifier,
      );
      if (!activation.valid || !activation.activationJwt) {
        const status = activation.error === 'phavo.net unreachable' ? 503 : 400;
        return c.json(err(activation.error ?? 'License activation failed'), status);
      }

      const existingActivations = await db.select().from(schema.licenseActivation);
      for (const activationRow of existingActivations) {
        await db
          .delete(schema.licenseActivation)
          .where(eq(schema.licenseActivation.id, activationRow.id));
      }

      await db.insert(schema.licenseActivation).values({
        licenseKey: requestBody.data.licenseKey,
        tier: 'celestial',
        activationJwt: activation.activationJwt,
        instanceIdentifier,
      });

      await db.delete(schema.sessions).where(eq(schema.sessions.id, session.id));

      const token = generateSessionToken();
      const sessionMaxAge = 7 * 24 * 60 * 60;
      await db.insert(schema.sessions).values({
        id: token,
        userId: session.userId,
        tier: 'celestial',
        authMode: session.authMode,
        validatedAt: Date.now(),
        graceUntil: null,
        expiresAt: Date.now() + sessionMaxAge * 1000,
      });

      const response = c.json(ok({ tier: 'celestial' as const, reload: true }));
      await setSessionCookies(response, token, sessionMaxAge);
      return response;
    } catch (e) {
      console.error('[phavo]', e);
      return c.json(err('Internal error'), 500);
    }
  });

  app.post('/license/deactivate', requireSession(), async (c) => {
    try {
      const session = c.get('session');
      if (!session) return c.json(err('Unauthorized'), 401);

      const licenseRows = await db
        .select()
        .from(schema.licenseActivation)
        .orderBy(desc(schema.licenseActivation.activatedAt))
        .limit(1);
      const licenseActivation = licenseRows[0];

      if (!licenseActivation) {
        return c.json(err('No active local licence found'), 400);
      }

      const phavoIoUrl = process.env.PHAVO_IO_URL ?? 'https://phavo.net';

      let response: Response;
      try {
        response = await fetch(`${phavoIoUrl}/api/license/deactivate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            licenseKey: licenseActivation.licenseKey,
            instanceId: licenseActivation.instanceIdentifier,
          }),
          signal: AbortSignal.timeout(15_000),
        });
      } catch {
        return c.json(
          err('phavo.net unreachable — internet connection required to deactivate'),
          503,
        );
      }

      if (!response.ok) {
        let errorMessage = 'Failed to deactivate licence';
        try {
          const payload = (await response.json()) as { error?: string };
          if (payload.error) errorMessage = payload.error;
        } catch {
          // Ignore malformed error bodies.
        }

        return c.json(err(errorMessage), 400);
      }

      const activationRows = await db.select().from(schema.licenseActivation);
      for (const activationRow of activationRows) {
        await db
          .delete(schema.licenseActivation)
          .where(eq(schema.licenseActivation.id, activationRow.id));
      }

      await db
        .update(schema.sessions)
        .set({ tier: 'stellar', graceUntil: null })
        .where(eq(schema.sessions.id, session.id));

      return c.json(ok({ tier: 'stellar' as const, reload: true }));
    } catch (e) {
      console.error('[phavo]', e);
      return c.json(err('Internal error'), 500);
    }
  });
}
