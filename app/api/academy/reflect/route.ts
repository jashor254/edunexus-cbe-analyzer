import { z } from 'zod'
import { createClient } from '@/utils/supabase/server'
import { createServiceClient } from '@/utils/supabase/service'
import {
  apiSuccess,
  apiBadRequest,
  apiUnauthorized,
  apiNotFound,
  apiError,
  getErrorMessage,
} from '@/lib/api/response'
import { upsertReflection } from '@/lib/academy/reflections'
import { scoreReflection } from '@/lib/academy/aiJudge'
import type { ReflectionResponse } from '@/lib/academy/types'
import { checkDailyCallLimit, releaseDailyCall } from '@/lib/ai/rateLimit'
import { AttemptLimiterUnavailableError } from '@/lib/security/attemptLimiter'

// Every field is sent to the AI judge verbatim, so each is bounded before any
// provider call. 2000 characters is ~300 words — far beyond a real answer.
const REFLECTION_FIELD_MAX = 2000

const bodySchema = z.object({
  lesson_id: z.string().uuid(),
  module_id: z.string().uuid(),
  tried:       z.string().trim().min(1, 'Please describe what you tried.').max(REFLECTION_FIELD_MAX),
  worked:      z.string().trim().min(1, 'Please describe what worked.').max(REFLECTION_FIELD_MAX),
  failed:      z.string().trim().min(1, 'Please describe what was difficult.').max(REFLECTION_FIELD_MAX),
  surprised:   z.string().trim().max(REFLECTION_FIELD_MAX).default(''),
  next_action: z.string().trim().min(1, 'Please describe what you will do differently.').max(REFLECTION_FIELD_MAX),
})

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return apiUnauthorized()

    const body = await req.json()
    const parsed = bodySchema.safeParse(body)
    if (!parsed.success) return apiBadRequest(parsed.error.issues[0].message)

    const input = parsed.data
    const db = createServiceClient()

    const { data: teacher } = await db
      .from('teachers')
      .select('id')
      .eq('user_id', user.id)
      .single()

    if (!teacher) return apiNotFound('Teacher profile not found')

    // Verify the lesson exists and belongs to the stated module
    const { data: lesson } = await db
      .from('academy_lessons')
      .select('id, module_id')
      .eq('id', input.lesson_id)
      .eq('module_id', input.module_id)
      .maybeSingle()

    if (!lesson) return apiNotFound('Lesson not found')

    // Verify teacher has completed this lesson before reflecting
    const { data: progress } = await db
      .from('academy_progress')
      .select('id')
      .eq('teacher_id', teacher.id)
      .eq('lesson_id', input.lesson_id)
      .maybeSingle()

    if (!progress) {
      return apiBadRequest('Mwalimu, please complete the lesson before submitting a reflection.')
    }

    // Reserved before the AI call; refunded when no genuine judgement was
    // produced (AI failure, unparseable reply, or too short to send at all).
    const quota = await checkDailyCallLimit(user.id, 'academy_reflection_feedback')
    if (quota.allowed === false) {
      return apiError(`Daily limit of ${quota.limit} reflection reviews reached. Resets at ${quota.resetAt}`, 429)
    }

    const feedback = await scoreReflection(input, user.id)
    if (feedback.isFallback) await releaseDailyCall(quota)
    const reflection = await upsertReflection(teacher.id, input, feedback)

    return apiSuccess<ReflectionResponse>({ success: true, reflection, feedback })
  } catch (err: unknown) {
    if (err instanceof AttemptLimiterUnavailableError) {
      return apiError('Reflection feedback is temporarily unavailable. Please try again shortly.', 503)
    }
    return apiError(getErrorMessage(err), 500)
  }
}
