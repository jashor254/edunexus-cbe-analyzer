// lib/payments/chargeVerification.ts
//
// The single rule for "does this verified Paystack charge actually pay for
// this payments row?" — applied by every path that can fulfil a payment
// (app/api/payments/callback: webhook + browser redirect; app/api/payments/
// verify) before lib/payments/fulfillment.ts grants anything.
//
// Security audit 2026-10-30, F-10: the callback path accepted any charge
// Paystack reported as `status: 'success'` for the reference, without
// comparing what was paid to what was owed, and the verify path compared the
// amount but not the currency. Both initialisers (payments/initialize,
// payments/mobile-init) store `payments.amount` in whole KES from the
// server-side product price and send Paystack `amount * 100` (kobo/cents)
// in KES — so that is exactly what a verified charge must show.

/** The only currency EduNexus initialises Paystack transactions in. */
export const PAYMENT_CURRENCY = 'KES'

/** Whole-unit amount → Paystack's minor unit (cents). */
export function toMinorUnits(amount: number): number {
  return Math.round(amount * 100)
}

export type VerifiedCharge = { amount?: unknown; currency?: unknown }

/**
 * True only when the verified charge is in KES and covers the expected
 * amount. Overpayment is accepted (as the verify route always has);
 * underpayment, another currency, or a missing/garbled amount is not.
 */
export function chargeCoversPayment(charge: VerifiedCharge, payment: { amount: number }): boolean {
  if (typeof charge.amount !== 'number' || !Number.isFinite(charge.amount)) return false
  if (charge.currency !== PAYMENT_CURRENCY) return false
  return charge.amount >= toMinorUnits(payment.amount)
}
