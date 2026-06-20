import { checkFeatureAccess } from '@/lib/payments/access'
import { getStudentProgress } from '@/lib/learn/progress'
import { createServiceClient } from '@/utils/supabase/service'
import { apiSuccess, apiError, apiForbidden } from '@/lib/api/response'

export async function GET(req: Request): Promise<Response> {
  try {
    const { searchParams } = new URL(req.url)
    const studentId = searchParams.get('studentId')
    if (!studentId) return apiError('studentId required', 400)

    const access = await checkFeatureAccess('learning_compass')
    if (access.allowed === false) {
      return apiError(access.reason, access.reason === 'unauthenticated' ? 401 : 403)
    }

    const db = createServiceClient()
    const { data: student } = await db
      .from('students')
      .select('id')
      .eq('id', studentId)
      .or(`user_id.eq.${access.userId},parent_user_id.eq.${access.userId}`)
      .maybeSingle()

    if (!student) return apiForbidden()

    const progress = await getStudentProgress(studentId)
    return apiSuccess({ progress })
  } catch (err) {
    console.error('[learn/progress GET]', err)
    return apiError('Server error', 500)
  }
}
