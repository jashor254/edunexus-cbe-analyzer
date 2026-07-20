// app/student/blueprint/[learnerId]/page.tsx
//
// Current Blueprint view — Phase 1 (Sprint 12J), access fixed Sprint 6.
// "[learnerId]" is the Core learner being viewed, not the viewing role —
// originally reached only from Teacher Workspace (see
// sprint-12j-blueprint-ui-phase1.md), but this is also the page a real
// student is redirected into from `/student/blueprint`. That self-access
// path was gated on `requireSchoolStaff` (admin/headteacher/teacher only —
// `student` is not a `school_users` role) until Sprint 6 found real student
// accounts 404ing here despite Blocker #5 declaring the route reachable;
// the routing test only ever exercised the "no owned student" empty state.
// Fixed by switching to `requireLearnerAccess` (self/parent/teacher-of-
// record/admin — the same read-visibility rule `canViewLearner` already
// defines elsewhere, bridged into Core-learner-id space), not a new
// authorization pattern.
//
// Uses ONLY the canonical composition engine (lib/learnerBlueprint) — no
// lib/academicClinic, no lib/learnerIntelligence import. Thin page: auth
// + schoolId resolution only, all composition logic lives in lib/.

import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { requireAuthentication, requireLearnerAccess } from '@/lib/core/permissions'
import { ResourceOwnershipError, UnauthorizedError } from '@/lib/core/errors'
import { repos } from '@/lib/repositories'
import { getUserRoles } from '@/lib/auth/getRole'
import { composeBlueprint } from '@/lib/learnerBlueprint/composeBlueprint'
import BlueprintView from '@/components/blueprint/BlueprintView'
import BlueprintStateMessage from '@/components/blueprint/BlueprintStateMessage'
import JourneyLinks from '@/components/student/JourneyLinks'

export default async function StudentBlueprintPage({
  params,
}: {
  params: Promise<{ learnerId: string }>
}) {
  const { learnerId } = await params
  const supabase = await createClient()

  let userId: string
  try {
    const user = await requireAuthentication(supabase)
    userId = user.id
  } catch (err) {
    if (err instanceof UnauthorizedError) redirect('/login')
    throw err
  }

  let schoolId: string
  try {
    schoolId = await repos.learners.findSchoolId(learnerId)
  } catch {
    // Membership is unresolved at this point, so a "does not exist" vs
    // "you can't see it" distinction would leak existence to a stranger —
    // notFound() here is the same conservative choice already made below
    // for MembershipRequiredError.
    notFound()
  }

  try {
    await requireLearnerAccess(supabase, schoolId, learnerId)
  } catch (err) {
    if (err instanceof ResourceOwnershipError) {
      // The user is authenticated but is not this learner's self/parent/
      // teacher-of-record/school-admin — an explicit message is strictly
      // more honest than a 404 here, without revealing any ID.
      return <BlueprintStateMessage kind="permission-denied" />
    }
    throw err
  }

  let blueprint, validation
  try {
    ;({ blueprint, validation } = await composeBlueprint({
      actorUserId: userId,
      coreLearnerId: learnerId,
      schoolId,
    }))
  } catch {
    return <BlueprintStateMessage kind="unavailable" />
  }

  // Access was already granted above via requireLearnerAccess, whose
  // self-branch (canViewLearner) is the only branch a `student`-role
  // viewer can ever pass — so a granted access + primary role 'student'
  // together mean this is the learner's own Blueprint, never a teacher/
  // parent/admin viewing someone else's. Journey links are self-service
  // routes only (Progress/Career/Holiday etc. resolve "my own record"
  // server-side), so they're only correct to show here.
  const { primary } = await getUserRoles(userId)

  return (
    <>
      <BlueprintView blueprint={blueprint} validation={validation} learnerId={learnerId} />
      {primary === 'student' && <JourneyLinks current="blueprint" />}
    </>
  )
}
