// app/api/payments/mobile-init/route.ts
// Mobile (M-PESA) Paystack transaction initializer.
// Amount is ALWAYS derived server-side from productId — never trusted from client.
import { z } from 'zod'
import { NextRequest } from 'next/server'
import { createServiceClient } from '@/utils/supabase/service'
import { apiSuccess, apiError, apiBadRequest } from '@/lib/api/response'
import { requireAuth } from '@/lib/api/middleware'
import { PURCHASABLE_PRODUCTS } from '@/lib/payments/config'

const MobileInitSchema = z.object({
  phone:     z.string().min(1),
  productId: z.string().min(1),
})

export async function POST(req: NextRequest) {
  const auth = await requireAuth()
  if ('response' in auth) return auth.response

  try {
    const parsed = MobileInitSchema.safeParse(await req.json())
    if (!parsed.success) return apiBadRequest(parsed.error.issues[0]?.message ?? 'phone and productId are required')
    const { phone, productId } = parsed.data

    // 🔒 Server-side price lookup — client-supplied amount is never used.
    //    Same registry as app/api/payments/initialize, so the two entry points
    //    accept exactly the same products at exactly the same prices.
    const product = PURCHASABLE_PRODUCTS[productId]
    if (!product) return apiBadRequest('Invalid product selected')

    if (!process.env.PAYSTACK_SECRET_KEY) {
      return apiError('Payment provider not configured')
    }

    // 🆔 Unique reference — generated locally so the payments row can be
    // persisted BEFORE Paystack is called. This guarantees a webhook/verify
    // lookup by transaction_id can always find the row, even if Paystack's
    // response never reaches the client (network drop, timeout, etc).
    const reference = `EDU-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`

    const db = createServiceClient()
    const { error: insertError } = await db.from('payments').insert({
      user_id:        auth.user.id,
      transaction_id: reference,
      amount:         product.price,
      status:         'pending',
      product_id:     productId,
      metadata:       { phone, email: auth.user.email, purchase_type: product.type, product_label: product.label },
    })

    if (insertError) {
      return apiError('Could not save transaction. Try again.')
    }

    const response = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        Authorization:  `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email:       auth.user.email,
        amount:      product.price * 100, // kobo
        currency:    'KES',
        reference,
        channels:    ['mpesa', 'card', 'bank', 'ussd', 'qr'],
        metadata:    { productId, phone_number: phone, user_id: auth.user.id },
        callback_url: `${process.env.NEXT_PUBLIC_SITE_URL}/payment/success`,
      }),
    })

    const data = await response.json() as { status: boolean; data: { authorization_url: string; reference: string }; message?: string }

    if (!response.ok || !data.status) {
      // Paystack never accepted the transaction — mark the local row failed
      // so it doesn't sit as an orphaned 'pending' payment forever.
      await db.from('payments').update({ status: 'failed' }).eq('transaction_id', reference)
      return apiError(data.message ?? 'Paystack initialization failed')
    }

    return apiSuccess({
      authorization_url: data.data.authorization_url,
      reference:         data.data.reference,
    })
  } catch (err: unknown) {
    return apiError(err instanceof Error ? err.message : 'Internal server error')
  }
}
