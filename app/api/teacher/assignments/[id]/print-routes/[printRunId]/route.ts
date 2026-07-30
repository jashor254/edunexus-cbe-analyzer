// app/api/teacher/assignments/[id]/print-routes/[printRunId]/route.ts
// Printable Adaptive Assignments pilot — teacher edits to one draft print
// run: either a route's printable content (`routeContent`) or one
// learner's route override (`routeOverride`). Both fail loudly (500, via
// the service layer's own error) if the run is no longer a draft — never
// silently ignored.
import { z } from 'zod'
import { createClient } from '@/utils/supabase/server'
import { apiSuccess, apiUnauthorized, apiForbidden, apiBadRequest, apiNotFound, apiFallback } from '@/lib/api/response'
import { UnauthorizedError, ResourceOwnershipError } from '@/lib/core/errors'
import { requireClassTeacher } from '@/lib/core/permissions'
import { editRouteContent, overrideLearnerRoute } from '@/lib/assignments/printRoutes'
import { repos } from '@/lib/repositories'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string; printRunId: string }> }) {
  const { id, printRunId } = await params
  try {
    const supabase = await createClient()
    const assignment = await repos.assignments.findById(id)
    if (!assignment) return apiNotFound('Assignment not found')
    await requireClassTeacher(supabase, assignment.class_id)

    const run = await repos.assignmentPrintRuns.findRunById(printRunId)
    if (!run || run.assignment_id !== id) return apiNotFound('Print run not found')

    const [routes, roster] = await Promise.all([
      repos.assignmentPrintRuns.listRoutesForRun(printRunId),
      repos.assignments.listClassRoster(assignment.class_id),
    ])
    return apiSuccess({ run, routes, roster })
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiUnauthorized()
    if (err instanceof ResourceOwnershipError) return apiForbidden()
    console.error('[print-routes GET one]', err instanceof Error ? err.message : String(err))
    return apiFallback('Failed to load print run')
  }
}

const RouteContentSchema = z.object({
  kind: z.literal('routeContent'),
  route: z.enum(['guided', 'core', 'extension']),
  html: z.string().min(1),
})

const RouteOverrideSchema = z.object({
  kind: z.literal('routeOverride'),
  studentId: z.string().uuid(),
  route: z.enum(['guided', 'core', 'extension']),
})

const PatchSchema = z.discriminatedUnion('kind', [RouteContentSchema, RouteOverrideSchema])

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string; printRunId: string }> }) {
  const { id, printRunId } = await params
  try {
    const body = PatchSchema.safeParse(await req.json())
    if (!body.success) return apiBadRequest(body.error.issues[0]?.message ?? 'Invalid request body')

    const supabase = await createClient()

    if (body.data.kind === 'routeContent') {
      const run = await editRouteContent(supabase, id, printRunId, body.data.route, body.data.html)
      return apiSuccess({ run })
    }

    const route = await overrideLearnerRoute(supabase, id, printRunId, body.data.studentId, body.data.route)
    return apiSuccess({ route })
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiUnauthorized()
    if (err instanceof ResourceOwnershipError) return apiForbidden()
    console.error('[print-routes PATCH]', err instanceof Error ? err.message : String(err))
    return apiFallback(err instanceof Error ? err.message : 'Failed to update print run')
  }
}
