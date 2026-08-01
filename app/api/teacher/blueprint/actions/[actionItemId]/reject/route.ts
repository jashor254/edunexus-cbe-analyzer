// POST /api/teacher/blueprint/actions/[actionItemId]/reject
//
// Records a teacher's rejection of a proposed/edited/deferred Blueprint
// action item. A reason is required — see
// lib/learnerBlueprint/actionPlan/lifecycle.ts::rejectBlueprintAction.
import { z } from 'zod'
import { createClient } from '@/utils/supabase/server'
import { apiSuccess, apiError, apiUnauthorized, apiForbidden, apiBadRequest, apiNotFound } from '@/lib/api/response'
import { UnauthorizedError, ForbiddenError } from '@/lib/core/errors'
import { rejectBlueprintAction } from '@/lib/learnerBlueprint/actionPlan/lifecycle'

const BodySchema = z.object({
  reason: z.string().min(1),
})

export async function POST(req: Request, { params }: { params: Promise<{ actionItemId: string }> }) {
  try {
    const { actionItemId } = await params
    const parsed = BodySchema.safeParse(await req.json())
    if (!parsed.success) return apiBadRequest(parsed.error.issues[0]?.message ?? 'A reason is required to reject an action item.')

    const supabase = await createClient()
    const action = await rejectBlueprintAction(supabase, actionItemId, parsed.data.reason)

    return apiSuccess({ action })
  } catch (e: unknown) {
    if (e instanceof UnauthorizedError) return apiUnauthorized()
    if (e instanceof ForbiddenError) return apiForbidden()
    if (e instanceof Error && e.message.includes('not found')) return apiNotFound(e.message)
    if (e instanceof Error) return apiError(e.message, 422)
    console.error('[teacher/blueprint/actions/reject]', e)
    return apiError('Internal server error')
  }
}
