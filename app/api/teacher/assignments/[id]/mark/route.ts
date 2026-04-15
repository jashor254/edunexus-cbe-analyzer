import { createClient } from '@/utils/supabase/server'
import { createServiceClient } from '@/utils/supabase/service'
import { apiSuccess, apiError, apiUnauthorized, apiForbidden, apiNotFound } from '@/lib/api/response'

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

    const body = await req.json()
    const { submissionId, studentId, score, feedback, status } = body

    if (!submissionId && !studentId) {
      return apiError('submissionId or studentId is required', 400)
    }

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

    // Fetch student info for WhatsApp notification
    try {
      const { data: studentData } = await db
        .from('students')
        .select('name, user_id')
        .eq('id', submission.student_id)
        .single()

      if (studentData) {
        const { data: classStudent } = await db
          .from('class_students')
          .select('parent_id')
          .eq('student_id', submission.student_id)
          .eq('class_id', assignment.class_id)
          .single()

        if (classStudent?.parent_id) {
          const scoreText = score !== undefined && score !== null
            ? `${score}/${maxScore}`
            : 'N/A'
          const feedbackText = feedback || 'No feedback provided'
          // WhatsApp deep-link message — frontend opens wa.me when parent phone is available
          console.log(
            `[WhatsApp] Assignment marked: ${assignment.title} | ` +
            `Student: ${studentData.name} | Score: ${scoreText} | ` +
            `Feedback: ${feedbackText} | View: edunexus.co.ke/dashboard`
          )
        }
      }
    } catch (notifyErr) {
      // Non-fatal — notification failure must not block the mark save
      console.warn('[mark] notification error:', notifyErr)
    }

    return apiSuccess({ submission })
  } catch (e: any) {
    console.error('[teacher/assignments/[id]/mark POST]', e.message)
    return apiError('Internal server error')
  }
}
