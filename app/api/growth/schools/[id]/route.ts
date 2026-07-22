import { createClient } from '@/utils/supabase/server'
import { apiSuccess, apiError, apiUnauthorized, apiForbidden } from '@/lib/api/response'
import { requireGrowthUser } from '@/lib/growth/auth'
import { getSchool, updateSchool } from '@/lib/growth/services/schools'
import { updateSchoolSchema } from '@/lib/growth/validation/schools'
import { UnauthorizedError, ForbiddenError } from '@/lib/core/errors'

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient()
    await requireGrowthUser(supabase)
    const { id } = await params
    const school = await getSchool(id)
    return apiSuccess({ school })
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiUnauthorized()
    if (err instanceof ForbiddenError) return apiForbidden()
    if (err instanceof Error && err.message.includes('not found')) return apiError(err.message, 404)
    console.error('[growth/schools/[id] GET]', err instanceof Error ? err.message : err)
    return apiError('Server error', 500)
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient()
    await requireGrowthUser(supabase)
    const { id } = await params

    const body = await request.json()
    const parsed = updateSchoolSchema.safeParse(body)
    if (!parsed.success) return apiError(parsed.error.issues[0]?.message ?? 'Invalid input', 400)

    const school = await updateSchool(id, parsed.data)
    return apiSuccess({ school })
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiUnauthorized()
    if (err instanceof ForbiddenError) return apiForbidden()
    console.error('[growth/schools/[id] PATCH]', err instanceof Error ? err.message : err)
    return apiError('Server error', 500)
  }
}
