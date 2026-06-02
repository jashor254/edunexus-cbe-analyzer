// app/api/ai/integrated-plan/route.ts
// Generates a career-integrated learning plan via DeepSeek AI.

import { NextRequest, NextResponse } from 'next/server'
import { generateCareerIntegratedLearningPlan } from '@/lib/academicClinic/careerEngine'
import { checkFeatureAccess, deductFeatureTokens } from '@/lib/payments/access'
import { type FeatureKey } from '@/lib/payments/config'

const FEATURE: FeatureKey = 'learning_compass'

export async function POST(request: NextRequest) {
  try {
    // ── Access check — auth + tier verification via session, never body userId ──
    const access = await checkFeatureAccess(FEATURE)
    if (access.allowed === false) {
      const status = access.reason === 'unauthenticated' ? 401 : 403
      return NextResponse.json({ error: access.reason }, { status })
    }

    const body = await request.json()
    const { career, subject, currentLevel, targetLevel, studentName } = body

    if (!career || !subject || !currentLevel || !targetLevel || !studentName) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const plan = await generateCareerIntegratedLearningPlan(
      career,
      subject,
      currentLevel,
      targetLevel,
      studentName
    )

    // ── Deduct ONLY after success, ONLY for token users ──
    if (access.deductTokens) {
      await deductFeatureTokens(access.userId, FEATURE, access.cost)
    }

    return NextResponse.json({ success: true, plan })

  } catch (error) {
    console.error('[integrated-plan] error:', error)
    return NextResponse.json(
      { error: 'Failed to generate learning plan' },
      { status: 500 }
    )
  }
}
