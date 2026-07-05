// app/api/eir/personalization/[studentId]/route.ts
// GET /api/eir/personalization/:studentId
// Returns the Personalization Model for a student.
// POST  → rebuild the model from scratch.

import { createClient } from '@/utils/supabase/server'
import { createServiceClient } from '@/utils/supabase/service'
import { apiSuccess, apiError, apiUnauthorized, apiForbidden } from '@/lib/api/response'
import { isTeacherOfLearner } from '@/lib/api/middleware'
import { getPersonalizationModel, buildPersonalizationModel } from '@/lib/eir'

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

    const model = await getPersonalizationModel(studentId)
    return apiSuccess(model)
  } catch (err) {
    return apiError(err instanceof Error ? err.message : 'Failed to get personalization model')
  }
}

export async function POST(
  _req:    Request,
  { params }: { params: Promise<{ studentId: string }> },
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return apiUnauthorized()

    const { studentId } = await params

    const isTeacher = await isTeacherOfLearner(studentId, user.id)

    if (!isTeacher) return apiForbidden()

    const model = await buildPersonalizationModel(studentId)
    return apiSuccess(model)
  } catch (err) {
    return apiError(err instanceof Error ? err.message : 'Failed to build personalization model')
  }
}
