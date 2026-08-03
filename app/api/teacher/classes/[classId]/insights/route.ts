import { createClient } from '@/utils/supabase/server'
import { apiSuccess, apiError, apiUnauthorized, apiForbidden, apiNotFound } from '@/lib/api/response'
import { requireAuthentication, requireClassTeacher } from '@/lib/core/permissions'
import { resolveTeacher } from '@/lib/core/identity'
import { UnauthorizedError } from '@/lib/core/errors'
import { getTeacherClassInsightsProjection } from '@/lib/teacherWorkspace/classInsightsProjection'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ classId: string }> }
) {
  try {
    const { classId } = await params
    const supabase = await createClient()
    let userId: string
    try {
      userId = (await requireAuthentication(supabase)).id
    } catch (err) {
      if (err instanceof UnauthorizedError) return apiUnauthorized()
      throw err
    }

    const teacher = await resolveTeacher(userId)
    if (!teacher) return apiForbidden()

    try {
      await requireClassTeacher(supabase, classId)
    } catch {
      return apiNotFound('Class not found')
    }

    const insights = await getTeacherClassInsightsProjection(classId, teacher.id)
    if (!insights) return apiNotFound('Class not found')

    return apiSuccess({ insights })
  } catch (e: unknown) {
    console.error('[teacher/classes/insights GET]', e instanceof Error ? e.message : String(e))
    return apiError('Internal server error')
  }
}
