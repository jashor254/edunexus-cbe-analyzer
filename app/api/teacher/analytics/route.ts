import { createClient } from '@/utils/supabase/server'
import { createServiceClient } from '@/utils/supabase/service'
import { apiSuccess, apiError, apiUnauthorized, apiForbidden } from '@/lib/api/response'
import { getAssessmentAnalytics } from '@/lib/assessments/analytics'

export async function GET(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return apiUnauthorized()

    const db = createServiceClient()
    const { data: teacher } = await db
      .from('teachers')
      .select('id')
      .eq('user_id', user.id)
      .single()
    if (!teacher) return apiForbidden()

    const url    = new URL(req.url)
    const term   = url.searchParams.get('term')   ?? undefined
    const yearRaw = url.searchParams.get('year')
    const year   = yearRaw ? parseInt(yearRaw, 10) : undefined

    const analytics = await getAssessmentAnalytics(teacher.id, { term, year })
    return apiSuccess({ analytics })
  } catch (e: unknown) {
    console.error('[teacher/analytics GET]', e instanceof Error ? e.message : String(e))
    return apiError('Failed to fetch analytics')
  }
}
