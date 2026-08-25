// app/api/student/submit-quiz/route.ts
// Auto-graded quiz submission — grades and records in one step, status
// goes straight to 'marked'. This is the whole point of a quiz over a
// regular assignment: no waiting for the teacher to mark a stack of papers.

import { z } from 'zod'
import { after } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createServiceClient } from '@/utils/supabase/service'
import { apiSuccess, apiError, apiUnauthorized, apiForbidden, apiNotFound, apiBadRequest } from '@/lib/api/response'
import { publishEvent } from '@/lib/events'
import { requireAuthentication, requireStudent, requireClassMembership } from '@/lib/core/permissions'
import { UnauthorizedError, isEduNexusError } from '@/lib/core/errors'
import { gradeAndSubmitQuiz } from '@/lib/quiz/quiz'
import { recordQuizAutoGradeEvidence } from '@/lib/quiz/quizEvidence'
import { buildAdaptiveProvenance } from '@/lib/assignments/adaptiveProvenance'
import { resolveInstitutionalAssignmentReadAccess } from '@/lib/core/assignmentDiscovery'

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
    const { assignmentId, studentId: requestedStudentId, answers } = parsed.data

    // Legacy/Solo learners resolve via `students.user_id` (requireStudent,
    // unchanged). An institutional learner has no such row — Phase 2.5
    // fallback: prove a durable `assignment_submissions` row already exists
    // for this exact assignment (resolveInstitutionalAssignmentReadAccess,
    // same signal Phase 2's read path uses). Must complete BEFORE grading —
    // an ineligible caller must never cause a score, a 'marked' status, or
    // quiz_auto_grade Evidence to be created. Client-supplied studentId is
    // never trusted once this falls to the institutional branch; the
    // resolved id below (the caller's own compatibility students.id) is
    // what grading, the submission row, and downstream evidence attribution
    // all key on.
    let studentId: string
    let isInstitutional = false
    try {
      await requireStudent(supabase, requestedStudentId)
      studentId = requestedStudentId
    } catch (err) {
      if (!isEduNexusError(err)) throw err
      const access = await resolveInstitutionalAssignmentReadAccess(userId, assignmentId)
      if (!access) return apiForbidden()
      studentId = access.studentId
      isInstitutional = true
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

    // Phase 0 containment: must run BEFORE grading — an ineligible learner
    // must never cause a score, a 'marked' status, or quiz_auto_grade
    // Evidence to be created. The assignment's own class_id (never a
    // client-supplied one) is the authority for which class owns it.
    //
    // Institutional branch skips this — see app/api/student/submit/route.ts's
    // identical comment: class_students is not a reliable transfer-safe
    // signal; the durable assignment_submissions row already proven above
    // is the eligibility signal for this branch.
    if (!isInstitutional) {
      try {
        await requireClassMembership(studentId, assignment.class_id, db)
      } catch (err) {
        if (isEduNexusError(err)) return apiForbidden()
        throw err
      }
    }

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

    // Emit Evidence Domain observation — additive, never blocking the
    // response. ADR-0024 Sprint C: closes the gap where quiz results
    // generated zero learner Evidence, unlike manually-marked assignments
    // (lib/assignments/evidence.ts, Sprint B).
    // Registered with after() rather than left as a detached promise — a
    // route handler returning its response is not a guarantee that an
    // un-awaited promise elsewhere in the function gets to keep running on
    // a serverless platform (this codebase already uses after() for exactly
    // this reason in app/api/sow/generate, app/api/holiday/generate, and
    // app/api/teacher/classes/[classId]/generate-reports). Stage 1 —
    // resolve instructional provenance first, from the served_variant_map
    // this submission was bound to at first open. Read only; a failure here
    // must never cost us the evidence row itself, so it degrades to null
    // provenance rather than rejecting.
    after(async () => {
      let adaptiveDelivery = null
      try {
        adaptiveDelivery = await buildAdaptiveProvenance({ assignmentId, studentId })
      } catch (err) {
        console.error('[submit-quiz] adaptive provenance failed:', err instanceof Error ? err.message : String(err))
      }
      try {
        await recordQuizAutoGradeEvidence({
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
          adaptiveDelivery,
        })
      } catch (err) {
        console.error('[submit-quiz] evidence emission failed:', err instanceof Error ? err.message : String(err))
      }
    })

    return apiSuccess({ submission, grade })
  } catch (e: unknown) {
    console.error('[student/submit-quiz POST]', e instanceof Error ? e.message : String(e))
    return apiError('Internal server error')
  }
}
