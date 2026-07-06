// app/api/eir/interventions/effectiveness/route.ts
// GET /api/eir/interventions/effectiveness?schoolId=
// Returns the Intervention Effectiveness Report.
// Accessible to: teachers, school_admin, admin.

import { z } from 'zod'
import { createClient } from '@/utils/supabase/server'
import { apiSuccess, apiError, apiUnauthorized, apiForbidden } from '@/lib/api/response'
import { buildInterventionEffectivenessReport } from '@/_frozen/eir'
import { getUserRole } from '@/lib/auth/getRole'

const QuerySchema = z.object({
  schoolId: z.string().uuid().optional(),
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
    })
    if (!parsed.success) return apiError('Invalid query parameters', 400)

    const report = await buildInterventionEffectivenessReport(parsed.data.schoolId)
    return apiSuccess(report)
  } catch (err) {
    return apiError(err instanceof Error ? err.message : 'Failed to build effectiveness report')
  }
}
