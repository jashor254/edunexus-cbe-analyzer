// GET /api/school/intervention-efficacy
// Returns intervention efficacy breakdown for all teachers in the same school
// as the authenticated teacher. Aggregates across intervention types and computes
// a school-wide efficacy rate.

import { createClient } from '@/utils/supabase/server'
import { createServiceClient } from '@/utils/supabase/service'
import { apiSuccess, apiError, apiUnauthorized, apiForbidden } from '@/lib/api/response'
import { computeInterventionEfficacy } from '@/lib/school/intelligence'
import type { InterventionEfficacyRecord } from '@/lib/school/types'

type InterventionEfficacyResponse = {
  efficacy: InterventionEfficacyRecord[]
  total_interventions: number
  effective_count: number
  school_efficacy_rate: number
}

export async function GET(): Promise<Response> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return apiUnauthorized()

    const db = createServiceClient()
    const { data: teacher } = await db
      .from('teachers')
      .select('id, school_name')
      .eq('user_id', user.id)
      .single()

    if (!teacher) return apiForbidden()

    const schoolName = teacher.school_name as string | null
    if (!schoolName) return apiError('Teacher is not associated with a school', 403)

    // Find all teachers in the same school — match on school_name
    const { data: schoolTeachers } = await db
      .from('teachers')
      .select('user_id')
      .eq('school_name', schoolName)

    if (!schoolTeachers?.length) {
      return apiSuccess<InterventionEfficacyResponse>({
        efficacy:             [],
        total_interventions:  0,
        effective_count:      0,
        school_efficacy_rate: 0,
      })
    }

    const teacherUserIds = schoolTeachers.map(t => t.user_id as string)

    const efficacy = await computeInterventionEfficacy(teacherUserIds)

    const total_interventions  = efficacy.reduce((sum, r) => sum + r.total_run, 0)
    const effective_count      = efficacy.reduce((sum, r) => sum + r.effective_count, 0)
    const school_efficacy_rate = total_interventions > 0
      ? Math.round((effective_count / total_interventions) * 100) / 100
      : 0

    return apiSuccess<InterventionEfficacyResponse>({
      efficacy,
      total_interventions,
      effective_count,
      school_efficacy_rate,
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[school/intervention-efficacy]', msg)
    return apiError('Failed to load intervention efficacy')
  }
}
