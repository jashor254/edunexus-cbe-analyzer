// lib/payments/siteUrl.ts
// The public base URL used to build Paystack callback URLs and post-payment
// redirects. ONE source: NEXT_PUBLIC_APP_URL — the variable the rest of the
// application already uses for absolute links (emails, invites, WhatsApp) and
// the one Production defines. (Payments previously read NEXT_PUBLIC_SITE_URL,
// which Production does not define, producing "undefined/api/…" callback URLs.)
// The value is validated, normalised to an origin, and the function FAILS
// CLOSED (throws) rather than ever emitting a malformed URL.

type EnvSource = Record<string, string | undefined>

export const SITE_URL_ENV = 'NEXT_PUBLIC_APP_URL'

export function getSiteUrl(env: EnvSource = process.env): string {
  const raw = env[SITE_URL_ENV]?.trim()
  if (!raw) {
    throw new Error(`Site URL is not configured (set ${SITE_URL_ENV})`)
  }

  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw new Error(`${SITE_URL_ENV} is not a valid absolute URL`)
  }
  const local = url.hostname === 'localhost' || url.hostname === '127.0.0.1'
  if (url.protocol !== 'https:' && !(local && url.protocol === 'http:')) {
    throw new Error(`${SITE_URL_ENV} must use https`)
  }
  return url.origin
}
