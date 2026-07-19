import { z } from 'zod'
import { createClient } from '@/utils/supabase/server'
import { createServiceClient } from '@/utils/supabase/service'
import { apiSuccess, apiError, apiUnauthorized, apiForbidden, apiNotFound, apiBadRequest } from '@/lib/api/response'
import { notifyAssignmentMarked } from '@/lib/notifications/notify'
import { recordAssignmentMarkEvidence } from '@/lib/assignments/evidence'
import { requireAuthentication } from '@/lib/core/permissions'
import { resolveTeacher } from '@/lib/core/identity'
import { UnauthorizedError } from '@/lib/core/errors'

const MarkSubmissionSchema = z.object({
  submissionId: z.string().uuid().optional(),
  studentId:    z.string().uuid().optional(),
  score:        z.number().optional(),
  feedback:     z.string().optional(),
  status:       z.string().optional(),
}).refine(d => d.submissionId || d.studentId, {
  message: 'submissionId or studentId is required',
})

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: assignmentId } = await params
    const supabase = await createClient()
    let userId: string
    try {
      userId = (await requireAuthentication(supabase)).id
    } catch (err) {
      if (err instanceof UnauthorizedError) return apiUnauthorized()
      throw err
    }

    const teacher = await resolveTeacher(userId)
    if (!teacher) return apiForbidden()

    const db = createServiceClient()

    // Verify assignment belongs to this teacher
    const { data: assignment } = await db
      .from('assignments')
      .select('id, title, max_score, class_id, subject, topic, substrand_id')
      .eq('id', assignmentId)
      .eq('teacher_id', teacher.id)
      .single()

    if (!assignment) return apiNotFound('Assignment not found')

    const parsed = MarkSubmissionSchema.safeParse(await req.json())
    if (!parsed.success) return apiBadRequest(parsed.error.issues[0]?.message ?? 'Invalid input')
    const { submissionId, studentId, score, feedback, status } = parsed.data

    // Validate score range
    const maxScore = assignment.max_score ?? 100
    if (score !== undefined && score !== null && (score < 0 || score > maxScore)) {
      return apiError(`Score must be between 0 and ${maxScore}`, 400)
    }

    // Resolve final status
    const finalStatus = status === 'needs_revision' ? 'marked' : 'marked'

    // Build the update query
    let updateQuery = db
      .from('assignment_submissions')
      .update({
        status: finalStatus,
        score: score ?? null,
        teacher_feedback: feedback ?? null,
        marked_at: new Date().toISOString(),
      })
      .eq('assignment_id', assignmentId)

    if (submissionId) {
      updateQuery = updateQuery.eq('id', submissionId)
    } else {
      updateQuery = updateQuery.eq('student_id', studentId)
    }

    const { data: submission, error } = await updateQuery.select().single()

    if (error || !submission) return apiNotFound('Submission not found')

    notifyAssignmentMarked(submission.id, assignmentId)
      .catch(err => console.error('[notify] mark:', err))

    // Emit Evidence Domain observation — additive, fire and forget, never
    // blocking the response. Only meaningful once a numeric score exists;
    // a status-only update (e.g. "needs_revision") has nothing to convert.
    if (score !== undefined && score !== null) {
      recordAssignmentMarkEvidence({
        studentId:     submission.student_id as string,
        teacherId:     teacher.id,
        teacherUserId: userId,
        assignmentId,
        subject:       assignment.subject as string,
        topic:         (assignment.topic as string | null) ?? null,
        substrandId:   (assignment.substrand_id as string | null) ?? null,
        score,
        maxScore,
        academicYear:  new Date().getFullYear(),
        term:          null,
        markedAt:      new Date().toISOString(),
      }).catch(err => console.error('[assignments/mark] evidence emission failed:', err instanceof Error ? err.message : String(err)))
    }

    return apiSuccess({ submission })
  } catch (e: unknown) {
    console.error('[teacher/assignments/[id]/mark POST]', e instanceof Error ? e.message : String(e))
    return apiError('Internal server error')
  }
}
