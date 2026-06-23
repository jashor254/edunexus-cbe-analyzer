import { createClient } from '@/utils/supabase/server'
import { createServiceClient } from '@/utils/supabase/service'
import {
  apiSuccess,
  apiUnauthorized,
  apiNotFound,
  apiForbidden,
  apiError,
  getErrorMessage,
} from '@/lib/api/response'
import { deleteEvidence } from '@/lib/academy/evidence'

interface Params {
  params: Promise<{ id: string }>
}

export async function DELETE(_req: Request, { params }: Params) {
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

    if (!teacher) return apiNotFound('Teacher profile not found')

    // Verify ownership before deleting
    const { data: existing } = await db
      .from('academy_evidence')
      .select('id, teacher_id')
      .eq('id', id)
      .maybeSingle()

    if (!existing) return apiNotFound('Evidence not found')
    if (existing.teacher_id !== teacher.id) return apiForbidden()

    await deleteEvidence(teacher.id, id)

    return apiSuccess({ deleted: true })
  } catch (err: unknown) {
    return apiError(getErrorMessage(err), 500)
  }
}
