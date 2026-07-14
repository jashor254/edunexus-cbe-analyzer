// lib/projection/coverage.ts
// Shared, deterministic coverage/confidence aggregation used by every
// projector — one formula, not seven slightly different ones.

import type { EvidenceRow } from '@/lib/repositories/evidence.repository'
import type { EvidenceCoverage } from './types'

const MS_PER_DAY = 1000 * 60 * 60 * 24

/**
 * Deltas smaller than this (on the 0-1 normalized level scale) are treated
 * as noise, not a real trend. Shared by every projector that classifies
 * movement (growthProjector, capabilityV2Projector, trendProjector) — one
 * threshold, not three independently-maintained copies of the same number.
 */
export const STABLE_THRESHOLD = 0.05

export function computeCoverage(evidence: EvidenceRow[], now: Date = new Date()): EvidenceCoverage {
  if (evidence.length === 0) {
    return { evidenceCount: 0, evidenceDiversity: 0, latestEvidenceAt: null, oldestEvidenceAt: null, freshnessDays: null }
  }
  const sources = new Set(evidence.map(e => e.evidence_source))
  const timestamps = evidence.map(e => new Date(e.created_at).getTime()).sort((a, b) => a - b)
  const oldest = timestamps[0]
  const latest = timestamps[timestamps.length - 1]

  return {
    evidenceCount: evidence.length,
    evidenceDiversity: sources.size,
    latestEvidenceAt: new Date(latest).toISOString(),
    oldestEvidenceAt: new Date(oldest).toISOString(),
    freshnessDays: Math.round((now.getTime() - latest) / MS_PER_DAY),
  }
}

/**
 * Normalizes a 1-4 CBC level onto a 0-1 scale. Shared by every projector that
 * needs a continuous value from a discrete level (Capability, Growth) — one
 * formula, not two independently-maintained copies.
 */
export function normalizeLevelToUnit(level: number): number {
  return Math.max(0, Math.min(1, (level - 1) / 3))
}

/**
 * Deterministic confidence for a projection, given its supporting evidence.
 * Formula (documented, versioned by the caller's projectionVersion string,
 * not by this function — this function itself is not independently
 * versioned since it's shared infrastructure, not a projection rule):
 *   base       = mean(evidence_confidence) across supporting evidence
 *   count factor = evidence count scaled 0..1, reaching 1.0 at 3+ pieces
 *                  (a single low-corroboration data point should never
 *                  produce full confidence, regardless of how confident
 *                  that one record's own extraction was)
 *   conflict factor = halved when any supporting evidence carries
 *                  verification_state === 'contradicted' (see
 *                  lib/intelligence/evidenceLifecycle.ts's
 *                  flagContradictionIfAny) — genuine disagreement between
 *                  two confirmed sources must read as real uncertainty, not
 *                  be silently averaged away by whichever arrived last.
 *   result     = base * countFactor * conflictFactor, capped [0, 100]
 */
export function computeProjectionConfidence(evidence: EvidenceRow[]): number {
  if (evidence.length === 0) return 0
  const base = evidence.reduce((sum, e) => sum + e.evidence_confidence, 0) / evidence.length
  const countFactor = Math.min(1, evidence.length / 3)
  const hasContradiction = evidence.some(e => e.verification_state === 'contradicted')
  const conflictFactor = hasContradiction ? 0.5 : 1
  return Math.round(base * countFactor * conflictFactor)
}
