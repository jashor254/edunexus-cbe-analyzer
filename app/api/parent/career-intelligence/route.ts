// app/api/parent/career-intelligence/route.ts
// Phase 6: Parent Intelligence — returns parent-friendly capability + career insights for a linked student.
import { NextRequest } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { apiSuccess, apiError, apiUnauthorized, apiBadRequest, apiNotFound } from '@/lib/api/response'
import { getCapabilityProfile, getAllCareersWithCOS } from '@/lib/career/careerEngine'
import { computeCapabilityMatches } from '@/lib/career/capabilityMatchEngine'
import { buildParentIntelligence } from '@/lib/career/parentIntelligence'

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
      .select('id, name, user_id, parent_user_id')
      .eq('id', studentId)
      .maybeSingle()

    if (!student) return apiNotFound('Student not found')

    const isOwner  = student.user_id      === user.id
    const isParent = student.parent_user_id === user.id
    if (!isOwner && !isParent) return apiUnauthorized()

    const profile = await getCapabilityProfile(studentId)
    if (!profile) {
      return apiSuccess({ has_profile: false, report: null })
    }

    const careers = await getAllCareersWithCOS()
    const matchReport = computeCapabilityMatches(studentId, profile, careers)
    const report = buildParentIntelligence(profile, matchReport, studentId, student.name)

    return apiSuccess({ has_profile: true, report, match_report: matchReport })
  } catch (err) {
    console.error('[parent/career-intelligence]', err)
    return apiError('Failed to load career intelligence')
  }
}
