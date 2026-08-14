// lib/projection/recompute.ts
// Persistence orchestration: fetches confirmed evidence for a learner, runs
// the pure engine, and upserts/deletes learner_projections rows to match.
// This is the only place the Projection Engine touches a database — kept
// separate from engine.ts (pure computation) per "separate orchestration
// from persistence."
//
// Never writes to legacy learner state (learner_profiles, assessments) —
// this engine's output lives only in learner_projections, a new store,
// per "Do NOT write directly to learner state."

import { repos } from '@/lib/repositories'
import { computeLearnerProjection } from './engine'
import type { LearnerIntelligenceProjection, Projection, ProjectorType } from './types'
import type { UpsertProjectionInput } from '@/lib/repositories/projection.repository'
import { asStudentId } from '@/lib/core/identityTypes'

const PERSISTED_PROJECTOR_TYPES: ProjectorType[] = [
  'academic', 'capability', 'knowledge', 'behaviour', 'growth', 'risk', 'completeness',
]

// Projection V2 (capabilityV2/trendV2/knowledgeV2) is computed by
// computeLearnerProjection() and returned in-memory below, but deliberately
// NOT persisted: learner_projections_projector_type_check only permits the
// 7 V1 types, and no downstream code reads a persisted V2 row today. Add
// these to PERSISTED_PROJECTOR_TYPES (and migrate the CHECK constraint)
// once a real V2 consumer exists.

// IDENTITY-1 write boundary. `learner_projections.learner_id` is FK'd to
// `students(id)`, so this is the point where a plain string becomes a
// StudentId. The public `recomputeLearnerProjection` still takes `string`
// deliberately — branding it would cascade to 81 call sites for no extra
// protection, since every write funnels through here.
function toUpsertInput(learnerId: string, type: ProjectorType, p: Projection<unknown>): UpsertProjectionInput {
  return {
    learner_id: asStudentId(learnerId),
    projector_type: type,
    projection_version: p.projectionVersion,
    value: p.value,
    supporting_evidence_ids: p.supportingEvidenceIds,
    confidence: p.confidence,
    evidence_count: p.coverage.evidenceCount,
    evidence_diversity: p.coverage.evidenceDiversity,
    latest_evidence_at: p.coverage.latestEvidenceAt,
    oldest_evidence_at: p.coverage.oldestEvidenceAt,
    coverage: null, // per-projector "coverage score" (e.g. completeness's 0-100) — set separately below where meaningful
    freshness_days: p.coverage.freshnessDays,
    last_computed: p.lastComputed,
  }
}

/**
 * Recomputes and persists the full LearnerIntelligenceProjection for one
 * learner from their current confirmed evidence. Idempotent — running this
 * twice with unchanged evidence produces the same persisted state (modulo
 * last_computed, which is metadata about *when*, not part of the
 * reproducible value).
 */
export async function recomputeLearnerProjection(learnerId: string): Promise<LearnerIntelligenceProjection> {
  const evidence = await repos.evidence.findConfirmedEvidenceForLearner(asStudentId(learnerId))
  const projection = computeLearnerProjection(learnerId, evidence)

  await Promise.all(PERSISTED_PROJECTOR_TYPES.map(async type => {
    const value = projection[type] as Projection<unknown> | null
    if (value === null) {
      // No supporting evidence for this dimension — the projection does not
      // exist, per the domain rule. If a stale row exists (e.g. the last
      // supporting evidence was retracted), remove it rather than leaving
      // a projection with content nothing currently supports.
      await repos.projections.deleteProjection(learnerId, type)
      return
    }
    const input = toUpsertInput(learnerId, type, value)
    if (type === 'completeness') {
      input.coverage = (value.value as { completenessScore: number }).completenessScore
    }
    await repos.projections.upsertProjection(input)
  }))

  return projection
}

export async function recomputeLearnerProjections(learnerIds: string[], concurrency = 20): Promise<void> {
  let index = 0
  async function worker() {
    while (index < learnerIds.length) {
      const i = index++
      await recomputeLearnerProjection(learnerIds[i])
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, learnerIds.length) }, worker))
}

export async function getPersistedProjections(learnerId: string) {
  return repos.projections.findProjectionsForLearner(learnerId)
}
