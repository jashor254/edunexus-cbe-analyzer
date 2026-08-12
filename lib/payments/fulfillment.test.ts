// lib/payments/fulfillment.test.ts
//
// Integration tests for the shared payment-fulfillment path used by both
// app/api/payments/callback/route.ts (webhook + browser redirect) and
// app/api/payments/verify/route.ts (client-triggered verify).
//
// Proves the three things Sprint 1 of the Pilot Hardening plan requires:
//   1. A successful fulfillment marks the payment 'success' and credits tokens.
//   2. Calling fulfillPayment() again for an already-fulfilled payment is a
//      safe no-op (no double-credit).
//   3. Two callers racing for the SAME payment (the webhook and the browser
//      redirect arriving concurrently, which Paystack's retry behavior makes
//      a real scenario) can only credit tokens once between them.
//
// Run with: npx tsx --env-file=.env.local --test lib/payments/fulfillment.test.ts
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createServiceClient } from '@/utils/supabase/service'
import { fulfillPayment } from './fulfillment'
import { TOKEN_PACK } from './config'

const SYNTHETIC_MARKER = 'SYNTHETIC_FULFILLMENT_TEST'
const db = createServiceClient()

let userId: string

async function createPendingPayment(productId: string, amount: number): Promise<{ id: string; transaction_id: string }> {
  const transactionId = `${SYNTHETIC_MARKER}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const { data, error } = await db
    .from('payments')
    .insert({ user_id: userId, transaction_id: transactionId, amount, status: 'pending', product_id: productId })
    .select('id, transaction_id')
    .single()
  if (error || !data) throw new Error(`Failed to seed pending payment: ${error?.message}`)
  return data
}

before(async () => {
  const { data: authUser } = await db.auth.admin.createUser({
    email: `fulfillment-test-${Date.now()}@example.com`,
    password: `Test!${Math.random().toString(36).slice(2, 10)}`,
    email_confirm: true,
  })
  userId = authUser!.user.id
})

after(async () => {
  await db.from('subscriptions').delete().eq('user_id', userId)
  await db.from('token_balances').delete().eq('user_id', userId)
  await db.from('payments').delete().eq('user_id', userId)
  await db.auth.admin.deleteUser(userId)
})

test('fulfillPayment marks the payment success and credits tokens on first call', async () => {
  const payment = await createPendingPayment('starter', TOKEN_PACK.priceKes)

  const result = await fulfillPayment(db, { id: payment.id, user_id: userId, product_id: 'starter' })
  assert.equal(result, 'fulfilled')

  const { data: updatedPayment } = await db.from('payments').select('status').eq('id', payment.id).single()
  assert.equal(updatedPayment?.status, 'success')

  const { data: balance } = await db.from('token_balances').select('balance, total_ever').eq('user_id', userId).single()
  assert.equal(balance?.balance, TOKEN_PACK.tokens, 'balance should equal exactly one token pack — no more, no less')
  assert.equal(balance?.total_ever, TOKEN_PACK.tokens)
})

test('a second, sequential fulfillPayment call for the same payment does not double-credit', async () => {
  const payment = await createPendingPayment('starter', TOKEN_PACK.priceKes)
  const before  = await db.from('token_balances').select('balance').eq('user_id', userId).maybeSingle()
  const balanceBefore = before.data?.balance ?? 0

  const first  = await fulfillPayment(db, { id: payment.id, user_id: userId, product_id: 'starter' })
  const second = await fulfillPayment(db, { id: payment.id, user_id: userId, product_id: 'starter' })

  assert.equal(first, 'fulfilled')
  assert.equal(second, 'already_processed')

  const { data: balanceAfter } = await db.from('token_balances').select('balance').eq('user_id', userId).single()
  assert.equal(balanceAfter?.balance, balanceBefore + TOKEN_PACK.tokens, 'balance must increase by exactly one token pack, not two')
})

test('two concurrent fulfillPayment calls for the same payment (webhook + browser racing) credit tokens exactly once', async () => {
  const payment = await createPendingPayment('starter', TOKEN_PACK.priceKes)
  const before  = await db.from('token_balances').select('balance').eq('user_id', userId).maybeSingle()
  const balanceBefore = before.data?.balance ?? 0

  const [resultA, resultB] = await Promise.all([
    fulfillPayment(db, { id: payment.id, user_id: userId, product_id: 'starter' }),
    fulfillPayment(db, { id: payment.id, user_id: userId, product_id: 'starter' }),
  ])

  const results = [resultA, resultB].sort()
  assert.deepEqual(results, ['already_processed', 'fulfilled'], 'exactly one of the two racing calls should win fulfillment')

  const { data: balanceAfter } = await db.from('token_balances').select('balance').eq('user_id', userId).single()
  assert.equal(balanceAfter?.balance, balanceBefore + TOKEN_PACK.tokens, 'a race between two callers must still only credit tokens once')
})

test('a subscription product creates an active subscription with a 3-month expiry', async () => {
  const payment = await createPendingPayment('term', 2499)

  const result = await fulfillPayment(db, { id: payment.id, user_id: userId, product_id: 'term' })
  assert.equal(result, 'fulfilled')

  const { data: sub } = await db
    .from('subscriptions')
    .select('status, plan, expires_at')
    .eq('user_id', userId)
    .eq('status', 'active')
    .single()

  assert.equal(sub?.plan, 'term')
  assert.equal(sub?.status, 'active')
  const monthsUntilExpiry = (new Date(sub!.expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24 * 30)
  assert.ok(monthsUntilExpiry > 2.5 && monthsUntilExpiry < 3.5, 'expiry should be roughly 3 months out')
})

test('a family-plan payment credits an active subscription with plan=family', async () => {
  // Regression test for the subscriptions_plan_check drift: the live
  // constraint only allowed ('term','premium','school') and rejected
  // 'family', even though SUBSCRIPTION_PRODUCTS and SUBSCRIPTION_PLANS
  // have treated 'family' as canonical since the term/family pricing model
  // shipped. This proves the constraint fix actually unblocks fulfillment,
  // not just that the migration ran without erroring.
  const payment = await createPendingPayment('family', 4499)

  const result = await fulfillPayment(db, { id: payment.id, user_id: userId, product_id: 'family' })
  assert.equal(result, 'fulfilled')

  const { data: sub } = await db
    .from('subscriptions')
    .select('status, plan, expires_at')
    .eq('user_id', userId)
    .eq('status', 'active')
    .eq('plan', 'family')
    .single()

  assert.equal(sub?.plan, 'family')
  assert.equal(sub?.status, 'active')
})

test('renewing an existing subscription extends it instead of creating a duplicate row', async () => {
  const { data: existingSubs } = await db.from('subscriptions').select('id').eq('user_id', userId).eq('status', 'active')
  assert.equal(existingSubs?.length, 1, 'precondition: exactly one active subscription from the previous test')

  const renewalPayment = await createPendingPayment('term', 2499)
  const result = await fulfillPayment(db, { id: renewalPayment.id, user_id: userId, product_id: 'term' })
  assert.equal(result, 'fulfilled')

  const { data: subsAfterRenewal } = await db.from('subscriptions').select('id, expires_at').eq('user_id', userId).eq('status', 'active')
  assert.equal(subsAfterRenewal?.length, 1, 'renewal must extend the existing row, not insert a second active subscription')
})
