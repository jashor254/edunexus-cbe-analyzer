import { checkFeatureAccess } from '@/lib/payments/access'
import { getStudentProgress } from '@/lib/learn/progress'
import { resolveCompassStudentAccess } from '@/lib/compass/ownership'
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

    const ownership = await resolveCompassStudentAccess(access.userId, studentId)
    if (!ownership.allowed) return apiForbidden()

    const progress = await getStudentProgress(studentId)
    return apiSuccess({ progress })
  } catch (err) {
    console.error('[learn/progress GET]', err)
    return apiError('Server error', 500)
  }
}
