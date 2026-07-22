// app/(parent)/child/[learnerId]/page.tsx
//
// Parent Home (Sprint 12Q Phase 2). Shows only: learner name/photo, class,
// a Blueprint summary teaser, a Teacher Reflection preview, attendance
// health, Learning Compass summary, Career summary, and the latest
// Snapshot — everything links deeper, nothing duplicated. One single
// `composeBlueprint()` call (Phase 3: consume directly, no transformations)
// feeds every teaser on this page; no second computation anywhere.

import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/utils/supabase/server'
import { requireAuthentication, requireParent } from '@/lib/core/permissions'
import { UnauthorizedError, ResourceOwnershipError } from '@/lib/core/errors'
import { repos } from '@/lib/repositories'
import { composeBlueprint } from '@/lib/learnerBlueprint/composeBlueprint'
import { getLatestBlueprintSnapshot } from '@/lib/learnerBlueprint/snapshot'
import { PARENT_STATUS_LABEL } from '@/lib/parentExperience/terminology'
import ParentActionCard from '@/components/parent/ParentActionCard'

export default async function ParentHomePage({
  params,
}: {
  params: Promise<{ learnerId: string }>
}) {
  const { learnerId } = await params
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

  const latestSnapshot = await getLatestBlueprintSnapshot(learnerId, schoolId).catch(() => null)

  const identity = blueprint.identity.data
  const name = identity?.learnerName ?? 'Your child'

  return (
    <div className="max-w-2xl mx-auto space-y-3 py-6 px-4">
      <div className="mb-2">
        <h1 className="text-lg font-black text-gray-900">{name}</h1>
        <p className="text-xs text-gray-400">{identity?.currentClassName ?? identity?.schoolName ?? ''}</p>
      </div>

      {blueprint.recommendedNextSteps.status === 'available' && blueprint.recommendedNextSteps.data && (
        <ParentActionCard actions={blueprint.recommendedNextSteps.data.actions} />
      )}

      <Link
        href={`/child/${learnerId}/full`}
        className="block bg-white rounded-2xl border border-gray-100 p-4 hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:outline-none transition-colors"
      >
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">This Term</p>
        <p className="text-sm text-gray-900 mt-1">
          {blueprint.parentSummary.data?.headline ?? 'View your child\'s full learning picture →'}
        </p>
      </Link>

      <Link
        href={`/child/${learnerId}/full`}
        className="block bg-white rounded-2xl border border-gray-100 p-4 hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:outline-none transition-colors"
      >
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">From the Teacher</p>
        <p className="text-sm text-gray-900 mt-1 line-clamp-3">
          {blueprint.teacherReflection.data?.strengths ?? 'Not enough information yet — check back soon.'}
        </p>
      </Link>

      <Link
        href={`/child/${learnerId}/full`}
        className="block bg-white rounded-2xl border border-gray-100 p-4 hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:outline-none transition-colors"
      >
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">Learning Time</p>
        <p className="text-sm text-gray-900 mt-1">
          {blueprint.attendance.data?.attendancePercentage !== null && blueprint.attendance.data?.attendancePercentage !== undefined
            ? `${blueprint.attendance.data.attendancePercentage}% this term`
            : PARENT_STATUS_LABEL[blueprint.attendance.status]}
        </p>
      </Link>

      <Link
        href={`/child/${learnerId}/full`}
        className="block bg-white rounded-2xl border border-gray-100 p-4 hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:outline-none transition-colors"
      >
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">Learning Compass</p>
        <p className="text-sm text-gray-900 mt-1">
          {blueprint.learningCompass.data?.currentLearningFocus
            ? `Currently focused on ${blueprint.learningCompass.data.currentLearningFocus.subject}`
            : PARENT_STATUS_LABEL[blueprint.learningCompass.status]}
        </p>
      </Link>

      <Link
        href={`/child/${learnerId}/full`}
        className="block bg-white rounded-2xl border border-gray-100 p-4 hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:outline-none transition-colors"
      >
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">Career Exploration</p>
        <p className="text-sm text-gray-900 mt-1">
          {blueprint.career.data?.careerCluster ?? PARENT_STATUS_LABEL[blueprint.career.status]}
        </p>
      </Link>

      {/* Sprint 5 (Parent Experience Convergence) — surfaces existing,
          already-built learner capabilities the parent never had a link to:
          same card pattern as above, no new computation. */}
      <Link
        href={`/child/${learnerId}/assignments`}
        className="block bg-white rounded-2xl border border-gray-100 p-4 hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:outline-none transition-colors"
      >
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">Assignments</p>
        <p className="text-sm text-gray-900 mt-1">What&apos;s been assigned, and whether it&apos;s been submitted →</p>
      </Link>

      <Link
        href={`/child/${learnerId}/gradebook`}
        className="block bg-white rounded-2xl border border-gray-100 p-4 hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:outline-none transition-colors"
      >
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">Gradebook</p>
        <p className="text-sm text-gray-900 mt-1">Assessment and assignment scores →</p>
      </Link>

      <Link
        href={`/child/${learnerId}/progress`}
        className="block bg-white rounded-2xl border border-gray-100 p-4 hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:outline-none transition-colors"
      >
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">Compass Progress</p>
        <p className="text-sm text-gray-900 mt-1">Completed Compass sessions by subject →</p>
      </Link>

      <Link
        href={`/child/${learnerId}/holiday`}
        className="block bg-white rounded-2xl border border-gray-100 p-4 hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:outline-none transition-colors"
      >
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">Holiday Plan</p>
        <p className="text-sm text-gray-900 mt-1">Includes what you can do to help, week by week →</p>
      </Link>

      <Link
        href={`/child/${learnerId}/journey`}
        className="block bg-white rounded-2xl border border-gray-100 p-4 hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:outline-none transition-colors"
      >
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">How Has My Child Grown?</p>
        <p className="text-sm text-gray-900 mt-1">
          {latestSnapshot
            ? `Last update: ${new Date(latestSnapshot.created_at).toLocaleDateString('en-KE', { dateStyle: 'long' })} →`
            : 'No history yet — one is created automatically as the term progresses.'}
        </p>
      </Link>

      <div className="pt-2 flex gap-4">
        <Link href={`/child/${learnerId}/full`} className="text-xs font-bold text-teal-700 hover:underline focus-visible:underline focus-visible:outline-none">
          Full Picture →
        </Link>
        <Link href={`/child/${learnerId}/journey`} className="text-xs font-bold text-teal-700 hover:underline focus-visible:underline focus-visible:outline-none">
          Growth Journey →
        </Link>
      </div>
    </div>
  )
}
