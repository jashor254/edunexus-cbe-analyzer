// POST: Generate a Quick Check for a specific remedial bank item
// Body: { substrandHealthId, sowId, strand, subStrand, grade, learningArea, struggleCount, rootCause }
import { z } from 'zod'
import { createClient } from '@/utils/supabase/server'
import { createServiceClient } from '@/utils/supabase/service'
import { apiSuccess, apiError, apiUnauthorized, apiForbidden, apiBadRequest } from '@/lib/api/response'
import { apiPaymentRequired } from '@/lib/payments/paywall'
import { generateQuickCheck } from '@/lib/teachingIntelligence/quickCheckGenerator'
import { checkFeatureAccess } from '@/lib/payments/access'
import { checkDailyCallLimit, releaseDailyCall, type RateLimitResult } from '@/lib/ai/rateLimit'
import { AttemptLimiterUnavailableError } from '@/lib/security/attemptLimiter'

const FEATURE = 'teaching_quick_check'

// Every text field is interpolated into the AI prompt, so each is bounded
// before any provider call (KICD strand/sub-strand names are well under 200).
const BodySchema = z.object({
  substrandHealthId: z.string().uuid(),
  sowId:             z.string().uuid(),
  strand:            z.string().min(1).max(200),
  subStrand:         z.string().min(1).max(200),
  grade:             z.string().min(1).max(20),
  learningArea:      z.string().min(1).max(100),
  struggleCount:     z.number().int().min(1).max(10_000),
  rootCause:         z.string().max(500).nullable(),
})

export async function POST(req: Request) {
  let quota: RateLimitResult | null = null
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return apiUnauthorized()

    const db = createServiceClient()
    const { data: teacher } = await db
      .from('teachers')
      .select('id')
      .eq('user_id', user.id)
      .single()
    if (!teacher) return apiForbidden()

    const parsed = BodySchema.safeParse(await req.json())
    if (!parsed.success) {
      return apiBadRequest(parsed.error.issues.map(i => i.message).join(', '))
    }
    const body = parsed.data

    // Verify the teacher owns this SOW before generating
    const { data: sow } = await db
      .from('schemes_of_work')
      .select('id')
      .eq('id', body.sowId)
      .eq('teacher_id', teacher.id)
      .single()
    if (!sow) return apiForbidden()

    // Entitlement (part of the Planning Bundle — lib/payments/config.ts) and
    // the daily cap, both server-side and both BEFORE any provider call. The
    // cap was defined for this feature but never checked by this route.
    const access = await checkFeatureAccess(FEATURE)
    if (access.allowed === false) {
      if (access.reason === 'insufficient_tokens') return apiPaymentRequired(FEATURE)
      return access.reason === 'unauthenticated' ? apiUnauthorized() : apiForbidden()
    }
    const reserved = await checkDailyCallLimit(user.id, FEATURE)
    if (reserved.allowed === false) {
      return apiError(`Daily limit of ${reserved.limit} quick checks reached. Resets at ${reserved.resetAt}`, 429)
    }
    quota = reserved

    const quickCheck = await generateQuickCheck({
      substrandHealthId: body.substrandHealthId,
      sowId:             body.sowId,
      teachersId:        teacher.id,
      authUserId:        user.id,
      strand:            body.strand,
      subStrand:         body.subStrand,
      grade:             body.grade,
      learningArea:      body.learningArea,
      struggleCount:     body.struggleCount,
      rootCause:         body.rootCause,
    })

    return apiSuccess({ quickCheck })
  } catch (err: unknown) {
    if (err instanceof AttemptLimiterUnavailableError) {
      return apiError('Quick checks are temporarily unavailable. Please try again shortly.', 503)
    }
    // The generator throws when no quick check was produced — refund the slot.
    if (quota) await releaseDailyCall(quota)
    console.error('[teaching-intelligence/quick-check]', err)
    return apiError(err instanceof Error ? err.message : 'Quick check generation failed')
  }
}
