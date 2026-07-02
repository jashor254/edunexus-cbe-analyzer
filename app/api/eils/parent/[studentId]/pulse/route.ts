// app/api/eils/parent/[studentId]/pulse/route.ts
// GET /api/eils/parent/:studentId/pulse
// Returns the EILS parent intelligence insight for a student.
// Parent-only endpoint — teacher cannot access.

import { createClient } from '@/utils/supabase/server'
import { createServiceClient } from '@/utils/supabase/service'
import { apiSuccess, apiError, apiUnauthorized, apiForbidden } from '@/lib/api/response'
import { buildParentInsight } from '@/lib/eils'

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

    const { data: learner } = await db
      .from('learners')
      .select('id, full_name, parent_user_id')
      .eq('id', studentId)
      .single()

    if (!learner) return apiError('Student not found', 404)
    if (learner.parent_user_id !== user.id) return apiForbidden()

    const insight = await buildParentInsight(studentId, learner.full_name as string)
    return apiSuccess(insight)
  } catch (err) {
    return apiError(err instanceof Error ? err.message : 'Failed to build parent insight')
  }
}
