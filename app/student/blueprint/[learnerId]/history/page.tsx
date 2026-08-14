// app/student/blueprint/[learnerId]/history/page.tsx
//
// Historical Snapshots list — ADR-0009 §1 Layer 4. Users may: view the
// snapshot list, open one snapshot, navigate back. Nothing more (mission).
// No audience filtering, no comparison, no diff, no deletion/editing UI —
// snapshots are read-only forever.

import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { requireAuthentication, requireSchoolStaff } from '@/lib/core/permissions'
import { MembershipRequiredError, PermissionDeniedError, UnauthorizedError } from '@/lib/core/errors'
import { repos } from '@/lib/repositories'
import { listBlueprintSnapshots } from '@/lib/learnerBlueprint/snapshot'
import type { BlueprintSnapshotType } from '@/lib/repositories/blueprintSnapshot.repository'
import BlueprintStateMessage from '@/components/blueprint/BlueprintStateMessage'
import { asLearnerId } from '@/lib/core/identityTypes'

const SNAPSHOT_TYPE_LABEL: Record<BlueprintSnapshotType, string> = {
  report_card_publication: 'Report Card Publication',
  end_of_term: 'End of Term',
  graduation: 'Graduation',
}

export default async function BlueprintHistoryPage({
  params,
}: {
  params: Promise<{ learnerId: string }>
}) {
  // Route-boundary trust origin: a Core `learners.id` — established by the
  // Core-learner queries this page performs, not by the URL wording.
  const { learnerId: rawLearnerId } = await params
  const learnerId = asLearnerId(rawLearnerId)
  const supabase = await createClient()

  try {
    await requireAuthentication(supabase)
  } catch (err) {
    if (err instanceof UnauthorizedError) redirect('/login')
    throw err
  }

  let schoolId: string
  try {
    schoolId = await repos.learners.findSchoolId(learnerId)
  } catch {
    notFound()
  }

  try {
    await requireSchoolStaff(supabase, schoolId)
  } catch (err) {
    if (err instanceof MembershipRequiredError) notFound()
    if (err instanceof PermissionDeniedError) {
      return <BlueprintStateMessage kind="permission-denied" />
    }
    throw err
  }

  let snapshots
  try {
    snapshots = await listBlueprintSnapshots(learnerId, schoolId)
  } catch {
    return <BlueprintStateMessage kind="unavailable" backHref={`/student/blueprint/${learnerId}`} backLabel="← Back to Blueprint" />
  }

  return (
    <div className="max-w-2xl mx-auto space-y-3 py-6 px-4">
      <div className="mb-4">
        <h1 className="text-lg font-black text-gray-900">Historical Snapshots</h1>
        <p className="text-xs text-gray-400">Frozen Blueprint records — one per Report Card publication, End of Term, or Graduation.</p>
        <Link
          href={`/student/blueprint/${learnerId}`}
          className="text-xs font-bold text-teal-700 hover:underline focus-visible:underline focus-visible:outline-none mt-2 inline-block"
        >
          ← Back to Current Blueprint
        </Link>
      </div>

      {snapshots.length === 0 ? (
        <div role="status" className="bg-white rounded-2xl border border-gray-100 p-5">
          <p className="text-sm text-gray-400">No historical snapshots yet — one is created automatically the next time a report card is published, a term ends, or this learner graduates.</p>
        </div>
      ) : (
        <ol aria-label="Blueprint snapshot timeline, newest first" className="space-y-2">
          {snapshots.map((s, i) => (
            <li key={s.id}>
              <Link
                href={`/student/blueprint/${learnerId}/history/${s.id}`}
                className="block bg-white rounded-2xl border border-gray-100 p-4 hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:outline-none transition-colors"
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] px-1.5 py-0.5 rounded border font-bold bg-amber-50 text-amber-700 border-amber-100">
                    Historical
                  </span>
                  {i === 0 && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded border font-bold bg-teal-50 text-teal-700 border-teal-100">
                      Most Recent
                    </span>
                  )}
                  <span className="text-sm font-bold text-gray-900">{SNAPSHOT_TYPE_LABEL[s.snapshot_type]}</span>
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  {new Date(s.created_at).toLocaleDateString('en-KE', { dateStyle: 'long' })}
                </p>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
