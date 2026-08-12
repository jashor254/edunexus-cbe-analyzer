// lib/learnerBlueprint/classBlueprint.ts
//
// The I/O half of the Class Blueprint. Fetches once, in batch, and hands
// everything to `computeClassBlueprint()` — all rules live in the pure module.
//
// Query budget: THREE queries for an entire class, regardless of size.
//   1. the roster                    (lib/core/learners.getClassRoster)
//   2. the Core -> legacy bridge     (one .in() over students.external_id)
//   3. every learner's Projection    (one .in() over learner_projections)
//
// This is the whole reason the module exists. Composing a Blueprint per learner
// would be roughly ten queries each — over 500 for a class of 52 — so the
// teacher-facing view that the Blueprint most needed was the one thing the
// per-learner composer could not provide.
//
// Why persisted projections rather than recomputeLearnerProjection()
// ------------------------------------------------------------------
// `recomputeLearnerProjection()` is the canonical way to read one learner's
// intelligence, and Blueprint composition still uses it. It recomputes from
// evidence per learner, which is correct for a document and unusable for a
// roster. `learner_projections` is that same engine's own persisted output —
// this module reads the engine's results, it never re-derives them from
// evidence, and it never touches `repos.evidence.*` or `learner_profiles`
// (docs/architecture/learner-record-layer-decisions.md Decision 5).
//
// The tradeoff is staleness, and it is surfaced rather than hidden: every row
// carries `projectionAsOf`, and the class carries `oldestProjectionAsOf`, so
// the view states when the picture was computed instead of implying it is live.

import { getClassRoster } from '@/lib/core/learners'
import { getClass } from '@/lib/core/classes'
import { repos } from '@/lib/repositories'
import type { AcademicValue, RiskValue } from '@/lib/projection/types'
import {
  computeClassBlueprint,
  type ClassBlueprint,
  type LearnerProjectionInput,
  type RosterLearner,
} from './classBlueprintPure'

export type { ClassBlueprint, ClassBlueprintRow, ClassLevelDistribution, ClassAttentionReason } from './classBlueprintPure'

export async function getClassBlueprint(input: {
  classId: string
  termId: string
  schoolId: string
}): Promise<ClassBlueprint> {
  const [cls, roster] = await Promise.all([
    getClass(input.classId, input.schoolId).catch(() => null),
    getClassRoster(input.classId, input.termId),
  ])

  const learners = roster as unknown as RosterLearner[]
  const coreLearnerIds = learners.map(l => l.id)

  if (coreLearnerIds.length === 0) {
    return computeClassBlueprint({
      classId: input.classId,
      className: cls?.name ?? null,
      termId: input.termId,
      roster: [],
      projections: [],
      bridgedLearnerIds: new Set(),
    })
  }

  // One query resolves the whole roster's legacy identities. A learner with no
  // row here has never been bridged, so no Projection can exist for them —
  // reported as `bridged: false` rather than silently as "no evidence".
  const bridgeRows = await repos.teachers.findLegacyStudentsByExternalIds(coreLearnerIds)
  const legacyToCore = new Map<string, string>()
  for (const row of bridgeRows) {
    if (row.external_id) legacyToCore.set(row.id, row.external_id)
  }
  const bridgedLearnerIds = new Set(legacyToCore.values())

  const projectionRows = legacyToCore.size > 0
    ? await repos.projections.findProjectionsForLearners([...legacyToCore.keys()])
    : []

  // Fold the per-projector rows into one entry per learner. Only the two
  // projectors a roster view actually reads are unpacked; the rest are ignored
  // rather than half-rendered.
  const byCoreLearner = new Map<string, LearnerProjectionInput>()
  for (const row of projectionRows) {
    const coreLearnerId = legacyToCore.get(row.learner_id)
    if (!coreLearnerId) continue

    const existing = byCoreLearner.get(coreLearnerId) ?? {
      coreLearnerId, academic: null, risk: null, evidenceCount: 0, lastComputed: null,
    }

    if (row.projector_type === 'academic') {
      existing.academic = row.value as AcademicValue
      // Evidence count is taken from the academic projection specifically, so
      // it always describes the same picture the subject rows describe.
      existing.evidenceCount = row.evidence_count
    }
    if (row.projector_type === 'risk') {
      existing.risk = row.value as RiskValue
    }

    // The most recent computation across the projections actually used.
    if (row.last_computed && (!existing.lastComputed || row.last_computed > existing.lastComputed)) {
      existing.lastComputed = row.last_computed
    }

    byCoreLearner.set(coreLearnerId, existing)
  }

  return computeClassBlueprint({
    classId: input.classId,
    className: cls?.name ?? null,
    termId: input.termId,
    roster: learners,
    projections: [...byCoreLearner.values()],
    bridgedLearnerIds,
  })
}
