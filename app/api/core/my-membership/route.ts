// app/api/core/my-membership/route.ts
//
// Sprint 10A Commit 3: resolves the caller's own Core school membership —
// no teacher/admin screen could otherwise learn which school+role to act
// as without a manual schoolId. Same self-scoped-by-auth pattern as
// app/api/reports/report-card/mine/route.ts (no ownership check beyond
// authentication needed: the query is inherently scoped to user.id).
//
// Uses the same single-membership lookup (repos.schools.findSchoolUserByUserId)
// already used, unmodified, by app/api/school/{strand-health,intelligence,
// intervention-efficacy}/route.ts — not a new resolution strategy, and (per
// that existing precedent) picks one membership if a user belongs to more
// than one school. Acceptable at current pilot scale; not a new limitation
// this route introduces.

import { createClient } from '@/utils/supabase/server'
import { apiSuccess, apiError, apiUnauthorized } from '@/lib/api/response'
import { repos } from '@/lib/repositories'
import { requireAuthentication } from '@/lib/core/permissions'
import { UnauthorizedError } from '@/lib/core/errors'

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

    const membership = await repos.schools.findSchoolUserByUserId(userId)
    if (!membership || !membership.is_active) {
      return apiSuccess({ membership: null })
    }

    const [school, currentTerm] = await Promise.all([
      repos.schools.findById(membership.school_id),
      repos.schools.findCurrentTerm(membership.school_id),
    ])

    return apiSuccess({
      membership: {
        schoolId:   membership.school_id,
        // The caller's own auth id. Already known to them (it is their
        // session); returned so an admin screen can tell "this row is me"
        // apart from a colleague without a second lookup — e.g. to hide a
        // remove-access action that the API would refuse anyway.
        userId:     membership.user_id,
        schoolName: school.school_name,
        role:       membership.role,
        currentTerm,
      },
    })
  } catch (err) {
    console.error('[core/my-membership GET]', err instanceof Error ? err.message : err)
    return apiError('Server error', 500)
  }
}
