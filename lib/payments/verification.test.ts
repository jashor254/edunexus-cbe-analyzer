// lib/payments/verification.test.ts — what counts as proof of payment (DSA-05).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { classifyProviderVerification, toMinorUnits, type ProviderTransaction } from './verification'

const expected = { transaction_id: 'EDU-1-ABC', amount: 100 }
const good: ProviderTransaction = { status: 'success', reference: 'EDU-1-ABC', amount: 10000, currency: 'KES' }

test('exact reference, amount and currency => verified', () => {
  assert.deepEqual(classifyProviderVerification(expected, good), { kind: 'verified' })
})

test('underpayment is a mismatch', () => {
  assert.deepEqual(classifyProviderVerification(expected, { ...good, amount: 9999 }), { kind: 'mismatch', reason: 'amount' })
})

test('overpayment is also a mismatch (needs a human, is never auto-credited)', () => {
  assert.deepEqual(classifyProviderVerification(expected, { ...good, amount: 10001 }), { kind: 'mismatch', reason: 'amount' })
})

test('wrong currency is a mismatch even when the number matches', () => {
  assert.deepEqual(classifyProviderVerification(expected, { ...good, currency: 'NGN' }), { kind: 'mismatch', reason: 'currency' })
  assert.deepEqual(classifyProviderVerification(expected, { ...good, currency: '' }), { kind: 'mismatch', reason: 'currency' })
})

test('a different reference than the payment row is a mismatch', () => {
  assert.deepEqual(classifyProviderVerification(expected, { ...good, reference: 'EDU-2-XYZ' }), { kind: 'mismatch', reason: 'reference' })
})

test('missing/NaN provider amount can never verify', () => {
  assert.deepEqual(classifyProviderVerification(expected, { ...good, amount: NaN }), { kind: 'mismatch', reason: 'amount' })
})

test('failed and reversed are terminal failures', () => {
  assert.equal(classifyProviderVerification(expected, { ...good, status: 'failed' }).kind, 'failed')
  assert.equal(classifyProviderVerification(expected, { ...good, status: 'reversed' }).kind, 'failed')
})

test('pending, abandoned, ongoing, processing, queued and unknown states are NOT failures', () => {
  for (const status of ['pending', 'abandoned', 'ongoing', 'processing', 'queued', 'something_new']) {
    assert.equal(classifyProviderVerification(expected, { ...good, status }).kind, 'pending', status)
  }
})

test('status is checked before anything else: a non-success state never verifies even with matching figures', () => {
  assert.notEqual(classifyProviderVerification(expected, { ...good, status: 'abandoned' }).kind, 'verified')
})

test('toMinorUnits converts whole KES to the provider unit without float drift', () => {
  assert.equal(toMinorUnits(100), 10000)
  assert.equal(toMinorUnits(2499), 249900)
  assert.equal(toMinorUnits(0.29), 29)
})
