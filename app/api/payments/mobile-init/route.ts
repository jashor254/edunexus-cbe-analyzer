// app/api/payments/mobile-init/route.ts
// Mobile (M-PESA) Paystack transaction initializer.
// Amount is ALWAYS derived server-side from productId — never trusted from client.
import { NextRequest } from 'next/server'
import { createServiceClient } from '@/utils/supabase/service'
import { apiSuccess, apiError, apiBadRequest } from '@/lib/api/response'
import { requireAuth } from '@/lib/api/middleware'
import { SUBSCRIPTION_PLANS, TOKEN_PACK } from '@/lib/payments/config'

const PRODUCTS: Record<string, { price: number; type: string; label: string; tokens?: number }> = {
  starter: { price: TOKEN_PACK.priceKes,                        type: 'token',        label: 'Pay-As-You-Go', tokens: TOKEN_PACK.tokens },
  term:    { price: SUBSCRIPTION_PLANS.TERMLY_SINGLE.priceKes, type: 'subscription', label: 'Term Plan'      },
  family:  { price: SUBSCRIPTION_PLANS.TERMLY_FAMILY.priceKes, type: 'subscription', label: 'Family Plan'    },
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth()
  if ('response' in auth) return auth.response

  try {
    const body = await req.json()
    const { phone, productId } = body as { phone?: string; productId?: string }

    if (!productId) return apiBadRequest('productId is required')
    if (!phone)     return apiBadRequest('phone is required')

    // 🔒 Server-side price lookup — client-supplied amount is never used
    const product = PRODUCTS[productId]
    if (!product) return apiBadRequest('Invalid product selected')

    if (!process.env.PAYSTACK_SECRET_KEY) {
      return apiError('Payment provider not configured')
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
        channels:    ['mpesa', 'card', 'bank', 'ussd', 'qr'],
        metadata:    { productId, phone_number: phone, user_id: auth.user.id },
        callback_url: `${process.env.NEXT_PUBLIC_SITE_URL}/payment/success`,
      }),
    })

    const data = await response.json() as { status: boolean; data: { authorization_url: string; reference: string }; message?: string }

    if (!response.ok || !data.status) {
      return apiError(data.message ?? 'Paystack initialization failed')
    }

    // Record pending payment
    const db = createServiceClient()
    await db.from('payments').insert({
      user_id:        auth.user.id,
      transaction_id: data.data.reference,
      amount:         product.price,
      status:         'pending',
      product_id:     productId,
      metadata:       { phone, email: auth.user.email, purchase_type: product.type, product_label: product.label },
    })

    return apiSuccess({
      authorization_url: data.data.authorization_url,
      reference:         data.data.reference,
    })
  } catch (err: unknown) {
    return apiError(err instanceof Error ? err.message : 'Internal server error')
  }
}
