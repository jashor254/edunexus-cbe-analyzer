// app/api/teacher/assignments/[id]/print-routes/[printRunId]/regenerate/route.ts
// Marks the given print run 'superseded' and generates a fresh draft from
// current assignment content + current roster evidence. The superseded
// run — including anything already approved on it — is never mutated.
import { createClient } from '@/utils/supabase/server'
import { apiSuccess, apiUnauthorized, apiForbidden, apiFallback } from '@/lib/api/response'
import { UnauthorizedError, ResourceOwnershipError } from '@/lib/core/errors'
import { regeneratePrintRun } from '@/lib/assignments/printRoutes'

export async function POST(_req: Request, { params }: { params: Promise<{ id: string; printRunId: string }> }) {
  const { id, printRunId } = await params
  try {
    const supabase = await createClient()
    const { run, routes } = await regeneratePrintRun(supabase, id, printRunId)
    return apiSuccess({ run, routes }, 201)
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiUnauthorized()
    if (err instanceof ResourceOwnershipError) return apiForbidden()
    console.error('[print-routes regenerate]', err instanceof Error ? err.message : String(err))
    return apiFallback(err instanceof Error ? err.message : 'Failed to regenerate print run')
  }
}
