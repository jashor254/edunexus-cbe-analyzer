import { z } from 'zod'
import { createClient } from '@/utils/supabase/server'
import { apiSuccess, apiError, apiUnauthorized, apiNotFound, apiBadRequest } from '@/lib/api/response'
import { requireAuthentication, requireStudent } from '@/lib/core/permissions'
import { UnauthorizedError, isEduNexusError } from '@/lib/core/errors'
import { joinClassByCode } from '@/lib/classes/joinClassByCode'
import { AttemptLimiterUnavailableError } from '@/lib/security/attemptLimiter'

const JoinClassSchema = z.object({
  classCode: z.string().trim().min(1).max(64),
  studentId: z.string().uuid(),
})

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    let userId: string
    try {
      userId = (await requireAuthentication(supabase)).id
    } catch (err) {
      if (err instanceof UnauthorizedError) return apiUnauthorized()
      throw err
    }

    const parsed = JoinClassSchema.safeParse(await req.json())
    if (!parsed.success) return apiBadRequest(parsed.error.issues[0]?.message ?? 'classCode and studentId are required')
    const { classCode, studentId } = parsed.data

    // Verify student belongs to this user
    try {
      await requireStudent(supabase, studentId)
    } catch (err) {
      if (isEduNexusError(err)) return apiError('Student not found or not yours', 403)
      throw err
    }

    const result = await joinClassByCode({ userId, studentId, classCode })

    if (result.status === 'rate_limited') return apiError('Too many incorrect class codes. Try again in an hour.', 429)
    if (result.status === 'not_found') return apiNotFound('Class not found. Check the code and try again.')
    if (result.status === 'already_enrolled') return apiError('Student is already in this class', 400)

    return apiSuccess({ class: result.class })
  } catch (e: unknown) {
    // The limiter logs its own failure detail; never join without it.
    if (e instanceof AttemptLimiterUnavailableError) {
      return apiError('Joining classes is temporarily unavailable. Please try again shortly.', 503)
    }
    console.error('[student/join-class POST]', e instanceof Error ? e.message : String(e))
    return apiError('Internal server error')
  }
}
