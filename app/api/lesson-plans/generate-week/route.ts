// POST: Manually trigger lesson plan generation for a specific week
import { createServiceClient } from '@/utils/supabase/service'
import { checkFeatureAccess } from '@/lib/payments/access'
import { type FeatureKey } from '@/lib/payments/config'
import {
  apiSuccess,
  apiError,
  apiForbidden,
  apiBadRequest,
} from '@/lib/api/response'
import { generateSpecificWeekPlans } from '@/lib/lessonPlan/weeklyGenerator'

const FEATURE: FeatureKey = 'lesson_plan_generate'

export async function POST(req: Request) {
  try {
    const access = await checkFeatureAccess(FEATURE)
    if (access.allowed === false) {
      const status = access.reason === 'unauthenticated' ? 401 : 403
      return apiError(access.reason, status)
    }

    const db = createServiceClient()
    const { data: teacher } = await db
      .from('teachers')
      .select('id')
      .eq('user_id', access.userId)
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
      teacher_id: access.userId,
      sow_id: sowId,
      week_number: weekNumber,
      status: 'processing',
    }).select('id').single()

    const result = await generateSpecificWeekPlans(sowId, access.userId, weekNumber)

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
