// app/api/payments/callback/route.settlement.test.ts
//
// Route-level behaviour of the Paystack callback (GET) and webhook (POST) on
// top of the single settlement path. Mocks the service client, the
// Supabase-backed store/verifier and the event bus so no network, database or
// Paystack account is touched. mock.module is registered before ./route loads.
//
// Run: npm test -- app/api/payments/callback/route.settlement.test.ts

import { test, before, beforeEach, mock } from 'node:test'
import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import type { PaymentRecord, PaymentStore } from '@/lib/payments/settlement'
import type { ProviderTransaction } from '@/lib/payments/verification'

const WEBHOOK_SECRET = 'test-webhook-secret'

let row: PaymentRecord | null
let provider: ProviderTransaction | Error
let fulfilThrows: boolean
const calls = { fulfil: 0, markFailed: 0, events: [] as string[] }

mock.module('@/lib/events', { namedExports: { publishEvent: async (e: { event_type: string }) => { calls.events.push(e.event_type) } } })
mock.module('@/lib/payments/paymentStore', {
  namedExports: {
    createServicePaymentStore: (): PaymentStore => ({
      async findByReference(ref) { return row && row.transaction_id === ref ? { ...row } : null },
      async markFailed() { calls.markFailed++; if (row) row.status = 'failed' },
      async fulfil() {
        calls.fulfil++
        if (fulfilThrows) throw new Error('atomic fulfilment failed')
        if (row?.status === 'success') return 'already_processed'
        if (row) row.status = 'success'
        return 'fulfilled'
      },
      async listPendingOlderThan() { return [] },
    }),
    verifyWithPaystack: async () => { if (provider instanceof Error) throw provider; return provider },
  },
})

let GET: typeof import('./route').GET
let POST: typeof import('./route').POST
before(async () => { ;({ GET, POST } = await import('./route')) })

const okTx: ProviderTransaction = { status: 'success', reference: 'EDU-1-ABC', amount: 10000, currency: 'KES' }
beforeEach(() => {
  row = { id: 'pay-1', user_id: 'user-1', product_id: 'planning_bundle', amount: 100, status: 'pending', transaction_id: 'EDU-1-ABC' }
  provider = { ...okTx }
  fulfilThrows = false
  calls.fulfil = 0; calls.markFailed = 0; calls.events = []
  process.env.NEXT_PUBLIC_APP_URL = 'https://www.example.test'
  process.env.PAYSTACK_WEBHOOK_SECRET = WEBHOOK_SECRET
})

const getReq = (qs: string) => new Request(`https://www.example.test/api/payments/callback?${qs}`)
function webhook(body: unknown, secret = WEBHOOK_SECRET, signed = true): Request {
  const raw = JSON.stringify(body)
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (signed) headers['x-paystack-signature'] = createHmac('sha512', secret).update(raw).digest('hex')
  return new Request('https://www.example.test/api/payments/callback', { method: 'POST', headers, body: raw })
}
const chargeSuccess = { event: 'charge.success', data: { reference: 'EDU-1-ABC' } }

// ── GET (browser redirect) ────────────────────────────────────────────────────
test('GET: success redirects using the STORED product, ignoring a forged ?plan=', async () => {
  const res = await GET(getReq('reference=EDU-1-ABC&plan=premium'))
  assert.equal(res.status, 307)
  const loc = new URL(res.headers.get('location')!)
  assert.equal(loc.pathname, '/payment/success')
  assert.equal(loc.searchParams.get('plan'), 'planning_bundle', 'plan must come from the payments row')
  assert.equal(calls.fulfil, 1)
  assert.deepEqual(calls.events, ['billing.payment.succeeded'])
})

test('GET: a malformed or unknown reference never fulfils anything', async () => {
  const res1 = await GET(getReq('reference=../../etc'))
  assert.match(res1.headers.get('location')!, /error=not_found/)
  const res2 = await GET(getReq('reference=EDU-UNKNOWN'))
  assert.match(res2.headers.get('location')!, /error=not_found/)
  assert.equal(calls.fulfil, 0)
})

test('GET: pending payment is not marked failed and is not shown as success', async () => {
  provider = { ...okTx, status: 'pending' }
  const res = await GET(getReq('reference=EDU-1-ABC'))
  assert.match(res.headers.get('location')!, /\/pricing\?error=payment_pending/)
  assert.equal(calls.markFailed, 0)
  assert.equal(calls.fulfil, 0)
  assert.equal(row!.status, 'pending')
})

test('GET: amount mismatch goes to the failed page and is not credited', async () => {
  provider = { ...okTx, amount: 100 }
  const res = await GET(getReq('reference=EDU-1-ABC'))
  assert.match(res.headers.get('location')!, /\/payment\/failed/)
  assert.equal(calls.fulfil, 0)
  assert.deepEqual(calls.events, ['billing.payment.failed'])
})

test('GET: missing site URL configuration fails closed with 500 (no "undefined/…" redirect)', async () => {
  delete process.env.NEXT_PUBLIC_APP_URL
  const res = await GET(getReq('reference=EDU-1-ABC'))
  assert.equal(res.status, 500)
  assert.equal(calls.fulfil, 0)
})

test('GET: duplicate redirect after success is idempotent', async () => {
  await GET(getReq('reference=EDU-1-ABC'))
  const second = await GET(getReq('reference=EDU-1-ABC'))
  assert.match(second.headers.get('location')!, /\/payment\/success/)
  assert.equal(calls.fulfil, 0 + 1, 'second delivery short-circuits on status=success; fulfil ran once')
})

// ── POST (Paystack webhook) ───────────────────────────────────────────────────
test('POST: bad or missing signature => 401 and nothing happens', async () => {
  assert.equal((await POST(webhook(chargeSuccess, 'wrong-secret'))).status, 401)
  assert.equal((await POST(webhook(chargeSuccess, WEBHOOK_SECRET, false))).status, 401)
  assert.equal(calls.fulfil, 0)
})

test('POST: webhook secret not configured => 500 (fails closed)', async () => {
  delete process.env.PAYSTACK_WEBHOOK_SECRET
  assert.equal((await POST(webhook(chargeSuccess))).status, 500)
})

test('POST: valid charge.success fulfils once; a redelivery is a harmless 200', async () => {
  assert.equal((await POST(webhook(chargeSuccess))).status, 200)
  assert.equal((await POST(webhook(chargeSuccess))).status, 200)
  assert.equal(calls.fulfil, 1)
})

test('POST: webhook racing the browser redirect credits once', async () => {
  const [a, b] = await Promise.all([GET(getReq('reference=EDU-1-ABC')), POST(webhook(chargeSuccess))])
  assert.equal(a.status, 307); assert.equal(b.status, 200)
  assert.equal(row!.status, 'success')
})

test('POST: fulfilment failure => 500 so Paystack retries; payment stays pending', async () => {
  fulfilThrows = true
  const res = await POST(webhook(chargeSuccess))
  assert.equal(res.status, 500)
  assert.equal(row!.status, 'pending')
  fulfilThrows = false
  assert.equal((await POST(webhook(chargeSuccess))).status, 200, 'the retry completes it')
  assert.equal(row!.status, 'success')
})

test('POST: provider unreachable or not-yet-final => 503 so Paystack retries', async () => {
  provider = new Error('ECONNRESET')
  assert.equal((await POST(webhook(chargeSuccess))).status, 503)
  provider = { ...okTx, status: 'pending' }
  assert.equal((await POST(webhook(chargeSuccess))).status, 503)
  assert.equal(row!.status, 'pending')
})

test('POST: a signed charge.success with a wrong amount is acknowledged but never credited', async () => {
  provider = { ...okTx, amount: 1 }
  assert.equal((await POST(webhook(chargeSuccess))).status, 200)
  assert.equal(calls.fulfil, 0)
})

test('POST: other events are ignored; missing reference is a 400', async () => {
  assert.equal((await POST(webhook({ event: 'charge.failed', data: { reference: 'EDU-1-ABC' } }))).status, 200)
  assert.equal(calls.fulfil, 0)
  assert.equal((await POST(webhook({ event: 'charge.success', data: {} }))).status, 400)
})
