// lib/payments/reference.ts
// Shape check for payment references before they touch the database, the
// Paystack API path, or a redirect URL. Every reference we issue is
// `EDU-<ms>-<base36>` (paystack.ts / payments initialize + mobile-init) or
// `MANUAL-<ms>-<base36>` (admin activate-user); Paystack's own references are
// alphanumeric. Anything else — slashes, dots, `?`, `&`, `%` — is rejected,
// so a caller-supplied value can't rewrite the verify URL
// (`/transaction/verify/{reference}`) or inject redirect query parameters.

const PAYMENT_REFERENCE = /^[A-Za-z0-9_-]{1,100}$/

export function isValidPaymentReference(reference: string): boolean {
  return PAYMENT_REFERENCE.test(reference)
}
