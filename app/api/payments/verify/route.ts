import { z } from 'zod'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api/middleware'
import { settlePayment } from '@/lib/payments/settlement'
import { createServicePaymentStore, verifyWithPaystack } from '@/lib/payments/paymentStore'
import { getSiteUrl } from '@/lib/payments/siteUrl'

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

    // Settlement runs on the service-role store (the user's own session never
    // writes payments/token_balances). Authorization is enforced by passing the
    // authenticated user id as `expectedUserId`: a reference that belongs to
    // someone else resolves to 'forbidden' before Paystack is even called.
    const result = await settlePayment(
      { store: createServicePaymentStore(), verify: verifyWithPaystack },
      transactionId,
      { expectedUserId: auth.user.id },
    )

    switch (result.status) {
      case 'invalid_reference':
        return NextResponse.json({ success: false, error: 'Invalid transaction reference' }, { status: 400 })
      case 'not_found':
        return NextResponse.json({ success: false, error: 'Payment record not found' }, { status: 404 })
      case 'forbidden':
        return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 })
      case 'provider_unavailable':
        return NextResponse.json({ success: false, error: 'Payment verification failed with Paystack' }, { status: 502 })
      case 'pending':
        return NextResponse.json({ success: false, status: 'pending', error: 'Payment pending' }, { status: 400 })
      case 'failed':
        return NextResponse.json({ success: false, status: 'failed', error: 'Payment failed' }, { status: 400 })
      case 'rejected':
        return NextResponse.json({ success: false, error: 'Amount or currency mismatch — payment not credited' }, { status: 400 })
      case 'already_processed':
        return NextResponse.json({ success: true, status: 'success', message: 'Payment already verified and active.' })
      case 'fulfilled':
        return NextResponse.json({
          success: true,
          status: 'success',
          message: 'Payment verified and account upgraded successfully!',
          data: { product_id: result.payment.product_id, amount: result.payment.amount },
        })
    }
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
  let siteUrl: string
  try {
    siteUrl = getSiteUrl()
  } catch (error: unknown) {
    console.error('[payments/verify GET] site URL not configured:', error instanceof Error ? error.message : String(error))
    return NextResponse.json({ success: false, error: 'Payment redirect is not configured' }, { status: 500 })
  }

  const searchParams = request.nextUrl.searchParams
  const reference    = searchParams.get('reference') ?? searchParams.get('trxref') ?? searchParams.get('transactionId')

  if (!reference) {
    return NextResponse.redirect(`${siteUrl}/payment/failed?error=no_reference`)
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
    const ref         = encodeURIComponent(reference)

    if (resultBody.success) {
      return NextResponse.redirect(`${siteUrl}/payment/success?reference=${ref}`)
    }

    // Unauthenticated redirects — send user to login, then back to verify
    if (result.status === 401) {
      const loginUrl = new URL('/login', siteUrl)
      loginUrl.searchParams.set('returnTo', `/api/payments/verify?reference=${ref}`)
      return NextResponse.redirect(loginUrl.toString())
    }

    return NextResponse.redirect(
      `${siteUrl}/payment/failed?reference=${ref}&error=${encodeURIComponent(resultBody.error ?? 'unknown')}`
    )
  } catch {
    return NextResponse.redirect(`${siteUrl}/payment/failed?reference=${encodeURIComponent(reference)}&error=verification_failed`)
  }
}
