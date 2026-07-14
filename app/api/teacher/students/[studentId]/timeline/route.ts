import { createClient } from '@/utils/supabase/server'
import { createServiceClient } from '@/utils/supabase/service'
import { apiSuccess, apiError, apiUnauthorized, apiForbidden, apiNotFound } from '@/lib/api/response'
import { getLearnerTimeline } from '@/lib/learnerRecord/timeline'

// Phase E (docs/architecture/learner-record-layer-decisions.md roadmap) —
// the canonical Learner Record. No UI yet — API surface only, same
// confirmed 2026-07-13 scope pattern as Phases A/B/C.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ studentId: string }> }
) {
  try {
    const { studentId } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return apiUnauthorized()

    const db = createServiceClient()
    const { data: teacher } = await db.from('teachers').select('id').eq('user_id', user.id).single()
    if (!teacher) return apiForbidden()

    const { data: taught } = await db
      .from('class_students')
      .select('class_id, teacher_classes!inner(teacher_id)')
      .eq('student_id', studentId)
      .eq('teacher_classes.teacher_id', teacher.id)
      .limit(1)
      .maybeSingle()
    if (!taught) return apiNotFound('Student not found in any of your classes')

    const timeline = await getLearnerTimeline(studentId)
    return apiSuccess({ timeline })
  } catch (e: unknown) {
    console.error('[teacher/students/timeline GET]', e instanceof Error ? e.message : String(e))
    return apiError('Failed to fetch learner timeline')
  }
}
