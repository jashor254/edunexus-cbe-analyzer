// POST /api/teacher/blueprint/actions/[actionItemId]/deliver-assignment
//
// Delivers an approved Blueprint action item as a real, class-wide
// assignment (Blueprint Living Action Plan Phase 2B —
// docs/architecture/blueprint-assignment-delivery-phase2b.md). Thin: parses
// the request, calls the delivery adapter, maps its result/errors onto an
// HTTP response. All authorization, lifecycle validation, content mapping,
// and assignment creation live in
// lib/learnerBlueprint/actionPlan/delivery/assignment.ts.
//
// `confirmClassWideDelivery: true` is mandatory — this assignment will be
// issued to the ENTIRE selected class, not only the learner the action item
// is about. The learner remains provenance for the originating Blueprint
// action; the created assignment is intentionally class-wide.
import { z } from 'zod'
import { createClient } from '@/utils/supabase/server'
import { apiSuccess, apiError, apiUnauthorized, apiForbidden, apiBadRequest, apiNotFound } from '@/lib/api/response'
import { UnauthorizedError, ForbiddenError, NotFoundError, ValidationError, ConflictError } from '@/lib/core/errors'
import { deliverBlueprintActionAsAssignment } from '@/lib/learnerBlueprint/actionPlan/delivery/assignment'

// Phase 7.5 — exactly one of classId (legacy teacher_classes.id) /
// classSubjectId (institutional, a current class_subjects.id tenure) must
// be supplied; the delivery adapter itself is the sole authority on
// enforcing "exactly one" (mirrors createAssignment's own dispatch) — this
// schema only requires each field, if present, to be a real UUID.
const DeliverAssignmentSchema = z.object({
  classId:                  z.string().uuid().optional(),
  classSubjectId:            z.string().uuid().optional(),
  confirmClassWideDelivery: z.boolean(),
  subject:                  z.string().min(1),
  topic:                    z.string().min(1),
  title:                    z.string().min(1).optional(),
  instructions:             z.string().min(1).optional(),
  dueDate:                  z.string().min(1).optional(),
  type:                     z.string().optional(),
  maxScore:                 z.number().int().positive().optional(),
  isQuiz:                   z.boolean().optional(),
})

export async function POST(req: Request, { params }: { params: Promise<{ actionItemId: string }> }) {
  try {
    const { actionItemId } = await params
    const supabase = await createClient()

    const parsed = DeliverAssignmentSchema.safeParse(await req.json())
    if (!parsed.success) return apiBadRequest(parsed.error.issues[0]?.message ?? 'Invalid input')

    const { assignment, alreadyDelivered } = await deliverBlueprintActionAsAssignment(supabase, actionItemId, {
      classId: parsed.data.classId,
      classSubjectId: parsed.data.classSubjectId,
      confirmClassWideDelivery: parsed.data.confirmClassWideDelivery,
      subject: parsed.data.subject,
      topic: parsed.data.topic,
      title: parsed.data.title,
      instructions: parsed.data.instructions,
      dueDate: parsed.data.dueDate,
      type: parsed.data.type,
      maxScore: parsed.data.maxScore,
      isQuiz: parsed.data.isQuiz,
    })

    return apiSuccess({ assignment, alreadyDelivered }, alreadyDelivered ? 200 : 201)
  } catch (e: unknown) {
    if (e instanceof UnauthorizedError) return apiUnauthorized()
    if (e instanceof NotFoundError) return apiNotFound(e.message)
    if (e instanceof ValidationError) return apiBadRequest(e.message)
    if (e instanceof ConflictError) return apiError(e.message, 409)
    if (e instanceof ForbiddenError) return apiForbidden()
    console.error('[teacher/blueprint/actions/deliver-assignment POST]', e instanceof Error ? e.message : String(e))
    return apiError('Internal server error')
  }
}
