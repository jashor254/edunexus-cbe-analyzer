// POST /api/lesson-plans/generate
// Canonical endpoint: SOW-aware generation with auto week detection.
// Body: { sow_id: string, week_number?: number }
import { z } from 'zod'
import { createClient } from '@/utils/supabase/server'
import { createServiceClient } from '@/utils/supabase/service'
import {
  apiSuccess,
  apiUnauthorized,
  apiForbidden,
  apiBadRequest,
  apiFallback,
} from '@/lib/api/response'
import { generateSpecificWeekPlans } from '@/lib/lessonPlan/weeklyGenerator'

const GenerateLessonSchema = z.object({
  sow_id:      z.uuid({ error: 'sow_id must be a valid UUID' }),
  week_number: z.number().int().min(1).max(52).optional(),
})

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

    const result = await generateSpecificWeekPlans(sowId, user.id, weekNumber)

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
