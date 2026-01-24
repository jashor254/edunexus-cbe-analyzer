// app/api/ai/usage/route.ts
// API endpoint to check current usage

import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit } from '@/lib/ai/rateLimit'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const userId = searchParams.get('userId')
    const tier = (searchParams.get('tier') as 'free' | 'family' | 'school') || 'free'
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Missing userId parameter' },
        { status: 400 }
      )
    }
    
    const [careerAnalysis, learningPlans, chatMessages] = await Promise.all([
      checkRateLimit(userId, 'careerAnalysis', tier),
      checkRateLimit(userId, 'learningPlans', tier),
      checkRateLimit(userId, 'chatMessages', tier)
    ])
    
    return NextResponse.json({
      success: true,
      tier,
      usage: {
        careerAnalysis,
        learningPlans,
        chatMessages
      },
      resetDate: getNextMonthStart()
    })
    
  } catch (error) {
    console.error('Usage check API error:', error)
    return NextResponse.json(
      { error: 'Failed to check usage' },
      { status: 500 }
    )
  }
}

function getNextMonthStart(): string {
  const date = new Date()
  date.setMonth(date.getMonth() + 1)
  date.setDate(1)
  date.setHours(0, 0, 0, 0)
  return date.toISOString()
}