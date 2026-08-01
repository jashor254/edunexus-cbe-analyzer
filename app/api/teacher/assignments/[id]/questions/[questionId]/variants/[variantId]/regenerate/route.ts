import { createClient } from '@/utils/supabase/server'
import { createServiceClient } from '@/utils/supabase/service'
import { apiSuccess, apiError, apiUnauthorized, apiForbidden, apiNotFound } from '@/lib/api/response'
import { requireClassTeacher } from '@/lib/core/permissions'
import { UnauthorizedError, ResourceOwnershipError } from '@/lib/core/errors'
import { repos } from '@/lib/repositories'
import { checkFeatureAccess, deductFeatureTokens } from '@/lib/payments/access'
import { checkDailyCallLimit } from '@/lib/ai/rateLimit'
import { regenerateOneVariant } from '@/lib/assignments/variantGeneration'

async function loadAssignment(variantId: string): Promise<{ classId: string; subject: string } | null> {
  const db = createServiceClient()
  const { data: variant } = await db.from('assignment_question_variants').select('question_id').eq('id', variantId).maybeSingle()
  if (!variant) return null
  const { data: question } = await db.from('assignment_questions').select('assignment_id').eq('id', variant.question_id).maybeSingle()
  if (!question) return null
  const { data: assignment } = await db.from('assignments').select('class_id, subject').eq('id', question.assignment_id).maybeSingle()
  if (!assignment) return null
  return { classId: assignment.class_id, subject: assignment.subject }
}

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string; questionId: string; variantId: string }> }
) {
  try {
    const access = await checkFeatureAccess('adaptive_variant_generate')
    if (access.allowed === false) {
      return apiError(
        access.reason === 'insufficient_tokens' ? 'Insufficient tokens. Please top up to regenerate this variant.' : 'Access denied',
        access.reason === 'unauthenticated' ? 401 : 403,
      )
    }

    const rateLimit = await checkDailyCallLimit(access.userId, 'adaptive_variant_generate')
    if (rateLimit.allowed === false) {
      return apiError(`Daily limit of ${rateLimit.limit} variant generations reached. Resets at ${rateLimit.resetAt}`, 429)
    }

    const { variantId } = await params
    const assignment = await loadAssignment(variantId)
    if (!assignment) return apiNotFound('Variant not found')

    const supabase = await createClient()
    try {
      await requireClassTeacher(supabase, assignment.classId)
    } catch (err) {
      if (err instanceof UnauthorizedError) return apiUnauthorized()
      if (err instanceof ResourceOwnershipError) return apiForbidden()
      throw err
    }

    const studentIds = await repos.learnerIntelligence.getClassEnrollment(assignment.classId)
    const names = await repos.learnerIntelligence.getStudentNamesByIds(studentIds)
    const nameById = new Map(names.map(n => [n.id, n.name?.trim() || 'Student']))
    const learners = studentIds.map(sid => ({ learnerId: sid, learnerName: nameById.get(sid) ?? 'Student' }))

    const result = await regenerateOneVariant({ variantId, learners, subject: assignment.subject })
    if ('error' in result) return apiError(result.error, 422)

    if (access.deductTokens) {
      await deductFeatureTokens(access.userId, 'adaptive_variant_generate', access.cost)
    }

    return apiSuccess({ variant: result.variant })
  } catch (e: unknown) {
    console.error('[variants regenerate POST]', e instanceof Error ? e.message : String(e))
    return apiError('Internal server error')
  }
}
