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
import { BLUEPRINT_EXPORT_QUERY_KEY, isBlueprintPdfExportMode } from '@/lib/learnerBlueprint/pdfExport'
import { listReviewableBlueprintActionsForLearner, type ReviewableActionListItem } from '@/lib/learnerBlueprint/actionPlan/reviewWorkspace'
import BlueprintView from '@/components/blueprint/BlueprintView'
import BlueprintStateMessage from '@/components/blueprint/BlueprintStateMessage'
import BlueprintActionPlanSection from '@/components/blueprint/actionPlan/BlueprintActionPlanSection'
import BlueprintCandidateQueue from '@/components/blueprint/actionPlan/BlueprintCandidateQueue'
import JourneyLinks from '@/components/student/JourneyLinks'
import Link from 'next/link'

export default async function StudentBlueprintPage({
  params,
  searchParams,
}: {
  params: Promise<{ learnerId: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { learnerId } = await params
  const supabase = await createClient()
  const query = await searchParams
  const exportMode = isBlueprintPdfExportMode(query[BLUEPRINT_EXPORT_QUERY_KEY]) ? 'pdf' : 'screen'

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

  let blueprint, validation, coherence
  try {
    ;({ blueprint, validation, coherence } = await composeBlueprint({
      actorUserId: userId,
      coreLearnerId: learnerId,
      schoolId,
    }))
  } catch {
    return <BlueprintStateMessage kind="unavailable" />
  }

  // Phase 4A — the Blueprint Intelligence Coherence Engine. A FAIL means a
  // critical contradiction between a claim/recommendation/action and the
  // learner's own Evidence/Projection was found; withheld rather than
  // shown with the contradiction visible. PASS_WITH_WARNINGS renders
  // normally — warnings never mutate or block Blueprint content.
  if (coherence.result === 'FAIL') {
    return <BlueprintStateMessage kind="coherence-failed" />
  }

  // Access was already granted above via requireLearnerAccess, whose
  // self-branch (canViewLearner) is the only branch a `student`-role
  // viewer can ever pass — so a granted access + primary role 'student'
  // together mean this is the learner's own Blueprint, never a teacher/
  // parent/admin viewing someone else's. Journey links are self-service
  // routes only (Progress/Career/Holiday etc. resolve "my own record"
  // server-side), so they're only correct to show here.
  const { primary } = await getUserRoles(userId)

  // Blueprint Action Plan (Phase 3A) — staff-only, the one coherent
  // teacher workflow surface: inspect an approved action, deliver it, see
  // its status, jump to the existing Review Workspace. Fetched only for a
  // teacher viewer — `listReviewableBlueprintActionsForLearner` requires
  // `canManageLearnerRecordCore` (teacher/admin-tier), narrower than the
  // `requireLearnerAccess` check above (which also admits the learner
  // themself and a parent) — so this call is never made for those viewers,
  // and its own `ResourceOwnershipError` (e.g. a `teacher`-role account
  // that doesn't actually manage THIS learner) is caught here and simply
  // omits the section rather than breaking a Blueprint page that already
  // legitimately rendered via the broader access check.
  let actionPlanItems: ReviewableActionListItem[] | null = null
  if (primary === 'teacher' && exportMode !== 'pdf') {
    try {
      actionPlanItems = await listReviewableBlueprintActionsForLearner(supabase, learnerId)
    } catch (err) {
      if (!(err instanceof ResourceOwnershipError)) throw err
    }
  }

  return (
    <>
      {/* Teacher Review Workspace entry point (Phase 2E) — staff-only,
          smallest useful link into the review workspace from the Blueprint
          a teacher is already looking at. Never shown to the learner or
          parent viewing their own/their child's Blueprint. */}
      {primary === 'teacher' && exportMode !== 'pdf' && (
        <div className="max-w-4xl mx-auto px-4 pt-4 flex items-center justify-between gap-2 flex-wrap">
          <Link
            href={`/teacher/learners/${learnerId}/blueprint/review`}
            className="inline-block bg-teal-600 text-white px-4 py-2 rounded-xl font-black text-sm hover:bg-teal-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
          >
            Review Actions
          </Link>
        </div>
      )}
      {actionPlanItems !== null && (
        <div className="max-w-4xl mx-auto px-4 pt-4 space-y-4">
          <BlueprintCandidateQueue learnerId={learnerId} schoolId={schoolId} />
          <BlueprintActionPlanSection learnerId={learnerId} items={actionPlanItems} />
        </div>
      )}
      <BlueprintView blueprint={blueprint} validation={validation} learnerId={learnerId} exportMode={exportMode} />
      {primary === 'student' && exportMode !== 'pdf' && <JourneyLinks current="blueprint" />}
    </>
  )
}
