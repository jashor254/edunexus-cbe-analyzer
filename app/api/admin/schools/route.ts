// app/api/admin/schools/route.ts
//
// The founder's canonical school list — the missing link between "we created
// the school" and "/admin/schools/[schoolId], where payment and entitlement
// live". Before this existed, reaching that page required knowing a UUID.
//
// SECURITY BOUNDARY
// requireGrowthUser(), same as every other platform-admin surface. A school
// admin is authoritative INSIDE their own school and has no business reading a
// platform-wide list of institutions — that distinction is the whole point of
// keeping the two authorities separate.
//
// The service client is used only after that check, and never reaches the
// browser. Cross-school reads deliberately do not go through RLS: rebuilding a
// browser-reachable cross-tenant view is the architecture the last two phases
// removed.
//
// GET only. This endpoint writes nothing.

import { z } from 'zod'
import { createClient } from '@/utils/supabase/server'
import { apiSuccess, apiError, apiUnauthorized, apiForbidden } from '@/lib/api/response'
import { requireGrowthUser } from '@/lib/growth/auth'
import { listSchoolsForPlatformAdmin, type SchoolDirectoryEntry } from '@/lib/core/schoolDirectory'
import { UnauthorizedError, ForbiddenError } from '@/lib/core/errors'

const QuerySchema = z.object({
  search: z.string().trim().max(200).optional(),
  limit:  z.coerce.number().int().min(1).max(100).optional(),
})

type SchoolsResponse = { schools: SchoolDirectoryEntry[] }

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    await requireGrowthUser(supabase)

    const url = new URL(request.url)
    const parsed = QuerySchema.safeParse({
      search: url.searchParams.get('search') ?? undefined,
      limit:  url.searchParams.get('limit')  ?? undefined,
    })
    if (!parsed.success) return apiError('Invalid query', 400)

    const schools = await listSchoolsForPlatformAdmin(parsed.data.search, parsed.data.limit)

    const body: SchoolsResponse = { schools }
    return apiSuccess(body)
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiUnauthorized()
    if (err instanceof ForbiddenError) return apiForbidden()
    console.error('[admin/schools GET]', err instanceof Error ? err.message : err)
    return apiError('Server error', 500)
  }
}
