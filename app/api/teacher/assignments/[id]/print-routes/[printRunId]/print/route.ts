// app/api/teacher/assignments/[id]/print-routes/[printRunId]/print/route.ts
// Renders the combined printable document (teacher routing sheet + route
// copies) for an APPROVED print run — returns raw HTML for the browser's
// own print dialog (window.print()), the same proven pattern the existing
// per-level "print by level" feature already uses. Returns 409 if the run
// is not yet approved — no print output before explicit approval, ever.
import { createClient } from '@/utils/supabase/server'
import { requireClassTeacher } from '@/lib/core/permissions'
import { apiUnauthorized, apiForbidden, apiNotFound, apiError, apiFallback } from '@/lib/api/response'
import { UnauthorizedError, ResourceOwnershipError } from '@/lib/core/errors'
import { repos } from '@/lib/repositories'
import { buildPrintRouteDocument, type PrintMode } from '@/lib/assignments/printRoutePdf'

export async function GET(req: Request, { params }: { params: Promise<{ id: string; printRunId: string }> }) {
  const { id, printRunId } = await params
  try {
    const supabase = await createClient()
    const assignment = await repos.assignments.findById(id)
    if (!assignment) return apiNotFound('Assignment not found')
    await requireClassTeacher(supabase, assignment.class_id)

    const run = await repos.assignmentPrintRuns.findRunById(printRunId)
    if (!run || run.assignment_id !== id) return apiNotFound('Print run not found')
    if (run.status !== 'approved') return apiError('This print run has not been approved yet — approve it before printing.', 409)

    const routes = await repos.assignmentPrintRuns.listRoutesForRun(printRunId)
    const roster = await repos.assignments.listClassRoster(assignment.class_id)
    const studentNames = Object.fromEntries(roster.map(s => [s.id, s.name]))

    const url = new URL(req.url)
    const mode: PrintMode = url.searchParams.get('mode') === 'named' ? 'named' : 'grouped'

    const html = buildPrintRouteDocument({
      run,
      routes,
      studentNames,
      meta: {
        school: undefined,
        grade: undefined,
        className: undefined,
      },
      mode,
    })

    return new Response(html, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } })
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiUnauthorized()
    if (err instanceof ResourceOwnershipError) return apiForbidden()
    console.error('[print-routes print]', err instanceof Error ? err.message : String(err))
    return apiFallback('Failed to render printable document')
  }
}
