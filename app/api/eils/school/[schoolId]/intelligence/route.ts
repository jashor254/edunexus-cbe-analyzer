// app/api/eils/school/[schoolId]/intelligence/route.ts
// GET /api/eils/school/:schoolId/intelligence
// Returns EILS school intelligence for principals and HoDs.

import { createClient } from '@/utils/supabase/server'
import { createServiceClient } from '@/utils/supabase/service'
import { apiSuccess, apiError, apiUnauthorized, apiForbidden } from '@/lib/api/response'
import { buildSchoolIntelligence } from '@/lib/eils'

export async function GET(
  req:     Request,
  { params }: { params: Promise<{ schoolId: string }> },
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return apiUnauthorized()

    const { schoolId } = await params
    const db = createServiceClient()

    // Must be a verified teacher or admin at this school
    const { data: schoolUser } = await db
      .from('school_users')
      .select('role, verified')
      .eq('school_id', schoolId)
      .eq('user_id', user.id)
      .single()

    if (!schoolUser?.verified) return apiForbidden()
    if (!['teacher', 'hod', 'admin', 'principal'].includes(schoolUser.role as string)) {
      return apiForbidden()
    }

    const url    = new URL(req.url)
    const weekOf = url.searchParams.get('week_of') ?? undefined

    const intelligence = await buildSchoolIntelligence(schoolId, weekOf)
    return apiSuccess(intelligence)
  } catch (err) {
    return apiError(err instanceof Error ? err.message : 'Failed to build school intelligence')
  }
}
