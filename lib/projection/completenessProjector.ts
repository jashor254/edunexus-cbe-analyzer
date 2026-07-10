// lib/projection/completenessProjector.ts
// A meta-projection about the evidence itself: how much exists, how
// diverse, how fresh — so consumers can decide whether the OTHER
// projections are strong enough to display, per the engine's design goal.

import type { EvidenceRow } from '@/lib/repositories/evidence.repository'
import type { Projection, CompletenessValue } from './types'
import { computeCoverage, computeProjectionConfidence } from './coverage'

export const COMPLETENESS_PROJECTION_VERSION = 'completeness-v1'

// A learner with evidence across this many distinct subjects is considered
// to have full subject-coverage credit. Matches the existing platform
// convention in app/api/assessments/create/route.ts's "at least 5 subject
// scores" validation rule, reused here for consistency rather than picking
// a new number.
const EXPECTED_SUBJECT_COUNT = 5
const FRESHNESS_FULL_CREDIT_DAYS = 30
const FRESHNESS_ZERO_CREDIT_DAYS = 180
const FULL_CREDIT_SOURCE_DIVERSITY = 2

export function projectCompleteness(evidence: EvidenceRow[], now: Date = new Date()): Projection<CompletenessValue> | null {
  if (evidence.length === 0) return null

  const coverage = computeCoverage(evidence, now)
  const subjectsCovered = [...new Set(evidence.map(e => e.subject))]

  const subjectComponent = Math.min(100, (subjectsCovered.length / EXPECTED_SUBJECT_COUNT) * 100)
  const sourceComponent = Math.min(100, (coverage.evidenceDiversity / FULL_CREDIT_SOURCE_DIVERSITY) * 100)
  const freshnessComponent = coverage.freshnessDays === null
    ? 0
    : coverage.freshnessDays <= FRESHNESS_FULL_CREDIT_DAYS
      ? 100
      : coverage.freshnessDays >= FRESHNESS_ZERO_CREDIT_DAYS
        ? 0
        : 100 * (1 - (coverage.freshnessDays - FRESHNESS_FULL_CREDIT_DAYS) / (FRESHNESS_ZERO_CREDIT_DAYS - FRESHNESS_FULL_CREDIT_DAYS))

  const completenessScore = Math.round((subjectComponent + sourceComponent + freshnessComponent) / 3)

  return {
    value: {
      subjectsCovered,
      totalEvidenceCount: evidence.length,
      sourceDiversity: coverage.evidenceDiversity,
      completenessScore,
    },
    supportingEvidenceIds: evidence.map(e => e.id),
    confidence: computeProjectionConfidence(evidence),
    coverage,
    lastComputed: now.toISOString(),
    projectionVersion: COMPLETENESS_PROJECTION_VERSION,
  }
}
