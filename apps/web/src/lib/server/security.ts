/**
 * Shared security utilities for route handlers.
 */

/** Blocks requests targeting cloud metadata endpoints (SSRF prevention). */
export function assertNotCloudMetadata(urlString: string): void {
  const parsed = new URL(urlString);
  const hostname = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '');

  const blockedHostnames = ['169.254.169.254', 'metadata.google.internal', 'metadata.goog'];
  const blockedPatterns = [/^169\.254\./, /^fd00:ec2:/i, /^::1$/];

  if (blockedHostnames.includes(hostname)) {
    throw new Error('URL not allowed');
  }

  for (const pattern of blockedPatterns) {
    if (pattern.test(hostname)) {
      throw new Error('URL not allowed');
    }
  }

  if (parsed.username || parsed.password) {
    throw new Error('URL not allowed');
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('URL not allowed');
  }
}
