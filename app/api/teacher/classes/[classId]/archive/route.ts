import { createClient } from '@/utils/supabase/server'
import { createServiceClient } from '@/utils/supabase/service'
import { apiSuccess, apiError, apiUnauthorized, apiForbidden, apiNotFound } from '@/lib/api/response'
import { archiveClassForYearEnd } from '@/lib/promotions/promote'

// Phase A (docs/architecture/academic-evidence-layer.md §2, Rule 2:
// classes are archived, never deleted). No UI yet — API surface only, per
// the confirmed 2026-07-13 scope decision.
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ classId: string }> }
) {
  try {
    const { classId } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return apiUnauthorized()

    const db = createServiceClient()
    const { data: teacher } = await db.from('teachers').select('id').eq('user_id', user.id).single()
    if (!teacher) return apiForbidden()

    const { data: cls } = await db
      .from('teacher_classes')
      .select('id, status')
      .eq('id', classId)
      .eq('teacher_id', teacher.id)
      .single()
    if (!cls) return apiNotFound('Class not found')
    if (cls.status === 'archived') return apiError('Class is already archived', 409)

    const archived = await archiveClassForYearEnd(classId, teacher.id)
    return apiSuccess({ class: archived })
  } catch (e: unknown) {
    console.error('[teacher/classes/archive POST]', e instanceof Error ? e.message : String(e))
    return apiError('Failed to archive class')
  }
}
