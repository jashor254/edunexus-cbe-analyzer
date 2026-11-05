// lib/payments/settlement.ts
// The ONE way a Paystack payment is turned into an entitlement. The callback
// redirect, the Paystack webhook, the client verify route and reconciliation
// all call settlePayment(), so there is a single place that decides whether a
// payment is real and a single fulfilment path.
//
// Trust model: the only inputs are a payment reference and (optionally) the
// authenticated user. The amount, currency, product and owner all come from
// the server-created `payments` row; the status comes from Paystack's verify
// API. Nothing supplied by a browser (plan, amount, role) reaches this code.
//
// Failure semantics (DSA-04 / DSA-05):
//  - A provider state that is not final (pending/abandoned/…) NEVER writes a
//    permanent failure, so a customer who completes payment later is still
//    fulfilled by the webhook or a retry.
//  - Fulfilment is one atomic database operation (fulfilPayment → RPC). If it
//    throws, the payment is still 'pending' and nothing was credited; the
//    error propagates so the webhook responds 5xx and Paystack retries.

import { isValidPaymentReference } from '@/lib/payments/reference'
import {
  classifyProviderVerification,
  type ProviderTransaction,
} from '@/lib/payments/verification'

export type PaymentStatus = 'pending' | 'success' | 'failed'

export type PaymentRecord = {
  id:             string
  user_id:        string
  product_id:     string
  amount:         number
  status:         PaymentStatus
  transaction_id: string
}

export type FulfilOutcome = 'fulfilled' | 'already_processed'

export type PaymentStore = {
  findByReference(reference: string): Promise<PaymentRecord | null>
  /** Conditional: only a still-'pending' row may become 'failed'. */
  markFailed(paymentId: string, reason: string): Promise<void>
  /** Atomic: marks success AND credits the entitlement in one transaction. */
  fulfil(payment: PaymentRecord): Promise<FulfilOutcome>
  listPendingOlderThan(minutes: number, limit: number): Promise<PaymentRecord[]>
}

/** Resolves Paystack's verify data for a reference, or throws if unreachable. */
export type ProviderVerifier = (reference: string) => Promise<ProviderTransaction>

export type SettlementResult =
  | { status: 'fulfilled';          payment: PaymentRecord }
  | { status: 'already_processed';  payment: PaymentRecord }
  | { status: 'pending';            payment: PaymentRecord; providerStatus: string }
  | { status: 'failed';             payment: PaymentRecord; providerStatus: string }
  | { status: 'rejected';           payment: PaymentRecord; reason: 'reference' | 'currency' | 'amount' }
  | { status: 'not_found' }
  | { status: 'invalid_reference' }
  | { status: 'forbidden' }
  | { status: 'provider_unavailable' }

export type SettlementDeps = { store: PaymentStore; verify: ProviderVerifier }

export async function settlePayment(
  deps: SettlementDeps,
  reference: string,
  opts: { expectedUserId?: string } = {},
): Promise<SettlementResult> {
  if (!isValidPaymentReference(reference)) return { status: 'invalid_reference' }

  const payment = await deps.store.findByReference(reference)
  if (!payment) return { status: 'not_found' }

  if (opts.expectedUserId !== undefined && payment.user_id !== opts.expectedUserId) {
    return { status: 'forbidden' }
  }

  if (payment.status === 'success') return { status: 'already_processed', payment }

  let provider: ProviderTransaction
  try {
    provider = await deps.verify(reference)
  } catch (err: unknown) {
    console.error('[settlement] provider verification unavailable', {
      paymentId: payment.id,
      message:   err instanceof Error ? err.message : String(err),
    })
    return { status: 'provider_unavailable' }
  }

  const outcome = classifyProviderVerification(payment, provider)

  switch (outcome.kind) {
    case 'pending':
      return { status: 'pending', payment, providerStatus: outcome.providerStatus }

    case 'failed':
      await deps.store.markFailed(payment.id, `provider_${outcome.providerStatus}`)
      return { status: 'failed', payment, providerStatus: outcome.providerStatus }

    case 'mismatch':
      // The provider confirms money moved, but not the money we asked for.
      // Never fulfil; never silently drop — surface it for a human.
      console.error('[settlement] provider/payment mismatch — NOT fulfilled', {
        paymentId: payment.id,
        reason:    outcome.reason,
      })
      await deps.store.markFailed(payment.id, `mismatch_${outcome.reason}`)
      return { status: 'rejected', payment, reason: outcome.reason }

    case 'verified': {
      const result = await deps.store.fulfil(payment)
      return { status: result, payment }
    }
  }
}
