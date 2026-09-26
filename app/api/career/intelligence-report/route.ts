// app/api/career/intelligence-report/route.ts
// Generates the full 13-section Career Intelligence Report for a student.
// One DeepSeek call for narrative sections + deterministic sections from COS pipeline.

import { NextRequest } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createServiceClient } from '@/utils/supabase/service'
import {
  apiSuccess, apiError, apiUnauthorized, apiBadRequest, apiForbidden,
} from '@/lib/api/response'
import { buildCareerIntelligenceReport } from '@/lib/career/careerIntelligenceEngine'
import { checkDailyCallLimit } from '@/lib/ai/rateLimit'
import { checkFeatureAccess, deductFeatureTokens } from '@/lib/payments/access'
import { apiPaymentRequired } from '@/lib/payments/paywall'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return apiUnauthorized()

    const { searchParams } = new URL(req.url)
    const studentId = searchParams.get('studentId')
    if (!studentId) return apiBadRequest('studentId is required')

    // Verify the student belongs to this user (owner or linked parent)
    const { data: student } = await supabase
      .from('students')
      .select('id, user_id, parent_user_id')
      .eq('id', studentId)
      .maybeSingle()

    if (!student) return apiForbidden()

    const isOwner  = student.user_id       === user.id
    const isParent = student.parent_user_id === user.id
    if (!isOwner && !isParent) return apiForbidden()

    // Priced at TOKEN_COSTS.career_intelligence_report, free on a Term Plan.
    // This route previously ran the paid report for anyone with no charge.
    const access = await checkFeatureAccess('career_intelligence_report')
    if (access.allowed === false) {
      if (access.reason === 'insufficient_tokens') return apiPaymentRequired('career_intelligence_report')
      return access.reason === 'unauthenticated' ? apiUnauthorized() : apiForbidden()
    }

    // Rate limit check — 2 intelligence reports per user per day
    const rateCheck = await checkDailyCallLimit(user.id, 'career_intelligence_report')
    if (!rateCheck.allowed) {
      return apiError(
        `Daily limit reached (${rateCheck.limit} career intelligence reports per day). Resets at midnight UTC.`,
        429
      )
    }

    const db = createServiceClient()
    const report = await buildCareerIntelligenceReport(studentId, db)

    // Charged only after the report was built — never for a failed run.
    if (access.deductTokens) {
      await deductFeatureTokens(access.userId, 'career_intelligence_report', access.cost)
    }

    return apiSuccess({ report })
  } catch (err) {
    console.error('[career/intelligence-report]', err)
    return apiError('Failed to generate career intelligence report')
  }
}
