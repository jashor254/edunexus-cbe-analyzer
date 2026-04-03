import { createClient } from '@/utils/supabase/server'
import { createServiceClient } from '@/utils/supabase/service'
import { apiSuccess, apiError, apiUnauthorized, apiForbidden, apiNotFound } from '@/lib/api/response'

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return apiUnauthorized()

    const db = createServiceClient()

    const { data: teacher } = await db
      .from('teachers')
      .select('id')
      .eq('user_id', user.id)
      .single()

    if (!teacher) return apiForbidden()

    // Verify assignment belongs to teacher
    const { data: assignment } = await db
      .from('assignments')
      .select('id, max_score')
      .eq('id', id)
      .eq('teacher_id', teacher.id)
      .single()

    if (!assignment) return apiNotFound('Assignment not found')

    const body = await req.json()
    const { studentId, score, feedback } = body

    if (!studentId) return apiError('studentId is required', 400)
    if (score !== undefined && (score < 0 || score > (assignment.max_score || 100))) {
      return apiError(`Score must be between 0 and ${assignment.max_score || 100}`, 400)
    }

    const { data: submission, error } = await db
      .from('assignment_submissions')
      .update({
        status: 'marked',
        score: score ?? null,
        teacher_feedback: feedback || null,
        marked_at: new Date().toISOString(),
      })
      .eq('assignment_id', id)
      .eq('student_id', studentId)
      .select()
      .single()

    if (error || !submission) return apiNotFound('Submission not found')

    return apiSuccess({ submission })
  } catch (e: any) {
    console.error('[teacher/assignments/[id]/mark POST]', e.message)
    return apiError('Internal server error')
  }
}
