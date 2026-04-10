import { createPublicKey, verify as verifySignature } from 'node:crypto';
import { z } from 'zod';

const LicensePayloadSchema = z.object({
  tier: z.literal('celestial'),
  licenseId: z.string().min(1),
  issuedAt: z.string().min(1),
});

export type OfflineLicenseActivation = {
  tier: 'celestial';
  licenseId: string;
  issuedAt: string;
  payloadB64: string;
  signatureB64: string;
};

type LicenseActivationResult =
  | { valid: true; activation: OfflineLicenseActivation }
  | { valid: false; error: string };

function decodeBase64Url(value: string): Uint8Array {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/');
  const normalized = padded + '='.repeat((4 - (padded.length % 4)) % 4);
  return Uint8Array.from(Buffer.from(normalized, 'base64'));
}

function encodeBase64Url(value: Uint8Array): string {
  return Buffer.from(value)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function importEd25519PublicKey(publicKeyInput: string) {
  const trimmed = publicKeyInput.trim();
  if (!trimmed) {
    throw new Error('Missing PHAVO_LICENSE_PUBLIC_KEY');
  }

  if (trimmed.includes('BEGIN PUBLIC KEY')) {
    return createPublicKey(trimmed);
  }

  return createPublicKey({
    key: Buffer.from(trimmed, 'base64'),
    format: 'der',
    type: 'spki',
  });
}

function parseSignedLicenseKey(licenseKey: string): {
  signature: Uint8Array;
  payload: Uint8Array;
  payloadB64: string;
  signatureB64: string;
} {
  const decoded = decodeBase64Url(licenseKey.trim());
  // Ed25519 signatures are fixed-length 64 bytes.
  const payloadStart = 64;
  if (decoded.length <= payloadStart) {
    throw new Error('Malformed license key');
  }

  const signature = decoded.slice(0, payloadStart);
  const payload = decoded.slice(payloadStart);

  return {
    signature,
    payload,
    payloadB64: encodeBase64Url(payload),
    signatureB64: encodeBase64Url(signature),
  };
}

function verifyOfflinePayload(payload: Uint8Array, signature: Uint8Array): boolean {
  const pubKey = importEd25519PublicKey(process.env.PHAVO_LICENSE_PUBLIC_KEY ?? '');
  return verifySignature(null, Buffer.from(payload), pubKey, Buffer.from(signature));
}

export function verifyStoredLicenseActivation(input: {
  payloadB64: string;
  signatureB64: string;
}): OfflineLicenseActivation | null {
  try {
    const payloadBytes = decodeBase64Url(input.payloadB64);
    const signatureBytes = decodeBase64Url(input.signatureB64);
    if (!verifyOfflinePayload(payloadBytes, signatureBytes)) return null;

    const payloadJson = JSON.parse(Buffer.from(payloadBytes).toString('utf-8')) as unknown;
    const parsed = LicensePayloadSchema.safeParse(payloadJson);
    if (!parsed.success) return null;

    return {
      tier: parsed.data.tier,
      licenseId: parsed.data.licenseId,
      issuedAt: parsed.data.issuedAt,
      payloadB64: input.payloadB64,
      signatureB64: input.signatureB64,
    };
  } catch {
    return null;
  }
}

export function activateOfflineLicense(licenseKey: string): LicenseActivationResult {
  try {
    const { payload, signature, payloadB64, signatureB64 } = parseSignedLicenseKey(licenseKey);
    if (!verifyOfflinePayload(payload, signature)) {
      return { valid: false, error: 'Invalid license signature' };
    }

    const payloadJson = JSON.parse(Buffer.from(payload).toString('utf-8')) as unknown;
    const parsed = LicensePayloadSchema.safeParse(payloadJson);
    if (!parsed.success) {
      return { valid: false, error: 'Invalid license payload' };
    }

    return {
      valid: true,
      activation: {
        tier: 'celestial',
        licenseId: parsed.data.licenseId,
        issuedAt: parsed.data.issuedAt,
        payloadB64,
        signatureB64,
      },
    };
  } catch {
    return { valid: false, error: 'Invalid license key format' };
  }
}
