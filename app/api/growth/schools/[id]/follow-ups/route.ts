import { createClient } from '@/utils/supabase/server'
import { apiSuccess, apiError, apiUnauthorized, apiForbidden } from '@/lib/api/response'
import { requireGrowthUser } from '@/lib/growth/auth'
import { listFollowUpsForSchool, createFollowUp } from '@/lib/growth/services/followUps'
import { createFollowUpSchema } from '@/lib/growth/validation/followUps'
import { UnauthorizedError, ForbiddenError } from '@/lib/core/errors'

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient()
    await requireGrowthUser(supabase)
    const { id } = await params
    const followUps = await listFollowUpsForSchool(id)
    return apiSuccess({ followUps })
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiUnauthorized()
    if (err instanceof ForbiddenError) return apiForbidden()
    console.error('[growth/schools/[id]/follow-ups GET]', err instanceof Error ? err.message : err)
    return apiError('Server error', 500)
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient()
    const growthUser = await requireGrowthUser(supabase)
    const { id } = await params

    const body = await request.json()
    const parsed = createFollowUpSchema.safeParse(body)
    if (!parsed.success) return apiError(parsed.error.issues[0]?.message ?? 'Invalid input', 400)

    const followUp = await createFollowUp({ schoolId: id, ...parsed.data }, growthUser.id)
    return apiSuccess({ followUp }, 201)
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiUnauthorized()
    if (err instanceof ForbiddenError) return apiForbidden()
    console.error('[growth/schools/[id]/follow-ups POST]', err instanceof Error ? err.message : err)
    return apiError('Server error', 500)
  }
}
