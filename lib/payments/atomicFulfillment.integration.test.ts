// lib/payments/atomicFulfillment.integration.test.ts
//
// DSA-04 / DSA-05 against a REAL (disposable, local) Postgres + PostgREST:
// proves the database guarantees that unit tests with a fake store cannot —
//   * browser roles cannot invoke the privileged settlement function,
//   * concurrent settlements of one payment credit exactly once (separate
//     HTTP requests = separate database sessions racing for the row lock),
//   * concurrent settlements of DIFFERENT payments for one user lose no credit,
//   * a failing credit leaves the payment pending and is recoverable,
//   * amount/currency/status checks run against the stored payment row.
// Synthetic users and payments only; no Paystack call (the provider is a stub);
// the test client refuses anything but a local Docker target.
//
// Run (DEEP tier): npm run test:deep  — TEST_SUPABASE_* must point at a disposable stack.

import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { createClient as createJsClient, type SupabaseClient } from '@supabase/supabase-js'
import { createTestServiceClient } from '@/utils/supabase/test-service'
import { getSupabasePublishableKey } from '@/utils/supabase/publishableKey'
import { deleteAuthUserOrThrow } from '@/lib/testing/deleteAuthUserOrThrow'
import { createPaymentStore } from './paymentStore'
import { settlePayment, type ProviderVerifier } from './settlement'
import { fulfillPayment } from './fulfillment'
import { TEACHER_PLANNING_BUNDLE } from './config'
import { toMinorUnits } from './verification'

const db = createTestServiceClient()
const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL!
const ANON = getSupabasePublishableKey()
const RPC = 'fulfill_payment_atomic'
const GRANT = TEACHER_PLANNING_BUNDLE.tokens
const PRICE = TEACHER_PLANNING_BUNDLE.priceKes

const userIds: string[] = []

async function mkUser(label: string): Promise<{ id: string; email: string; password: string }> {
  const email = `pay-int-${label}-${Date.now()}-${randomBytes(3).toString('hex')}-synthetic@example.com`
  const password = `Test!${randomBytes(8).toString('hex')}`
  const { data, error } = await db.auth.admin.createUser({ email, password, email_confirm: true })
  if (error || !data?.user) throw new Error(`mkUser: ${error?.message}`)
  userIds.push(data.user.id)
  return { id: data.user.id, email, password }
}

let seq = 0
async function mkPayment(userId: string, productId = 'planning_bundle', amount: number = PRICE): Promise<{ id: string; ref: string }> {
  const ref = `EDU-INT-${Date.now()}-${seq++}-${randomBytes(3).toString('hex').toUpperCase()}`
  const { data, error } = await db.from('payments')
    .insert({ user_id: userId, transaction_id: ref, amount, status: 'pending', product_id: productId })
    .select('id').single()
  if (error || !data) throw new Error(`mkPayment: ${error?.message}`)
  return { id: data.id, ref }
}

const status = async (id: string) => (await db.from('payments').select('status').eq('id', id).single()).data?.status
const balance = async (userId: string) =>
  (await db.from('token_balances').select('balance, total_ever').eq('user_id', userId).maybeSingle()).data

const providerOk = (ref: string, over: Partial<{ status: string; amount: number; currency: string; reference: string }> = {}) => ({
  status: 'success', reference: ref, amount: toMinorUnits(PRICE), currency: 'KES', ...over,
})
const rpcTokens = (client: SupabaseClient, paymentId: string) =>
  client.rpc(RPC, { p_payment_id: paymentId, p_token_grant: GRANT, p_plan: null, p_months: 3 })

after(async () => {
  for (const id of userIds) {
    await db.from('subscriptions').delete().eq('user_id', id)
    await db.from('token_balances').delete().eq('user_id', id)
    await db.from('payments').delete().eq('user_id', id)
    await deleteAuthUserOrThrow(db, id)
  }
})

// ── privileges ───────────────────────────────────────────────────────────────
test('anonymous and ordinary authenticated clients cannot invoke the settlement function', async () => {
  const owner = await mkUser('priv-owner')
  const other = await mkUser('priv-other')
  const pay = await mkPayment(owner.id)

  const anon = createJsClient(URL_, ANON)
  const anonRes = await rpcTokens(anon, pay.id)
  assert.ok(anonRes.error, 'anon was allowed to call fulfill_payment_atomic')

  for (const u of [owner, other]) { // the payment's own owner AND an unrelated user
    const c = createJsClient(URL_, ANON)
    const { error: signInError } = await c.auth.signInWithPassword({ email: u.email, password: u.password })
    assert.equal(signInError, null)
    const res = await rpcTokens(c, pay.id)
    assert.ok(res.error, 'an authenticated browser client was allowed to call fulfill_payment_atomic')
    assert.match(`${res.error!.code} ${res.error!.message}`, /42501|permission denied|not allowed|401|403/i)
  }

  assert.equal(await status(pay.id), 'pending', 'a forged settlement request changed the payment')
  assert.equal(await balance(owner.id), null, 'a forged settlement request credited tokens')
})

test('browser roles cannot write payments or token balances directly either', async () => {
  const u = await mkUser('direct')
  const pay = await mkPayment(u.id)
  const c = createJsClient(URL_, ANON)
  await c.auth.signInWithPassword({ email: u.email, password: u.password })
  await c.from('payments').update({ status: 'success' }).eq('id', pay.id)
  await c.from('token_balances').insert({ user_id: u.id, balance: 999, total_ever: 999 })
  assert.equal(await status(pay.id), 'pending')
  assert.equal(await balance(u.id), null)
})

// ── idempotency + concurrency ────────────────────────────────────────────────
test('service role: first call fulfils, repeat is already_processed', async () => {
  const u = await mkUser('idem'); const pay = await mkPayment(u.id)
  assert.equal((await rpcTokens(db, pay.id)).data, 'fulfilled')
  assert.equal((await rpcTokens(db, pay.id)).data, 'already_processed')
  assert.deepEqual(await balance(u.id), { balance: GRANT, total_ever: GRANT })
})

test('12 concurrent sessions settling ONE payment credit exactly once', async () => {
  const u = await mkUser('race-one'); const pay = await mkPayment(u.id)
  // Pre-existing balance row, so a double credit shows up as a wrong balance (not hidden by an insert conflict).
  await db.from('token_balances').insert({ user_id: u.id, balance: 0, total_ever: 0 })
  const results = await Promise.all(Array.from({ length: 12 }, () => rpcTokens(db, pay.id)))
  const outcomes = results.map(r => r.error ? `ERR:${r.error.message}` : r.data)
  assert.equal(outcomes.filter(o => o === 'fulfilled').length, 1, `outcomes: ${outcomes.join(',')}`)
  assert.equal(outcomes.filter(o => o === 'already_processed').length, 11, `outcomes: ${outcomes.join(',')}`)
  assert.deepEqual(await balance(u.id), { balance: GRANT, total_ever: GRANT })
  assert.equal(await status(pay.id), 'success')
})

test('webhook and browser callback racing through the real settlement path credit once', async () => {
  const u = await mkUser('race-settle'); const pay = await mkPayment(u.id)
  const deps = { store: createPaymentStore(db), verify: (async ref => providerOk(ref)) as ProviderVerifier }
  const results = await Promise.all([1, 2, 3, 4, 5, 6].map(() => settlePayment(deps, pay.ref)))
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1)
  assert.equal(results.filter(r => r.status === 'already_processed').length, 5)
  assert.deepEqual(await balance(u.id), { balance: GRANT, total_ever: GRANT })
})

test('10 concurrent DIFFERENT payments for one user lose no credit (no read-modify-write race)', async () => {
  const u = await mkUser('race-many')
  const pays = await Promise.all(Array.from({ length: 10 }, () => mkPayment(u.id)))
  const results = await Promise.all(pays.map(p => rpcTokens(db, p.id)))
  assert.ok(results.every(r => !r.error && r.data === 'fulfilled'), JSON.stringify(results.map(r => r.error?.message ?? r.data)))
  assert.deepEqual(await balance(u.id), { balance: GRANT * 10, total_ever: GRANT * 10 })
})

test('2 concurrent subscription payments for a new user create ONE subscription extended by both', async () => {
  const u = await mkUser('race-sub')
  const [a, b] = await Promise.all([mkPayment(u.id, 'term', 2499), mkPayment(u.id, 'term', 2499)])
  const call = (id: string) => db.rpc(RPC, { p_payment_id: id, p_token_grant: null, p_plan: 'term', p_months: 3 })
  const results = await Promise.all([call(a.id), call(b.id)])
  assert.ok(results.every(r => !r.error && r.data === 'fulfilled'), JSON.stringify(results.map(r => r.error?.message ?? r.data)))
  const { data: subs } = await db.from('subscriptions').select('id, expires_at, status').eq('user_id', u.id)
  assert.equal(subs?.length, 1, 'duplicate subscription rows')
  const months = (new Date(subs![0].expires_at).getTime() - Date.now()) / 86_400_000 / 30.4
  assert.ok(months > 5.5 && months < 6.5, `expected ~6 months, got ${months.toFixed(2)}`)
})

// ── failure + recovery ───────────────────────────────────────────────────────
test('a failing credit leaves the payment pending, credits nothing, and a retry succeeds', async () => {
  const u = await mkUser('partial'); const pay = await mkPayment(u.id)
  // Natural failure: the balance column is a 32-bit integer; this credit would overflow it.
  await db.from('token_balances').insert({ user_id: u.id, balance: 2147483646, total_ever: 2147483646 })
  const deps = { store: createPaymentStore(db), verify: (async ref => providerOk(ref)) as ProviderVerifier }

  await assert.rejects(settlePayment(deps, pay.ref), /Failed to fulfil payment/)
  assert.equal(await status(pay.id), 'pending', 'payment must not be marked complete when crediting failed')
  assert.deepEqual(await balance(u.id), { balance: 2147483646, total_ever: 2147483646 })

  await db.from('token_balances').update({ balance: 0, total_ever: 0 }).eq('user_id', u.id) // fault cleared
  assert.equal((await settlePayment(deps, pay.ref)).status, 'fulfilled')
  assert.deepEqual(await balance(u.id), { balance: GRANT, total_ever: GRANT })
  assert.equal((await settlePayment(deps, pay.ref)).status, 'already_processed')
})

// ── amount / currency / provider status against the stored row ───────────────
test('wrong amount, wrong currency and wrong reference are rejected and never credited', async () => {
  const u = await mkUser('verify-mismatch')
  for (const over of [{ amount: 100 }, { amount: toMinorUnits(PRICE) + 1 }, { currency: 'USD' }, { reference: 'EDU-SOMEONE-ELSE' }]) {
    const pay = await mkPayment(u.id)
    const deps = { store: createPaymentStore(db), verify: (async ref => providerOk(ref, over)) as ProviderVerifier }
    const r = await settlePayment(deps, pay.ref)
    assert.equal(r.status, 'rejected', JSON.stringify(over))
    assert.equal(await status(pay.id), 'failed')
  }
  assert.equal(await balance(u.id), null, 'a mismatched payment credited tokens')
})

test('failed provider result stays unfulfilled; pending can later succeed', async () => {
  const u = await mkUser('verify-states')
  const failedPay = await mkPayment(u.id)
  const failedDeps = { store: createPaymentStore(db), verify: (async ref => providerOk(ref, { status: 'failed' })) as ProviderVerifier }
  assert.equal((await settlePayment(failedDeps, failedPay.ref)).status, 'failed')
  assert.equal(await status(failedPay.id), 'failed')
  assert.equal(await balance(u.id), null)

  const pendingPay = await mkPayment(u.id)
  let providerStatus = 'abandoned'
  const deps = { store: createPaymentStore(db), verify: (async ref => providerOk(ref, { status: providerStatus })) as ProviderVerifier }
  assert.equal((await settlePayment(deps, pendingPay.ref)).status, 'pending')
  assert.equal(await status(pendingPay.id), 'pending', 'a non-final provider state must not fail the payment')
  providerStatus = 'success'
  assert.equal((await settlePayment(deps, pendingPay.ref)).status, 'fulfilled')
  assert.deepEqual(await balance(u.id), { balance: GRANT, total_ever: GRANT })
})

test('a row left failed by the old behaviour is recovered once the provider confirms the exact amount', async () => {
  const u = await mkUser('recover'); const pay = await mkPayment(u.id)
  await db.from('payments').update({ status: 'failed' }).eq('id', pay.id)
  const deps = { store: createPaymentStore(db), verify: (async ref => providerOk(ref)) as ProviderVerifier }
  assert.equal((await settlePayment(deps, pay.ref)).status, 'fulfilled')
  assert.equal(await status(pay.id), 'success')
})

test('fulfillPayment (library entry point) uses the same atomic path and stays idempotent', async () => {
  const u = await mkUser('lib'); const pay = await mkPayment(u.id)
  const [x, y] = await Promise.all([
    fulfillPayment(db, { id: pay.id, user_id: u.id, product_id: 'planning_bundle' }),
    fulfillPayment(db, { id: pay.id, user_id: u.id, product_id: 'planning_bundle' }),
  ])
  assert.deepEqual([x, y].sort(), ['already_processed', 'fulfilled'])
  assert.deepEqual(await balance(u.id), { balance: GRANT, total_ever: GRANT })
})
