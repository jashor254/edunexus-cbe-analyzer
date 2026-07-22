import { createClient } from '@/utils/supabase/server'
import { apiSuccess, apiError, apiUnauthorized, apiForbidden } from '@/lib/api/response'
import { requireGrowthUser } from '@/lib/growth/auth'
import { listSchools, createSchool } from '@/lib/growth/services/schools'
import { createSchoolSchema } from '@/lib/growth/validation/schools'
import { UnauthorizedError, ForbiddenError } from '@/lib/core/errors'

export async function GET() {
  try {
    const supabase = await createClient()
    await requireGrowthUser(supabase)
    const schools = await listSchools()
    return apiSuccess({ schools })
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiUnauthorized()
    if (err instanceof ForbiddenError) return apiForbidden()
    console.error('[growth/schools GET]', err instanceof Error ? err.message : err)
    return apiError('Server error', 500)
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const growthUser = await requireGrowthUser(supabase)

    const body = await request.json()
    const parsed = createSchoolSchema.safeParse(body)
    if (!parsed.success) return apiError(parsed.error.issues[0]?.message ?? 'Invalid input', 400)

    const school = await createSchool(parsed.data, growthUser.id)
    return apiSuccess({ school }, 201)
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiUnauthorized()
    if (err instanceof ForbiddenError) return apiForbidden()
    if (err instanceof Error && err.message.includes('already exists')) return apiError(err.message, 409)
    console.error('[growth/schools POST]', err instanceof Error ? err.message : err)
    return apiError('Server error', 500)
  }
}
