// app/api/ai/integrated-plan/route.ts
// API endpoint for integrated learning plans

import { NextRequest, NextResponse } from 'next/server'
import { generateCareerIntegratedLearningPlan } from '@/lib/ai/careerAnalysis'
import { checkRateLimit, trackUsage } from '@/lib/ai/rateLimit'

function getNextMonthStart(): string {
  const date = new Date()
  date.setMonth(date.getMonth() + 1)
  date.setDate(1)
  date.setHours(0, 0, 0, 0)
  return date.toISOString()
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { 
      career, 
      subject, 
      currentLevel, 
      targetLevel, 
      studentName,
      userId,
      tier = 'free' 
    } = body
    
    if (!career || !subject || !currentLevel || !targetLevel || !studentName || !userId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }
    
    const rateLimit = await checkRateLimit(userId, 'learningPlans', tier)
    
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { 
          error: 'Rate limit exceeded',
          limit: rateLimit.limit,
          remaining: 0,
          resetDate: getNextMonthStart()
        },
        { status: 429 }
      )
    }
    
    const plan = await generateCareerIntegratedLearningPlan(
      career,
      subject,
      currentLevel,
      targetLevel,
      studentName
    )
    
    await trackUsage(userId, 'learningPlans', {
      career,
      subject,
      levelGap: targetLevel - currentLevel
    })
    
    return NextResponse.json({
      success: true,
      plan,
      usage: {
        remaining: rateLimit.remaining - 1,
        limit: rateLimit.limit
      }
    })
    
  } catch (error) {
    console.error('Integrated plan API error:', error)
    return NextResponse.json(
      { error: 'Failed to generate learning plan' },
      { status: 500 }
    )
  }
}