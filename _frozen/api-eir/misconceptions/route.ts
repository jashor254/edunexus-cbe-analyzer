// app/api/eir/misconceptions/route.ts
// GET /api/eir/misconceptions?schoolId=&subject=
// Returns the aggregated Misconception Library for a school or platform-wide.
// Accessible to: teachers, admins.

import { z } from 'zod'
import { createClient } from '@/utils/supabase/server'
import { apiSuccess, apiError, apiUnauthorized, apiForbidden } from '@/lib/api/response'
import { buildMisconceptionLibrary } from '@/_frozen/eir'
import { getUserRole } from '@/lib/auth/getRole'

const QuerySchema = z.object({
  schoolId: z.string().uuid().optional(),
  subject:  z.string().optional(),
})

export async function GET(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return apiUnauthorized()

    const role = await getUserRole(user.id)
    if (!role || !['teacher', 'admin', 'school_admin'].includes(role)) {
      return apiForbidden()
    }

    const url    = new URL(req.url)
    const parsed = QuerySchema.safeParse({
      schoolId: url.searchParams.get('schoolId') ?? undefined,
      subject:  url.searchParams.get('subject')  ?? undefined,
    })
    if (!parsed.success) return apiError('Invalid query parameters', 400)

    const library = await buildMisconceptionLibrary(parsed.data.schoolId)
    return apiSuccess(library)
  } catch (err) {
    return apiError(err instanceof Error ? err.message : 'Failed to build misconception library')
  }
}
