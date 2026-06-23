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
import { markLessonComplete, getAcademyStats } from '@/lib/academy/queries'
import type { ProgressUpdateResponse } from '@/lib/academy/types'

const bodySchema = z.object({
  lesson_id: z.string().uuid(),
  answer: z.string().trim().optional().default(''),
})

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return apiUnauthorized()

    const body = await req.json()
    const parsed = bodySchema.safeParse(body)
    if (!parsed.success) return apiBadRequest(parsed.error.issues[0].message)

    const { lesson_id, answer } = parsed.data
    const db = createServiceClient()

    const { data: teacher } = await db
      .from('teachers')
      .select('id')
      .eq('user_id', user.id)
      .single()

    if (!teacher) return apiNotFound('Teacher profile not found')

    const { data: lesson } = await db
      .from('academy_lessons')
      .select('id, module_id, practice_prompt')
      .eq('id', lesson_id)
      .maybeSingle()

    if (!lesson) return apiNotFound('Lesson not found')

    if (lesson.practice_prompt?.trim()) {
      if (answer.length < 15) {
        return apiBadRequest(
          'Mwalimu, tafadhali andika angalau herufi 15 za tafakari yako ili kukamilisha somo hili.'
        )
      }
    }

    await markLessonComplete(teacher.id, lesson_id)

    const updatedStats = await getAcademyStats(teacher.id)

    return apiSuccess<ProgressUpdateResponse>({
      success: true,
      message: 'Lesson progress recorded successfully.',
      updatedStats,
    })
  } catch (err: unknown) {
    return apiError(getErrorMessage(err), 500)
  }
}
