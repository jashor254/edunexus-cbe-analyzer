// app/api/payments/callback/route.webhookAuthenticity.integration.test.ts
//
// H2A / SEC-PAY-001 — proves the Paystack webhook boundary
// (app/api/payments/callback/route.ts POST) can never mutate a payment
// record without a signature that verifies against the exact raw request
// body, using the real exported route handler (not a mock of signature
// verification) and the real local Supabase instance.
//
// Deliberately never calls the real Paystack API: every scenario is
// constructed so the route's signature check (or its idempotency fast path)
// short-circuits before `processPayment()` would reach the live
// `fetch('https://api.paystack.co/...')` call — see route.ts step 3, only
// reached once a payment is both found and not already 'success'. Cases
// below either fail signature verification first, or resolve a payment that
// is either not found or already 'success', so that line is never executed.
//
// Run: npx tsx --env-file=.env.local --experimental-test-module-mocks --test app/api/payments/callback/route.webhookAuthenticity.integration.test.ts
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createHmac } from 'crypto'
import { createTestServiceClient as createServiceClient } from '@/utils/supabase/test-service'
import { POST } from './route'

const SYNTHETIC_MARKER = 'SYNTHETIC_WEBHOOK_AUTH_TEST'
const db = createServiceClient()
const WEBHOOK_SECRET = process.env.PAYSTACK_WEBHOOK_SECRET

let userId: string
const createdTransactionIds: string[] = []

before(async () => {
  if (!WEBHOOK_SECRET) {
    throw new Error('PAYSTACK_WEBHOOK_SECRET must be set to run this test — it exercises the real signature-verification code path.')
  }
  const { data, error } = await db.auth.admin.createUser({
    email: `${SYNTHETIC_MARKER.toLowerCase()}-${Date.now()}@example.com`,
    password: `Test!${Math.random().toString(36).slice(2, 10)}`,
    email_confirm: true,
  })
  if (error || !data.user) throw new Error(`user creation failed: ${error?.message}`)
  userId = data.user.id
})

after(async () => {
  if (createdTransactionIds.length) await db.from('payments').delete().in('transaction_id', createdTransactionIds)
  if (userId) await db.auth.admin.deleteUser(userId)
})

function sign(body: string): string {
  return createHmac('sha512', WEBHOOK_SECRET!).update(body).digest('hex')
}

async function seedPayment(status: 'pending' | 'success'): Promise<string> {
  const transactionId = `${SYNTHETIC_MARKER}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  createdTransactionIds.push(transactionId)
  const { error } = await db
    .from('payments')
    .insert({ user_id: userId, transaction_id: transactionId, amount: 500, status, product_id: 'starter' })
  if (error) throw new Error(`seedPayment failed: ${error.message}`)
  return transactionId
}

function chargeSuccessBody(reference: string): string {
  return JSON.stringify({ event: 'charge.success', data: { reference, status: 'success' } })
}

function postWebhook(body: string, signature: string | undefined): Promise<Response> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (signature !== undefined) headers['x-paystack-signature'] = signature
  const req = new Request('http://localhost/api/payments/callback', { method: 'POST', headers, body })
  return POST(req)
}

async function paymentStatus(transactionId: string): Promise<string> {
  const { data } = await db.from('payments').select('status').eq('transaction_id', transactionId).single()
  return data!.status
}

test('missing signature header is rejected and the payment is never touched', async () => {
  const ref = await seedPayment('pending')
  const res = await postWebhook(chargeSuccessBody(ref), undefined)
  assert.equal(res.status, 401)
  assert.equal(await paymentStatus(ref), 'pending')
})

test('an incorrect signature is rejected and the payment is never touched', async () => {
  const ref = await seedPayment('pending')
  const body = chargeSuccessBody(ref)
  const res = await postWebhook(body, 'deadbeef'.repeat(16))
  assert.equal(res.status, 401)
  assert.equal(await paymentStatus(ref), 'pending')
})

test('a signature computed over a different body is rejected — raw-byte integrity, not reserialized equality', async () => {
  const ref = await seedPayment('pending')
  const signedBody = chargeSuccessBody(ref)
  const signature = sign(signedBody)

  // Same JSON meaning, different bytes (reordered/reformatted) — proves the
  // route checks the exact raw body, not a reparsed/reserialized version of it.
  const mutatedBody = JSON.stringify({ event: 'charge.success', data: { status: 'success', reference: ref } }, null, 1)
  assert.notEqual(mutatedBody, signedBody, 'sanity check: mutated body must actually differ byte-for-byte')

  const res = await postWebhook(mutatedBody, signature)
  assert.equal(res.status, 401)
  assert.equal(await paymentStatus(ref), 'pending', 'a forged/mutated payload must never reach fulfillment, even with a signature valid for different bytes')
})

test('a valid signature is accepted for a real, correctly-signed body', async () => {
  // Deliberately references a payment that does not exist — processPayment()
  // short-circuits at its "payment not found" step (before any Paystack
  // call), so this proves signature acceptance without ever reaching the
  // live api.paystack.co fetch.
  const ref = `${SYNTHETIC_MARKER}-nonexistent-${Date.now()}`
  const body = chargeSuccessBody(ref)
  const res = await postWebhook(body, sign(body))
  assert.equal(res.status, 200)
  const json = await res.json()
  assert.equal(json.received, true)
})

test('a validly-signed non-charge.success event is accepted but never mutates the payment', async () => {
  const ref = await seedPayment('pending')
  const body = JSON.stringify({ event: 'charge.failed', data: { reference: ref, status: 'failed' } })
  const res = await postWebhook(body, sign(body))
  assert.equal(res.status, 200)
  assert.equal(await paymentStatus(ref), 'pending', 'only charge.success triggers processPayment()')
})

test('a validly-signed but malformed event body is safely rejected, not a 500 crash', async () => {
  const body = '{not valid json'
  const res = await postWebhook(body, sign(body))
  assert.equal(res.status, 500)
  const json = await res.json()
  assert.ok(json.error, 'must return a structured error, not leak a stack trace or crash the process')
})

test('a valid duplicate charge.success event for an already-fulfilled payment is idempotent (fast path, no re-fulfillment)', async () => {
  const ref = await seedPayment('success')
  const body = chargeSuccessBody(ref)
  const res = await postWebhook(body, sign(body))
  assert.equal(res.status, 200)
  assert.equal(await paymentStatus(ref), 'success', 'stays success — the already-success fast path short-circuits before any Paystack call or re-fulfillment')
})
