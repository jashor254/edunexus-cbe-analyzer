// app/api/career/growth/route.ts
// Phase 7: Returns capability growth report for a student (current vs previous snapshot).
import { NextRequest } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { apiSuccess, apiError, apiUnauthorized, apiBadRequest } from '@/lib/api/response'
import { getCapabilityHistory } from '@/lib/career/careerEngine'
import { resolveCurrentCapabilityProfile } from '@/lib/learnerIntelligence/careerIntelligenceOrchestration'
import { computeCapabilityGrowth } from '@/lib/career/growthEngine'
import { canAccessLegacyStudent } from '@/lib/core/permissions'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return apiUnauthorized()

    const studentId = new URL(req.url).searchParams.get('studentId')
    if (!studentId) return apiBadRequest('studentId is required')

    // Ownership check — legacy self link, or the institutional Phase 1C
    // compatibility bridge (canAccessLegacyStudent, lib/core/permissions.ts).
    const allowed = await canAccessLegacyStudent(user.id, studentId)
    if (!allowed) return apiUnauthorized()

    // Phase 5 (Career Intelligence Convergence): "current" is now the live
    // canonical profile (Projection-first, legacy-blend only on absence —
    // resolveCurrentCapabilityProfile), not the possibly-stale persisted
    // snapshot. "previous" stays a real historical record from
    // capability_history — Projection is stateless and keeps no history of
    // its own, so a genuine "growth since last recorded snapshot" question
    // can only be answered by comparing live current state against a past
    // persisted point, never by comparing two persisted points. Only
    // history[1] (not history[0], which used to double as "current") is
    // read here, so this is a drop-in change, not a restructuring.
    const [current, history] = await Promise.all([
      resolveCurrentCapabilityProfile(studentId),
      getCapabilityHistory(studentId, 2),
    ])

    if (!current) return apiSuccess({ has_profile: false, growth: null })

    // Previous snapshot = second-most-recent history entry
    const previous = history.length > 1 ? (history[1].profile as typeof current) : null

    const growth = computeCapabilityGrowth(studentId, current, previous)

    return apiSuccess({ has_profile: true, growth })
  } catch (err) {
    console.error('[career/growth]', err)
    return apiError('Failed to compute growth report')
  }
}
