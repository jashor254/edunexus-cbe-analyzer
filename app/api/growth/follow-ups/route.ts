import { createClient } from '@/utils/supabase/server'
import { apiSuccess, apiError, apiUnauthorized, apiForbidden } from '@/lib/api/response'
import { requireGrowthUser } from '@/lib/growth/auth'
import { listOpenFollowUps } from '@/lib/growth/services/followUps'
import { UnauthorizedError, ForbiddenError } from '@/lib/core/errors'

// The global "what's due" list across every school — Spec §2.4 / §8 screen inventory item 11.
export async function GET() {
  try {
    const supabase = await createClient()
    await requireGrowthUser(supabase)
    const followUps = await listOpenFollowUps()
    return apiSuccess({ followUps })
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiUnauthorized()
    if (err instanceof ForbiddenError) return apiForbidden()
    console.error('[growth/follow-ups GET]', err instanceof Error ? err.message : err)
    return apiError('Server error', 500)
  }
}
