// POST /api/teacher/blueprint/actions/[actionItemId]/approve
//
// Records a teacher's approval of a proposed/edited/deferred Blueprint
// action item. Thin — all authorization, the DECIDABLE_STATUSES guard, and
// the Coherence Engine FAIL check live in
// lib/learnerBlueprint/actionPlan/lifecycle.ts::approveBlueprintAction.
import { z } from 'zod'
import { createClient } from '@/utils/supabase/server'
import { apiSuccess, apiError, apiUnauthorized, apiForbidden, apiBadRequest, apiNotFound } from '@/lib/api/response'
import { UnauthorizedError, ForbiddenError } from '@/lib/core/errors'
import { approveBlueprintAction } from '@/lib/learnerBlueprint/actionPlan/lifecycle'

const BodySchema = z.object({
  decisionReason: z.string().min(1).optional(),
  reviewDate:     z.string().optional(),
})

export async function POST(req: Request, { params }: { params: Promise<{ actionItemId: string }> }) {
  try {
    const { actionItemId } = await params
    const parsed = BodySchema.safeParse(await req.json().catch(() => ({})))
    if (!parsed.success) return apiBadRequest(parsed.error.issues[0]?.message ?? 'Invalid input')

    const supabase = await createClient()
    const action = await approveBlueprintAction(supabase, actionItemId, {
      decisionReason: parsed.data.decisionReason ?? null,
      reviewDate:      parsed.data.reviewDate ?? null,
    })

    return apiSuccess({ action })
  } catch (e: unknown) {
    if (e instanceof UnauthorizedError) return apiUnauthorized()
    if (e instanceof ForbiddenError) return apiForbidden()
    if (e instanceof Error && e.message.includes('not found')) return apiNotFound(e.message)
    if (e instanceof Error) return apiError(e.message, 422)
    console.error('[teacher/blueprint/actions/approve]', e)
    return apiError('Internal server error')
  }
}
