// apps/web/src/lib/server/license-generator.ts
// Generates signed Ed25519 license keys for Celestial tier.
// Output format must match the verifier in license.ts:
//   base64url( signature_64_bytes + payload_bytes )

import { createPrivateKey, sign } from 'node:crypto';

export interface LicensePayload {
  licenseId: string;
  email: string;
  product: string;
  tier: 'celestial';
  issuedAt: string;
  gumroadOrderId: string;
}

function encodeBase64Url(value: Uint8Array): string {
  return Buffer.from(value)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export function generateLicenseKey(payload: LicensePayload, privateKeyPem: string): string {
  const payloadBytes = Buffer.from(JSON.stringify(payload), 'utf-8');

  const privateKey = createPrivateKey(privateKeyPem);
  const signature = sign(null, payloadBytes, privateKey);

  // Verifier expects: base64url( signature (64 bytes) + payload )
  const combined = Buffer.concat([signature, payloadBytes]);
  return encodeBase64Url(new Uint8Array(combined));
}
