// app/api/student/calendar/route.ts
// Merged calendar (teacher events + assignment due dates) across every
// class the current student (or their parent) belongs to. Same
// self/parent + "resolve own classes" pattern as
// app/api/student/assignments/route.ts and app/api/student/resources/route.ts.

import { createClient } from '@/utils/supabase/server'
import { createServiceClient } from '@/utils/supabase/service'
import { apiSuccess, apiError, apiUnauthorized } from '@/lib/api/response'
import { requireAuthentication } from '@/lib/core/permissions'
import { UnauthorizedError } from '@/lib/core/errors'
import { buildCalendarForClassIds } from '@/lib/calendar/calendar'
import { resolveFamilyStudentIds } from '@/lib/core/identity'

export async function GET() {
  try {
    const supabase = await createClient()
    let userId: string
    try {
      userId = (await requireAuthentication(supabase)).id
    } catch (err) {
      if (err instanceof UnauthorizedError) return apiUnauthorized()
      throw err
    }

    const db = createServiceClient()

    // Parent Portal Phase P1: legacy self+parent, institutional self, AND
    // institutional GUARDIAN — see lib/core/identity.ts's
    // resolveFamilyStudentIds for the full rationale (P0 §26).
    const studentIds = await resolveFamilyStudentIds(userId, db)
    if (!studentIds.length) return apiSuccess({ calendar: [] })

    const { data: classLinks } = await db
      .from('class_students')
      .select('class_id')
      .in('student_id', studentIds)

    const classIds = [...new Set((classLinks ?? []).map(c => c.class_id))]
    const calendar = await buildCalendarForClassIds(classIds)
    return apiSuccess({ calendar })
  } catch (e: unknown) {
    console.error('[student/calendar GET]', e instanceof Error ? e.message : String(e))
    return apiError('Internal server error')
  }
}
