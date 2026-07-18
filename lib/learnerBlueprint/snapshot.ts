// lib/learnerBlueprint/snapshot.ts
//
// Blueprint Snapshot service (Sprint 12K, ADR-0008 Part 3). Creates and
// reads immutable, frozen Blueprint compositions — never a second source
// of truth: `createBlueprintSnapshot` composes via the same canonical
// `composeBlueprint()` every other consumer uses, then stores exactly that
// result. No derived analytics, no recalculation, no second capability/
// pathway/attendance computation lives here.
//
// Only the three triggers ADR-0008 Part 3 already froze may call this —
// report card publication, end of term, graduation. No fourth trigger is
// invented; see the call sites in lib/core/report-cards.ts,
// lib/core/endOfTerm.ts, and lib/core/promotions.ts.

import { repos } from '@/lib/repositories'
import { getSchoolUser } from '@/lib/core/school-users'
import { composeBlueprint } from './composeBlueprint'
import { BLUEPRINT_VERSION } from './composeMetadata'
import type {
  BlueprintSnapshotRow,
  BlueprintSnapshotType,
} from '@/lib/repositories/blueprintSnapshot.repository'

export type CreateBlueprintSnapshotInput = {
  coreLearnerId: string
  schoolId: string
  academicYearId: string | null
  termId: string | null
  snapshotType: BlueprintSnapshotType
  /** The report card id / term id / promotion id that triggered this snapshot, for provenance. */
  sourceRecordId: string | null
  actorUserId: string
}

/**
 * Composes the Current Blueprint (via the one canonical composeBlueprint())
 * and freezes it as an immutable snapshot row. Never mutates, never
 * recomputes independently — if composeBlueprint() itself fails, this
 * function fails too rather than persisting a partial/fabricated snapshot
 * silently; callers (the three trigger sites) are responsible for treating
 * a snapshot failure as non-fatal to their own primary operation, per this
 * sprint's own discipline that Blueprint Snapshots must never block Report
 * Card publication / End of Term / Graduation.
 */
export async function createBlueprintSnapshot(
  input: CreateBlueprintSnapshotInput
): Promise<BlueprintSnapshotRow> {
  const [{ blueprint }, actorSchoolUser] = await Promise.all([
    composeBlueprint({
      actorUserId: input.actorUserId,
      coreLearnerId: input.coreLearnerId,
      schoolId: input.schoolId,
    }),
    // Provenance only, matching attendance_sessions.marked_by_teacher_id's
    // own precedent — never used for access control. A cron/system actor
    // with no school_users row (e.g. a scheduled end-of-term job running
    // under a service identity) still produces a valid snapshot with
    // created_by left null, never blocking the snapshot on this lookup.
    getSchoolUser(input.actorUserId, input.schoolId).catch(() => null),
  ])

  return repos.blueprintSnapshots.insert({
    learner_id: input.coreLearnerId,
    school_id: input.schoolId,
    academic_year_id: input.academicYearId,
    term_id: input.termId,
    snapshot_type: input.snapshotType,
    blueprint_payload: blueprint,
    provenance: {
      trigger: input.snapshotType,
      sourceRecordId: input.sourceRecordId,
      actorUserId: input.actorUserId,
    },
    schema_version: BLUEPRINT_VERSION,
    created_by: actorSchoolUser?.id ?? null,
  })
}

export async function getBlueprintSnapshot(
  snapshotId: string,
  schoolId: string
): Promise<BlueprintSnapshotRow | null> {
  return repos.blueprintSnapshots.findById(snapshotId, schoolId)
}

export async function listBlueprintSnapshots(
  coreLearnerId: string,
  schoolId: string
): Promise<BlueprintSnapshotRow[]> {
  return repos.blueprintSnapshots.listForLearner(coreLearnerId, schoolId)
}

/** Pure read — same ordering `listBlueprintSnapshots` already uses, no new query shape, no recomputation. */
export async function getLatestBlueprintSnapshot(
  coreLearnerId: string,
  schoolId: string
): Promise<BlueprintSnapshotRow | null> {
  return repos.blueprintSnapshots.getLatestForLearner(coreLearnerId, schoolId)
}
