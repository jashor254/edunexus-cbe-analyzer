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
import { TOKEN_PACK } from '@/lib/payments/config'

export type FulfillmentResult = 'fulfilled' | 'already_processed'

const SUBSCRIPTION_PRODUCTS = new Set(['term', 'family', 'premium'])

type PaymentForFulfillment = {
  id: string
  user_id: string
  product_id: string
}

/**
 * Atomically transitions a payment row from 'pending' to 'success' and, only
 * if this call is the one that won that transition, credits the resource
 * (tokens or subscription).
 *
 * The conditional update (`.eq('status', 'pending')`) is the idempotency
 * guard: if two callers race for the same payment (e.g. Paystack's webhook
 * and the browser redirect both arrive for the same reference — which
 * Paystack's retry behavior makes a real, not hypothetical, scenario), only
 * one UPDATE can match a still-'pending' row. The other observes zero
 * affected rows and safely returns 'already_processed' without crediting
 * anything a second time.
 */
export async function fulfillPayment(
  db: SupabaseClient,
  payment: PaymentForFulfillment
): Promise<FulfillmentResult> {
  const { data: updated, error: updateError } = await db
    .from('payments')
    .update({ status: 'success', updated_at: new Date().toISOString() })
    .eq('id', payment.id)
    .eq('status', 'pending')
    .select('id')

  if (updateError) {
    throw new Error(`Failed to mark payment success: ${updateError.message}`)
  }
  if (!updated || updated.length === 0) {
    return 'already_processed'
  }

  if (SUBSCRIPTION_PRODUCTS.has(payment.product_id)) {
    await fulfillSubscription(db, payment.user_id, payment.product_id, payment.id)
  } else {
    await fulfillTokens(db, payment.user_id)
  }

  return 'fulfilled'
}

async function fulfillSubscription(
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
    newExpiry.setMonth(newExpiry.getMonth() + 3)

    await db
      .from('subscriptions')
      .update({
        plan:       productId,
        status:     'active',
        expires_at: newExpiry.toISOString(),
        payment_id: paymentId,
      })
      .eq('id', existingSub.id)
  } else {
    const expiry = new Date()
    expiry.setMonth(expiry.getMonth() + 3)

    await db.from('subscriptions').insert({
      user_id:    userId,
      payment_id: paymentId,
      plan:       productId,
      status:     'active',
      started_at: new Date().toISOString(),
      expires_at: expiry.toISOString(),
    })
  }
}

async function fulfillTokens(db: SupabaseClient, userId: string): Promise<void> {
  const tokensToAdd = TOKEN_PACK.tokens

  const { data: existing } = await db
    .from('token_balances')
    .select('balance, total_ever')
    .eq('user_id', userId)
    .maybeSingle()

  if (existing) {
    await db
      .from('token_balances')
      .update({
        balance:    existing.balance    + tokensToAdd,
        total_ever: existing.total_ever + tokensToAdd,
      })
      .eq('user_id', userId)
  } else {
    await db
      .from('token_balances')
      .insert({ user_id: userId, balance: tokensToAdd, total_ever: tokensToAdd })
  }
}
