import { z } from 'zod'
import { createClient } from '@/utils/supabase/server'
import { createServiceClient } from '@/utils/supabase/service'
import { apiSuccess, apiError, apiUnauthorized, apiNotFound, apiBadRequest } from '@/lib/api/response'
import { publishEvent } from '@/lib/events'
import { requireAuthentication, requireStudent, requireClassMembership } from '@/lib/core/permissions'
import { UnauthorizedError, isEduNexusError } from '@/lib/core/errors'

const SubmitSchema = z.object({
  assignmentId:        z.string().uuid(),
  studentId:           z.string().uuid(),
  work_text:           z.string().optional(),
  compass_session_id:  z.string().uuid().optional(),
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

    const db = createServiceClient()

    const parsed = SubmitSchema.safeParse(await req.json())
    if (!parsed.success) return apiBadRequest(parsed.error.issues[0]?.message ?? 'assignmentId and studentId are required')
    const { assignmentId, studentId, work_text, compass_session_id } = parsed.data

    // Verify student belongs to this user
    try {
      await requireStudent(supabase, studentId)
    } catch (err) {
      if (isEduNexusError(err)) return apiError('Student not found', 403)
      throw err
    }

    // Verify the assignment exists and is active
    const { data: assignment } = await db
      .from('assignments')
      .select('id, status, class_id')
      .eq('id', assignmentId)
      .single()

    if (!assignment) return apiNotFound('Assignment not found')
    if (assignment.status === 'closed') {
      return apiError('Assignment is closed', 400)
    }

    // Phase 0 containment: identity alone ("this is your own studentId") is
    // not eligibility. The assignment's own class_id — never a client-
    // supplied one — is the authority for which class owns it; the learner
    // must be a current class_students member of that exact class. Runs
    // before any submission write, so an ineligible learner leaves no row.
    try {
      await requireClassMembership(studentId, assignment.class_id, db)
    } catch (err) {
      if (isEduNexusError(err)) return apiError('You are not enrolled in the class this assignment belongs to', 403)
      throw err
    }

    // Build the update payload
    const updatePayload: Record<string, unknown> = {
      status: 'submitted',
      submitted_at: new Date().toISOString(),
    }

    if (work_text !== undefined) {
      updatePayload.work_text = work_text
    }
    if (compass_session_id) {
      updatePayload.compass_session_id = compass_session_id
    }

    // Upsert — submission row was pre-created on assignment creation, but handle both cases
    const { data: existing } = await db
      .from('assignment_submissions')
      .select('id')
      .eq('assignment_id', assignmentId)
      .eq('student_id', studentId)
      .single()

    let submission: Record<string, unknown> | null = null
    let opError: { message: string } | null = null

    if (existing) {
      const { data, error } = await db
        .from('assignment_submissions')
        .update(updatePayload)
        .eq('id', existing.id)
        .select()
        .single()
      submission = data
      opError = error
    } else {
      // Pre-create row for edge cases where submission row was not
      // pre-populated. class_id comes from the already-verified assignment
      // row above (requireClassMembership just proved this student belongs
      // to it) — no separate class_students lookup needed here.
      const { data, error } = await db
        .from('assignment_submissions')
        .insert({
          assignment_id: assignmentId,
          student_id: studentId,
          class_id: assignment.class_id,
          ...updatePayload,
        })
        .select()
        .single()
      submission = data
      opError = error
    }

    if (opError || !submission) {
      console.error('[student/submit POST]', opError)
      return apiError('Failed to submit assignment')
    }

    void publishEvent({
      event_type:      'student.assignment.submitted',
      resource_type:   'assignment_submission',
      resource_id:     submission.id as string,
      actor_id:        studentId,
      payload: {
        assignment_id: assignmentId,
        student_id:    studentId,
        class_id:      submission.class_id as string,
      },
      idempotency_key: `student.assignment.submitted:${submission.id}`,
    }).catch(err => console.error('[events] student.assignment.submitted:', err instanceof Error ? err.message : String(err)))

    return apiSuccess({ submission })
  } catch (e: unknown) {
    console.error('[student/submit POST]', e instanceof Error ? e.message : String(e))
    return apiError('Internal server error')
  }
}
