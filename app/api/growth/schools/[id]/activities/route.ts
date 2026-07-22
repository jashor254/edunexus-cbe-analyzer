import { createClient } from '@/utils/supabase/server'
import { apiSuccess, apiError, apiUnauthorized, apiForbidden } from '@/lib/api/response'
import { requireGrowthUser } from '@/lib/growth/auth'
import { listActivitiesForSchool, logActivity } from '@/lib/growth/services/activities'
import { createActivitySchema } from '@/lib/growth/validation/activities'
import { UnauthorizedError, ForbiddenError } from '@/lib/core/errors'

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient()
    await requireGrowthUser(supabase)
    const { id } = await params
    const activities = await listActivitiesForSchool(id)
    return apiSuccess({ activities })
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiUnauthorized()
    if (err instanceof ForbiddenError) return apiForbidden()
    console.error('[growth/schools/[id]/activities GET]', err instanceof Error ? err.message : err)
    return apiError('Server error', 500)
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient()
    const growthUser = await requireGrowthUser(supabase)
    const { id } = await params

    const body = await request.json()
    const parsed = createActivitySchema.safeParse(body)
    if (!parsed.success) return apiError(parsed.error.issues[0]?.message ?? 'Invalid input', 400)

    const activity = await logActivity({ schoolId: id, ...parsed.data }, growthUser.id)
    return apiSuccess({ activity }, 201)
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiUnauthorized()
    if (err instanceof ForbiddenError) return apiForbidden()
    console.error('[growth/schools/[id]/activities POST]', err instanceof Error ? err.message : err)
    return apiError('Server error', 500)
  }
}
