// app/api/teacher/assignments/[id]/print-routes/[printRunId]/approve/route.ts
// Explicit teacher approval — the only action that makes a print run
// printable. No automatic/time-based approval path exists anywhere in this
// feature (unlike the holiday-plan auto-publish cron this pilot was
// explicitly instructed not to replicate).
import { createClient } from '@/utils/supabase/server'
import { apiSuccess, apiUnauthorized, apiForbidden, apiFallback } from '@/lib/api/response'
import { UnauthorizedError, ResourceOwnershipError } from '@/lib/core/errors'
import { approvePrintRun } from '@/lib/assignments/printRoutes'

export async function POST(_req: Request, { params }: { params: Promise<{ id: string; printRunId: string }> }) {
  const { id, printRunId } = await params
  try {
    const supabase = await createClient()
    const run = await approvePrintRun(supabase, id, printRunId)
    return apiSuccess({ run })
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiUnauthorized()
    if (err instanceof ResourceOwnershipError) return apiForbidden()
    console.error('[print-routes approve]', err instanceof Error ? err.message : String(err))
    return apiFallback(err instanceof Error ? err.message : 'Failed to approve print run')
  }
}
