// lib/payments/paymentStore.ts
// Supabase-backed PaymentStore. All `payments` access for settlement lives
// here so the routes stay thin. Server-side only (service-role client): the
// caller passes in the client, this module never constructs one.

import type { SupabaseClient } from '@supabase/supabase-js'
import { createServiceClient } from '@/utils/supabase/service'
import { fulfillPayment } from '@/lib/payments/fulfillment'
import type { PaymentRecord, PaymentStore } from '@/lib/payments/settlement'
import { paystackClient } from '@/lib/payments/paystack'
import type { ProviderTransaction } from '@/lib/payments/verification'

const PAYMENT_COLUMNS = 'id, user_id, product_id, amount, status, transaction_id'

export function createPaymentStore(db: SupabaseClient): PaymentStore {
  return {
    async findByReference(reference) {
      const { data, error } = await db
        .from('payments')
        .select(PAYMENT_COLUMNS)
        .eq('transaction_id', reference)
        .maybeSingle()
      if (error) throw new Error(`Failed to load payment: ${error.message}`)
      return (data as PaymentRecord | null) ?? null
    },

    async markFailed(paymentId, reason) {
      const { error } = await db
        .from('payments')
        .update({ status: 'failed', updated_at: new Date().toISOString() })
        .eq('id', paymentId)
        .eq('status', 'pending')
      if (error) throw new Error(`Failed to mark payment failed (${reason}): ${error.message}`)
    },

    fulfil(payment) {
      return fulfillPayment(db, { id: payment.id, user_id: payment.user_id, product_id: payment.product_id })
    },

    async listPendingOlderThan(minutes, limit) {
      const cutoff = new Date(Date.now() - minutes * 60_000).toISOString()
      const { data, error } = await db
        .from('payments')
        .select(PAYMENT_COLUMNS)
        .eq('status', 'pending')
        .lt('created_at', cutoff)
        .order('created_at', { ascending: true })
        .limit(limit)
      if (error) throw new Error(`Failed to list pending payments: ${error.message}`)
      return (data ?? []) as PaymentRecord[]
    },
  }
}

/** Production wiring: a store on the service-role client (server-side only). */
export function createServicePaymentStore(): PaymentStore {
  return createPaymentStore(createServiceClient())
}

type PaystackVerifyBody = {
  status?: boolean
  data?:   { status?: string; reference?: string; amount?: number; currency?: string }
}

/** Real provider verifier: Paystack's verify API, normalised for settlement. */
export async function verifyWithPaystack(reference: string): Promise<ProviderTransaction> {
  const body = (await paystackClient.verifyPayment(reference)) as PaystackVerifyBody
  if (!body.status || !body.data) throw new Error('Paystack verify returned no data')
  return {
    status:    String(body.data.status ?? 'unknown'),
    reference: String(body.data.reference ?? ''),
    amount:    Number(body.data.amount ?? NaN),
    currency:  String(body.data.currency ?? ''),
  }
}
