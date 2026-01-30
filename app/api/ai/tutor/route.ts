import { NextRequest, NextResponse } from 'next/server'
import { GuardianTutor } from '@/lib/ai/GuardianTutor'

// Hakikisha neno POST limeandikwa kwa CAPITAL LETTERS
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    
    // Test kidogo kuona kama data inafika
    console.log("Data inayokuja:", body)

    const response = await GuardianTutor.generateResponse(body)

    return NextResponse.json({ response })
    
  } catch (error: any) {
    console.error('API Error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: 500 }
    )
  }
}

// Hii hapa chini ni siri: Next.js wakati mwingine inahitaji kulazimishwa 
// kutambua kuwa hii ni Dynamic route
export const dynamic = 'force-dynamic'