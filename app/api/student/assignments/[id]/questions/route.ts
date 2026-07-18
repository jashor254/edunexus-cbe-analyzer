// app/api/student/assignments/[id]/questions/route.ts
// The question set for a student taking a quiz — never includes
// correct_index (see findQuestionsForStudent's own header).

import { createClient } from '@/utils/supabase/server'
import { createServiceClient } from '@/utils/supabase/service'
import { apiSuccess, apiError, apiUnauthorized, apiForbidden, apiNotFound } from '@/lib/api/response'
import { requireAuthentication } from '@/lib/core/permissions'
import { UnauthorizedError } from '@/lib/core/errors'
import { findQuestionsForStudent } from '@/lib/quiz/quiz'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    let userId: string
    try {
      userId = (await requireAuthentication(supabase)).id
    } catch (err) {
      if (err instanceof UnauthorizedError) return apiUnauthorized()
      throw err
    }

    const db = createServiceClient()
    const { data: assignment } = await db.from('assignments').select('id, class_id, is_quiz').eq('id', id).maybeSingle()
    if (!assignment) return apiNotFound('Assignment not found')
    if (!assignment.is_quiz) return apiError('This assignment is not a quiz', 400)

    // The student must be enrolled in the assignment's class (self or a
    // linked parent — parents don't take quizzes, but keep the same
    // ownership shape as every other student-portal read in this file family).
    const { data: student } = await db
      .from('students')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle()
    if (!student) return apiForbidden()

    const { data: link } = await db
      .from('class_students')
      .select('id')
      .eq('class_id', assignment.class_id)
      .eq('student_id', student.id)
      .maybeSingle()
    if (!link) return apiForbidden()

    const questions = await findQuestionsForStudent(id)
    return apiSuccess({ questions })
  } catch (e: unknown) {
    console.error('[student/assignments/questions GET]', e instanceof Error ? e.message : String(e))
    return apiError('Internal server error')
  }
}
