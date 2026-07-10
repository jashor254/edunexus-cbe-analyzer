// lib/intelligence/confidence.ts
// Confidence scoring stage, per docs/architecture/intelligence-ingestion-engine.md
// §2 (confidence scoring) and learner-intelligence-engineering-principles.md
// LI-6 (evidence quality gates are explicit, not implicit).
//
// Final confidence is the minimum of: identity-match confidence, field-validation
// confidence, and the source's declared trust-tier ceiling — a source can never
// produce evidence more confident than its tier allows, regardless of how clean
// an individual row looks.

import type { EvidenceSource } from './evidence'
import { EVIDENCE_SOURCE_TRUST_TIER } from './evidence'
import type { IdentityMatchType } from './identityResolution'

/** Below this, evidence is never auto-confirmed — always pending_review. */
export const AUTO_CONFIRM_THRESHOLD = 85

const TRUST_TIER_CEILING: Record<1 | 2 | 3, number> = {
  1: 60,   // tier-1 sources (AI-inferred, unverified observation) can never auto-confirm
  2: 95,
  3: 100,
}

export function computeConfidence(input: {
  identityConfidence: number
  identityMatchType: IdentityMatchType
  fieldIssueCount: number
  source: EvidenceSource
}): number {
  if (input.identityMatchType === 'none') return 0

  // Each field issue (out-of-range score, unmapped subject, etc.) is a real
  // reason for doubt — not a hard block, but a meaningful confidence penalty.
  const fieldConfidence = Math.max(0, 100 - input.fieldIssueCount * 20)

  const tier = EVIDENCE_SOURCE_TRUST_TIER[input.source]
  const ceiling = TRUST_TIER_CEILING[tier]

  return Math.min(input.identityConfidence, fieldConfidence, ceiling)
}

export function resolveReviewStatus(confidence: number): 'auto_confirmed' | 'pending_review' {
  return confidence >= AUTO_CONFIRM_THRESHOLD ? 'auto_confirmed' : 'pending_review'
}
