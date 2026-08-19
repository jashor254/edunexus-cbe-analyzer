// app/api/student/resources/route.ts
// Files shared to any class the current student (or their parent) belongs
// to. Same self/parent + "resolve own classes" pattern as
// app/api/student/assignments/route.ts.

import { createClient } from '@/utils/supabase/server'
import { createServiceClient } from '@/utils/supabase/service'
import { apiSuccess, apiError, apiUnauthorized } from '@/lib/api/response'
import { requireAuthentication } from '@/lib/core/permissions'
import { UnauthorizedError } from '@/lib/core/errors'
import { resolveInstitutionalCompatibilityStudentIds, listAssignmentsForAuthenticatedLearner } from '@/lib/core/assignmentDiscovery'

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

    const { data: students } = await db
      .from('students')
      .select('id')
      .or(`user_id.eq.${userId},parent_user_id.eq.${userId}`)

    // Phase 2 — Step 25: additive institutional branch. A compatibility
    // student (Phase 1C) never has `user_id`/`parent_user_id` set, so it can
    // never appear in the legacy query above — union, not override, keeps
    // Solo/parent behavior byte-for-byte unchanged (Step 18) while adding
    // institutional coverage for a learner with no legacy `students` row at all.
    const institutionalStudentIds = await resolveInstitutionalCompatibilityStudentIds(userId)

    const studentIds = [...new Set([...(students ?? []).map(s => s.id), ...institutionalStudentIds])]
    if (!studentIds.length) return apiSuccess({ resources: [] })

    const { data: classLinks } = await db
      .from('class_students')
      .select('class_id')
      .in('student_id', studentIds)
    const currentClassIds = (classLinks ?? []).map(c => c.class_id as string)

    // Phase 3A — Part B: `class_students` alone only proves CURRENT roster
    // membership, which the Phase 1B/1C roster-sync mechanism intentionally
    // removes for a transferred-out learner — the same distinction Finding 2
    // identified between this route and assignment discovery. Resources are
    // generic class materials, not assignment-specific rows (`class_resources`
    // carries no assignment id), so there is no per-resource lifecycle to
    // classify here (Step 8) — the fix is durable CLASS-level eligibility:
    // any compatibility class this identity has a legitimate, durable
    // assignment relationship with (the exact signal `assignmentDiscovery.ts`
    // already uses, reused rather than reimplemented) keeps its resources
    // visible even after a transfer, alongside whatever is still currently
    // enrolled. Union, never override — Solo/parent legacy behavior above is
    // completely unaffected (their classIds only ever come from `class_students`).
    const durableAssignments = await listAssignmentsForAuthenticatedLearner(userId)
    const durableClassIds = durableAssignments.map(a => a.class_id)

    const classIds = [...new Set([...currentClassIds, ...durableClassIds])]
    if (!classIds.length) return apiSuccess({ resources: [] })

    const { data: resources, error } = await db
      .from('class_resources')
      .select('id, class_id, title, file_name, file_type, created_at, teacher_classes(name, subject)')
      .in('class_id', classIds)
      .order('created_at', { ascending: false })

    if (error) return apiError('Failed to fetch resources')

    return apiSuccess({ resources: resources ?? [] })
  } catch (e: unknown) {
    console.error('[student/resources GET]', e instanceof Error ? e.message : String(e))
    return apiError('Internal server error')
  }
}
