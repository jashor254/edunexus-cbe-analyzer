// app/api/payments/callback/route.chargeAmount.integration.test.ts
//
// Security audit 2026-10-30, F-10, end to end: a correctly SIGNED Paystack
// webhook for a real pending payment fulfils it only when Paystack's
// verification shows a KES charge covering the server-side price. Uses the
// real route handler, real signature check, real fulfilment and a real
// database; only the outbound call to api.paystack.co is answered locally
// (every other fetch — the Supabase clients — passes through untouched), so
// no real payment API is ever contacted.
//
// Run with: npm run test:deep (TEST_SUPABASE_* pointed at a disposable stack)
import { test, before, after, mock } from 'node:test'
import assert from 'node:assert/strict'
import { createHmac, randomBytes } from 'node:crypto'
import { createTestServiceClient } from '@/utils/supabase/test-service'
import { deleteAuthUserOrThrow } from '@/lib/testing/deleteAuthUserOrThrow'
import { POST } from './route'

const MARKER = 'SYNTHETIC_CHARGE_AMOUNT'
const db = createTestServiceClient()
const WEBHOOK_SECRET = process.env.PAYSTACK_WEBHOOK_SECRET

let verifyReply: { amount: unknown; currency: unknown } = { amount: 0, currency: 'KES' }
const realFetch = globalThis.fetch
mock.method(globalThis, 'fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = input instanceof Request ? input.url : String(input)
  if (url.startsWith('https://api.paystack.co/')) {
    return Response.json({ status: true, data: { status: 'success', ...verifyReply } })
  }
  return realFetch(input, init)
})

let userId: string
const refs: string[] = []

before(async () => {
  if (!WEBHOOK_SECRET) throw new Error('PAYSTACK_WEBHOOK_SECRET must be set — this exercises the real signature path.')
  const { data, error } = await db.auth.admin.createUser({
    email: `charge-amount-${Date.now()}-${randomBytes(3).toString('hex')}-synthetic@example.com`,
    password: `Test!${randomBytes(8).toString('hex')}`, email_confirm: true,
  })
  if (error || !data.user) throw new Error(`user: ${error?.message}`)
  userId = data.user.id
})

after(async () => {
  for (const [table, run] of [
    ['payments',       () => db.from('payments').delete().in('transaction_id', refs)],
    ['token_usage',    () => db.from('token_usage').delete().eq('user_id', userId)],
    ['token_balances', () => db.from('token_balances').delete().eq('user_id', userId)],
  ] as const) {
    const { error } = await run()
    if (error) throw new Error(`cleanup ${table}: ${error.message}`)
  }
  if (userId) await deleteAuthUserOrThrow(db, userId)
})

async function seedPending(): Promise<string> {
  const ref = `${MARKER}_${Date.now()}_${randomBytes(3).toString('hex')}`
  refs.push(ref)
  const { error } = await db.from('payments').insert({ user_id: userId, transaction_id: ref, amount: 500, status: 'pending', product_id: 'starter' })
  if (error) throw new Error(`seed: ${error.message}`)
  return ref
}

async function deliverSignedWebhook(ref: string): Promise<Response> {
  const body = JSON.stringify({ event: 'charge.success', data: { reference: ref, status: 'success' } })
  const signature = createHmac('sha512', WEBHOOK_SECRET!).update(body).digest('hex')
  return POST(new Request('http://localhost/api/payments/callback', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'x-paystack-signature': signature }, body,
  }))
}

const status = async (ref: string) => (await db.from('payments').select('status').eq('transaction_id', ref).single()).data!.status
const balance = async () => (await db.from('token_balances').select('balance').eq('user_id', userId).maybeSingle()).data?.balance ?? 0

test('an underpaid charge is never fulfilled', async () => {
  const ref = await seedPending()
  verifyReply = { amount: 100, currency: 'KES' } // KES 1 for a KES 500 product
  assert.equal((await deliverSignedWebhook(ref)).status, 200)
  assert.equal(await status(ref), 'failed')
  assert.equal(await balance(), 0)
})

test('a charge in another currency is never fulfilled, even for a larger number', async () => {
  const ref = await seedPending()
  verifyReply = { amount: 5_000_000, currency: 'NGN' }
  await deliverSignedWebhook(ref)
  assert.equal(await status(ref), 'failed')
  assert.equal(await balance(), 0)
})

test('a correct KES charge is fulfilled exactly once, however often Paystack delivers it', async () => {
  const ref = await seedPending()
  verifyReply = { amount: 50_000, currency: 'KES' }
  await deliverSignedWebhook(ref)
  assert.equal(await status(ref), 'success')
  const credited = await balance()
  assert.ok(credited > 0, 'the paid product was not credited')

  await deliverSignedWebhook(ref)
  await deliverSignedWebhook(ref)
  assert.equal(await balance(), credited, 'a duplicate delivery credited again')
})

test('a mismatched late delivery never reverses a payment that already succeeded', async () => {
  const ref = refs[refs.length - 1]
  verifyReply = { amount: 1, currency: 'USD' }
  await deliverSignedWebhook(ref)
  assert.equal(await status(ref), 'success')
})
