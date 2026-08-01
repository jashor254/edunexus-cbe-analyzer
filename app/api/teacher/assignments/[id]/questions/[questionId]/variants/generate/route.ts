// POST — generates adaptive variants (draft only, never auto-approved) for
// one canonical question, for exactly the instructional tiers this class
// roster needs. See lib/assignments/variantGeneration.ts for the pipeline.
import { createClient } from '@/utils/supabase/server'
import { createServiceClient } from '@/utils/supabase/service'
import { apiSuccess, apiError, apiUnauthorized, apiForbidden, apiNotFound } from '@/lib/api/response'
import { requireClassTeacher } from '@/lib/core/permissions'
import { UnauthorizedError, ResourceOwnershipError } from '@/lib/core/errors'
import { checkFeatureAccess, deductFeatureTokens } from '@/lib/payments/access'
import { checkDailyCallLimit } from '@/lib/ai/rateLimit'
import { loadAssignmentGenerationContext, generateVariantsForAssignmentQuestion } from '@/lib/assignments/variantOrchestration'

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string; questionId: string }> }
) {
  try {
    const access = await checkFeatureAccess('adaptive_variant_generate')
    if (access.allowed === false) {
      return apiError(
        access.reason === 'insufficient_tokens' ? 'Insufficient tokens. Please top up to generate adaptive variants.' : 'Access denied',
        access.reason === 'unauthenticated' ? 401 : 403,
      )
    }

    const rateLimit = await checkDailyCallLimit(access.userId, 'adaptive_variant_generate')
    if (rateLimit.allowed === false) {
      return apiError(`Daily limit of ${rateLimit.limit} variant generations reached. Resets at ${rateLimit.resetAt}`, 429)
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

    const result = await generateVariantsForAssignmentQuestion(assignmentId, questionId, ctx)

    if (access.deductTokens) {
      await deductFeatureTokens(access.userId, 'adaptive_variant_generate', access.cost)
    }

    return apiSuccess(result)
  } catch (e: unknown) {
    console.error('[variants generate POST]', e instanceof Error ? e.message : String(e))
    return apiError('Internal server error')
  }
}
