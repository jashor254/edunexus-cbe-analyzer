// app/api/ai/career-analysis/route.ts
// API endpoint for AI career analysis

import { NextRequest, NextResponse } from 'next/server'
import { analyzeCareerOptions, type CareerProfile } from '@/lib/ai/careerAnalysis'
import { checkRateLimit, trackUsage } from '@/lib/ai/rateLimit'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { profile, userId, tier = 'free' } = body as { 
      profile: CareerProfile
      userId: string
      tier?: 'free' | 'family' | 'school'
    }
    
    if (!profile || !userId) {
      return NextResponse.json(
        { error: 'Missing required fields: profile, userId' },
        { status: 400 }
      )
    }
    
    const rateLimit = await checkRateLimit(userId, 'careerAnalysis', tier)
    
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
    
    const recommendations = await analyzeCareerOptions(profile)
    
    await trackUsage(userId, 'careerAnalysis', {
      pathway: profile.pathway,
      grade: profile.grade,
      recommendationsCount: recommendations.length
    })
    
    return NextResponse.json({
      success: true,
      recommendations,
      usage: {
        remaining: rateLimit.remaining - 1,
        limit: rateLimit.limit
      }
    })
    
  } catch (error) {
    console.error('Career analysis API error:', error)
    return NextResponse.json(
      { error: 'Failed to generate career analysis' },
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