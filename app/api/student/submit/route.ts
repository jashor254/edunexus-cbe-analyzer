import { createClient } from '@/utils/supabase/server'
import { createServiceClient } from '@/utils/supabase/service'
import { apiSuccess, apiError, apiUnauthorized, apiNotFound } from '@/lib/api/response'

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return apiUnauthorized()

    const db = createServiceClient()

    const body = await req.json()
    const { assignmentId, studentId, work_text, compass_session_id } = body

    if (!assignmentId || !studentId) {
      return apiError('assignmentId and studentId are required', 400)
    }

    // Verify student belongs to this user
    const { data: student } = await db
      .from('students')
      .select('id')
      .eq('id', studentId)
      .eq('user_id', user.id)
      .single()

    if (!student) return apiError('Student not found', 403)

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

    return apiSuccess({ submission })
  } catch (e: any) {
    console.error('[student/submit POST]', e.message)
    return apiError('Internal server error')
  }
}
