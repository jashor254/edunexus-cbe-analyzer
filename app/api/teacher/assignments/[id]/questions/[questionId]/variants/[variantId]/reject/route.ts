import { createClient } from '@/utils/supabase/server'
import { createServiceClient } from '@/utils/supabase/service'
import { apiSuccess, apiError, apiUnauthorized, apiForbidden, apiNotFound } from '@/lib/api/response'
import { requireClassTeacher } from '@/lib/core/permissions'
import { UnauthorizedError, ResourceOwnershipError } from '@/lib/core/errors'
import { rejectVariant } from '@/lib/assignments/variants'

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

    // A rejected variant's band silently falls back to serving the
    // canonical question — the safe default (Sprint 4C design), not an error.
    const variant = await rejectVariant(variantId)
    return apiSuccess({ variant })
  } catch (e: unknown) {
    console.error('[variants reject POST]', e instanceof Error ? e.message : String(e))
    return apiError('Internal server error')
  }
}
