// lib/learnerIntelligence/canonicalCapability.ts
//
// H2D Decision A (docs/architecture/adr-0029-addendum-h2d-capability-convergence.md).
// The one function Monday Panel (app/api/teacher/monday-panel/route.ts) and
// Attention Feed (lib/attentionFeed/panel.ts) both call to derive a
// learner's 6-dimension capability profile for teacher-facing display —
// replacing two separate direct reads of the raw, unfiltered
// `learner_profiles.capability_dimensions` column (sourced from the legacy
// `assessments` table, no admissibility lifecycle).
//
// This is intentionally not a new computation: it is the same
// extractCapabilityProfile() formula every other canonical consumer
// (Career Intelligence, careerIntelligenceEngine.ts) already uses, fed via
// the same sanctioned Projection adapter (projectionToScoreHistory) —
// ADR-0029 §3.3/§3.10's already-named owner of the 6-dimension breakdown,
// now reused here instead of duplicated inline.
import type { LearnerIntelligenceProjection } from '@/lib/projection/types'
import type { CapabilityProfile } from '@/lib/career/types'
import { extractCapabilityProfile } from '@/lib/career/capabilityExtractor'
import { projectionToScoreHistory } from '@/lib/learnerIntelligence/projectionAdapters'

/**
 * Derives the canonical, evidence-admissible 6-dimension capability profile
 * from an already-computed Projection. Returns null when there is no
 * admissible academic evidence yet — never a fabricated profile.
 */
export function canonicalCapabilityFor(
  projection: LearnerIntelligenceProjection | null | undefined
): CapabilityProfile | null {
  if (!projection) return null
  const scoreHistory = projectionToScoreHistory(projection)
  return scoreHistory.length > 0 ? extractCapabilityProfile(scoreHistory) : null
}
