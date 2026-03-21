// app/api/payments/mobile-init/route.ts
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const { email, amount, phone, productId } = await req.json()

    // 🔍 DEBUG - angalia hizi kwenye terminal
    console.log('1. Secret key exists:', !!process.env.PAYSTACK_SECRET_KEY)
    console.log('2. Secret key prefix:', process.env.PAYSTACK_SECRET_KEY?.substring(0, 10))
    console.log('3. Amount:', amount)

    if (!process.env.PAYSTACK_SECRET_KEY) {
      return NextResponse.json(
        { error: 'Paystack secret key not configured' },
        { status: 500 }
      )
    }

    const response = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: email || 'test@example.com',
        amount: amount * 100, // Convert to kobo
        currency: 'KES',
        channels: ['mpesa', 'card', 'bank', 'ussd', 'qr'],
        metadata: {
          productId,
          phone_number: phone
        },
        callback_url: `${process.env.NEXT_PUBLIC_SITE_URL}/payment/success`
      })
    })

    const data = await response.json()
    console.log('Paystack response:', data)

    if (!response.ok) {
      return NextResponse.json(
        { error: data.message },
        { status: response.status }
      )
    }

    return NextResponse.json({
      authorization_url: data.data.authorization_url,
      reference: data.data.reference
    })

  } catch (error) {
    console.error('Server error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}