// lib/learnerBlueprint/coherence/rules/careerAlignment.ts
//
// Rule 5 — Career Alignment. `capabilityMatchEngine.ts`'s `buildMatchNarrative()`
// already appends a confidence caveat whenever confidence !== 'High'
// (lines ~180-181 at the time of the Phase 4 audit) — this rule verifies
// that invariant holds in the composed Blueprint rather than assuming the
// composer will never regress it, and flags the case Career Intelligence's
// own design was built to prevent: confident-sounding career language
// while confidence is intentionally low.

import type { LearnerBlueprint } from '@/lib/learnerBlueprint/types'
import type { CoherenceFinding } from '../types'

// Deterministic hedge-word set — the same vocabulary buildMatchNarrative()
// itself already uses for its confidence caveat. Not exhaustive prose
// analysis, just a check that SOME hedge made it into the text.
const HEDGE_MARKERS = ['provisional', 'low because', 'small number of assessments', 'confidence is low', 'evidence arrives', 'this will sharpen']

function hasHedge(text: string): boolean {
  const lower = text.toLowerCase()
  return HEDGE_MARKERS.some(marker => lower.includes(marker))
}

export function checkCareerAlignment(blueprint: LearnerBlueprint): CoherenceFinding[] {
  const findings: CoherenceFinding[] = []
  if (blueprint.career.status !== 'available' || !blueprint.career.data) return findings

  const career = blueprint.career.data
  const narrative = `${career.strengthProfile ?? ''} ${career.futureDirection ?? ''}`.trim()
  if (narrative.length === 0) return findings

  if (career.confidence === 'Low' && !hasHedge(narrative)) {
    findings.push({
      rule: 'career_alignment',
      severity: 'warning',
      section: 'career',
      explanation: `Career confidence is "Low" but the composed career narrative ("${narrative}") contains no hedging language acknowledging that — it reads with more certainty than the evidence supports.`,
      evidenceReference: 'career.confidence',
      suggestedCorrection: 'Ensure buildMatchNarrative()\'s confidence caveat is present whenever confidence !== \'High\' — this may indicate a regression in that composer.',
    })
  }

  if (career.confidence === null) {
    findings.push({
      rule: 'career_alignment',
      severity: 'warning',
      section: 'career',
      explanation: `Career narrative ("${narrative}") makes a career-fit claim with no confidence label at all — a claim with no stated confidence is itself a coherence gap.`,
      evidenceReference: null,
      suggestedCorrection: 'Attach a confidence label to every rendered career claim, or suppress the narrative when confidence cannot be computed.',
    })
  }

  return findings
}
