// app/api/student/submit-quiz/route.ts
// Auto-graded quiz submission — grades and records in one step, status
// goes straight to 'marked'. This is the whole point of a quiz over a
// regular assignment: no waiting for the teacher to mark a stack of papers.

import { z } from 'zod'
import { createClient } from '@/utils/supabase/server'
import { createServiceClient } from '@/utils/supabase/service'
import { apiSuccess, apiError, apiUnauthorized, apiForbidden, apiNotFound, apiBadRequest } from '@/lib/api/response'
import { publishEvent } from '@/lib/events'
import { requireAuthentication, requireStudent } from '@/lib/core/permissions'
import { UnauthorizedError, isEduNexusError } from '@/lib/core/errors'
import { gradeAndSubmitQuiz } from '@/lib/quiz/quiz'
import { recordQuizAutoGradeEvidence } from '@/lib/quiz/quizEvidence'

const SubmitQuizSchema = z.object({
  assignmentId: z.string().uuid(),
  studentId: z.string().uuid(),
  answers: z.array(z.object({
    questionId: z.string().uuid(),
    selectedIndex: z.number().int().min(0),
  })),
})

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    let userId: string
    try {
      userId = (await requireAuthentication(supabase)).id
    } catch (err) {
      if (err instanceof UnauthorizedError) return apiUnauthorized()
      throw err
    }

    const parsed = SubmitQuizSchema.safeParse(await req.json())
    if (!parsed.success) return apiBadRequest(parsed.error.issues[0]?.message ?? 'Invalid input')
    const { assignmentId, studentId, answers } = parsed.data

    try {
      await requireStudent(supabase, studentId)
    } catch (err) {
      if (isEduNexusError(err)) return apiForbidden()
      throw err
    }

    const db = createServiceClient()
    const { data: assignment } = await db
      .from('assignments')
      .select('id, class_id, status, is_quiz, max_score, subject, topic, substrand_id')
      .eq('id', assignmentId)
      .maybeSingle()

    if (!assignment) return apiNotFound('Assignment not found')
    if (!assignment.is_quiz) return apiBadRequest('This assignment is not a quiz')
    if (assignment.status === 'closed') return apiError('Assignment is closed', 400)

    const { submission, grade } = await gradeAndSubmitQuiz({
      assignmentId,
      studentId,
      classId: assignment.class_id,
      maxScore: assignment.max_score ?? 100,
      answers,
    })

    void publishEvent({
      event_type:      'student.assignment.submitted',
      resource_type:   'assignment_submission',
      resource_id:     submission.id as string,
      actor_id:        studentId,
      payload: { assignment_id: assignmentId, student_id: studentId, class_id: assignment.class_id },
      idempotency_key: `student.assignment.submitted:${submission.id}`,
    }).catch(err => console.error('[events] student.assignment.submitted:', err instanceof Error ? err.message : String(err)))

    // Emit Evidence Domain observation — additive, fire and forget, never
    // blocking the response. ADR-0024 Sprint C: closes the gap where quiz
    // results generated zero learner Evidence, unlike manually-marked
    // assignments (lib/assignments/evidence.ts, Sprint B).
    recordQuizAutoGradeEvidence({
      studentId,
      initiatedBy:  userId,
      assignmentId,
      subject:      assignment.subject as string,
      topic:        (assignment.topic as string | null) ?? null,
      substrandId:  (assignment.substrand_id as string | null) ?? null,
      score:        grade.score,
      maxScore:     assignment.max_score ?? 100,
      academicYear: new Date().getFullYear(),
      term:         null,
    }).catch(err => console.error('[submit-quiz] evidence emission failed:', err instanceof Error ? err.message : String(err)))

    return apiSuccess({ submission, grade })
  } catch (e: unknown) {
    console.error('[student/submit-quiz POST]', e instanceof Error ? e.message : String(e))
    return apiError('Internal server error')
  }
}
