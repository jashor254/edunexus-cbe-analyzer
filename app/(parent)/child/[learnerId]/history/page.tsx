// app/(parent)/child/[learnerId]/history/page.tsx
//
// Growth Timeline for the Parent audience (Sprint 12Q Phase 4 base +
// Sprint 12R Phases 2/3/5: richer cards, one per immutable Blueprint
// Snapshot, with growth indicators comparing each snapshot only against
// the one immediately before it). Consumes `listBlueprintSnapshots()`
// only — one read, no recomputation; `compareSnapshots()`
// (lib/parentExperience/growthTimeline.ts) is a pure comparison over the
// exact fields that call already returned, never a second data source.

import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { requireAuthentication, requireParent } from '@/lib/core/permissions'
import { UnauthorizedError, ResourceOwnershipError } from '@/lib/core/errors'
import { repos } from '@/lib/repositories'
import { listBlueprintSnapshots } from '@/lib/learnerBlueprint/snapshot'
import type { BlueprintSnapshotType } from '@/lib/repositories/blueprintSnapshot.repository'
import { compareSnapshots } from '@/lib/parentExperience/growthTimeline'
import { PARENT_STATUS_LABEL } from '@/lib/parentExperience/terminology'

const SNAPSHOT_TYPE_LABEL: Record<BlueprintSnapshotType, string> = {
  report_card_publication: 'Report Card Time',
  end_of_term: 'End of Term',
  graduation: 'Graduation',
}

export default async function ParentGrowthTimelinePage({
  params,
}: {
  params: Promise<{ learnerId: string }>
}) {
  const { learnerId } = await params
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

  return (
    <div className="max-w-2xl mx-auto space-y-3 py-6 px-4">
      <div className="mb-4">
        <h1 className="text-lg font-black text-gray-900">Growth Timeline</h1>
        <p className="text-xs text-gray-400">Every recorded moment in your child&apos;s learning journey, newest first.</p>
        <Link href={`/child/${learnerId}/journey`} className="text-xs font-bold text-teal-700 hover:underline focus-visible:underline focus-visible:outline-none mt-2 inline-block">
          ← Back to Growth Journey
        </Link>
      </div>

      {snapshots.length === 0 ? (
        <div role="status" className="bg-white rounded-2xl border border-gray-100 p-5">
          <p className="text-sm text-gray-400">No moments recorded yet — one is added automatically as the term progresses.</p>
        </div>
      ) : (
        <>
          {snapshots.length === 1 && (
            <div role="status" className="bg-white rounded-2xl border border-gray-100 p-4">
              <p className="text-xs text-gray-400">This is the first recorded moment — nothing to compare it to yet. More will appear here as the term progresses.</p>
            </div>
          )}
          <ol aria-label="Growth Timeline, newest first" className="space-y-2">
            {snapshots.map((s, i) => {
              const previous = snapshots[i + 1] ?? null
              const growth = compareSnapshots(s, previous)
              const payload = s.blueprint_payload

              return (
                <li key={s.id}>
                  <Link
                    href={`/child/${learnerId}/history/${s.id}`}
                    className="block bg-white rounded-2xl border border-gray-100 p-4 hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:outline-none transition-colors space-y-2"
                  >
                    <div className="flex items-center gap-2 flex-wrap">
                      {i === 0 && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded border font-bold bg-teal-50 text-teal-700 border-teal-100">
                          Most Recent
                        </span>
                      )}
                      <span className="text-sm font-bold text-gray-900">{SNAPSHOT_TYPE_LABEL[s.snapshot_type]}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded border font-bold bg-emerald-50 text-emerald-700 border-emerald-100">
                        {growth.overallGrowthStatus}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400">
                      {new Date(s.created_at).toLocaleDateString('en-KE', { dateStyle: 'long' })}
                    </p>

                    <div className="text-xs text-gray-600 space-y-1 pt-1 border-t border-gray-50">
                      {payload.teacherReflection.data?.strengths && (
                        <p className="line-clamp-2">
                          <span className="font-bold text-gray-400">From the Teacher: </span>
                          {payload.teacherReflection.data.strengths}
                        </p>
                      )}
                      <p>
                        <span className="font-bold text-gray-400">Learning Time: </span>
                        {payload.attendance.data?.attendancePercentage !== null && payload.attendance.data?.attendancePercentage !== undefined
                          ? `${payload.attendance.data.attendancePercentage}%`
                          : PARENT_STATUS_LABEL[payload.attendance.status]}
                        {growth.attendance.direction !== 'unknown' && ` · ${growth.attendance.label}`}
                      </p>
                      <p>
                        <span className="font-bold text-gray-400">Learning Compass: </span>
                        {payload.learningCompass.data?.currentLearningFocus?.subject ?? PARENT_STATUS_LABEL[payload.learningCompass.status]}
                      </p>
                      <p>
                        <span className="font-bold text-gray-400">Career Exploration: </span>
                        {payload.career.data?.careerCluster ?? PARENT_STATUS_LABEL[payload.career.status]}
                      </p>
                    </div>
                  </Link>
                </li>
              )
            })}
          </ol>
        </>
      )}
    </div>
  )
}

