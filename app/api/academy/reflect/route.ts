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

const bodySchema = z.object({
  lesson_id: z.string().uuid(),
  module_id: z.string().uuid(),
  tried:       z.string().trim().min(1, 'Please describe what you tried.'),
  worked:      z.string().trim().min(1, 'Please describe what worked.'),
  failed:      z.string().trim().min(1, 'Please describe what was difficult.'),
  surprised:   z.string().trim().default(''),
  next_action: z.string().trim().min(1, 'Please describe what you will do differently.'),
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

    const feedback = await scoreReflection(input, user.id)
    const reflection = await upsertReflection(teacher.id, input, feedback)

    return apiSuccess<ReflectionResponse>({ success: true, reflection, feedback })
  } catch (err: unknown) {
    return apiError(getErrorMessage(err), 500)
  }
}
