// lib/payments/chargeVerification.test.ts
//
// Security audit 2026-10-30, F-10: a payment is fulfilled only when the
// verified Paystack charge is in KES and covers the server-side price.
// The end-to-end callback behaviour is proven against a real database in
// app/api/payments/callback/route.chargeAmount.integration.test.ts.
//
// Run with: npx tsx --test lib/payments/chargeVerification.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { chargeCoversPayment, toMinorUnits, PAYMENT_CURRENCY } from './chargeVerification'

const PAYMENT = { amount: 500 } // KES 500, initialised to Paystack as 50000

test('the exact KES amount is accepted', () => {
  assert.equal(chargeCoversPayment({ amount: 50_000, currency: 'KES' }, PAYMENT), true)
})

test('overpayment is accepted (unchanged verify-route behaviour)', () => {
  assert.equal(chargeCoversPayment({ amount: 60_000, currency: 'KES' }, PAYMENT), true)
})

test('any underpayment is refused, including by one minor unit', () => {
  assert.equal(chargeCoversPayment({ amount: 49_999, currency: 'KES' }, PAYMENT), false)
  assert.equal(chargeCoversPayment({ amount: 100, currency: 'KES' }, PAYMENT), false)
})

test('a charge in another currency is refused even when the number is larger', () => {
  for (const currency of ['NGN', 'USD', 'GHS', 'kes', undefined, null]) {
    assert.equal(chargeCoversPayment({ amount: 10_000_000, currency }, PAYMENT), false, String(currency))
  }
})

test('a missing or non-numeric amount is refused', () => {
  for (const amount of [undefined, null, '50000', NaN, Infinity]) {
    assert.equal(chargeCoversPayment({ amount, currency: 'KES' }, PAYMENT), false, String(amount))
  }
})

test('units: whole KES are converted to Paystack minor units', () => {
  assert.equal(PAYMENT_CURRENCY, 'KES')
  assert.equal(toMinorUnits(500), 50_000)
  assert.equal(toMinorUnits(149.99), 14_999)
})
