// app/api/student/assignments/[id]/questions/route.ts
// The question set for a student taking a quiz — never includes
// correct_index (see findQuestionsForStudent's own header).

import { createClient } from '@/utils/supabase/server'
import { createServiceClient } from '@/utils/supabase/service'
import { apiSuccess, apiError, apiUnauthorized, apiForbidden, apiNotFound } from '@/lib/api/response'
import { requireAuthentication } from '@/lib/core/permissions'
import { UnauthorizedError } from '@/lib/core/errors'
import { findServedQuestionsForStudent } from '@/lib/quiz/quizDelivery'
import { resolveInstitutionalAssignmentReadAccess } from '@/lib/core/assignmentDiscovery'

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
      .select('id, name')
      .eq('user_id', userId)
      .maybeSingle()

    let studentId: string
    let learnerName: string

    if (student) {
      const { data: link } = await db
        .from('class_students')
        .select('id')
        .eq('class_id', assignment.class_id)
        .eq('student_id', student.id)
        .maybeSingle()
      if (!link) return apiForbidden()
      studentId = student.id
      learnerName = student.name?.trim() || 'Student'
    } else {
      // Phase 2 — Step 23/24: an institutional learner has no
      // `students.user_id` row at all (that column is legacy/Solo-only).
      // Read authorization instead follows the same recipient-materialization
      // signal assignment discovery uses — a compatibility student of this
      // identity's current enrollment must already have an
      // `assignment_submissions` row for this exact assignment.
      const access = await resolveInstitutionalAssignmentReadAccess(userId, id)
      if (!access) return apiForbidden()
      const { data: compatStudent } = await db
        .from('students')
        .select('name')
        .eq('id', access.studentId)
        .maybeSingle()
      studentId = access.studentId
      learnerName = compatStudent?.name?.trim() || 'Student'
    }

    // Sprint 9 Slice 3: resolves (once) and serves this student's bound
    // adaptive variant per question, falling back to the canonical question
    // exactly as findQuestionsForStudent always did when no variant applies.
    const questions = await findServedQuestionsForStudent({
      assignmentId: id,
      studentId,
      learnerName,
    })
    return apiSuccess({ questions })
  } catch (e: unknown) {
    console.error('[student/assignments/questions GET]', e instanceof Error ? e.message : String(e))
    return apiError('Internal server error')
  }
}
