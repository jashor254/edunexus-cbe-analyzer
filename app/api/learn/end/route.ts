// app/api/learn/end/route.ts
import { createServiceClient } from '@/utils/supabase/service'
import { checkFeatureAccess } from '@/lib/payments/access'
import { type FeatureKey } from '@/lib/payments/config'
import { endSession } from '@/lib/compass/session'
import { apiSuccess, apiError, apiForbidden, getErrorMessage } from '@/lib/api/response'

const FEATURE: FeatureKey = 'learning_compass'

type EndSessionBody = {
  sessionId:       string
  studentId:       string
  status:          'completed' | 'abandoned'
  durationSeconds: number
}

export async function POST(req: Request): Promise<Response> {
  try {
    const { sessionId, studentId, status, durationSeconds } = await req.json() as EndSessionBody

    if (!sessionId || !studentId) return apiError('sessionId and studentId are required', 400)
    if (status !== 'completed' && status !== 'abandoned') return apiError('Invalid status', 400)
    if (typeof durationSeconds !== 'number' || durationSeconds < 0) return apiError('Invalid durationSeconds', 400)

    const access = await checkFeatureAccess(FEATURE)
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

    await endSession(sessionId, studentId, status, durationSeconds)

    return apiSuccess({ ended: true })
  } catch (err) {
    console.error('[learn/end]', err)
    return apiError(getErrorMessage(err), 500)
  }
}
