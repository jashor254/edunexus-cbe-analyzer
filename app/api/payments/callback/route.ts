import { NextResponse } from 'next/server'
import { createHmac, timingSafeEqual } from 'crypto'
import { publishEvent } from '@/lib/events'
import { settlePayment, type SettlementResult } from '@/lib/payments/settlement'
import { createServicePaymentStore, verifyWithPaystack } from '@/lib/payments/paymentStore'
import { getSiteUrl } from '@/lib/payments/siteUrl'
import { PAYMENT_CURRENCY } from '@/lib/payments/config'
import { toMinorUnits } from '@/lib/payments/verification'

// ─────────────────────────────────────────────────────────────────────────────
// Paystack callback (browser redirect, GET) and webhook (server, POST).
// Both call the single settlement path in lib/payments/settlement.ts: the
// amount, currency, product and owner come from OUR payments row, the status
// from Paystack's verify API. Nothing in the query string (including `plan`)
// or the webhook body other than the reference is trusted.
// ─────────────────────────────────────────────────────────────────────────────

function settle(reference: string): Promise<SettlementResult> {
  return settlePayment(
    { store: createServicePaymentStore(), verify: verifyWithPaystack },
    reference,
  )
}

function emitBillingEvent(reference: string, result: SettlementResult): void {
  if (result.status === 'fulfilled') {
    void publishEvent({
      event_type:      'billing.payment.succeeded',
      resource_type:   'payment',
      resource_id:     reference,
      actor_id:        result.payment.user_id,
      payload: {
        reference,
        amount_kobo: toMinorUnits(result.payment.amount),
        currency:    PAYMENT_CURRENCY,
        plan:        result.payment.product_id,
      },
      idempotency_key: `billing.payment.succeeded:${reference}`,
    }).catch(err => console.error('[events] billing.payment.succeeded:', err instanceof Error ? err.message : String(err)))
    return
  }
  if (result.status === 'failed' || result.status === 'rejected') {
    void publishEvent({
      event_type:      'billing.payment.failed',
      resource_type:   'payment',
      resource_id:     reference,
      actor_id:        result.payment.user_id,
      payload:         { reference, reason: result.status === 'rejected' ? `mismatch_${result.reason}` : `provider_${result.providerStatus}` },
      idempotency_key: `billing.payment.failed:${reference}`,
    }).catch(err => console.error('[events] billing.payment.failed:', err instanceof Error ? err.message : String(err)))
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GET — Browser redirect after Paystack checkout
// ─────────────────────────────────────────────────────────────────────────────
export async function GET(req: Request) {
  let siteUrl: string
  try {
    siteUrl = getSiteUrl()
  } catch (error: unknown) {
    console.error('[callback GET] site URL not configured:', error instanceof Error ? error.message : String(error))
    return NextResponse.json({ error: 'Payment redirect is not configured' }, { status: 500 })
  }

  const url       = new URL(req.url)
  const reference = url.searchParams.get('reference') || url.searchParams.get('trxref')

  if (!reference) {
    return NextResponse.redirect(`${siteUrl}/pricing?error=missing_ref`)
  }

  try {
    const result = await settle(reference)
    emitBillingEvent(reference, result)

    switch (result.status) {
      case 'fulfilled':
      case 'already_processed':
        // `plan` is for display only and comes from the stored payment, never the URL.
        return NextResponse.redirect(
          `${siteUrl}/payment/success?plan=${encodeURIComponent(result.payment.product_id)}&reference=${encodeURIComponent(reference)}`
        )
      case 'failed':
      case 'rejected':
        return NextResponse.redirect(`${siteUrl}/payment/failed?reference=${encodeURIComponent(reference)}`)
      case 'pending':
      case 'provider_unavailable':
        // Not final: the webhook or a retry will still settle it.
        return NextResponse.redirect(`${siteUrl}/pricing?error=payment_pending&reference=${encodeURIComponent(reference)}`)
      default:
        return NextResponse.redirect(`${siteUrl}/pricing?error=not_found`)
    }
  } catch (error: unknown) {
    console.error('[callback GET] error:', error instanceof Error ? error.message : String(error))
    return NextResponse.redirect(`${siteUrl}/payment/failed`)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST — Paystack server webhook (configure in Paystack Dashboard)
// ─────────────────────────────────────────────────────────────────────────────
export async function POST(req: Request) {
  try {
    const rawBody   = await req.text()
    const signature = req.headers.get('x-paystack-signature') ?? ''

    // Require a dedicated webhook secret — fail hard if not configured
    const secret = process.env.PAYSTACK_WEBHOOK_SECRET
    if (!secret) {
      return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 })
    }

    // 🔒 Timing-safe HMAC comparison — prevents timing-attack signature bypass
    const expectedSig = createHmac('sha512', secret).update(rawBody).digest('hex')
    const sigMatch =
      signature.length === expectedSig.length &&
      timingSafeEqual(Buffer.from(signature, 'utf8'), Buffer.from(expectedSig, 'utf8'))

    if (!sigMatch) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }

    const event = JSON.parse(rawBody)

    // Only process successful charges
    if (event.event !== 'charge.success') {
      return NextResponse.json({ received: true })
    }

    const reference = event.data?.reference
    if (!reference || typeof reference !== 'string') {
      return NextResponse.json({ error: 'No reference' }, { status: 400 })
    }

    const result = await settle(reference)
    emitBillingEvent(reference, result)

    // A signed charge.success that we could not settle YET must be retried by
    // Paystack: answer 5xx so it re-delivers. Terminal outcomes are 200.
    if (result.status === 'pending' || result.status === 'provider_unavailable') {
      return NextResponse.json({ error: 'Payment not yet confirmable' }, { status: 503 })
    }

    return NextResponse.json({ received: true })

  } catch (error: unknown) {
    // Includes a failed atomic fulfilment: the payment is still 'pending', so
    // the 500 makes Paystack retry and the retry completes it.
    console.error('[webhook POST] error:', error instanceof Error ? error.message : String(error))
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    )
  }
}
