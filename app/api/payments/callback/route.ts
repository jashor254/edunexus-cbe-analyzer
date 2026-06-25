import { NextResponse } from 'next/server'
import { createServiceClient } from '@/utils/supabase/service'
import { createHmac } from 'crypto'
import { TOKEN_PACK } from '@/lib/payments/config'

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

  // 2. Idempotency guard — never process twice
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
    return 'failed'
  }

  // 4. Mark payment success
  await db
    .from('payments')
    .update({ status: 'success' })
    .eq('transaction_id', reference)

  const userId    = payment.user_id
  const productId = payment.product_id

  // 5. Fulfill based on product ─────────────────────────────────────────────

  if (productId === 'starter') {
    const tokensToAdd = TOKEN_PACK.tokens
    const { data: existing } = await db
      .from('token_balances')
      .select('balance, total_ever')
      .eq('user_id', userId)
      .single()

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

  } else if (productId === 'term' || productId === 'family' || productId === 'premium') {
    // Create or extend subscription by 3 months
    const { data: existingSub } = await db
      .from('subscriptions')
      .select('id, expires_at')
      .eq('user_id', userId)
      .eq('status', 'active')
      .single()

    if (existingSub) {
      // Extend from current expiry — not from today
      const newExpiry = new Date(existingSub.expires_at)
      newExpiry.setMonth(newExpiry.getMonth() + 3)

      await db
        .from('subscriptions')
        .update({
          plan:       productId,
          status:     'active',
          expires_at: newExpiry.toISOString(),
          payment_id: payment.id,
        })
        .eq('id', existingSub.id)
    } else {
      const expiry = new Date()
      expiry.setMonth(expiry.getMonth() + 3)

      await db
        .from('subscriptions')
        .insert({
          user_id:    userId,
          payment_id: payment.id,
          plan:       productId,
          status:     'active',
          started_at: new Date().toISOString(),
          expires_at: expiry.toISOString(),
        })
    }
  }

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
    const signature = req.headers.get('x-paystack-signature') || ''
    const secret    = process.env.PAYSTACK_WEBHOOK_SECRET || process.env.PAYSTACK_SECRET_KEY || ''

    // 🔒 Reject anything not signed by Paystack
    const expectedSig = createHmac('sha512', secret)
      .update(rawBody)
      .digest('hex')

    if (signature !== expectedSig) {
      console.error('[webhook] invalid signature — rejected')
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