// app/api/eir/trajectories/[studentId]/route.ts
// GET /api/eir/trajectories/:studentId
// Returns the Learning Trajectory Model for a student.
// Teachers can view students in their class; parents can view their child.

import { createClient } from '@/utils/supabase/server'
import { createServiceClient } from '@/utils/supabase/service'
import { apiSuccess, apiError, apiUnauthorized, apiForbidden } from '@/lib/api/response'
import { isTeacherOfLearner } from '@/lib/api/middleware'
import { getTrajectoryModel } from '@/lib/eir'

export async function GET(
  _req:    Request,
  { params }: { params: Promise<{ studentId: string }> },
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return apiUnauthorized()

    const { studentId } = await params
    const db = createServiceClient()

    const [isTeacher, parentRes] = await Promise.all([
      isTeacherOfLearner(studentId, user.id),
      db.from('learners')
        .select('parent_user_id')
        .eq('id', studentId)
        .single(),
    ])

    const isParent = parentRes.data?.parent_user_id === user.id

    if (!isParent && !isTeacher) return apiForbidden()

    const model = await getTrajectoryModel(studentId)
    return apiSuccess(model)
  } catch (err) {
    return apiError(err instanceof Error ? err.message : 'Failed to get trajectory model')
  }
}
