// lib/payments/verification.ts
// Pure decision: given what WE asked Paystack to charge (the server-created
// payments row) and what Paystack reports for that reference, may the payment
// be fulfilled? Nothing here trusts a browser or webhook-supplied amount, plan
// or status — the only inputs are our own row and Paystack's verify response.

import { PAYMENT_CURRENCY, PAYMENT_MINOR_UNITS } from '@/lib/payments/config'

export type ProviderTransaction = {
  status:    string
  reference: string
  amount:    number // minor units, as reported by the provider
  currency:  string
}

export type ExpectedPayment = {
  transaction_id: string
  amount:         number // whole currency units, as stored when the row was created
}

export type VerificationOutcome =
  | { kind: 'verified' }
  | { kind: 'pending';  providerStatus: string }
  | { kind: 'failed';   providerStatus: string }
  | { kind: 'mismatch'; reason: 'reference' | 'currency' | 'amount' }

export function toMinorUnits(amount: number): number {
  return Math.round(amount * PAYMENT_MINOR_UNITS)
}

// Only terminal-negative provider states may mark a payment failed. 'abandoned',
// 'pending', 'ongoing', 'processing', 'queued' (and anything unrecognised) are
// NOT final — a customer can still complete payment (e.g. an M-PESA prompt
// answered late), so they must never write a permanent failure.
const TERMINAL_FAILURE = new Set(['failed', 'reversed'])

export function classifyProviderVerification(
  expected: ExpectedPayment,
  provider: ProviderTransaction,
): VerificationOutcome {
  if (TERMINAL_FAILURE.has(provider.status)) return { kind: 'failed', providerStatus: provider.status }
  if (provider.status !== 'success')         return { kind: 'pending', providerStatus: provider.status }

  if (provider.reference !== expected.transaction_id)    return { kind: 'mismatch', reason: 'reference' }
  if (provider.currency !== PAYMENT_CURRENCY)            return { kind: 'mismatch', reason: 'currency' }
  if (provider.amount !== toMinorUnits(expected.amount)) return { kind: 'mismatch', reason: 'amount' }

  return { kind: 'verified' }
}
