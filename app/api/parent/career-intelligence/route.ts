// app/api/parent/career-intelligence/route.ts
// Phase 6: Parent Intelligence — returns parent-friendly capability + career insights for a linked student.
import { NextRequest } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { apiSuccess, apiError, apiUnauthorized, apiBadRequest, apiNotFound } from '@/lib/api/response'
import { getAllCareersWithCOS } from '@/lib/career/careerEngine'
import { computeCapabilityMatches } from '@/lib/career/capabilityMatchEngine'
import { extractCapabilityProfile } from '@/lib/career/capabilityExtractor'
import { buildParentIntelligence } from '@/lib/career/parentIntelligence'
import { recomputeLearnerProjection } from '@/lib/projection/recompute'
import { projectionToScoreHistory } from '@/lib/learnerIntelligence/projectionAdapters'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return apiUnauthorized()

    const studentId = new URL(req.url).searchParams.get('studentId')
    if (!studentId) return apiBadRequest('studentId is required')

    // Verify caller is the student's owner or the linked parent (parent_user_id)
    const { data: student } = await supabase
      .from('students')
      .select('id, name, user_id, parent_user_id, grade')
      .eq('id', studentId)
      .maybeSingle()

    if (!student) return apiNotFound('Student not found')

    const isOwner  = student.user_id      === user.id
    const isParent = student.parent_user_id === user.id
    if (!isOwner && !isParent) return apiUnauthorized()

    // Sourced live from Projection — the same path Blueprint and Career
    // Intelligence use — instead of the separately-stored, potentially stale
    // `career_capability_profiles` snapshot. See docs/architecture/migration-ledger.md.
    const projection   = await recomputeLearnerProjection(studentId)
    const scoreHistory = projectionToScoreHistory(projection)
    if (scoreHistory.length === 0) {
      return apiSuccess({ has_profile: false, report: null })
    }
    const profile = extractCapabilityProfile(scoreHistory)

    const careers = await getAllCareersWithCOS()
    const matchReport = computeCapabilityMatches(studentId, profile, careers)
    // Career Principle: Junior (Grade 7-9) parents see broad exploration
    // families, never a ranked/percentage career prediction.
    const mode = student.grade >= 7 && student.grade <= 9 ? 'exploration' as const : 'planning' as const
    const report = buildParentIntelligence(profile, matchReport, studentId, student.name, mode)

    return apiSuccess({ has_profile: true, report, match_report: mode === 'planning' ? matchReport : null })
  } catch (err) {
    console.error('[parent/career-intelligence]', err)
    return apiError('Failed to load career intelligence')
  }
}
