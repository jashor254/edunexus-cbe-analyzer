// lib/learnerIntelligence/projectionAdapters.ts
//
// TEMPORARY COMPATIBILITY SHIM — Phase 4 only.
//
// `projectionToScoreHistory` exists solely to bridge the legacy
// `extractCapabilityProfile()` formula (lib/career/capabilityExtractor.ts)
// onto Projection-sourced data, so Blueprint and Career Intelligence can stop
// querying raw assessment history directly while the underlying 6-dimension
// formula itself is not yet rewritten to consume Projection data natively.
//
// Retire this the moment capabilityExtractor.ts is retired or rewritten to
// read Projection data directly. Approved callers: lib/learnerIntelligence/blueprint.ts,
// lib/learnerIntelligence/careerIntelligence.ts, and (Parent Intelligence
// Sprint 1) app/api/parent/career-intelligence/route.ts — see
// docs/architecture/migration-ledger.md.

import type { LearnerIntelligenceProjection, RiskFlag } from '@/lib/projection/types'

/**
 * Reconstructs subject-score snapshots (oldest first) from the Academic
 * Projection's per-subject evidence history, in the shape
 * extractCapabilityProfile() expects: one Record<subject, cbcLevel> per
 * assessment event. Evidence rows sharing the same timestamp are treated as
 * one multi-subject snapshot.
 */
export function projectionToScoreHistory(
  projection: LearnerIntelligenceProjection
): Array<Record<string, number>> {
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
    .map(([, snapshot]) => snapshot)
}

/** Thin, permanent accessor — not a compatibility shim, no expiry. */
export function projectionRiskFlags(projection: LearnerIntelligenceProjection): RiskFlag[] {
  return projection.risk?.value.flags ?? []
}
