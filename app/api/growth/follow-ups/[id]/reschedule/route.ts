import { createClient } from '@/utils/supabase/server'
import { apiSuccess, apiError, apiUnauthorized, apiForbidden } from '@/lib/api/response'
import { requireGrowthUser } from '@/lib/growth/auth'
import { rescheduleFollowUp } from '@/lib/growth/services/followUps'
import { rescheduleFollowUpSchema } from '@/lib/growth/validation/followUps'
import { UnauthorizedError, ForbiddenError } from '@/lib/core/errors'

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient()
    await requireGrowthUser(supabase)
    const { id } = await params

    const body = await request.json()
    const parsed = rescheduleFollowUpSchema.safeParse(body)
    if (!parsed.success) return apiError(parsed.error.issues[0]?.message ?? 'Invalid input', 400)

    const followUp = await rescheduleFollowUp(id, parsed.data.dueDate)
    return apiSuccess({ followUp })
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiUnauthorized()
    if (err instanceof ForbiddenError) return apiForbidden()
    console.error('[growth/follow-ups/[id]/reschedule PATCH]', err instanceof Error ? err.message : err)
    return apiError('Server error', 500)
  }
}
