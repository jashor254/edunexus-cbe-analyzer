// lib/learnerBlueprint/coherence/rules/reviewAlignment.ts
//
// Rule 6 — Review Alignment. Every approved action must define an expected
// outcome (`intendedOutcome`) and an observable indicator
// (`successIndicator`) — both already required non-empty at write time
// (validation.ts) — plus a future review condition (`reviewDate`), which
// is nullable at the schema level and therefore the one part of this
// chain the compiler must actually check, not just re-verify.

import type { BlueprintActionItem } from '@/lib/learnerBlueprint/actionPlan/types'
import type { CoherenceFinding } from '../types'

const MIN_SUCCESS_INDICATOR_LENGTH = 25
// A tiny, explicit denylist of maximally-generic phrasing — deliberately
// narrow to avoid false positives on a real, specific indicator that
// happens to be short.
const GENERIC_SUCCESS_INDICATOR_PATTERNS = [
  /^shows? improvement$/i,
  /^improves?$/i,
  /^gets better$/i,
  /^does better$/i,
]

function isGenericSuccessIndicator(text: string): boolean {
  const trimmed = text.trim()
  if (trimmed.length < MIN_SUCCESS_INDICATOR_LENGTH) return true
  return GENERIC_SUCCESS_INDICATOR_PATTERNS.some(pattern => pattern.test(trimmed))
}

export function checkReviewAlignment(actionItems: BlueprintActionItem[]): CoherenceFinding[] {
  const findings: CoherenceFinding[] = []

  for (const item of actionItems) {
    // "future review condition" — reviewDate is nullable at the schema
    // level; an approved action with none has no defined moment to revisit it.
    if (!item.reviewDate) {
      findings.push({
        rule: 'review_alignment',
        severity: 'warning',
        section: `actionItem:${item.id}`,
        explanation: `Action "${item.title}" has no reviewDate — it defines an expected outcome and success indicator, but no future point at which either will be checked.`,
        evidenceReference: null,
        suggestedCorrection: 'Set a reviewDate when approving this action, so it appears for review at a defined point rather than only when a teacher happens to revisit it.',
      })
    }

    // "generic actions without review criteria" — a maximally-generic
    // success indicator gives a future reviewer nothing concrete to check
    // against, even though the field is technically non-empty.
    if (isGenericSuccessIndicator(item.successIndicator)) {
      findings.push({
        rule: 'review_alignment',
        severity: 'critical',
        section: `actionItem:${item.id}`,
        explanation: `Action "${item.title}"'s success indicator ("${item.successIndicator}") is too generic to be checked against evidence — it does not say what "improvement" would actually look like.`,
        evidenceReference: null,
        suggestedCorrection: 'Rewrite the success indicator to name a specific, observable change (e.g. a CBC level, a score range, a specific behaviour) rather than an unqualified "improves."',
      })
    }
  }

  return findings
}
