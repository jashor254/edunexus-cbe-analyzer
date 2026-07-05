import { z } from 'zod'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { paystackClient } from '@/lib/payments/paystack'
import { requireAuth } from '@/lib/api/middleware'

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

    const supabase = await createClient()

    // 1. FIND PAYMENT RECORD
    const { data: payment, error: paymentError } = await supabase
      .from('payments')
      .select('id, status, amount, user_id, transaction_id, plan, created_at, product_id, payment_type, metadata')
      .eq('transaction_id', transactionId)
      .single()

    if (paymentError || !payment) {
      return NextResponse.json({ success: false, error: 'Payment record not found' }, { status: 404 })
    }

    // 🔒 Ownership — payment must belong to the authenticated user
    if (payment.user_id !== auth.user.id) {
      return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 })
    }

    // 2. IDEMPOTENCY — never process twice
    if (payment.status === 'completed' || payment.status === 'successful') {
      return NextResponse.json({
        success: true,
        status: 'completed',
        message: 'Payment already verified and active.',
      })
    }

    // 3. VERIFY WITH PAYSTACK
    let verifyResult: Awaited<ReturnType<typeof paystackClient.verifyPayment>>
    try {
      verifyResult = await paystackClient.verifyPayment(transactionId)
    } catch (verifyError: unknown) {
      await supabase
        .from('payments')
        .update({
          status: 'failed',
          error_message: 'Paystack verification failed',
          updated_at: new Date().toISOString(),
        })
        .eq('id', payment.id)

      return NextResponse.json({ success: false, error: 'Payment verification failed with Paystack' }, { status: 502 })
    }

    if (!verifyResult.status || verifyResult.data.status !== 'success') {
      const newStatus = verifyResult.data.status === 'pending' ? 'pending' : 'failed'
      await supabase
        .from('payments')
        .update({ status: newStatus, paystack_data: verifyResult.data, updated_at: new Date().toISOString() })
        .eq('id', payment.id)
      return NextResponse.json({ success: false, status: newStatus, error: `Payment ${newStatus}` }, { status: 400 })
    }

    const paystackData = verifyResult.data

    // 4. VALIDATE AMOUNT
    const expectedKobo = paystackClient.toKobo(payment.amount)
    if (paystackData.amount < expectedKobo) {
      await supabase
        .from('payments')
        .update({ status: 'failed', error_message: 'Amount mismatch', paystack_data: paystackData, updated_at: new Date().toISOString() })
        .eq('id', payment.id)
      return NextResponse.json({ success: false, error: 'Amount mismatch — possible fraud' }, { status: 400 })
    }

    // 5. ATOMIC FULFILLMENT via RPC
    const { error: rpcError } = await supabase.rpc('handle_successful_payment', {
      p_payment_id:    payment.id,
      p_user_id:       payment.user_id,
      p_product_id:    payment.product_id,
      p_payment_type:  payment.payment_type,
      p_tokens_to_add: (payment.metadata as { tokens_to_add?: number } | null)?.tokens_to_add ?? 0,
      p_paystack_data: paystackData,
    })

    if (rpcError) {
      // Fallback manual fulfillment — still atomic per resource type
      await supabase
        .from('payments')
        .update({ status: 'completed', verified_at: new Date().toISOString(), paystack_data: paystackData, updated_at: new Date().toISOString() })
        .eq('id', payment.id)

      if (payment.payment_type === 'bundle' && (payment.metadata as { tokens_to_add?: number } | null)?.tokens_to_add) {
        const { error: tokenErr } = await supabase.rpc('add_tokens_to_user', {
          p_user_id:   payment.user_id,
          p_tokens:    (payment.metadata as { tokens_to_add: number }).tokens_to_add,
          p_source:    'payment',
          p_reference: transactionId,
        })
        if (tokenErr) {
          // Token RPC failed — log but don't surface to caller (payment status already set)
          console.error('[verify] add_tokens_to_user failed:', tokenErr.message)
        }
      }

      if (payment.payment_type === 'subscription') {
        const endDate = new Date()
        endDate.setMonth(endDate.getMonth() + 3)
        await supabase.from('subscriptions').insert({
          user_id:    payment.user_id,
          plan_type:  payment.product_id,
          status:     'active',
          start_date: new Date().toISOString(),
          end_date:   endDate.toISOString(),
          payment_id: payment.id,
        })
      }
    }

    return NextResponse.json({
      success: true,
      status: 'completed',
      message: 'Payment verified and account upgraded successfully!',
      data: {
        payment_type: payment.payment_type,
        product_id:   payment.product_id,
        amount:       payment.amount,
      },
    })
  } catch (err: unknown) {
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
