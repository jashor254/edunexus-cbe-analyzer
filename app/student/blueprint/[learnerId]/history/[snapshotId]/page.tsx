// app/student/blueprint/[learnerId]/history/[snapshotId]/page.tsx
//
// Selected Snapshot — the third and final step of ADR-0009 §6's
// Current Blueprint -> Historical Snapshots -> Selected Snapshot chain.
// Reuses BlueprintView (Sprint 12J) with historicalMeta injected — no
// second renderer (mission: "reuse the same renderer"). The stored
// blueprint_payload is rendered exactly as composed at snapshot time;
// nothing here recomputes or re-validates it.

import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { requireAuthentication, requireSchoolStaff } from '@/lib/core/permissions'
import { MembershipRequiredError, PermissionDeniedError, UnauthorizedError } from '@/lib/core/errors'
import { repos } from '@/lib/repositories'
import { getBlueprintSnapshot } from '@/lib/learnerBlueprint/snapshot'
import { validateBlueprint } from '@/lib/learnerBlueprint/validation'
import { listAcademicYears, listTerms } from '@/lib/core/school'
import BlueprintView from '@/components/blueprint/BlueprintView'
import BlueprintStateMessage from '@/components/blueprint/BlueprintStateMessage'

export default async function BlueprintSnapshotPage({
  params,
}: {
  params: Promise<{ learnerId: string; snapshotId: string }>
}) {
  const { learnerId, snapshotId } = await params
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

  let snapshot, academicYears, terms
  try {
    ;[snapshot, [academicYears, terms]] = await Promise.all([
      getBlueprintSnapshot(snapshotId, schoolId),
      Promise.all([listAcademicYears(schoolId), listTerms(schoolId)]),
    ])
  } catch {
    return <BlueprintStateMessage kind="unavailable" backHref={`/student/blueprint/${learnerId}/history`} backLabel="← Back to History" />
  }

  if (!snapshot || snapshot.learner_id !== learnerId) {
    return <BlueprintStateMessage kind="snapshot-not-found" backHref={`/student/blueprint/${learnerId}/history`} backLabel="← Back to History" />
  }

  const academicYearLabel = academicYears.find(y => y.id === snapshot.academic_year_id)?.name ?? null
  const termLabel = terms.find(t => t.id === snapshot.term_id)?.name ?? null
  // Read straight from the stored row/payload — no recomputation, per mission
  // ("if data already exists in payload, read it, never recompute").
  const schoolName = snapshot.blueprint_payload.identity.data?.schoolName ?? null

  return (
    <BlueprintView
      blueprint={snapshot.blueprint_payload}
      validation={validateBlueprint(snapshot.blueprint_payload)}
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
