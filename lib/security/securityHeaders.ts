// lib/security/securityHeaders.ts
//
// Browser security headers applied to every response (next.config.ts
// `headers()`). Security audit 2026-10-30, F-06: production sent only the
// HSTS header Vercel adds by default — no clickjacking protection, no
// nosniff, no referrer or permissions policy, no CSP.
//
// Kept free of `@/` imports so next.config.ts can load it directly.
//
// What is ENFORCED now:
//   X-Frame-Options: DENY            no page may be framed (clickjacking).
//                                     The app frames nothing of its own.
//   X-Content-Type-Options: nosniff   no MIME sniffing of uploads/responses.
//   Referrer-Policy                   cross-origin requests get the origin
//                                     only — never paths such as
//                                     /shared/<token> or /join/<code>.
//   Permissions-Policy                device APIs off except the two the app
//                                     uses: microphone (speech input on
//                                     /learn) and camera (script capture
//                                     inputs, capture="environment").
//
// What is REPORT-ONLY (Content-Security-Policy-Report-Only):
//   A policy derived from what the app actually loads: its own origin, the
//   Supabase project (REST/Auth from the browser, signed Storage images),
//   and Vercel Analytics (same-origin /_vercel). Paystack is a full-page
//   redirect, so it needs no allowance. script-src still permits inline
//   scripts because Next.js emits inline bootstrap scripts; moving to
//   per-request nonces (generated in proxy.ts) is the step before
//   enforcing. Violations surface in the browser console during staging
//   smoke tests; no collection endpoint exists yet.
//
// HSTS is deliberately left to Vercel's default (max-age=63072000).
// includeSubDomains / preload must wait for a verified inventory of every
// edunexus.co.ke subdomain.

export type SecurityHeader = { key: string; value: string }

const PERMISSIONS_POLICY = [
  'camera=(self)',
  'microphone=(self)',
  'geolocation=()',
  'payment=()',
  'usb=()',
  'serial=()',
  'bluetooth=()',
  'midi=()',
  'magnetometer=()',
  'gyroscope=()',
  'accelerometer=()',
  'browsing-topics=()',
].join(', ')

function originOf(url: string | undefined): string | null {
  if (!url) return null
  try {
    return new URL(url).origin
  } catch {
    return null
  }
}

export function buildContentSecurityPolicy(env: { supabaseUrl?: string }): string {
  const supabase = originOf(env.supabaseUrl) ?? 'https://*.supabase.co'
  const supabaseWs = supabase.replace(/^https:/, 'wss:').replace(/^http:/, 'ws:')

  const directives: Record<string, string[]> = {
    'default-src':     ["'self'"],
    'script-src':      ["'self'", "'unsafe-inline'"],
    'style-src':       ["'self'", "'unsafe-inline'"],
    'img-src':         ["'self'", 'data:', 'blob:', supabase],
    'font-src':        ["'self'", 'data:'],
    'connect-src':     ["'self'", supabase, supabaseWs],
    'media-src':       ["'self'", 'blob:'],
    'worker-src':      ["'self'", 'blob:'],
    'frame-src':       ["'self'"],
    'frame-ancestors': ["'none'"],
    'object-src':      ["'none'"],
    'base-uri':        ["'self'"],
    'form-action':     ["'self'"],
  }
  return Object.entries(directives).map(([name, values]) => `${name} ${values.join(' ')}`).join('; ')
}

export function buildSecurityHeaders(env: { supabaseUrl?: string }): SecurityHeader[] {
  return [
    { key: 'X-Frame-Options',                     value: 'DENY' },
    { key: 'X-Content-Type-Options',              value: 'nosniff' },
    { key: 'Referrer-Policy',                     value: 'strict-origin-when-cross-origin' },
    { key: 'Permissions-Policy',                  value: PERMISSIONS_POLICY },
    { key: 'Content-Security-Policy-Report-Only', value: buildContentSecurityPolicy(env) },
  ]
}
