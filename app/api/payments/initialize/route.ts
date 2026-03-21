import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const body = await req.json()

  const { email, amount } = body

  try {
    const res = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        amount: amount * 100,
        currency: 'KES',
      }),
    })

    const data = await res.json()

    if (!data.status) {
      throw new Error(data.message)
    }

    return NextResponse.json({
      authorization_url: data.data.authorization_url,
    })

  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}