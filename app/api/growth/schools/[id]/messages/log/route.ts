import { createClient } from '@/utils/supabase/server'
import { apiSuccess, apiError, apiUnauthorized, apiForbidden, apiBadRequest, apiNotFound } from '@/lib/api/response'
import { requireGrowthUser } from '@/lib/growth/auth'
import { getSchool } from '@/lib/growth/services/schools'
import { logMessageSent } from '@/lib/growth/services/activities'
import { logMessageSentSchema } from '@/lib/growth/validation/messages'
import { UnauthorizedError, ForbiddenError } from '@/lib/core/errors'

/**
 * Sprint PE-8 Part 5/9 — "Mark sent." Records that the founder sent a
 * prepared draft (channel, template, whether it was edited, optional
 * outcome note) as a real growth_activities row and advances the pipeline
 * stage. Never sends anything itself — the actual message leaves via a
 * wa.me/mailto/tel link the founder opens client-side.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient()
    const growthUser = await requireGrowthUser(supabase)
    const { id } = await params

    const parsed = logMessageSentSchema.safeParse(await request.json())
    if (!parsed.success) return apiBadRequest(parsed.error.issues[0]?.message ?? 'Invalid input')

    const school = await getSchool(id)
    const result = await logMessageSent(
      {
        schoolId: id,
        contactId: parsed.data.contactId,
        channel: parsed.data.channel,
        templateId: parsed.data.templateId,
        edited: parsed.data.edited,
        outcomeNote: parsed.data.outcomeNote,
        currentStage: school.pipeline_stage,
      },
      growthUser.id,
    )
    return apiSuccess({ activity: result.activity, newStage: result.newStage }, 201)
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiUnauthorized()
    if (err instanceof ForbiddenError) return apiForbidden()
    if (err instanceof Error && err.message.includes('not found')) return apiNotFound(err.message)
    console.error('[growth/schools/[id]/messages/log POST]', err instanceof Error ? err.message : err)
    return apiError('Server error', 500)
  }
}
