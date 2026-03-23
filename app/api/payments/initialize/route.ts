import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createServiceClient } from '@/utils/supabase/service'

// 🔒 Single source of truth — backend only, never trust frontend
const PRODUCTS: Record<string, { price: number; type: string; label: string; tokens?: number }> = {
  starter: { price: 500,  type: 'token',       label: 'Try It',    tokens: 15 },
  term:    { price: 3200, type: 'subscription', label: 'Term Plan'             },
  premium: { price: 7000, type: 'subscription', label: 'Premium'               },
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { productId, phoneNumber } = body

    // 🔐 1. Auth — anon client reads session cookie
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Please login first' }, { status: 401 })
    }

    // 🧠 2. Validate product
    const product = PRODUCTS[productId]
    if (!product) {
      return NextResponse.json({ error: 'Invalid product selected' }, { status: 400 })
    }

    // 📱 3. Format phone → 254XXXXXXXXX
    const clean = phoneNumber.replace(/\D/g, '')
    let formattedPhone: string

    if (clean.startsWith('254'))    formattedPhone = clean
    else if (clean.startsWith('0')) formattedPhone = '254' + clean.slice(1)
    else                            formattedPhone = '254' + clean

    if (formattedPhone.length !== 12) {
      return NextResponse.json(
        { error: 'Invalid M-PESA number. Use format: 0712345678' },
        { status: 400 }
      )
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
      return NextResponse.json(
        { error: 'Could not save transaction. Try again.' },
        { status: 500 }
      )
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL

    // 🌍 6. Initialize Paystack
    const paystackRes = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        Authorization:  `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email:        user.email,
        amount:       product.price * 100, // kobo
        currency:     'KES',
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
      return NextResponse.json(
        { error: data.message || 'Paystack initialization failed' },
        { status: 400 }
      )
    }

    return NextResponse.json({
      authorization_url: data.data.authorization_url,
      reference:         data.data.reference,
    })

  } catch (error: any) {
    console.error('[initialize] Unhandled error:', error.message)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}