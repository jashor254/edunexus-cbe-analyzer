// GET  /api/teacher/blueprint/actions?learnerId=<uuid>&status=<status>
// POST /api/teacher/blueprint/actions
//
// The candidate-review front half of the Blueprint action-plan pipeline
// (docs/architecture/blueprint-living-action-plan-audit.md §5/§7 Phase 1).
// Until this route existed, `generateActionCandidate` and
// `proposeBlueprintAction` (lib/learnerBlueprint/actionPlan/*) were
// code-complete and tested but had no way for a teacher to reach them —
// only already-approved rows were ever visible in the product. This route
// is deliberately thin: GET lists actions awaiting a decision (proposed /
// edited / deferred), POST generates one system candidate for a learner +
// subject and immediately proposes it (status stays 'proposed' — a
// separate call to .../[actionItemId]/approve|reject|defer is still
// required before it can ever be delivered as an Assignment or Compass
// session; see the deliver-assignment/deliver-compass routes).
import { z } from 'zod'
import { createClient } from '@/utils/supabase/server'
import { apiSuccess, apiError, apiUnauthorized, apiForbidden, apiBadRequest, apiNotFound } from '@/lib/api/response'
import { UnauthorizedError, ForbiddenError, NotFoundError } from '@/lib/core/errors'
import { listBlueprintActionsForLearner, proposeBlueprintAction } from '@/lib/learnerBlueprint/actionPlan/lifecycle'
import { generateActionCandidate } from '@/lib/learnerBlueprint/actionPlan/candidateGeneration'
import { getLearner } from '@/lib/core/learners'

const PENDING_STATUSES = ['proposed', 'edited', 'deferred'] as const

const ListQuerySchema = z.object({
  learnerId: z.string().uuid(),
  status:    z.enum(['proposed', 'edited', 'approved', 'rejected', 'deferred']).optional(),
})

const GenerateSchema = z.object({
  learnerId: z.string().uuid(),
  schoolId:  z.string().uuid(),
  subject:   z.string().min(1),
})

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const parsed = ListQuerySchema.safeParse({
      learnerId: searchParams.get('learnerId'),
      status:    searchParams.get('status') ?? undefined,
    })
    if (!parsed.success) return apiBadRequest(parsed.error.issues[0]?.message ?? 'Invalid input')

    const supabase = await createClient()
    const actions = await listBlueprintActionsForLearner(supabase, parsed.data.learnerId, parsed.data.status ? { status: parsed.data.status } : undefined)

    // Default view (no explicit status filter) is "what needs a decision" —
    // the whole point of this endpoint existing — not the full history.
    const filtered = parsed.data.status
      ? actions
      : actions.filter(a => (PENDING_STATUSES as readonly string[]).includes(a.status))

    return apiSuccess({ actions: filtered })
  } catch (e: unknown) {
    return mapError(e, 'GET')
  }
}

export async function POST(req: Request) {
  try {
    const parsed = GenerateSchema.safeParse(await req.json())
    if (!parsed.success) return apiBadRequest(parsed.error.issues[0]?.message ?? 'Invalid input')
    const { learnerId, schoolId, subject } = parsed.data

    // Confirms the learner is real and in this school before spending a
    // Projection recompute on a candidate — getLearner throws NotFoundError
    // for a bad/cross-school id, caught below.
    await getLearner(learnerId, schoolId)

    const candidate = await generateActionCandidate(learnerId, schoolId, subject)
    if (!candidate) {
      return apiBadRequest('Not enough evidence yet to responsibly suggest an action for this learner in this subject.')
    }

    const supabase = await createClient()
    const action = await proposeBlueprintAction(supabase, { coreLearnerId: learnerId, ...candidate })

    return apiSuccess({ action }, 201)
  } catch (e: unknown) {
    return mapError(e, 'POST')
  }
}

function mapError(e: unknown, method: 'GET' | 'POST') {
  if (e instanceof UnauthorizedError) return apiUnauthorized()
  if (e instanceof NotFoundError) return apiNotFound(e.message)
  if (e instanceof ForbiddenError) return apiForbidden()
  console.error(`[teacher/blueprint/actions ${method}]`, e instanceof Error ? e.message : String(e))
  return apiError('Internal server error')
}
