// POST: Manually trigger lesson plan generation for a specific week
import { createClient } from '@/utils/supabase/server'
import { createServiceClient } from '@/utils/supabase/service'
import {
  apiSuccess,
  apiError,
  apiUnauthorized,
  apiForbidden,
  apiBadRequest,
} from '@/lib/api/response'
import { generateSpecificWeekPlans } from '@/lib/lessonPlan/weeklyGenerator'

export async function POST(req: Request) {
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

    const { sowId, weekNumber } = await req.json()
    if (!sowId || !weekNumber) return apiBadRequest('sowId and weekNumber required')

    // Verify teacher owns this SOW
    const { data: sow } = await db
      .from('schemes_of_work')
      .select('id')
      .eq('id', sowId)
      .eq('teacher_id', teacher.id)
      .single()
    if (!sow) return apiForbidden()

    // Log job start
    const { data: job } = await db.from('generation_jobs').insert({
      teacher_id: user.id,
      sow_id: sowId,
      week_number: weekNumber,
      status: 'processing',
    }).select('id').single()

    const result = await generateSpecificWeekPlans(sowId, user.id, weekNumber)

    if (job) {
      await db.from('generation_jobs').update({
        status: 'done',
        completed_at: new Date().toISOString(),
      }).eq('id', job.id)
    }

    // Fetch the newly created plans
    const { data: plans } = await db
      .from('lesson_plans')
      .select('*')
      .eq('sow_id', sowId)
      .eq('week_number', weekNumber)
      .order('lesson_number')

    return apiSuccess({ ...result, plans: plans || [] })
  } catch (err: any) {
    console.error('[lesson-plans/generate-week]', err)
    return apiError(err.message || 'Generation failed')
  }
}
