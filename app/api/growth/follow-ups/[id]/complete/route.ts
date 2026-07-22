import { createClient } from '@/utils/supabase/server'
import { apiSuccess, apiError, apiUnauthorized, apiForbidden } from '@/lib/api/response'
import { requireGrowthUser } from '@/lib/growth/auth'
import { completeFollowUp } from '@/lib/growth/services/followUps'
import { UnauthorizedError, ForbiddenError } from '@/lib/core/errors'

export async function PATCH(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient()
    await requireGrowthUser(supabase)
    const { id } = await params
    const followUp = await completeFollowUp(id)
    return apiSuccess({ followUp })
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiUnauthorized()
    if (err instanceof ForbiddenError) return apiForbidden()
    console.error('[growth/follow-ups/[id]/complete PATCH]', err instanceof Error ? err.message : err)
    return apiError('Server error', 500)
  }
}
