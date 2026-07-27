// GET/POST /api/teacher/blueprint/actions/[actionItemId]/review
//
// Teacher Review — the final stage of the Blueprint execution cycle
// (Blueprint Living Action Plan Phase 2D —
// docs/architecture/blueprint-review-loop-phase2d.md). Thin: parses the
// request, calls the canonical review service, maps its result/errors onto
// an HTTP response. All authorization, snapshot-gathering, and the review
// write itself live in lib/learnerBlueprint/actionPlan/review.ts.
//
// GET returns the current review snapshot (Blueprint Action + Assignment
// status + Compass summary + latest Evidence + latest Projection + review
// history) without recording anything — for rendering the review screen
// before the teacher decides. POST records the teacher's decision and
// always creates a NEW review row (a review is never overwritten — see the
// service's own doc comment).
import { z } from 'zod'
import { createClient } from '@/utils/supabase/server'
import { apiSuccess, apiError, apiUnauthorized, apiForbidden, apiBadRequest, apiNotFound } from '@/lib/api/response'
import { UnauthorizedError, ForbiddenError, NotFoundError, ConflictError } from '@/lib/core/errors'
import { getBlueprintActionReviewSnapshot, reviewBlueprintAction } from '@/lib/learnerBlueprint/actionPlan/review'

const ReviewDecisionSchema = z.object({
  decision: z.enum(['complete', 'needs_revision', 'reopen', 'defer', 'no_decision']),
  notes: z.string().min(1).optional(),
})

export async function GET(_req: Request, { params }: { params: Promise<{ actionItemId: string }> }) {
  try {
    const { actionItemId } = await params
    const supabase = await createClient()

    const snapshot = await getBlueprintActionReviewSnapshot(supabase, actionItemId)
    return apiSuccess({ snapshot })
  } catch (e: unknown) {
    return mapReviewError(e, 'GET')
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ actionItemId: string }> }) {
  try {
    const { actionItemId } = await params
    const supabase = await createClient()

    const parsed = ReviewDecisionSchema.safeParse(await req.json())
    if (!parsed.success) return apiBadRequest(parsed.error.issues[0]?.message ?? 'Invalid input')

    const { review, snapshot } = await reviewBlueprintAction(supabase, actionItemId, {
      decision: parsed.data.decision,
      notes: parsed.data.notes,
    })

    return apiSuccess({ review, snapshot }, 201)
  } catch (e: unknown) {
    return mapReviewError(e, 'POST')
  }
}

function mapReviewError(e: unknown, method: 'GET' | 'POST') {
  if (e instanceof UnauthorizedError) return apiUnauthorized()
  if (e instanceof NotFoundError) return apiNotFound(e.message)
  if (e instanceof ConflictError) return apiError(e.message, 409)
  if (e instanceof ForbiddenError) return apiForbidden()
  console.error(`[teacher/blueprint/actions/review ${method}]`, e instanceof Error ? e.message : String(e))
  return apiError('Internal server error')
}
