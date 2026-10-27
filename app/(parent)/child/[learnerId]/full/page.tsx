// app/(parent)/child/[learnerId]/full/page.tsx
//
// The parent's Learner Progress Report. Composes with the same coherence
// gate as the learner/teacher report (app/student/blueprint/[learnerId]):
// a report the Coherence Engine withholds there for a critical
// contradiction is withheld here too, so a parent can never read a report
// the school's own check has stopped. Warnings (PASS_WITH_WARNINGS) render
// normally, exactly as on the learner page. `ParentBlueprintView` renders
// the shared four-question report first, then supplementary detail.

import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { requireAuthentication, requireParent } from '@/lib/core/permissions'
import { UnauthorizedError, ResourceOwnershipError } from '@/lib/core/errors'
import { repos } from '@/lib/repositories'
import { composeBlueprintWithCoherence } from '@/lib/learnerBlueprint/composeBlueprint'
import ParentBlueprintView from '@/components/parent/ParentBlueprintView'
import BlueprintStateMessage from '@/components/blueprint/BlueprintStateMessage'
import { asLearnerId } from '@/lib/core/identityTypes'

export default async function ParentFullBlueprintPage({
  params,
}: {
  params: Promise<{ learnerId: string }>
}) {
  // Route-boundary trust origin: this segment is a Core `learners.id` — proven
  // by the Core-learner queries below, not by the URL wording.
  const { learnerId: rawLearnerId } = await params
  const learnerId = asLearnerId(rawLearnerId)
  const supabase = await createClient()

  let userId: string
  try {
    userId = (await requireAuthentication(supabase)).id
  } catch (err) {
    if (err instanceof UnauthorizedError) redirect('/login')
    throw err
  }

  try {
    await requireParent(supabase, learnerId)
  } catch (err) {
    if (err instanceof ResourceOwnershipError) notFound()
    throw err
  }

  let schoolId: string
  try {
    schoolId = await repos.learners.findSchoolId(learnerId)
  } catch {
    notFound()
  }

  let blueprint, validation, coherence
  try {
    ;({ blueprint, validation, coherence } = await composeBlueprintWithCoherence({ actorUserId: userId, coreLearnerId: learnerId, schoolId }))
  } catch {
    return (
      <div className="max-w-md mx-auto py-12 px-4 text-center">
        <p className="text-sm text-gray-500">We couldn&apos;t load this right now. Please try again in a moment.</p>
      </div>
    )
  }

  if (coherence.result === 'FAIL') {
    return <BlueprintStateMessage kind="coherence-failed" backHref={`/child/${learnerId}`} backLabel="← Back to Home" />
  }

  return <ParentBlueprintView blueprint={blueprint} validation={validation} learnerId={learnerId} />
}
