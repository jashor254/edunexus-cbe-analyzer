// app/api/career/intelligence-report/route.ts
// Generates the full 13-section Career Intelligence Report for a student.
// Deterministic sections are computed live on every view; the one AI call
// (narrative sections) runs only when no narrative exists for the learner's
// current inputs. Re-opening a report whose evidence has not changed reuses
// the stored narrative — no model call, no daily-cap unit, no charge.

import { NextRequest } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createServiceClient } from '@/utils/supabase/service'
import {
  apiSuccess, apiError, apiUnauthorized, apiBadRequest, apiForbidden,
} from '@/lib/api/response'
import { buildCareerIntelligenceReport, NarrativeNotAvailableError } from '@/lib/career/careerIntelligenceEngine'
import { reserveDailyCallOrThrow, DailyLimitExceededError, dailyLimitMessage, type HeldReservation } from '@/lib/ai/rateLimit'
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
    // A parent without tokens may still re-open a report whose narrative
    // already exists for the current evidence (they paid for it) — only a
    // NEW generation needs access.
    const access = await checkFeatureAccess('career_intelligence_report')
    if (access.allowed === false && access.reason !== 'insufficient_tokens') {
      return access.reason === 'unauthenticated' ? apiUnauthorized() : apiForbidden()
    }

    const db = createServiceClient()
    // Rate limit — 2 intelligence report GENERATIONS per user per day,
    // reserved by the engine's hook only when a fresh model call is needed.
    const held: { quota?: HeldReservation } = {}
    let report: Awaited<ReturnType<typeof buildCareerIntelligenceReport>>
    try {
      report = await buildCareerIntelligenceReport(studentId, db, {
        allowGeneration: access.allowed,
        beforeGenerate: async () => { held.quota = await reserveDailyCallOrThrow(user.id, 'career_intelligence_report') },
      })
    } catch (err) {
      if (err instanceof NarrativeNotAvailableError) return apiPaymentRequired('career_intelligence_report')
      if (err instanceof DailyLimitExceededError) {
        return apiError(dailyLimitMessage(err, 'career intelligence reports'), 429)
      }
      await held.quota?.release('career intelligence report generation failed')
      throw err
    }

    // Charged only for a fresh generation that succeeded — never for a
    // failed run, and never for re-opening an unchanged report.
    if (report.narrative_source === 'generated' && access.allowed && access.deductTokens) {
      await deductFeatureTokens(access.userId, 'career_intelligence_report', access.cost)
    }

    return apiSuccess({ report })
  } catch (err) {
    console.error('[career/intelligence-report]', err)
    return apiError('Failed to generate career intelligence report')
  }
}
