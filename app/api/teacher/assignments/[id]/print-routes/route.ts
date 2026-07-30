// app/api/teacher/assignments/[id]/print-routes/route.ts
// Printable Adaptive Assignments pilot — generate a new draft print run
// (POST) or list existing runs for an assignment (GET).
import { createClient } from '@/utils/supabase/server'
import { apiSuccess, apiUnauthorized, apiForbidden, apiNotFound, apiFallback } from '@/lib/api/response'
import { UnauthorizedError, ResourceOwnershipError } from '@/lib/core/errors'
import { generatePrintRun } from '@/lib/assignments/printRoutes'
import { repos } from '@/lib/repositories'
import { requireClassTeacher } from '@/lib/core/permissions'

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const supabase = await createClient()
    const { run, routes } = await generatePrintRun(supabase, id)
    return apiSuccess({ run, routes }, 201)
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiUnauthorized()
    if (err instanceof ResourceOwnershipError) return apiForbidden()
    console.error('[print-routes POST]', err instanceof Error ? err.message : String(err))
    return apiFallback('Failed to generate printable routes')
  }
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const supabase = await createClient()
    const assignment = await repos.assignments.findById(id)
    if (!assignment) return apiNotFound('Assignment not found')
    await requireClassTeacher(supabase, assignment.class_id)

    const runs = await repos.assignmentPrintRuns.listRunsForAssignment(id)
    return apiSuccess({ runs })
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiUnauthorized()
    if (err instanceof ResourceOwnershipError) return apiForbidden()
    console.error('[print-routes GET]', err instanceof Error ? err.message : String(err))
    return apiFallback('Failed to load printable routes')
  }
}
