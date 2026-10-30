// POST — generates adaptive variants (draft only, never auto-approved) for
// one canonical question, for exactly the instructional tiers this class
// roster needs. See lib/assignments/variantGeneration.ts for the pipeline.
import { createClient } from '@/utils/supabase/server'
import { createServiceClient } from '@/utils/supabase/service'
import { apiSuccess, apiError, apiUnauthorized, apiForbidden, apiNotFound } from '@/lib/api/response'
import { requireClassTeacher } from '@/lib/core/permissions'
import { UnauthorizedError, ResourceOwnershipError } from '@/lib/core/errors'
import { checkFeatureAccess, deductFeatureTokens } from '@/lib/payments/access'
import { apiPaymentRequired } from '@/lib/payments/paywall'
import { reserveDailyCall, dailyLimitMessage } from '@/lib/ai/rateLimit'
import { loadAssignmentGenerationContext, generateVariantsForAssignmentQuestion } from '@/lib/assignments/variantOrchestration'

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string; questionId: string }> }
) {
  try {
    const access = await checkFeatureAccess('adaptive_variant_generate')
    if (access.allowed === false) {
      if (access.reason === 'insufficient_tokens') return apiPaymentRequired('adaptive_variant_generate')
      return apiError(
        'Access denied',
        access.reason === 'unauthenticated' ? 401 : 403,
      )
    }

    const { id: assignmentId, questionId } = await params
    const ctx = await loadAssignmentGenerationContext(assignmentId)
    if (!ctx) return apiNotFound('Assignment not found')

    const supabase = await createClient()
    try {
      await requireClassTeacher(supabase, ctx.classId)
    } catch (err) {
      if (err instanceof UnauthorizedError) return apiUnauthorized()
      if (err instanceof ResourceOwnershipError) return apiForbidden()
      throw err
    }

    const db = createServiceClient()
    const { data: question } = await db.from('assignment_questions').select('id').eq('id', questionId).eq('assignment_id', assignmentId).maybeSingle()
    if (!question) return apiNotFound('Question not found on this assignment')

    // One unit of today's cap per question generated — reserved after the
    // ownership checks, released if the question produced no variant.
    const quota = await reserveDailyCall(access.userId, 'adaptive_variant_generate')
    if (quota.allowed === false) {
      return apiError(dailyLimitMessage(quota, 'variant generations'), 429)
    }

    let result: Awaited<ReturnType<typeof generateVariantsForAssignmentQuestion>>
    try {
      result = await generateVariantsForAssignmentQuestion(assignmentId, questionId, ctx)
    } catch (err) {
      await quota.release('variant generation failed')
      throw err
    }
    if (result.created.length === 0) await quota.release('no variant produced')

    // Charge only when a variant was actually produced — a request that
    // fails structural validation or independent verification is not a
    // successful AI response (matches the guard already correct in the
    // sibling generate-all/route.ts, which this route previously lacked).
    if (access.deductTokens && result.created.length > 0) {
      await deductFeatureTokens(access.userId, 'adaptive_variant_generate', access.cost)
    }

    return apiSuccess(result)
  } catch (e: unknown) {
    console.error('[variants generate POST]', e instanceof Error ? e.message : String(e))
    return apiError('Internal server error')
  }
}
