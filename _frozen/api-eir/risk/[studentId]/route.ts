// app/api/eir/risk/[studentId]/route.ts
// GET /api/eir/risk/:studentId        — get existing predictions
// POST /api/eir/risk/:studentId       — run a fresh risk prediction cycle

import { createClient } from '@/utils/supabase/server'
import { createServiceClient } from '@/utils/supabase/service'
import { apiSuccess, apiError, apiUnauthorized, apiForbidden } from '@/lib/api/response'
import { isTeacherOfLearner } from '@/lib/api/middleware'
import { getRiskPredictions, predictRisks } from '@/_frozen/eir'

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

    const predictions = await getRiskPredictions(studentId)
    return apiSuccess({ predictions })
  } catch (err) {
    return apiError(err instanceof Error ? err.message : 'Failed to get risk predictions')
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

    const result = await predictRisks(studentId)
    return apiSuccess(result)
  } catch (err) {
    return apiError(err instanceof Error ? err.message : 'Failed to run risk prediction')
  }
}
