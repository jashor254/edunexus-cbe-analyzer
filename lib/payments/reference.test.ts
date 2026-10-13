// lib/payments/reference.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isValidPaymentReference } from './reference'

test('accepts every reference shape we issue', () => {
  assert.equal(isValidPaymentReference('EDU-1760000000000-k3j9x2abc'), true)  // paystack.ts generateReference
  assert.equal(isValidPaymentReference('EDU-1760000000000-K3J9X2'), true)     // initialize / mobile-init
  assert.equal(isValidPaymentReference('MANUAL-1760000000000-AB12CD'), true)  // admin activate-user
  assert.equal(isValidPaymentReference('T123456789012345_x'), true)           // Paystack-style
})

test('rejects values that could rewrite the Paystack verify path', () => {
  assert.equal(isValidPaymentReference('../../customer'), false)
  assert.equal(isValidPaymentReference('EDU-1/../../transaction'), false)
  assert.equal(isValidPaymentReference('EDU-1%2F..%2Fcustomer'), false)
  assert.equal(isValidPaymentReference('EDU-1?perPage=100'), false)
})

test('rejects values that could inject redirect query parameters', () => {
  assert.equal(isValidPaymentReference('EDU-1&plan=premium'), false)
  assert.equal(isValidPaymentReference('EDU-1#x'), false)
  assert.equal(isValidPaymentReference('EDU 1'), false)
})

test('rejects empty and oversized references', () => {
  assert.equal(isValidPaymentReference(''), false)
  assert.equal(isValidPaymentReference('A'.repeat(101)), false)
  assert.equal(isValidPaymentReference('A'.repeat(100)), true)
})
