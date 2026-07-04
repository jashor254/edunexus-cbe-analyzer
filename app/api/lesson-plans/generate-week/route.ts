// POST: Manually trigger lesson plan generation for a specific week
import { z } from 'zod'
import { createServiceClient } from '@/utils/supabase/service'
import { checkFeatureAccess } from '@/lib/payments/access'
import { checkDailyCallLimit } from '@/lib/ai/rateLimit'
import { type FeatureKey } from '@/lib/payments/config'
import {
  apiSuccess,
  apiError,
  apiForbidden,
  apiBadRequest,
} from '@/lib/api/response'
import { generateSpecificWeekPlans } from '@/lib/lessonPlan/weeklyGenerator'

const FEATURE: FeatureKey = 'lesson_plan_generate'

const GenerateWeekSchema = z.object({
  sowId:      z.string().uuid(),
  weekNumber: z.number().int().min(1).max(52),
})

export async function POST(req: Request) {
  try {
    const access = await checkFeatureAccess(FEATURE)
    if (access.allowed === false) {
      const status = access.reason === 'unauthenticated' ? 401 : 403
      return apiError(access.reason, status)
    }

    const rateLimit = await checkDailyCallLimit(access.userId, FEATURE)
    if (rateLimit.allowed === false) {
      return apiError(`Daily limit of ${rateLimit.limit} lesson plan generations reached. Resets at ${rateLimit.resetAt}`, 429)
    }

    const db = createServiceClient()
    const { data: teacher } = await db
      .from('teachers')
      .select('id')
      .eq('user_id', access.userId)
      .single()
    if (!teacher) return apiForbidden()

    const parsed = GenerateWeekSchema.safeParse(await req.json())
    if (!parsed.success) return apiBadRequest(parsed.error.issues[0]?.message ?? 'sowId and weekNumber required')
    const { sowId, weekNumber } = parsed.data

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

    let result
    try {
      result = await generateSpecificWeekPlans(sowId, access.userId, weekNumber)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Generation failed'
      console.error('[lesson-plans/generate-week]', message)
      if (job) {
        await db.from('generation_jobs').update({
          status: 'failed',
          error_message: message,
          completed_at: new Date().toISOString(),
        }).eq('id', job.id)
      }
      return apiError(message)
    }

    if (job) {
      await db.from('generation_jobs').update({
        status: 'done',
        completed_at: new Date().toISOString(),
      }).eq('id', job.id)
    }

    // Fetch the newly created plans
    const { data: plans } = await db
      .from('lesson_plans')
      .select('id, sow_id, teacher_id, week_number, lesson_number, strand, sub_strand, learning_outcomes, key_inquiry_questions, learning_resources, organisation_of_learning, introduction, step_1, step_2, step_3, conclusion, extended_activities, reflection, status, taught_date, generated_at, created_at')
      .eq('sow_id', sowId)
      .eq('week_number', weekNumber)
      .order('lesson_number')

    return apiSuccess({ ...result, plans: plans || [] })
  } catch (err: unknown) {
    console.error('[lesson-plans/generate-week]', err)
    return apiError(err instanceof Error ? err.message : 'Generation failed')
  }
}
