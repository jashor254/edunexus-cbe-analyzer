// lib/payments/paywall.test.ts
//
// Proves every "out of tokens" answer names a real product and a place to buy
// it. Before this, the answer was a 403 "Please top up" with nowhere to top up.
// Pure — no DB, no network.
//
// Run with: npm test -- lib/payments/paywall.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { resolvePaywall, paywallMessage, apiPaymentRequired } from './paywall'

test('a second scheme of work points at the KES 100 Planning Bundle on the teacher tab', () => {
  const info = resolvePaywall('sow_generate')
  assert.equal(info.productId, 'planning_bundle')
  assert.equal(info.priceKes, 100)
  assert.equal(info.payUrl, '/pricing?tab=teacher&product=planning_bundle')
})

test('class reports and insha point at their own KES 100 products', () => {
  assert.equal(resolvePaywall('class_reports_generate').productId, 'class_reports')
  assert.equal(resolvePaywall('class_reports_generate').priceKes, 100)
  assert.equal(resolvePaywall('kiswahili_insha_pack').productId, 'insha_pack')
  assert.equal(resolvePaywall('kiswahili_insha_pack').priceKes, 100)
})

test('parent features point at the Term Plan on the family tab', () => {
  const info = resolvePaywall('career_intelligence_report')
  assert.equal(info.productId, 'term')
  assert.equal(info.payUrl, '/pricing?tab=family&product=term')
})

test('a feature with no single product still gets somewhere to go', () => {
  const info = resolvePaywall('adaptive_variant_generate')
  assert.equal(info.productId, null)
  assert.equal(info.payUrl, '/pricing?tab=teacher')
})

test('the message names the price', () => {
  assert.match(paywallMessage(resolvePaywall('sow_generate')), /KES 100/)
})

test('the response is a 402 with the paywall in data', async () => {
  const res = apiPaymentRequired('slides_generate')
  assert.equal(res.status, 402)
  const body = await res.json() as { success: boolean; data: { code: string; productId: string } }
  assert.equal(body.success, false)
  assert.equal(body.data.code, 'payment_required')
  assert.equal(body.data.productId, 'slides')
})
