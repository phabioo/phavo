import { z } from 'zod';

interface LicenseValidationResult {
  valid: boolean;
  tier: 'free' | 'standard' | 'local';
  graceUntil?: number;
  activationJwt?: string;
  error?: string;
}

const GRACE_PERIOD_FREE = 24 * 60 * 60 * 1000; // 24 hours
const GRACE_PERIOD_STANDARD = 72 * 60 * 60 * 1000; // 72 hours

const LicenseValidateResponseSchema = z.object({
  tier: z.enum(['free', 'standard']),
});

const LicenseActivateResponseSchema = z.object({
  activationJwt: z.string().optional(),
});

export async function validateLicense(
  licenseKey: string,
  authMode: 'phavo-net' | 'local',
): Promise<LicenseValidationResult> {
  // Local tier: validate once on activation, fully offline after
  if (authMode === 'local') {
    return {
      valid: true,
      tier: 'local',
    };
  }

  // phavo.net validation
  const phavoIoUrl = process.env.PHAVO_IO_URL ?? 'https://phavo.net';

  try {
    const response = await fetch(`${phavoIoUrl}/api/license/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ licenseKey }),
    });

    if (response.ok) {
      const raw: unknown = await response.json();
      const parsed = LicenseValidateResponseSchema.safeParse(raw);
      if (!parsed.success) {
        return { valid: false, tier: 'free', error: 'Invalid response from phavo.net' };
      }
      return {
        valid: true,
        tier: parsed.data.tier,
      };
    }

    return { valid: false, tier: 'free' };
  } catch {
    // phavo.net unreachable — apply grace period
    const gracePeriod = licenseKey ? GRACE_PERIOD_STANDARD : GRACE_PERIOD_FREE;
    const graceUntil = Date.now() + gracePeriod;

    return {
      valid: true,
      tier: licenseKey ? 'standard' : 'free',
      graceUntil,
    };
  }
}

export async function activateLocalLicense(
  licenseKey: string,
  instanceIdentifier: string,
): Promise<LicenseValidationResult> {
  const phavoIoUrl = process.env.PHAVO_IO_URL ?? 'https://phavo.net';

  try {
    const response = await fetch(`${phavoIoUrl}/api/license/activate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ licenseKey, instanceId: instanceIdentifier }),
      signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) {
      let error = 'License activation failed';
      try {
        const payload = (await response.json()) as { error?: string };
        if (payload.error) error = payload.error;
      } catch {
        // Ignore invalid error payloads.
      }

      return { valid: false, tier: 'local', error };
    }

    const raw: unknown = await response.json();
    const parsed = LicenseActivateResponseSchema.safeParse(raw);
    if (!parsed.success || !parsed.data.activationJwt) {
      return { valid: false, tier: 'local', error: 'Missing activation token from phavo.net' };
    }

    return {
      valid: true,
      tier: 'local',
      activationJwt: parsed.data.activationJwt,
    };
  } catch {
    return { valid: false, tier: 'local', error: 'phavo.net unreachable' };
  }
}
