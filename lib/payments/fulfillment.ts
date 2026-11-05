// lib/payments/fulfillment.ts
//
// Single source of truth for what happens after Paystack confirms a payment
// succeeded. Used by both the webhook/browser callback route and the
// client-triggered verify route, so there is exactly one status value, one
// idempotency guard, and one crediting path — not two independently
// maintained copies that can (and did) drift out of sync.
//
// Audit reference: Phase C — Trust & Reliability, Payments & Token Integrity,
// Critical Findings #1 and #2 (nonexistent RPC names; no atomic guard between
// the webhook and browser-redirect payment paths).

import type { SupabaseClient } from '@supabase/supabase-js'
import { TOKEN_PACK, TOKEN_GRANTS, SUBSCRIPTION_TERM_MONTHS } from '@/lib/payments/config'

export type FulfillmentResult = 'fulfilled' | 'already_processed'

const SUBSCRIPTION_PRODUCTS = new Set(['term', 'family', 'premium'])

type PaymentForFulfillment = {
  id: string
  user_id: string
  product_id: string
}

/**
 * Fulfils a verified payment: marks it 'success' AND credits the entitlement
 * (tokens or subscription) as ONE database transaction.
 *
 * The work is done by public.fulfill_payment_atomic() (migration
 * 20261105120000_payments_atomic_fulfillment.sql), which locks the payment row,
 * credits, and flips the status in a single transaction. That is what removes
 * the old failure mode where the row was marked 'success' first and a crediting
 * error afterwards left a paid customer with no access and no retry (DSA-04):
 * now either everything commits or nothing does, and a thrown error leaves the
 * payment 'pending' so the webhook retry / reconciliation completes it.
 *
 * Idempotency: a second caller blocks on the row lock, sees 'success', and gets
 * 'already_processed' without crediting again — this covers the webhook and the
 * browser redirect racing for the same reference.
 *
 * A 'failed' row may still be fulfilled here: settlePayment() only calls this
 * after Paystack has confirmed success for the exact amount and currency, and
 * a 'failed' status can have been written by an earlier non-final check.
 */
export async function fulfillPayment(
  db: SupabaseClient,
  payment: PaymentForFulfillment
): Promise<FulfillmentResult> {
  const isSubscription = SUBSCRIPTION_PRODUCTS.has(payment.product_id)

  const { data, error } = await db.rpc('fulfill_payment_atomic', {
    p_payment_id:   payment.id,
    p_token_grant:  isSubscription ? null : resolveTokenGrant(payment.product_id),
    p_plan:         isSubscription ? payment.product_id : null,
    p_months:       SUBSCRIPTION_TERM_MONTHS,
  })

  if (error) {
    throw new Error(`Failed to fulfil payment ${payment.id}: ${error.message}`)
  }
  if (data !== 'fulfilled' && data !== 'already_processed') {
    throw new Error(`Unexpected fulfilment result for payment ${payment.id}`)
  }
  return data
}

/**
 * How many tokens a non-subscription product credits.
 *
 * This used to be TOKEN_PACK.tokens for every product, which was correct only
 * while 'starter' was the sole non-subscription product. The moment a second
 * one exists it silently overpays: a KES 100 planning bundle would have
 * credited a KES 500 pack's worth of tokens.
 *
 * Unrecognised product ids fall back to the historical constant rather than
 * throwing, because a payment row that already exists must always fulfil —
 * refusing to credit a customer who has actually paid is the worse failure.
 * The error log is what surfaces a product added to sale but not to
 * TOKEN_GRANTS.
 */
function resolveTokenGrant(productId: string): number {
  const grant = TOKEN_GRANTS[productId]
  if (grant === undefined) {
    console.error(
      `[fulfillment] no token grant configured for product_id '${productId}' — ` +
      `falling back to TOKEN_PACK.tokens (${TOKEN_PACK.tokens}). Add it to TOKEN_GRANTS.`
    )
    return TOKEN_PACK.tokens
  }
  return grant
}

/**
 * Grants/extends an active subscription for a user. Exported so every
 * crediting path (webhook, client verify, and admin manual activation)
 * shares one implementation — in particular, one that always extends from
 * an existing active subscription's expiry rather than overwriting it.
 */
export async function creditSubscription(
  db: SupabaseClient,
  userId: string,
  productId: string,
  paymentId: string
): Promise<void> {
  const { data: existingSub } = await db
    .from('subscriptions')
    .select('id, expires_at')
    .eq('user_id', userId)
    .eq('status', 'active')
    .maybeSingle()

  if (existingSub) {
    // Extend from current expiry — not from today — so a renewal never
    // shortens time a family already paid for.
    const newExpiry = new Date(existingSub.expires_at)
    newExpiry.setMonth(newExpiry.getMonth() + SUBSCRIPTION_TERM_MONTHS)

    const { error } = await db
      .from('subscriptions')
      .update({
        plan:       productId,
        status:     'active',
        expires_at: newExpiry.toISOString(),
        payment_id: paymentId,
      })
      .eq('id', existingSub.id)
    if (error) throw new Error(`Failed to extend subscription: ${error.message}`)
  } else {
    const expiry = new Date()
    expiry.setMonth(expiry.getMonth() + SUBSCRIPTION_TERM_MONTHS)

    const { error } = await db.from('subscriptions').insert({
      user_id:    userId,
      payment_id: paymentId,
      plan:       productId,
      status:     'active',
      started_at: new Date().toISOString(),
      expires_at: expiry.toISOString(),
    })
    if (error) throw new Error(`Failed to create subscription: ${error.message}`)
  }
}

/**
 * Credits `tokensToAdd` tokens to a user's balance. Exported so every
 * crediting path (webhook, client verify, and admin manual activation)
 * shares one implementation.
 */
export async function creditTokens(db: SupabaseClient, userId: string, tokensToAdd: number): Promise<void> {
  const { data: existing } = await db
    .from('token_balances')
    .select('balance, total_ever')
    .eq('user_id', userId)
    .maybeSingle()

  if (existing) {
    const { error } = await db
      .from('token_balances')
      .update({
        balance:    existing.balance    + tokensToAdd,
        total_ever: existing.total_ever + tokensToAdd,
      })
      .eq('user_id', userId)
    if (error) throw new Error(`Failed to credit tokens: ${error.message}`)
  } else {
    const { error } = await db
      .from('token_balances')
      .insert({ user_id: userId, balance: tokensToAdd, total_ever: tokensToAdd })
    if (error) throw new Error(`Failed to credit tokens: ${error.message}`)
  }
}
