import { createClient } from '@/utils/supabase/server'
import { createServiceClient } from '@/utils/supabase/service'
import { apiSuccess, apiError, apiUnauthorized, apiForbidden } from '@/lib/api/response'

export async function GET(req: Request): Promise<Response> {
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

    const url = new URL(req.url)
    const sowId = url.searchParams.get('sowId')

    let q = db
      .from('remedial_plans')
      .select('id, sow_id, class_id, term, year, week_start, week_end, subject, strand, sub_strand, groups, allocation, check_in_week, generated_at')
      .eq('teacher_id', teacher.id)
      .order('generated_at', { ascending: false })

    if (sowId) q = q.eq('sow_id', sowId)

    const { data, error } = await q.limit(20)
    if (error) throw error

    return apiSuccess({ plans: data ?? [] })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[remedial/list]', msg)
    return apiError('Failed to fetch remedial plans')
  }
}
