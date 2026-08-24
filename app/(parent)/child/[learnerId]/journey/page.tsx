// app/(parent)/child/[learnerId]/journey/page.tsx
//
// Growth Journey (Sprint 12R Phase 4) — the milestone-level landing page
// between Parent Home and the full Growth Timeline (ADR-0009 navigation:
// Parent Home -> Growth Journey -> Timeline -> Snapshot -> Back to
// Timeline). Consumes `listBlueprintSnapshots()` only; milestones are
// built by `buildMilestones()` (lib/parentExperience/growthTimeline.ts),
// a pure function over the same already-fetched rows — no second read,
// no fabricated milestone type.

import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { requireAuthentication, requireParent } from '@/lib/core/permissions'
import { UnauthorizedError, ResourceOwnershipError } from '@/lib/core/errors'
import { repos } from '@/lib/repositories'
import { listBlueprintSnapshots } from '@/lib/learnerBlueprint/snapshot'
import { buildMilestones } from '@/lib/parentExperience/growthTimeline'
import { asLearnerId } from '@/lib/core/identityTypes'
import ChildContextHeader from '@/components/parent/ChildContextHeader'

export default async function ParentGrowthJourneyPage({
  params,
}: {
  params: Promise<{ learnerId: string }>
}) {
  // Route-boundary trust origin: this segment is a Core `learners.id` — proven
  // by the Core-learner queries below, not by the URL wording.
  const { learnerId: rawLearnerId } = await params
  const learnerId = asLearnerId(rawLearnerId)
  const supabase = await createClient()

  try {
    await requireAuthentication(supabase)
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

  let snapshots
  try {
    snapshots = await listBlueprintSnapshots(learnerId, schoolId)
  } catch {
    return (
      <div className="max-w-md mx-auto py-12 px-4 text-center">
        <p className="text-sm text-gray-500">We couldn&apos;t load this right now. Please try again in a moment.</p>
      </div>
    )
  }

  const milestones = buildMilestones(snapshots)

  return (
    <div className="max-w-2xl mx-auto space-y-3 py-6 px-4">
      <ChildContextHeader learnerId={learnerId} />
      <div className="mb-4">
        <h1 className="text-lg font-black text-gray-900">How Has My Child Grown?</h1>
        <p className="text-xs text-gray-400">A look at the key moments that make up your child&apos;s learning journey so far.</p>
        <Link href={`/child/${learnerId}`} className="text-xs font-bold text-teal-700 hover:underline focus-visible:underline focus-visible:outline-none mt-2 inline-block">
          ← Back to Home
        </Link>
      </div>

      {milestones.length === 0 ? (
        <div role="status" className="bg-white rounded-2xl border border-gray-100 p-5">
          <p className="text-sm text-gray-400">
            Your child was recently onboarded, so there isn&apos;t a journey to show yet — the first milestone will appear here automatically, for example the next time a report card is published or a term ends.
          </p>
        </div>
      ) : (
        <>
          <ol aria-label="Growth journey milestones, newest first" className="space-y-2">
            {milestones.map(m => (
              <li key={m.snapshotId}>
                <Link
                  href={`/child/${learnerId}/history/${m.snapshotId}`}
                  className="block bg-white rounded-2xl border border-gray-100 p-4 hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:outline-none transition-colors"
                >
                  <p className="text-sm font-bold text-gray-900">{m.label}</p>
                  <p className="text-xs text-gray-400 mt-1">{new Date(m.date).toLocaleDateString('en-KE', { dateStyle: 'long' })}</p>
                </Link>
              </li>
            ))}
          </ol>

          <Link
            href={`/child/${learnerId}/history`}
            className="block bg-white rounded-2xl border border-gray-100 p-4 hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:outline-none transition-colors text-center"
          >
            <p className="text-sm font-bold text-teal-700">See the Full Growth Timeline →</p>
          </Link>
        </>
      )}
    </div>
  )
}
