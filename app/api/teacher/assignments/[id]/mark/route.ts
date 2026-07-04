import { z } from 'zod'
import { createClient } from '@/utils/supabase/server'
import { createServiceClient } from '@/utils/supabase/service'
import { apiSuccess, apiError, apiUnauthorized, apiForbidden, apiNotFound, apiBadRequest } from '@/lib/api/response'
import { notifyAssignmentMarked } from '@/lib/notifications/notify'

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
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return apiUnauthorized()

    const db = createServiceClient()

    // Teacher auth check
    const { data: teacher } = await db
      .from('teachers')
      .select('id')
      .eq('user_id', user.id)
      .single()

    if (!teacher) return apiForbidden()

    // Verify assignment belongs to this teacher
    const { data: assignment } = await db
      .from('assignments')
      .select('id, title, max_score, class_id')
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

    return apiSuccess({ submission })
  } catch (e: unknown) {
    console.error('[teacher/assignments/[id]/mark POST]', e instanceof Error ? e.message : String(e))
    return apiError('Internal server error')
  }
}
