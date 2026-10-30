import { z } from 'zod'
import { createClient } from '@/utils/supabase/server'
import { apiSuccess, apiError, apiUnauthorized, apiBadRequest } from '@/lib/api/response'
import { requireAuthentication } from '@/lib/core/permissions'
import { UnauthorizedError } from '@/lib/core/errors'
import { redeemClassInvite } from '@/lib/classes/redeemClassInvite'
import { AttemptLimiterUnavailableError } from '@/lib/security/attemptLimiter'

const JoinSchema = z.object({
  inviteCode: z.string().trim().min(1, 'inviteCode is required').max(64),
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

    const parsed = JoinSchema.safeParse(await req.json())
    if (!parsed.success) {
      return apiBadRequest(parsed.error.issues.map(i => i.message).join(', '))
    }

    const result = await redeemClassInvite({ userId, inviteCode: parsed.data.inviteCode })

    switch (result.status) {
      case 'linked':
        return apiSuccess({ className: result.className, grade: result.grade, linked: result.linked })
      case 'no_matching_learner':
        return apiError(
          `No learner in ${result.className} is registered under your email address. ` +
          "Ask your child's teacher to add this email to your child's record, then open the link again.",
          409,
        )
      case 'email_unconfirmed':
        return apiError('Please confirm your email address first, then open the invite link again.', 403)
      case 'expired':
        return apiError('This invite link has expired. Ask the teacher for a new one.', 410)
      case 'not_found':
        return apiError('Invite link not found or has expired', 404)
      case 'rate_limited':
        return apiError('Too many attempts. Please try again in an hour.', 429)
    }
  } catch (e: unknown) {
    // The limiter logs its own failure detail; never join without it.
    if (e instanceof AttemptLimiterUnavailableError) {
      return apiError('Joining is temporarily unavailable. Please try again shortly.', 503)
    }
    const message = e instanceof Error ? e.message : String(e)
    console.error('[class/join POST]', message)
    return apiError('Internal server error')
  }
}
