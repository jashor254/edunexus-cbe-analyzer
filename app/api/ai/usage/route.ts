// app/api/ai/usage/route.ts
import { NextRequest } from 'next/server'
import { checkRateLimit } from '@/lib/ai/rateLimit'
import { apiSuccess, apiError, apiUnauthorized } from '@/lib/api/response'
import type { UsageTier } from '@/lib/ai/rateLimit'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const tier = (searchParams.get('tier') as UsageTier) || 'free'

    if (!userId) {
      return apiUnauthorized()
    }

    // Hapa tunacheki kama amefika kikomo (Rate Limits)
    const [careerAnalysis, learningPlans, chatMessages] = await Promise.all([
      checkRateLimit(userId, 'careerAnalysis', tier),
      checkRateLimit(userId, 'learningPlans', tier),
      checkRateLimit(userId, 'chatMessages', tier)
    ])

    return apiSuccess({
      tier,
      usage: {
        careerAnalysis, // Hii itarudisha { allowed: boolean, remaining: number }
        learningPlans,
        chatMessages
      },
      resetDate: getNextMonthStart()
    })

  } catch (error) {
    console.error('Usage check API error:', error)
    return apiError('Internal Server Error', 500)
  }
}

function getNextMonthStart(): string {
  const date = new Date()
  date.setMonth(date.getMonth() + 1)
  date.setDate(1)
  date.setHours(0, 0, 0, 0)
  return date.toISOString()
}