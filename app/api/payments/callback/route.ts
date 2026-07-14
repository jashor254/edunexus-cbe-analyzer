import { NextResponse } from 'next/server'
import { createServiceClient } from '@/utils/supabase/service'
import { createHmac, timingSafeEqual } from 'crypto'
import { publishEvent } from '@/lib/events'
import { fulfillPayment } from '@/lib/payments/fulfillment'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL!

// ─────────────────────────────────────────────────────────────────────────────
// Core payment processor — idempotent, called by both GET and POST
// ─────────────────────────────────────────────────────────────────────────────
async function processPayment(
  reference: string
): Promise<'success' | 'failed' | 'already_processed' | 'not_found'> {
  const db = createServiceClient()

  // 1. Fetch payment record
  const { data: payment, error: fetchError } = await db
    .from('payments')
    .select('id, status, user_id, product_id')
    .eq('transaction_id', reference)
    .single()

  if (fetchError || !payment) {
    console.error('[callback] payment not found:', reference)
    return 'not_found'
  }

  // 2. Fast-path idempotency check — avoids an unnecessary Paystack call for
  //    the common case. The real guard against a race between this GET and
  //    the webhook POST arriving concurrently is the atomic conditional
  //    update inside fulfillPayment() below, not this check.
  if (payment.status === 'success') {
    return 'already_processed'
  }

  // 3. Verify with Paystack
  const verifyRes = await fetch(
    `https://api.paystack.co/transaction/verify/${reference}`,
    { headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` } }
  )

  const verification = await verifyRes.json()

  if (!verification.status || verification.data?.status !== 'success') {
    console.error('[callback] verification failed for:', reference)
    await db
      .from('payments')
      .update({ status: 'failed' })
      .eq('transaction_id', reference)

    void publishEvent({
      event_type:      'billing.payment.failed',
      resource_type:   'payment',
      resource_id:     reference,
      actor_id:        payment.user_id,
      payload:         { reference, reason: 'verification_failed' },
      idempotency_key: `billing.payment.failed:${reference}`,
    }).catch(err => console.error('[events] billing.payment.failed:', err instanceof Error ? err.message : String(err)))

    return 'failed'
  }

  // 4. Atomically mark success and credit tokens/subscription — this is the
  //    step that must not run twice. fulfillPayment()'s conditional update
  //    means only one of a racing GET+POST pair actually credits anything.
  const userId    = payment.user_id
  const productId = payment.product_id
  const result    = await fulfillPayment(db, { id: payment.id, user_id: userId, product_id: productId })

  if (result === 'already_processed') {
    return 'already_processed'
  }

  // Emit billing event — fire and forget, never block the redirect
  const verifiedData = verification.data
  void publishEvent({
    event_type:      'billing.payment.succeeded',
    resource_type:   'payment',
    resource_id:     reference,
    actor_id:        userId,
    payload: {
      reference,
      amount_kobo: verifiedData?.amount ?? 0,
      currency:    verifiedData?.currency ?? 'NGN',
      plan:        productId,
    },
    idempotency_key: `billing.payment.succeeded:${reference}`,
  }).catch(err => console.error('[events] billing.payment.succeeded:', err instanceof Error ? err.message : String(err)))

  return 'success'
}

// ─────────────────────────────────────────────────────────────────────────────
// GET — Browser redirect after Paystack checkout
// ─────────────────────────────────────────────────────────────────────────────
export async function GET(req: Request) {
  const url       = new URL(req.url)
  const reference = url.searchParams.get('reference') || url.searchParams.get('trxref')
  const plan      = url.searchParams.get('plan') || ''

  if (!reference) {
    return NextResponse.redirect(`${SITE_URL}/pricing?error=missing_ref`)
  }

  try {
    const result = await processPayment(reference)

    if (result === 'success' || result === 'already_processed') {
      return NextResponse.redirect(
        `${SITE_URL}/payment/success?plan=${plan}&reference=${reference}`
      )
    }

    if (result === 'failed') {
      return NextResponse.redirect(
        `${SITE_URL}/payment/failed?reference=${reference}`
      )
    }

    return NextResponse.redirect(`${SITE_URL}/pricing?error=not_found`)

  } catch (error: unknown) {
    console.error('[callback GET] error:', error instanceof Error ? error.message : String(error))
    return NextResponse.redirect(`${SITE_URL}/payment/failed`)
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
    if (!reference) {
      return NextResponse.json({ error: 'No reference' }, { status: 400 })
    }

    await processPayment(reference)
    return NextResponse.json({ received: true })

  } catch (error: unknown) {
    console.error('[webhook POST] error:', error instanceof Error ? error.message : String(error))
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    )
  }
}