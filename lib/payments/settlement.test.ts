// lib/payments/settlement.test.ts
//
// Behavioural tests for the single payment-settlement path (DSA-04 / DSA-05),
// using an in-memory PaymentStore whose fulfil() models the database function
// public.fulfill_payment_atomic: it is serialised per payment (row lock),
// idempotent, and all-or-nothing (an injected failure leaves NOTHING changed).
// The real database guarantee is proven separately by the rolled-back SQL
// harness; these tests prove the service logic that sits on top of it.
//
// No network, no live Paystack, no real database.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { settlePayment, type PaymentRecord, type PaymentStore, type ProviderVerifier, type FulfilOutcome } from './settlement'
import { reconcilePendingPayments } from './reconciliation'
import type { ProviderTransaction } from './verification'

type Fake = {
  store: PaymentStore
  rows: Map<string, PaymentRecord>
  credits: Array<{ paymentId: string; userId: string; productId: string }>
  failedReasons: string[]
  failNextFulfil: { count: number }
  fulfilCalls: { count: number }
}

function makeFake(initial: PaymentRecord[]): Fake {
  const rows = new Map(initial.map(r => [r.transaction_id, { ...r }]))
  const credits: Fake['credits'] = []
  const failedReasons: string[] = []
  const failNextFulfil = { count: 0 }
  const fulfilCalls = { count: 0 }
  let lock: Promise<unknown> = Promise.resolve() // models the row lock

  const store: PaymentStore = {
    async findByReference(ref) { const r = rows.get(ref); return r ? { ...r } : null },
    async markFailed(id, reason) {
      for (const r of rows.values()) if (r.id === id && r.status === 'pending') { r.status = 'failed'; failedReasons.push(reason) }
    },
    fulfil(payment) {
      const run = async (): Promise<FulfilOutcome> => {
        fulfilCalls.count++
        const row = [...rows.values()].find(r => r.id === payment.id)!
        if (row.status === 'success') return 'already_processed'
        if (failNextFulfil.count > 0) { failNextFulfil.count--; throw new Error('injected: entitlement write failed') } // atomic: nothing changed
        credits.push({ paymentId: row.id, userId: row.user_id, productId: row.product_id })
        row.status = 'success'
        return 'fulfilled'
      }
      const next = lock.then(run, run)
      lock = next.catch(() => undefined)
      return next
    },
    async listPendingOlderThan(_m, limit) { return [...rows.values()].filter(r => r.status === 'pending').slice(0, limit).map(r => ({ ...r })) },
  }
  return { store, rows, credits, failedReasons, failNextFulfil, fulfilCalls }
}

const base = (over: Partial<PaymentRecord> = {}): PaymentRecord => ({
  id: 'pay-1', user_id: 'user-1', product_id: 'planning_bundle', amount: 100, status: 'pending', transaction_id: 'EDU-1-ABC', ...over,
})
const providerOk = (over: Partial<ProviderTransaction> = {}): ProviderTransaction => ({
  status: 'success', reference: 'EDU-1-ABC', amount: 10000, currency: 'KES', ...over,
})
const verifierFor = (tx: ProviderTransaction | (() => ProviderTransaction)): ProviderVerifier =>
  async () => (typeof tx === 'function' ? tx() : tx)

// 1
test('valid successful payment is fulfilled exactly once', async () => {
  const f = makeFake([base()])
  const r = await settlePayment({ store: f.store, verify: verifierFor(providerOk()) }, 'EDU-1-ABC')
  assert.equal(r.status, 'fulfilled')
  assert.equal(f.credits.length, 1)
  assert.equal(f.rows.get('EDU-1-ABC')!.status, 'success')
})

// 2
test('incorrect amount is rejected, not credited, and recorded as failed', async () => {
  const f = makeFake([base()])
  const r = await settlePayment({ store: f.store, verify: verifierFor(providerOk({ amount: 100 })) }, 'EDU-1-ABC') // 1 KES instead of 100
  assert.deepEqual(r.status === 'rejected' && r.reason, 'amount')
  assert.equal(f.credits.length, 0)
  assert.equal(f.fulfilCalls.count, 0)
  assert.equal(f.rows.get('EDU-1-ABC')!.status, 'failed')
})

// 3
test('incorrect currency is rejected and not credited', async () => {
  const f = makeFake([base()])
  const r = await settlePayment({ store: f.store, verify: verifierFor(providerOk({ currency: 'USD' })) }, 'EDU-1-ABC')
  assert.equal(r.status === 'rejected' && r.reason, 'currency')
  assert.equal(f.credits.length, 0)
})

// 3b — a provider response for a different reference than the row
test('a verify response for a different reference is rejected', async () => {
  const f = makeFake([base()])
  const r = await settlePayment({ store: f.store, verify: verifierFor(providerOk({ reference: 'EDU-OTHER' })) }, 'EDU-1-ABC')
  assert.equal(r.status === 'rejected' && r.reason, 'reference')
  assert.equal(f.credits.length, 0)
})

// 4
test('unknown transaction reference => not_found, no provider call', async () => {
  const f = makeFake([base()])
  let called = 0
  const r = await settlePayment({ store: f.store, verify: async () => { called++; return providerOk() } }, 'EDU-NOPE')
  assert.equal(r.status, 'not_found')
  assert.equal(called, 0)
})

test('malformed reference is rejected before any lookup', async () => {
  const f = makeFake([base()])
  for (const bad of ['', '../x', 'a b', 'x?y=1', 'x'.repeat(101)]) {
    assert.equal((await settlePayment({ store: f.store, verify: verifierFor(providerOk()) }, bad)).status, 'invalid_reference', bad)
  }
})

// 5
test('provider says failed => payment marked failed, nothing credited', async () => {
  const f = makeFake([base()])
  const r = await settlePayment({ store: f.store, verify: verifierFor(providerOk({ status: 'failed' })) }, 'EDU-1-ABC')
  assert.equal(r.status, 'failed')
  assert.equal(f.rows.get('EDU-1-ABC')!.status, 'failed')
  assert.equal(f.credits.length, 0)
})

// 6
test('provider says pending/abandoned => stays pending (NOT failed) and a later success still fulfils', async () => {
  const f = makeFake([base()])
  let tx = providerOk({ status: 'pending' })
  const deps = { store: f.store, verify: async () => tx }

  const first = await settlePayment(deps, 'EDU-1-ABC')
  assert.equal(first.status, 'pending')
  assert.equal(f.rows.get('EDU-1-ABC')!.status, 'pending', 'a non-final provider state must not write a permanent failure')

  tx = providerOk({ status: 'abandoned' })
  assert.equal((await settlePayment(deps, 'EDU-1-ABC')).status, 'pending')

  tx = providerOk() // customer completes the M-PESA prompt late; webhook arrives
  const later = await settlePayment(deps, 'EDU-1-ABC')
  assert.equal(later.status, 'fulfilled')
  assert.equal(f.credits.length, 1)
})

test('a row wrongly left failed by an earlier version is recovered when the provider confirms success', async () => {
  const f = makeFake([base({ status: 'failed' })])
  const r = await settlePayment({ store: f.store, verify: verifierFor(providerOk()) }, 'EDU-1-ABC')
  assert.equal(r.status, 'fulfilled')
  assert.equal(f.credits.length, 1)
})

test('...but a failed row whose provider figures mismatch is still never credited', async () => {
  const f = makeFake([base({ status: 'failed' })])
  const r = await settlePayment({ store: f.store, verify: verifierFor(providerOk({ amount: 1 })) }, 'EDU-1-ABC')
  assert.equal(r.status, 'rejected')
  assert.equal(f.credits.length, 0)
})

// 7 + 8
test('duplicate callback / duplicate webhook: second delivery is a no-op', async () => {
  const f = makeFake([base()])
  const deps = { store: f.store, verify: verifierFor(providerOk()) }
  assert.equal((await settlePayment(deps, 'EDU-1-ABC')).status, 'fulfilled')
  assert.equal((await settlePayment(deps, 'EDU-1-ABC')).status, 'already_processed')
  assert.equal((await settlePayment(deps, 'EDU-1-ABC')).status, 'already_processed')
  assert.equal(f.credits.length, 1)
})

// 9
test('webhook and browser callback racing for the same reference credit exactly once', async () => {
  const f = makeFake([base()])
  const deps = { store: f.store, verify: verifierFor(providerOk()) }
  const results = await Promise.all([settlePayment(deps, 'EDU-1-ABC'), settlePayment(deps, 'EDU-1-ABC'), settlePayment(deps, 'EDU-1-ABC')])
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1)
  assert.equal(results.filter(r => r.status === 'already_processed').length, 2)
  assert.equal(f.credits.length, 1)
})

// 10 + 14
test('fulfilment failure after provider success: error propagates, payment stays pending, nothing credited', async () => {
  const f = makeFake([base()])
  f.failNextFulfil.count = 1
  await assert.rejects(settlePayment({ store: f.store, verify: verifierFor(providerOk()) }, 'EDU-1-ABC'), /entitlement write failed/)
  assert.equal(f.rows.get('EDU-1-ABC')!.status, 'pending', 'must NOT be left marked success without access')
  assert.equal(f.credits.length, 0)
})

// 11
test('retry after the partial failure succeeds and credits exactly once', async () => {
  const f = makeFake([base()])
  const deps = { store: f.store, verify: verifierFor(providerOk()) }
  f.failNextFulfil.count = 2
  await assert.rejects(settlePayment(deps, 'EDU-1-ABC'))
  await assert.rejects(settlePayment(deps, 'EDU-1-ABC'))
  assert.equal(f.credits.length, 0)
  assert.equal((await settlePayment(deps, 'EDU-1-ABC')).status, 'fulfilled')
  assert.equal((await settlePayment(deps, 'EDU-1-ABC')).status, 'already_processed')
  assert.equal(f.credits.length, 1)
})

// 12
test('the customer cannot influence plan or amount: settlement takes only a reference and uses the stored row', async () => {
  const f = makeFake([base({ product_id: 'planning_bundle', amount: 100 })])
  // A hostile caller can only vary the reference string; there is no plan/amount parameter at all.
  assert.equal(settlePayment.length >= 2, true)
  const r = await settlePayment({ store: f.store, verify: verifierFor(providerOk()) }, 'EDU-1-ABC')
  assert.equal(r.status === 'fulfilled' && r.payment.product_id, 'planning_bundle')
  assert.equal(f.credits[0].productId, 'planning_bundle')
})

// 13
test('verify route semantics: a reference belonging to another user is forbidden and Paystack is never called', async () => {
  const f = makeFake([base({ user_id: 'victim' })])
  let called = 0
  const r = await settlePayment({ store: f.store, verify: async () => { called++; return providerOk() } }, 'EDU-1-ABC', { expectedUserId: 'attacker' })
  assert.equal(r.status, 'forbidden')
  assert.equal(called, 0)
  assert.equal(f.credits.length, 0)
})

test('an owner can settle their own reference', async () => {
  const f = makeFake([base({ user_id: 'owner' })])
  const r = await settlePayment({ store: f.store, verify: verifierFor(providerOk()) }, 'EDU-1-ABC', { expectedUserId: 'owner' })
  assert.equal(r.status, 'fulfilled')
})

test('provider unreachable => provider_unavailable, payment untouched', async () => {
  const f = makeFake([base()])
  const r = await settlePayment({ store: f.store, verify: async () => { throw new Error('ECONNRESET') } }, 'EDU-1-ABC')
  assert.equal(r.status, 'provider_unavailable')
  assert.equal(f.rows.get('EDU-1-ABC')!.status, 'pending')
})

// 15
test('reconciliation finds stranded pending payments and settles them through the same checks', async () => {
  const f = makeFake([
    base({ id: 'p1', transaction_id: 'EDU-A', user_id: 'u1' }),                       // webhook was lost: provider says success
    base({ id: 'p2', transaction_id: 'EDU-B', user_id: 'u2' }),                       // customer never paid
    base({ id: 'p3', transaction_id: 'EDU-C', user_id: 'u3' }),                       // underpaid
    base({ id: 'p4', transaction_id: 'EDU-D', user_id: 'u4' }),                       // provider outage
    base({ id: 'p5', transaction_id: 'EDU-E', user_id: 'u5', status: 'success' }),    // already done, not listed
  ])
  const verify: ProviderVerifier = async ref => {
    if (ref === 'EDU-A') return providerOk({ reference: 'EDU-A' })
    if (ref === 'EDU-B') return providerOk({ reference: 'EDU-B', status: 'abandoned' })
    if (ref === 'EDU-C') return providerOk({ reference: 'EDU-C', amount: 5000 })
    throw new Error('provider down')
  }
  const summary = await reconcilePendingPayments({ store: f.store, verify }, { olderThanMinutes: 30, limit: 50 })
  assert.deepEqual(summary, { examined: 4, fulfilled: 1, stillPending: 1, failed: 0, rejected: 1, unavailable: 1, errors: 0 })
  assert.equal(f.credits.length, 1)
  assert.equal(f.rows.get('EDU-A')!.status, 'success')
  assert.equal(f.rows.get('EDU-B')!.status, 'pending')
  assert.equal(f.rows.get('EDU-C')!.status, 'failed')
})

test('reconciliation survives a failing fulfilment and leaves that payment pending for the next run', async () => {
  const f = makeFake([base({ id: 'p1', transaction_id: 'EDU-A' }), base({ id: 'p2', transaction_id: 'EDU-B' })])
  f.failNextFulfil.count = 1
  const verify: ProviderVerifier = async ref => providerOk({ reference: ref })
  const summary = await reconcilePendingPayments({ store: f.store, verify }, { olderThanMinutes: 30, limit: 50 })
  assert.equal(summary.errors, 1)
  assert.equal(summary.fulfilled, 1)
  assert.equal(f.rows.get('EDU-A')!.status, 'pending')
  const again = await reconcilePendingPayments({ store: f.store, verify }, { olderThanMinutes: 30, limit: 50 })
  assert.equal(again.fulfilled, 1)
  assert.equal(f.credits.length, 2)
})
