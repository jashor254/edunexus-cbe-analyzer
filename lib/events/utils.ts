// lib/events/utils.ts
// Webhook signing secret generation and HMAC-SHA256 signature computation.

/**
 * Generate a cryptographically-random webhook signing secret.
 * Format: whsec_{48-char-hex}
 * Unlike an API key, this must remain retrievable server-side (not just
 * hashed) because the platform needs the original secret to compute an
 * HMAC-SHA256 signature on every outbound delivery — this is the standard
 * symmetric-secret pattern used by Stripe, GitHub, and other webhook senders.
 */
export function generateWebhookSecret(): string {
  const randomBytes = crypto.getRandomValues(new Uint8Array(24))
  const hex = Array.from(randomBytes).map(b => b.toString(16).padStart(2, '0')).join('')
  return `whsec_${hex}`
}

/**
 * Compute an HMAC-SHA256 signature over a webhook payload body.
 * Returns a hex-encoded digest, to be sent as the X-EduNexus-Signature header
 * in the form "sha256=<hex>".
 *
 * Verification (for documentation — receivers should do this):
 *   1. Read the raw request body as a string (do not re-serialize JSON —
 *      whitespace/key-order differences will produce a different signature).
 *   2. Compute HMAC-SHA256 of that exact string using your subscription's
 *      signing secret (shown once at subscription creation).
 *   3. Compare the result, hex-encoded, against the value after "sha256="
 *      in the X-EduNexus-Signature header using a constant-time comparison.
 *   4. Reject the request if they don't match, or if the header is missing.
 */
export async function signWebhookPayload(secret: string, body: string): Promise<string> {
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(body))
  return Array.from(new Uint8Array(signature)).map(b => b.toString(16).padStart(2, '0')).join('')
}
