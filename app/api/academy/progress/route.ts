import { z } from 'zod'
import { createClient } from '@/utils/supabase/server'
import { createServiceClient } from '@/utils/supabase/service'
import {
  apiSuccess,
  apiBadRequest,
  apiUnauthorized,
  apiNotFound,
  getErrorMessage,
  apiError,
} from '@/lib/api/response'
import { markLessonComplete } from '@/lib/academy/queries'

const bodySchema = z.object({
  lesson_id: z.string().uuid(),
})

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return apiUnauthorized()

    const body = await req.json()
    const parsed = bodySchema.safeParse(body)
    if (!parsed.success) return apiBadRequest(parsed.error.issues[0].message)

    const { lesson_id } = parsed.data

    const db = createServiceClient()

    const { data: teacher } = await db
      .from('teachers')
      .select('id')
      .eq('user_id', user.id)
      .single()

    if (!teacher) return apiNotFound('Teacher profile not found')

    // Verify the lesson exists
    const { data: lesson } = await db
      .from('academy_lessons')
      .select('id, module_id')
      .eq('id', lesson_id)
      .single()

    if (!lesson) return apiNotFound('Lesson not found')

    await markLessonComplete(teacher.id, lesson_id)

    // Return updated completion count for the module
    const { count: moduleTotal } = await db
      .from('academy_lessons')
      .select('id', { count: 'exact', head: true })
      .eq('module_id', lesson.module_id)

    const { count: moduleCompleted } = await db
      .from('academy_progress')
      .select('id', { count: 'exact', head: true })
      .eq('teacher_id', teacher.id)
      .in(
        'lesson_id',
        (await db
          .from('academy_lessons')
          .select('id')
          .eq('module_id', lesson.module_id)
        ).data?.map(l => l.id) ?? []
      )

    return apiSuccess({
      lesson_id,
      module_id: lesson.module_id,
      module_total: moduleTotal ?? 0,
      module_completed: moduleCompleted ?? 0,
    })
  } catch (err) {
    return apiError(getErrorMessage(err), 500)
  }
}
