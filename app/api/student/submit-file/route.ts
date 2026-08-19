// app/api/student/submit-file/route.ts
// File-attachment variant of app/api/student/submit/route.ts — same
// ownership/status checks, but accepts multipart form data and uploads to
// the private `assignment-submissions` Storage bucket instead of writing
// work_text. A submission can carry both a file and typed text.

import { createClient } from '@/utils/supabase/server'
import { createServiceClient } from '@/utils/supabase/service'
import { apiSuccess, apiError, apiUnauthorized, apiNotFound, apiBadRequest, apiForbidden } from '@/lib/api/response'
import { publishEvent } from '@/lib/events'
import { requireAuthentication, requireStudent, requireClassMembership } from '@/lib/core/permissions'
import { UnauthorizedError, isEduNexusError } from '@/lib/core/errors'
import { UPLOAD_LIMITS, isAllowedUploadType } from '@/lib/config/uploads'

const BUCKET = 'assignment-submissions'

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
    void userId

    const form = await req.formData()
    const assignmentId = form.get('assignmentId')
    const studentId = form.get('studentId')
    const file = form.get('file')

    if (typeof assignmentId !== 'string' || typeof studentId !== 'string') {
      return apiBadRequest('assignmentId and studentId are required')
    }
    if (!(file instanceof File)) {
      return apiBadRequest('file is required')
    }
    if (file.size > UPLOAD_LIMITS.maxFileSizeBytes) {
      return apiBadRequest(`File too large — max ${UPLOAD_LIMITS.maxFileSizeBytes / (1024 * 1024)}MB`)
    }
    if (!isAllowedUploadType(file.type)) {
      return apiBadRequest('Unsupported file type — use a photo or PDF')
    }

    try {
      await requireStudent(supabase, studentId)
    } catch (err) {
      if (isEduNexusError(err)) return apiForbidden()
      throw err
    }

    const db = createServiceClient()

    const { data: assignment } = await db
      .from('assignments')
      .select('id, status, class_id')
      .eq('id', assignmentId)
      .single()

    if (!assignment) return apiNotFound('Assignment not found')
    if (assignment.status === 'closed') return apiError('Assignment is closed', 400)

    // Phase 0 containment: must run BEFORE any Storage upload — an
    // ineligible learner must never leave a durable Storage object, even a
    // rejected one. The assignment's own class_id (never a client-supplied
    // one) is the authority for which class owns it.
    try {
      await requireClassMembership(studentId, assignment.class_id, db)
    } catch (err) {
      if (isEduNexusError(err)) return apiForbidden()
      throw err
    }

    const { data: existing } = await db
      .from('assignment_submissions')
      .select('id, class_id')
      .eq('assignment_id', assignmentId)
      .eq('student_id', studentId)
      .single()

    // class_id is always the already-verified assignment.class_id — never
    // re-derived from a separate, unscoped class_students lookup.
    const classId = assignment.class_id

    const ext = file.name.split('.').pop() || 'bin'
    const objectPath = `${assignmentId}/${studentId}/${Date.now()}.${ext}`
    const bytes = new Uint8Array(await file.arrayBuffer())

    const { error: uploadError } = await db.storage
      .from(BUCKET)
      .upload(objectPath, bytes, { contentType: file.type, upsert: true })

    if (uploadError) {
      console.error('[student/submit-file POST] upload', uploadError.message)
      return apiError('Failed to upload file')
    }

    const updatePayload = {
      status: 'submitted' as const,
      submitted_at: new Date().toISOString(),
      file_path: objectPath,
      file_name: file.name,
      file_type: file.type,
    }

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
      const { data, error } = await db
        .from('assignment_submissions')
        .insert({ assignment_id: assignmentId, student_id: studentId, class_id: classId, ...updatePayload })
        .select()
        .single()
      submission = data
      opError = error
    }

    if (opError || !submission) {
      console.error('[student/submit-file POST]', opError)
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
    console.error('[student/submit-file POST]', e instanceof Error ? e.message : String(e))
    return apiError('Internal server error')
  }
}
