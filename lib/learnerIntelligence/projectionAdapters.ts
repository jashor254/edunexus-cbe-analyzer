// lib/learnerIntelligence/projectionAdapters.ts
//
// ANTI-CORRUPTION LAYER between the Projection bounded context and the
// Reasoning layer's first citizen (capabilityExtractor.ts) — REWORDED
// 2026-07-14, Reasoning promotion (learner-record-layer-decisions.md
// Decision 6). Previously described as a "temporary compatibility shim";
// that framing was wrong. capabilityExtractor.ts is not legacy code being
// bridged out of existence — it is permanent architecture, proven by five
// real callers. What retires here is this ADAPTER, on the day
// capabilityExtractor.ts is rewritten to consume Projection's shape
// natively — the function itself does not retire, and there is no
// deadline pressure to remove this file.
//
// `projectionToScoreHistory` bridges `extractCapabilityProfile()`
// (lib/career/capabilityExtractor.ts) onto Projection-sourced data, so
// Blueprint and Career Intelligence can stop querying raw assessment
// history directly while the underlying 6-dimension formula itself is not
// yet rewritten to consume Projection data natively.
//
// Retire this adapter the day capabilityExtractor.ts is rewritten to read
// Projection data directly. Approved callers: lib/learnerIntelligence/blueprint.ts,
// lib/learnerIntelligence/careerIntelligence.ts, app/api/parent/career-intelligence/route.ts
// (Parent Intelligence Sprint 1), (Implementation Wave 3) app/api/career/capability-matches/route.ts
// and lib/career/careerIntelligenceEngine.ts, and (Phase H, capability-store
// consolidation) lib/career/careerEngine.ts's recomputeAndSaveCapabilityProfile
// — see docs/architecture/migration-ledger.md.
//
// `students.capability_profile` (getCapabilityProfile/recomputeAndSaveCapabilityProfile)
// still needs its own persisted snapshot history for /api/career/growth's
// trend view, which Projection does not keep — so it isn't folded into this
// shim's storage, only its computation. As of Phase H, its SOURCE is this
// same Projection-derived history, blended with the legacy `assessments`
// table (Academic Clinic intake, which does not yet emit an Evidence Domain
// row — migration-ledger.md, Implementation Wave 3) via
// projectionToTimestampedScoreHistory below, so neither source's signal is
// silently dropped. See docs/architecture/learner-record-layer-decisions.md
// Decision 8 (amended).

import type { LearnerIntelligenceProjection, RiskFlag } from '@/lib/projection/types'

export type TimestampedScoreSnapshot = { at: string; scores: Record<string, number> }

/**
 * Reconstructs subject-score snapshots (oldest first), WITH their original
 * timestamps, from the Academic Projection's per-subject evidence history.
 * Evidence rows sharing the same timestamp are treated as one multi-subject
 * snapshot. The timestamped form exists specifically so a caller can merge
 * this history with another chronological source (Phase H's legacy-table
 * blend) without losing true time ordering — see `projectionToScoreHistory`
 * below for the plain form most callers want.
 */
export function projectionToTimestampedScoreHistory(
  projection: LearnerIntelligenceProjection
): TimestampedScoreSnapshot[] {
  const bySubject = projection.academic?.value.bySubject ?? {}

  const snapshotsByTimestamp = new Map<string, Record<string, number>>()
  for (const [subject, performance] of Object.entries(bySubject)) {
    for (const entry of performance.history) {
      const snapshot = snapshotsByTimestamp.get(entry.at) ?? {}
      snapshot[subject] = entry.level
      snapshotsByTimestamp.set(entry.at, snapshot)
    }
  }

  return Array.from(snapshotsByTimestamp.entries())
    .sort(([a], [b]) => new Date(a).getTime() - new Date(b).getTime())
    .map(([at, scores]) => ({ at, scores }))
}

/**
 * Reconstructs subject-score snapshots (oldest first) from the Academic
 * Projection's per-subject evidence history, in the shape
 * extractCapabilityProfile() expects: one Record<subject, cbcLevel> per
 * assessment event.
 */
export function projectionToScoreHistory(
  projection: LearnerIntelligenceProjection
): Array<Record<string, number>> {
  return projectionToTimestampedScoreHistory(projection).map(s => s.scores)
}

/** Thin, permanent accessor — not a compatibility shim, no expiry. */
export function projectionRiskFlags(projection: LearnerIntelligenceProjection): RiskFlag[] {
  return projection.risk?.value.flags ?? []
}
