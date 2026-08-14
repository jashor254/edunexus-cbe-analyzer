// app/(parent)/child/[learnerId]/full/page.tsx
//
// Full Blueprint view for the Parent audience (Sprint 12Q Phase 3).
// Consumes `composeBlueprint()` directly — no transformations, no
// recalculations, no parent-specific Blueprint. `ParentBlueprintView`
// applies only the ADR-0010 Part 3 visibility matrix (which sections
// render, never a different value for a section that does).

import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { requireAuthentication, requireParent } from '@/lib/core/permissions'
import { UnauthorizedError, ResourceOwnershipError } from '@/lib/core/errors'
import { repos } from '@/lib/repositories'
import { composeBlueprint } from '@/lib/learnerBlueprint/composeBlueprint'
import ParentBlueprintView from '@/components/parent/ParentBlueprintView'
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

  let blueprint
  try {
    ;({ blueprint } = await composeBlueprint({ actorUserId: userId, coreLearnerId: learnerId, schoolId }))
  } catch {
    return (
      <div className="max-w-md mx-auto py-12 px-4 text-center">
        <p className="text-sm text-gray-500">We couldn&apos;t load this right now. Please try again in a moment.</p>
      </div>
    )
  }

  return <ParentBlueprintView blueprint={blueprint} learnerId={learnerId} />
}
