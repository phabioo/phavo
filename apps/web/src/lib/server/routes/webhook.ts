// apps/web/src/lib/server/routes/webhook.ts
// Gumroad purchase webhook — verifies HMAC, generates license key, delivers via Gumroad API.

import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { err, ok } from '@phavo/types';
import { env } from '@phavo/types/env';
import type { Hono } from 'hono';
import { generateLicenseKey } from '../license-generator.js';
import type { AppVariables } from '../middleware/auth.js';

// Best-effort in-process idempotency for Gumroad retries.
// Keys are pruned after 24h to keep memory bounded.
const processedSales = new Map<string, number>();
const PROCESSED_SALE_TTL_MS = 24 * 60 * 60 * 1000;

function pruneProcessedSales(now = Date.now()): void {
  for (const [saleId, seenAt] of processedSales) {
    if (now - seenAt > PROCESSED_SALE_TTL_MS) {
      processedSales.delete(saleId);
    }
  }
}

function normalizeSignature(raw: string): string {
  // Accept both "<hex>" and "sha256=<hex>" forms.
  const value = raw.trim();
  return value.toLowerCase().startsWith('sha256=') ? value.slice(7) : value;
}

async function deliverLicenseViaGumroad(
  saleId: string,
  licenseKey: string,
  apiKey: string,
): Promise<void> {
  const res = await fetch(`https://api.gumroad.com/v2/sales/${saleId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      access_token: apiKey,
      // Gumroad custom receipt field — appears in the buyer's receipt email
      custom_fields: JSON.stringify({
        'License Key': licenseKey,
      }),
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gumroad API error ${res.status}: ${text}`);
  }
}

export function registerWebhookRoutes(app: Hono<{ Variables: AppVariables }>): void {
  app.post('/webhooks/gumroad', async (c) => {
    const rawBody = await c.req.text();

    // Verify Gumroad HMAC-SHA256 signature
    const signature = c.req.header('X-Gumroad-Signature');
    if (!signature || !env.PHAVO_GUMROAD_WEBHOOK_SECRET) {
      return c.json(err('Missing signature'), 401);
    }

    const normalizedSignature = normalizeSignature(signature);

    const expected = createHmac('sha256', env.PHAVO_GUMROAD_WEBHOOK_SECRET)
      .update(rawBody)
      .digest('hex');

    // Both are hex strings — compare as buffers via timingSafeEqual
    const sigBuffer = Buffer.from(normalizedSignature, 'hex');
    const expBuffer = Buffer.from(expected, 'hex');

    if (sigBuffer.length !== expBuffer.length || !timingSafeEqual(sigBuffer, expBuffer)) {
      return c.json(err('Invalid signature'), 401);
    }

    // Parse Gumroad payload (form-encoded or JSON)
    let data: Record<string, string>;
    const contentType = c.req.header('Content-Type') ?? '';
    try {
      if (contentType.includes('application/json')) {
        data = JSON.parse(rawBody) as Record<string, string>;
      } else {
        data = Object.fromEntries(new URLSearchParams(rawBody));
      }
    } catch {
      // Invalid payloads are ignored to avoid noisy retries from malformed requests.
      return c.json(ok({ warning: 'invalid_payload' }));
    }

    // Only process successful sales with required fields
    if (data.sale_id && data.email) {
      pruneProcessedSales();
      if (processedSales.has(data.sale_id)) {
        return c.json(ok({ duplicate: true }));
      }

      const privateKeyB64 = env.PHAVO_LICENSE_PRIVATE_KEY;
      if (!privateKeyB64) {
        console.error('[webhook] PHAVO_LICENSE_PRIVATE_KEY not set');
        return c.json(err('Key not configured'), 500);
      }

      try {
        // Decode PEM from base64 storage
        const pemKey = Buffer.from(privateKeyB64, 'base64').toString('utf-8');

        const payload = {
          licenseId: randomUUID(),
          email: data.email,
          product: 'phavo-celestial',
          tier: 'celestial' as const,
          issuedAt: String(Math.floor(Date.now() / 1000)),
          gumroadOrderId: data.sale_id,
        };

        const licenseKey = generateLicenseKey(payload, pemKey);

        const gumroadApiKey = env.PHAVO_GUMROAD_API_KEY;
        if (!gumroadApiKey) {
          console.error('[webhook] PHAVO_GUMROAD_API_KEY not set');
          return c.json(ok({ warning: 'api_key_missing' }));
        }

        await deliverLicenseViaGumroad(data.sale_id, licenseKey, gumroadApiKey);

        processedSales.set(data.sale_id, Date.now());

        console.log(`[webhook] License delivered via Gumroad for order ${data.sale_id}`);
      } catch (e) {
        console.error('[webhook] License generation failed:', e);
        // Return 200 to Gumroad to prevent retries; log for manual recovery
        return c.json(ok({ warning: 'delivery_failed' }));
      }
    }

    return c.json(ok(null));
  });
}
