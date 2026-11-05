// lib/payments/reconciliation.ts
// Safety net for payments that were opened but never settled — a webhook that
// was lost, a customer who closed the tab before the redirect, or a provider
// outage during verification. Re-runs the SAME settlement path (so every check
// still applies and fulfilment stays atomic/idempotent) for pending payments
// old enough that a normal flow should have finished.

import { settlePayment, type SettlementDeps, type SettlementResult } from '@/lib/payments/settlement'

export type ReconciliationSummary = {
  examined:    number
  fulfilled:   number
  stillPending: number
  failed:      number
  rejected:    number
  unavailable: number
  errors:      number
}

export async function reconcilePendingPayments(
  deps: SettlementDeps,
  opts: { olderThanMinutes: number; limit: number },
): Promise<ReconciliationSummary> {
  const pending = await deps.store.listPendingOlderThan(opts.olderThanMinutes, opts.limit)
  const summary: ReconciliationSummary = {
    examined: pending.length, fulfilled: 0, stillPending: 0, failed: 0, rejected: 0, unavailable: 0, errors: 0,
  }

  for (const payment of pending) {
    let result: SettlementResult
    try {
      result = await settlePayment(deps, payment.transaction_id)
    } catch (err: unknown) {
      summary.errors++
      console.error('[reconciliation] settlement threw — left pending for the next run', {
        paymentId: payment.id,
        message:   err instanceof Error ? err.message : String(err),
      })
      continue
    }
    switch (result.status) {
      case 'fulfilled':            summary.fulfilled++; break
      case 'already_processed':    break
      case 'pending':              summary.stillPending++; break
      case 'failed':               summary.failed++; break
      case 'rejected':             summary.rejected++; break
      case 'provider_unavailable': summary.unavailable++; break
      default:                     summary.errors++
    }
  }
  return summary
}
