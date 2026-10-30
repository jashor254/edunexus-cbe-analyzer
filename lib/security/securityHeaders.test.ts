// lib/security/securityHeaders.test.ts
//
// Security audit 2026-10-30, F-06: every response carries the browser
// security headers, the CSP is report-only (staged), and the policies keep
// the device features the app genuinely uses. The live response check is
// part of the post-build smoke test in the remediation report.
//
// Run with: npx tsx --test lib/security/securityHeaders.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildSecurityHeaders, buildContentSecurityPolicy } from './securityHeaders'
import nextConfig from '../../next.config'

const SUPABASE = 'https://lpxrfbmzncaztpmyqzkc.supabase.co'
const byKey = (headers: Array<{ key: string; value: string }>) => Object.fromEntries(headers.map(h => [h.key, h.value]))

test('clickjacking, MIME sniffing and referrer leakage are prevented', () => {
  const h = byKey(buildSecurityHeaders({ supabaseUrl: SUPABASE }))
  assert.equal(h['X-Frame-Options'], 'DENY')
  assert.equal(h['X-Content-Type-Options'], 'nosniff')
  assert.equal(h['Referrer-Policy'], 'strict-origin-when-cross-origin')
})

test('device APIs are off except microphone (/learn speech input) and camera (script capture)', () => {
  const p = byKey(buildSecurityHeaders({}))['Permissions-Policy']
  assert.match(p, /microphone=\(self\)/)
  assert.match(p, /camera=\(self\)/)
  for (const off of ['geolocation', 'payment', 'usb']) assert.match(p, new RegExp(`${off}=\\(\\)`))
})

test('the CSP ships report-only in this phase, never as an enforced header', () => {
  const h = byKey(buildSecurityHeaders({ supabaseUrl: SUPABASE }))
  assert.ok(h['Content-Security-Policy-Report-Only'])
  assert.equal(h['Content-Security-Policy'], undefined)
})

test('the CSP allows exactly the origins the app loads from, and forbids framing and plugins', () => {
  const csp = buildContentSecurityPolicy({ supabaseUrl: SUPABASE })
  const directive = (name: string) => csp.split('; ').find(d => d.startsWith(`${name} `)) ?? ''
  assert.match(directive('connect-src'), new RegExp(SUPABASE.replace(/\./g, '\\.')))
  assert.match(directive('connect-src'), /wss:\/\/lpxrfbmzncaztpmyqzkc\.supabase\.co/)
  assert.match(directive('img-src'), new RegExp(SUPABASE.replace(/\./g, '\\.')))
  assert.equal(directive('frame-ancestors'), "frame-ancestors 'none'")
  assert.equal(directive('object-src'), "object-src 'none'")
  assert.ok(!csp.includes('paystack'), 'Paystack is a redirect and needs no CSP allowance')
  assert.ok(!/\*(?!\.supabase\.co)/.test(csp), 'no unexpected wildcard source')
})

test('without a configured Supabase URL the CSP falls back to the Supabase domain, not to *', () => {
  assert.match(buildContentSecurityPolicy({}), /connect-src 'self' https:\/\/\*\.supabase\.co wss:\/\/\*\.supabase\.co/)
})

test('next.config applies the headers to every path', async () => {
  const rules = await nextConfig.headers()
  const all = rules.find(r => r.source === '/:path*')
  assert.ok(all, 'no catch-all header rule')
  const h = byKey(all.headers)
  for (const key of ['X-Frame-Options', 'X-Content-Type-Options', 'Referrer-Policy', 'Permissions-Policy', 'Content-Security-Policy-Report-Only']) {
    assert.ok(h[key], `${key} missing from next.config headers()`)
  }
})
