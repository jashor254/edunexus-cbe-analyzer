import { z } from 'zod'
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/utils/supabase/service'
import { paystackClient } from '@/lib/payments/paystack'
import { requireAuth } from '@/lib/api/middleware'
import { fulfillPayment } from '@/lib/payments/fulfillment'

export const dynamic = 'force-dynamic'

const VerifyPaymentSchema = z.object({
  transactionId: z.string().min(1).optional(),
  reference:     z.string().min(1).optional(),
})

export async function POST(request: NextRequest) {
  // 🔐 Auth — always first, always getUser()
  const auth = await requireAuth()
  if ('response' in auth) return auth.response

  try {
    const parsed = VerifyPaymentSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: 'Transaction ID required' }, { status: 400 })
    }
    const transactionId = parsed.data.transactionId ?? parsed.data.reference

    if (!transactionId) {
      return NextResponse.json({ success: false, error: 'Transaction ID required' }, { status: 400 })
    }

    // DB writes below (payments status transitions, token_balances via
    // fulfillPayment) use the service client, not the caller's own session
    // client — matching the sibling app/api/payments/callback/route.ts.
    // Authorization is already fully enforced above via requireAuth() +
    // the explicit payment.user_id === auth.user.id check immediately below;
    // it never rested on RLS, so this does not weaken authorization. It closes
    // the one real dependency the permissive token_balances RLS policy had
    // (Platform Audit v1.0, Blocker #1).
    const service = createServiceClient()

    // 1. FIND PAYMENT RECORD
    const { data: payment, error: paymentError } = await service
      .from('payments')
      .select('id, status, amount, user_id, transaction_id, created_at, product_id, metadata')
      .eq('transaction_id', transactionId)
      .single()

    if (paymentError || !payment) {
      return NextResponse.json({ success: false, error: 'Payment record not found' }, { status: 404 })
    }

    // 🔒 Ownership — payment must belong to the authenticated user
    if (payment.user_id !== auth.user.id) {
      return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 })
    }

    // 2. IDEMPOTENCY fast path — 'success' is the only terminal-success value
    // in the payments.status enum (pending | success | failed | cancelled).
    // The authoritative guard against double-fulfillment is the atomic
    // conditional update inside fulfillPayment() below.
    if (payment.status === 'success') {
      return NextResponse.json({
        success: true,
        status: 'success',
        message: 'Payment already verified and active.',
      })
    }

    // 3. VERIFY WITH PAYSTACK
    let verifyResult: Awaited<ReturnType<typeof paystackClient.verifyPayment>>
    try {
      verifyResult = await paystackClient.verifyPayment(transactionId)
    } catch (verifyError: unknown) {
      const message = verifyError instanceof Error ? verifyError.message : String(verifyError)
      console.error('[payments/verify] Paystack verification threw', { paymentId: payment.id, transactionId, message })

      await service
        .from('payments')
        .update({ status: 'failed', updated_at: new Date().toISOString() })
        .eq('id', payment.id)

      return NextResponse.json({ success: false, error: 'Payment verification failed with Paystack' }, { status: 502 })
    }

    if (!verifyResult.status || verifyResult.data.status !== 'success') {
      const newStatus = verifyResult.data.status === 'pending' ? 'pending' : 'failed'
      await service
        .from('payments')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', payment.id)
      return NextResponse.json({ success: false, status: newStatus, error: `Payment ${newStatus}` }, { status: 400 })
    }

    const paystackData = verifyResult.data

    // 4. VALIDATE AMOUNT
    const expectedKobo = paystackClient.toKobo(payment.amount)
    if (paystackData.amount < expectedKobo) {
      await service
        .from('payments')
        .update({ status: 'failed', updated_at: new Date().toISOString() })
        .eq('id', payment.id)
      return NextResponse.json({ success: false, error: 'Amount mismatch — possible fraud' }, { status: 400 })
    }

    // 5. ATOMIC FULFILLMENT — same guarded transition + crediting path used
    // by the webhook/browser callback route (lib/payments/fulfillment.ts),
    // so there is exactly one way a payment ever gets fulfilled.
    await fulfillPayment(service, {
      id:         payment.id,
      user_id:    payment.user_id,
      product_id: payment.product_id,
    })

    return NextResponse.json({
      success: true,
      status: 'success',
      message: 'Payment verified and account upgraded successfully!',
      data: {
        product_id: payment.product_id,
        amount:     payment.amount,
      },
    })
  } catch (err: unknown) {
    console.error('[payments/verify] Unhandled error', { userId: auth.user.id, message: err instanceof Error ? err.message : String(err) })
    return NextResponse.json(
      { success: false, error: 'Internal server error during verification' },
      { status: 500 }
    )
  }
}

// GET — callback redirect from Paystack (not from client directly)
// This does NOT attempt to verify payment for the caller — it calls POST as the same user.
// Note: unauthenticated GET callbacks from Paystack redirect to login, preserving the reference.
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const reference    = searchParams.get('reference') ?? searchParams.get('trxref') ?? searchParams.get('transactionId')

  if (!reference) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_SITE_URL}/payments/failed?error=no_reference`
    )
  }

  // Delegate to POST — auth check runs inside POST
  try {
    const verifyRequest = new NextRequest(request.url, {
      method:  'POST',
      body:    JSON.stringify({ transactionId: reference }),
      headers: request.headers,
    })
    const result      = await POST(verifyRequest)
    const resultBody  = await result.json() as { success: boolean; error?: string }

    if (resultBody.success) {
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_SITE_URL}/payments/success?reference=${reference}`)
    }

    // Unauthenticated redirects — send user to login, then back to verify
    if (result.status === 401) {
      const loginUrl = new URL('/login', process.env.NEXT_PUBLIC_SITE_URL)
      loginUrl.searchParams.set('returnTo', `/payments/verify?reference=${reference}`)
      return NextResponse.redirect(loginUrl.toString())
    }

    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_SITE_URL}/payments/failed?reference=${reference}&error=${encodeURIComponent(resultBody.error ?? 'unknown')}`
    )
  } catch {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_SITE_URL}/payments/failed?reference=${reference}&error=verification_failed`
    )
  }
}
