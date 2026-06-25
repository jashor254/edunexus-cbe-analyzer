// POST /api/lesson-plans/generate
// Canonical endpoint: SOW-aware generation with auto week detection.
// Body: { sow_id: string, week_number?: number }
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
  apiFallback,
} from '@/lib/api/response'
import { generateSpecificWeekPlans } from '@/lib/lessonPlan/weeklyGenerator'

const FEATURE: FeatureKey = 'lesson_plan_generate'

const GenerateLessonSchema = z.object({
  sow_id:      z.uuid({ error: 'sow_id must be a valid UUID' }),
  week_number: z.number().int().min(1).max(52).optional(),
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

    const parsed = GenerateLessonSchema.safeParse(await req.json())
    if (!parsed.success) {
      return apiBadRequest(parsed.error.issues.map(i => i.message).join(', '))
    }
    const { sow_id: sowId, week_number: bodyWeekNumber } = parsed.data

    // Verify teacher owns this SOW
    const { data: sow } = await db
      .from('schemes_of_work')
      .select('id, total_weeks')
      .eq('id', sowId)
      .eq('teacher_id', teacher.id)
      .single()
    if (!sow) return apiForbidden()

    // Auto-detect next week if not supplied
    let weekNumber: number = bodyWeekNumber ?? 0
    if (!weekNumber) {
      const { data: latest } = await db
        .from('lesson_plans')
        .select('week_number')
        .eq('sow_id', sowId)
        .order('week_number', { ascending: false })
        .limit(1)
        .maybeSingle()
      weekNumber = (latest?.week_number ?? 0) + 1
    }

    // Idempotency: return existing plans if already generated
    const { count: existing } = await db
      .from('lesson_plans')
      .select('id', { count: 'exact', head: true })
      .eq('sow_id', sowId)
      .eq('week_number', weekNumber)

    if ((existing ?? 0) > 0) {
      const { data: existingPlans } = await db
        .from('lesson_plans')
        .select('id, sow_id, week_number, lesson_number, strand, sub_strand, learning_outcomes, key_inquiry_questions, learning_resources, status, taught_date')
        .eq('sow_id', sowId)
        .eq('week_number', weekNumber)
        .order('lesson_number', { ascending: true })

      return apiSuccess({
        generated: 0,
        week: weekNumber,
        sow_id: sowId,
        already_exists: true,
        plans: existingPlans || [],
      })
    }

    const result = await generateSpecificWeekPlans(sowId, access.userId, weekNumber)

    const { data: plans } = await db
      .from('lesson_plans')
      .select('id, sow_id, week_number, lesson_number, strand, sub_strand, learning_outcomes, key_inquiry_questions, learning_resources, status, taught_date')
      .eq('sow_id', sowId)
      .eq('week_number', weekNumber)
      .order('lesson_number', { ascending: true })

    return apiSuccess({
      ...result,
      sow_id: sowId,
      plans: plans || [],
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Generation failed'
    return apiFallback(`AI generation failed: ${message}. Please try again in a moment.`)
  }
}
