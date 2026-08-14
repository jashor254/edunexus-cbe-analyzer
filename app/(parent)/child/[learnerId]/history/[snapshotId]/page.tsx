// app/(parent)/child/[learnerId]/history/[snapshotId]/page.tsx
//
// Historical Snapshot for the Parent audience (Sprint 12Q Phase 4).
// Consumes `getBlueprintSnapshot()` only — the stored `blueprint_payload`
// is rendered exactly as composed at snapshot time, through the same
// `ParentBlueprintView` the Current Blueprint uses, with `historicalMeta`
// injected so it can never be mistaken for the live picture.

import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { requireAuthentication, requireParent } from '@/lib/core/permissions'
import { UnauthorizedError, ResourceOwnershipError } from '@/lib/core/errors'
import { repos } from '@/lib/repositories'
import { getBlueprintSnapshot } from '@/lib/learnerBlueprint/snapshot'
import { listAcademicYears, listTerms } from '@/lib/core/school'
import ParentBlueprintView from '@/components/parent/ParentBlueprintView'
import { asLearnerId } from '@/lib/core/identityTypes'

export default async function ParentHistoricalSnapshotPage({
  params,
}: {
  params: Promise<{ learnerId: string; snapshotId: string }>
}) {
  // Route-boundary trust origin: Core `learners.id` (repos.learners.findSchoolId below).
  const { learnerId: rawLearnerId, snapshotId } = await params
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

  let snapshot, academicYears, terms
  try {
    ;[snapshot, [academicYears, terms]] = await Promise.all([
      getBlueprintSnapshot(snapshotId, schoolId),
      Promise.all([listAcademicYears(schoolId), listTerms(schoolId)]),
    ])
  } catch {
    return (
      <div className="max-w-md mx-auto py-12 px-4 text-center">
        <p className="text-sm text-gray-500">We couldn&apos;t load this right now. Please try again in a moment.</p>
      </div>
    )
  }

  if (!snapshot || snapshot.learner_id !== learnerId) {
    return (
      <div className="max-w-md mx-auto py-12 px-4 text-center space-y-2">
        <p className="text-sm font-black text-gray-900">This moment isn&apos;t available</p>
        <p className="text-xs text-gray-400">It may have been removed, or the link may be incorrect.</p>
      </div>
    )
  }

  const academicYearLabel = academicYears.find(y => y.id === snapshot.academic_year_id)?.name ?? null
  const termLabel = terms.find(t => t.id === snapshot.term_id)?.name ?? null
  const schoolName = snapshot.blueprint_payload.identity.data?.schoolName ?? null

  return (
    <ParentBlueprintView
      blueprint={snapshot.blueprint_payload}
      learnerId={learnerId}
      historicalMeta={{
        snapshotId: snapshot.id,
        snapshotDate: snapshot.created_at,
        academicYearLabel,
        termLabel,
        snapshotType: snapshot.snapshot_type,
        schoolName,
        schemaVersion: snapshot.schema_version,
        blueprintVersion: snapshot.blueprint_payload.metadata.blueprintVersion,
        generatedFrom: snapshot.provenance.trigger,
      }}
    />
  )
}
