import { createClient } from '@/utils/supabase/server'
import { apiSuccess, apiError, apiUnauthorized, apiForbidden, apiBadRequest, apiNotFound } from '@/lib/api/response'
import { requireGrowthUser } from '@/lib/growth/auth'
import { sendApprovedMessage } from '@/lib/growth/services/messaging'
import { sendMessageSchema } from '@/lib/growth/validation/messages'
import { UnauthorizedError, ForbiddenError } from '@/lib/core/errors'

/**
 * Founder-approved automated WhatsApp send. The founder has already
 * reviewed (and possibly edited) the draft client-side and explicitly
 * clicked "Approve & Send" — this route never fires on its own. Requires
 * an approved Meta template (see lib/growth/messaging/send.ts) since the
 * school has no open conversation window with us.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient()
    const growthUser = await requireGrowthUser(supabase)
    const { id } = await params

    const parsed = sendMessageSchema.safeParse(await request.json())
    if (!parsed.success) return apiBadRequest(parsed.error.issues[0]?.message ?? 'Invalid input')

    const result = await sendApprovedMessage(id, growthUser.id, parsed.data)
    return apiSuccess({ activity: result.activity, newStage: result.newStage }, 201)
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiUnauthorized()
    if (err instanceof ForbiddenError) return apiForbidden()
    if (err instanceof Error && err.message.includes('not found')) return apiNotFound(err.message)
    if (err instanceof Error && (err.message.includes('No phone') || err.message.includes('WhatsApp send failed'))) {
      return apiBadRequest(err.message)
    }
    console.error('[growth/schools/[id]/messages/send POST]', err instanceof Error ? err.message : err)
    return apiError('Server error', 500)
  }
}
