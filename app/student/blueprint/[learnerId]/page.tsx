// app/student/blueprint/[learnerId]/page.tsx
//
// Current Blueprint view — Phase 1 (Sprint 12J). Teacher-first per this
// sprint's explicit scope (no Parent Portal, no Employer/University
// filtering, no learner personalization — audience filtering is deferred).
// "[learnerId]" is the Core learner being viewed, not the viewing role —
// this route is reached from Teacher Workspace, not a learner's own
// session (see sprint-12j-blueprint-ui-phase1.md for the path-naming
// rationale).
//
// Uses ONLY the canonical composition engine (lib/learnerBlueprint) — no
// lib/academicClinic, no lib/learnerIntelligence import. Thin page: auth
// + schoolId resolution only, all composition logic lives in lib/.

import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { requireAuthentication, requireSchoolStaff } from '@/lib/core/permissions'
import { MembershipRequiredError, PermissionDeniedError, UnauthorizedError } from '@/lib/core/errors'
import { repos } from '@/lib/repositories'
import { composeBlueprint } from '@/lib/learnerBlueprint/composeBlueprint'
import BlueprintView from '@/components/blueprint/BlueprintView'
import BlueprintStateMessage from '@/components/blueprint/BlueprintStateMessage'

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
    await requireSchoolStaff(supabase, schoolId)
  } catch (err) {
    if (err instanceof MembershipRequiredError) notFound()
    if (err instanceof PermissionDeniedError) {
      // The user IS a member of this school (membership already resolved
      // above), so there's nothing left to hide — an explicit message is
      // strictly more honest than a 404 here, without revealing any ID.
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

  return <BlueprintView blueprint={blueprint} validation={validation} learnerId={learnerId} />
}
