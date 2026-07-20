// app/api/teacher/assignments/[id]/variants/bulk-action/route.ts
// Sprint 8 (Assessment Excellence) — the Review Dashboard's bulk
// approve/reject. Deliberately a thin orchestrator, not a new grading/
// lifecycle implementation: every variant transition still goes through
// the exact same approveVariant()/rejectVariant() (lib/assignments/
// variants.ts) the single-variant routes call — this route only loops
// them, so the DB lifecycle trigger, the one-approved-per-tier partial
// unique index, and every existing single-variant test's guarantees still
// hold identically for a bulk call (Ten Engineering Rules: never duplicate
// business logic).
//
// Requested variantIds are always intersected against variants that
// actually belong to THIS assignment's own questions before acting — a
// teacher who owns this assignment's class cannot use a crafted variantId
// list to touch a variant belonging to a different assignment/class.

import { z } from 'zod'
import { createClient } from '@/utils/supabase/server'
import { apiSuccess, apiError, apiUnauthorized, apiForbidden, apiNotFound, apiBadRequest } from '@/lib/api/response'
import { requireClassTeacher } from '@/lib/core/permissions'
import { UnauthorizedError, ResourceOwnershipError } from '@/lib/core/errors'
import { findQuestionsForTeacher } from '@/lib/quiz/quiz'
import { findVariantsForQuestionIds, approveVariant, rejectVariant } from '@/lib/assignments/variants'
import { loadAssignmentGenerationContext } from '@/lib/assignments/variantOrchestration'

const BodySchema = z.object({
  variantIds: z.array(z.string().uuid()).min(1).max(200),
  action: z.enum(['approve', 'reject']),
})

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: assignmentId } = await params
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

    const body = await req.json().catch(() => null)
    const parsed = BodySchema.safeParse(body)
    if (!parsed.success) return apiBadRequest('variantIds (1-200 UUIDs) and action ("approve"|"reject") are required')
    const { variantIds, action } = parsed.data

    const questions = await findQuestionsForTeacher(assignmentId)
    const ownedVariants = await findVariantsForQuestionIds(questions.map(q => q.id))
    const ownedIds = new Set(ownedVariants.map(v => v.id))
    const requestedSet = new Set(variantIds)
    const validIds = variantIds.filter(id => ownedIds.has(id))
    const skipped = variantIds.length - validIds.length

    const transition = action === 'approve' ? approveVariant : rejectVariant
    const succeeded: string[] = []
    const failed: Array<{ variantId: string; reason: string }> = []

    // Sequential, not Promise.all — approve/reject write to the same table
    // under a DB-level partial unique index (one approved variant per
    // question+tier); sequential calls surface a genuine 409 per row
    // instead of a burst of concurrent writes racing the same constraint.
    for (const variantId of validIds) {
      try {
        await transition(variantId)
        succeeded.push(variantId)
      } catch (e: unknown) {
        failed.push({ variantId, reason: e instanceof Error ? e.message : String(e) })
      }
    }

    return apiSuccess({
      succeeded,
      failed,
      skipped: skipped > 0 ? { count: skipped, reason: 'Not a variant of this assignment' } : null,
      requestedCount: requestedSet.size,
    })
  } catch (e: unknown) {
    console.error('[variants bulk-action POST]', e instanceof Error ? e.message : String(e))
    return apiError('Internal server error')
  }
}
