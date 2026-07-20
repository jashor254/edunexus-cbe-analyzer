import { createClient } from '@/utils/supabase/server'
import { createServiceClient } from '@/utils/supabase/service'
import { apiSuccess, apiError, apiUnauthorized, apiForbidden, apiNotFound } from '@/lib/api/response'
import { requireClassTeacher } from '@/lib/core/permissions'
import { UnauthorizedError, ResourceOwnershipError } from '@/lib/core/errors'
import { approveVariant } from '@/lib/assignments/variants'

async function loadClassId(variantId: string): Promise<string | null> {
  const db = createServiceClient()
  const { data: variant } = await db.from('assignment_question_variants').select('question_id').eq('id', variantId).maybeSingle()
  if (!variant) return null
  const { data: question } = await db.from('assignment_questions').select('assignment_id').eq('id', variant.question_id).maybeSingle()
  if (!question) return null
  const { data: assignment } = await db.from('assignments').select('class_id').eq('id', question.assignment_id).maybeSingle()
  return assignment?.class_id ?? null
}

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string; questionId: string; variantId: string }> }
) {
  try {
    const { variantId } = await params
    const classId = await loadClassId(variantId)
    if (!classId) return apiNotFound('Variant not found')

    const supabase = await createClient()
    try {
      await requireClassTeacher(supabase, classId)
    } catch (err) {
      if (err instanceof UnauthorizedError) return apiUnauthorized()
      if (err instanceof ResourceOwnershipError) return apiForbidden()
      throw err
    }

    // The partial unique index (Sprint 9 Slice 1) is the real guard against
    // two approved variants for the same (question, tier) — this call
    // simply attempts the transition and surfaces the DB's own rejection.
    const variant = await approveVariant(variantId)
    return apiSuccess({ variant })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[variants approve POST]', msg)
    if (/duplicate key|unique/i.test(msg)) {
      return apiError('Another variant for this tier is already approved — reject or regenerate it first', 409)
    }
    return apiError('Internal server error')
  }
}
