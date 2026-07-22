import { createClient } from '@/utils/supabase/server'
import { apiSuccess, apiError, apiUnauthorized, apiForbidden } from '@/lib/api/response'
import { requireGrowthUser } from '@/lib/growth/auth'
import { listContactsForSchool, createContact } from '@/lib/growth/services/contacts'
import { createContactSchema } from '@/lib/growth/validation/contacts'
import { UnauthorizedError, ForbiddenError } from '@/lib/core/errors'

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient()
    await requireGrowthUser(supabase)
    const { id } = await params
    const contacts = await listContactsForSchool(id)
    return apiSuccess({ contacts })
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiUnauthorized()
    if (err instanceof ForbiddenError) return apiForbidden()
    console.error('[growth/schools/[id]/contacts GET]', err instanceof Error ? err.message : err)
    return apiError('Server error', 500)
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient()
    await requireGrowthUser(supabase)
    const { id } = await params

    const body = await request.json()
    const parsed = createContactSchema.safeParse(body)
    if (!parsed.success) return apiError(parsed.error.issues[0]?.message ?? 'Invalid input', 400)

    const contact = await createContact({ schoolId: id, ...parsed.data })
    return apiSuccess({ contact }, 201)
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiUnauthorized()
    if (err instanceof ForbiddenError) return apiForbidden()
    console.error('[growth/schools/[id]/contacts POST]', err instanceof Error ? err.message : err)
    return apiError('Server error', 500)
  }
}
