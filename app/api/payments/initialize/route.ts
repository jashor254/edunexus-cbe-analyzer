import { createClient } from '@/utils/supabase/server'
import { createServiceClient } from '@/utils/supabase/service'
import { apiSuccess, apiError, apiUnauthorized, apiBadRequest } from '@/lib/api/response'
import { PURCHASABLE_PRODUCTS, PAYMENT_CURRENCY } from '@/lib/payments/config'
import { getSiteUrl } from '@/lib/payments/siteUrl'
import { toMinorUnits } from '@/lib/payments/verification'
import { z } from 'zod'

const InitializeSchema = z.object({
  productId:   z.string().min(1),
  phoneNumber: z.string().min(1),
})

export async function POST(req: Request) {
  try {
    const rawBody: unknown = await req.json()
    const parsed = InitializeSchema.safeParse(rawBody)
    if (!parsed.success) {
      return apiBadRequest(parsed.error.message ?? 'Invalid request body')
    }
    const { productId, phoneNumber } = parsed.data

    // 🔐 1. Auth — anon client reads session cookie
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return apiUnauthorized()
    }

    // 🧠 2. Validate product — PURCHASABLE_PRODUCTS is the single registry of
    //    what a NEW payment may be opened against. Retired products (notably
    //    the 'starter' token pack) are absent and are rejected here.
    const product = PURCHASABLE_PRODUCTS[productId]
    if (!product) {
      return apiBadRequest('Invalid product selected')
    }

    // 📱 3. Format phone → 254XXXXXXXXX
    const clean = phoneNumber.replace(/\D/g, '')
    let formattedPhone: string

    if (clean.startsWith('254'))    formattedPhone = clean
    else if (clean.startsWith('0')) formattedPhone = '254' + clean.slice(1)
    else                            formattedPhone = '254' + clean

    if (formattedPhone.length !== 12) {
      return apiBadRequest('Invalid M-PESA number. Use format: 0712345678')
    }

    // 🌐 Resolve the public base URL BEFORE creating any payment row, so a
    //    misconfiguration fails closed instead of leaving an orphaned pending
    //    payment and an "undefined/api/…" callback URL.
    let siteUrl: string
    try {
      siteUrl = getSiteUrl()
    } catch (configError: unknown) {
      console.error('[initialize] site URL not configured:', configError instanceof Error ? configError.message : String(configError))
      return apiError('Payment provider not configured')
    }

    // 🆔 4. Unique reference
    const reference = `EDU-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`

    // 💾 5. Save pending payment — service client bypasses RLS
    const db = createServiceClient()

    const { error: insertError } = await db.from('payments').insert({
      user_id:        user.id,
      transaction_id: reference,
      amount:         product.price,
      status:         'pending',
      product_id:     productId,
      metadata: {
        phone:         formattedPhone,
        email:         user.email,
        purchase_type: product.type,
        product_label: product.label,
      }
    })

    if (insertError) {
      console.error('[initialize] DB error:', insertError.code, insertError.message)
      return apiError('Could not save transaction. Try again.')
    }

    // 🌍 6. Initialize Paystack
    const paystackRes = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        Authorization:  `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email:        user.email,
        amount:       toMinorUnits(product.price),
        currency:     PAYMENT_CURRENCY,
        reference,
        callback_url: `${siteUrl}/api/payments/callback?plan=${productId}`,
        metadata: {
          reference,
          user_id:       user.id,
          product_id:    productId,
          phone_number:  formattedPhone,
          purchase_type: product.type,
        },
        channels: ['mpesa', 'card', 'bank', 'ussd'],
      }),
    })

    const data = await paystackRes.json()

    if (!data.status) {
      console.error('[initialize] Paystack error:', data.message)
      return apiBadRequest(data.message || 'Paystack initialization failed')
    }

    return apiSuccess({
      authorization_url: data.data.authorization_url,
      reference:         data.data.reference,
    })

  } catch (error: unknown) {
    console.error('[initialize] Unhandled error:', error instanceof Error ? error.message : String(error))
    return apiError('Internal server error')
  }
}