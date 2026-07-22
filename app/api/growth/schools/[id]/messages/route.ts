import { createClient } from '@/utils/supabase/server'
import { apiSuccess, apiError, apiUnauthorized, apiForbidden, apiBadRequest, apiNotFound } from '@/lib/api/response'
import { requireGrowthUser } from '@/lib/growth/auth'
import { getCommunicationWorkspace } from '@/lib/growth/services/messaging'
import { getWorkspaceQuerySchema } from '@/lib/growth/validation/messages'
import { UnauthorizedError, ForbiddenError } from '@/lib/core/errors'

/**
 * Sprint PE-8 — Communication Workspace read. Query params let the founder
 * swap the suggested template/channel or supply a meeting date/time before
 * generating; every other draft input (school, contact, founder name, pilot
 * slot count) comes straight from the database, never the request body.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient()
    const growthUser = await requireGrowthUser(supabase)
    const { id } = await params

    const url = new URL(request.url)
    const parsed = getWorkspaceQuerySchema.safeParse({
      templateId: url.searchParams.get('templateId'),
      channel: url.searchParams.get('channel'),
      meetingDate: url.searchParams.get('meetingDate'),
      meetingTime: url.searchParams.get('meetingTime'),
    })
    if (!parsed.success) return apiBadRequest(parsed.error.issues[0]?.message ?? 'Invalid input')

    const workspace = await getCommunicationWorkspace(id, growthUser.id, {
      templateId: parsed.data.templateId ?? undefined,
      channel: parsed.data.channel ?? undefined,
      meetingDate: parsed.data.meetingDate ?? undefined,
      meetingTime: parsed.data.meetingTime ?? undefined,
    })
    return apiSuccess({ workspace })
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiUnauthorized()
    if (err instanceof ForbiddenError) return apiForbidden()
    if (err instanceof Error && err.message.includes('not found')) return apiNotFound(err.message)
    console.error('[growth/schools/[id]/messages GET]', err instanceof Error ? err.message : err)
    return apiError('Server error', 500)
  }
}
