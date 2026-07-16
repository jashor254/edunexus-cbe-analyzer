import { z } from 'zod'
import { createClient } from '@/utils/supabase/server'
import { createServiceClient } from '@/utils/supabase/service'
import { apiSuccess, apiError, apiUnauthorized, apiNotFound, apiBadRequest } from '@/lib/api/response'
import { publishEvent } from '@/lib/events'
import { requireAuthentication, requireStudent } from '@/lib/core/permissions'
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
      .select('id, status')
      .eq('id', assignmentId)
      .single()

    if (!assignment) return apiNotFound('Assignment not found')
    if (assignment.status === 'closed') {
      return apiError('Assignment is closed', 400)
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
      // Pre-create row for edge cases where submission row was not pre-populated
      const { data: classLink } = await db
        .from('class_students')
        .select('class_id')
        .eq('student_id', studentId)
        .single()

      if (!classLink) return apiError('Student not in any class', 400)

      const { data, error } = await db
        .from('assignment_submissions')
        .insert({
          assignment_id: assignmentId,
          student_id: studentId,
          class_id: classLink.class_id,
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
