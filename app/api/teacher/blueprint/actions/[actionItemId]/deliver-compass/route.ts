// POST /api/teacher/blueprint/actions/[actionItemId]/deliver-compass
//
// Delivers an approved Blueprint action item to Learning Compass as a
// bounded, queued tutoring objective for its originating learner (Blueprint
// Living Action Plan Phase 2C —
// docs/architecture/blueprint-compass-delivery-phase2c.md). Thin: parses the
// request, calls the delivery adapter, maps its result/errors onto an HTTP
// response. All authorization, lifecycle validation, content mapping, and
// the Compass write itself live in
// lib/learnerBlueprint/actionPlan/delivery/compass.ts.
//
// `confirmCompassDelivery: true` is mandatory. No tutoring session is
// created or started by this endpoint — it only queues an objective the
// learner's own next Compass session will pick up, through the existing,
// unmodified Compass flow.
import { z } from 'zod'
import { createClient } from '@/utils/supabase/server'
import { apiSuccess, apiError, apiUnauthorized, apiForbidden, apiBadRequest, apiNotFound } from '@/lib/api/response'
import { UnauthorizedError, ForbiddenError, NotFoundError, ValidationError, ConflictError, IdentityResolutionError } from '@/lib/core/errors'
import { deliverBlueprintActionToCompass } from '@/lib/learnerBlueprint/actionPlan/delivery/compass'

const DeliverCompassSchema = z.object({
  confirmCompassDelivery: z.boolean(),
  subject:                z.string().min(1),
  objective:              z.string().min(1).optional(),
  learnerInstructions:    z.string().min(1).optional(),
  successIndicator:       z.string().min(1).optional(),
  reviewDate:             z.string().min(1).optional(),
})

export async function POST(req: Request, { params }: { params: Promise<{ actionItemId: string }> }) {
  try {
    const { actionItemId } = await params
    const supabase = await createClient()

    const parsed = DeliverCompassSchema.safeParse(await req.json())
    if (!parsed.success) return apiBadRequest(parsed.error.issues[0]?.message ?? 'Invalid input')

    const { delivery, alreadyDelivered } = await deliverBlueprintActionToCompass(supabase, actionItemId, {
      confirmCompassDelivery: parsed.data.confirmCompassDelivery,
      subject: parsed.data.subject,
      objective: parsed.data.objective,
      learnerInstructions: parsed.data.learnerInstructions,
      successIndicator: parsed.data.successIndicator,
      reviewDate: parsed.data.reviewDate,
    })

    return apiSuccess({ delivery, alreadyDelivered }, alreadyDelivered ? 200 : 201)
  } catch (e: unknown) {
    if (e instanceof UnauthorizedError) return apiUnauthorized()
    if (e instanceof NotFoundError) return apiNotFound(e.message)
    if (e instanceof IdentityResolutionError) return apiNotFound(e.message)
    if (e instanceof ValidationError) return apiBadRequest(e.message)
    if (e instanceof ConflictError) return apiError(e.message, 409)
    if (e instanceof ForbiddenError) return apiForbidden()
    console.error('[teacher/blueprint/actions/deliver-compass POST]', e instanceof Error ? e.message : String(e))
    return apiError('Internal server error')
  }
}
