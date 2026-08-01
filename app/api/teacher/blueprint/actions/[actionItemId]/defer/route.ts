// POST /api/teacher/blueprint/actions/[actionItemId]/defer
//
// Records a teacher's deferral of a proposed/edited/(already-)deferred
// Blueprint action item — the one non-final decision, revisitable later.
// A reason is required; reviewDate (when to revisit) is optional. See
// lib/learnerBlueprint/actionPlan/lifecycle.ts::deferBlueprintAction.
import { z } from 'zod'
import { createClient } from '@/utils/supabase/server'
import { apiSuccess, apiError, apiUnauthorized, apiForbidden, apiBadRequest, apiNotFound } from '@/lib/api/response'
import { UnauthorizedError, ForbiddenError } from '@/lib/core/errors'
import { deferBlueprintAction } from '@/lib/learnerBlueprint/actionPlan/lifecycle'

const BodySchema = z.object({
  reason:     z.string().min(1),
  reviewDate: z.string().optional(),
})

export async function POST(req: Request, { params }: { params: Promise<{ actionItemId: string }> }) {
  try {
    const { actionItemId } = await params
    const parsed = BodySchema.safeParse(await req.json())
    if (!parsed.success) return apiBadRequest(parsed.error.issues[0]?.message ?? 'A reason is required to defer an action item.')

    const supabase = await createClient()
    const action = await deferBlueprintAction(supabase, actionItemId, {
      reason:     parsed.data.reason,
      reviewDate: parsed.data.reviewDate ?? null,
    })

    return apiSuccess({ action })
  } catch (e: unknown) {
    if (e instanceof UnauthorizedError) return apiUnauthorized()
    if (e instanceof ForbiddenError) return apiForbidden()
    if (e instanceof Error && e.message.includes('not found')) return apiNotFound(e.message)
    if (e instanceof Error) return apiError(e.message, 422)
    console.error('[teacher/blueprint/actions/defer]', e)
    return apiError('Internal server error')
  }
}
