// lib/payments/siteUrl.test.ts — the payment redirect/callback base URL: one source, fails closed.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { getSiteUrl } from './siteUrl'

test('reads NEXT_PUBLIC_APP_URL and normalises to the origin', () => {
  assert.equal(getSiteUrl({ NEXT_PUBLIC_APP_URL: 'https://www.edunexus.co.ke' }), 'https://www.edunexus.co.ke')
  assert.equal(getSiteUrl({ NEXT_PUBLIC_APP_URL: 'https://www.edunexus.co.ke/' }), 'https://www.edunexus.co.ke')
  assert.equal(getSiteUrl({ NEXT_PUBLIC_APP_URL: 'https://www.edunexus.co.ke/some/path?x=1' }), 'https://www.edunexus.co.ke')
})

test('the legacy NEXT_PUBLIC_SITE_URL is deliberately NOT a second source', () => {
  assert.throws(() => getSiteUrl({ NEXT_PUBLIC_SITE_URL: 'https://www.edunexus.co.ke' }), /not configured/)
  assert.equal(
    getSiteUrl({ NEXT_PUBLIC_APP_URL: 'https://www.edunexus.co.ke', NEXT_PUBLIC_SITE_URL: 'https://other.example' }),
    'https://www.edunexus.co.ke',
  )
})

test('unset or blank => throws (never returns "undefined")', () => {
  assert.throws(() => getSiteUrl({}), /not configured/)
  assert.throws(() => getSiteUrl({ NEXT_PUBLIC_APP_URL: '   ' }), /not configured/)
})

test('malformed or non-https values are rejected', () => {
  assert.throws(() => getSiteUrl({ NEXT_PUBLIC_APP_URL: 'not a url' }), /valid absolute URL/)
  assert.throws(() => getSiteUrl({ NEXT_PUBLIC_APP_URL: 'http://www.edunexus.co.ke' }), /https/)
  assert.throws(() => getSiteUrl({ NEXT_PUBLIC_APP_URL: 'javascript:alert(1)' }), /https/)
})

test('http is allowed only for localhost development', () => {
  assert.equal(getSiteUrl({ NEXT_PUBLIC_APP_URL: 'http://localhost:3000' }), 'http://localhost:3000')
  assert.throws(() => getSiteUrl({ NEXT_PUBLIC_APP_URL: 'http://evil.example' }), /https/)
})
