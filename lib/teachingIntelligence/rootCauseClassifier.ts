import type { SubstrandHealthRow, RootCauseCode } from './types'

// Deterministic only. There used to be an AI fallback here for every row the
// rules below could not classify, asking Gemini to choose between
// PREREQUISITE_GAP, LANGUAGE_BARRIER, RESOURCE_MISMATCH and TEACHER_STRATEGY.
// Its only evidence was this row's three counters (lessons_covered,
// struggle_count, remediated) plus the sub-strand name — data that cannot
// distinguish any of those four causes from one another. The answer was a
// guess, persisted as substrand_health.root_cause and read downstream as a
// diagnosis (remedial planning, quick-check framing). See
// docs/audits/ai-call-efficiency-deep-audit.md F-05.
//
// When the evidence cannot tell, the honest answer is UNKNOWN — every
// consumer already handles it neutrally ("Needs revisiting"; a quick check
// framed as "revisit this concept in a different way").

// Rule-based heuristics: inspectable labels for the two patterns the counters
// genuinely describe. They are heuristics about pacing, not confirmed causes.
export function classifyRuleBased(row: SubstrandHealthRow): RootCauseCode | null {
  // Taught multiple times, still flagged, teacher hasn't remediated — pacing issue
  if (row.struggle_count >= 2 && !row.remediated) {
    return 'PACE_MISMATCH'
  }
  // First time this sub-strand was ever taught and already flagged — curriculum jumped too fast
  if (row.lessons_covered === 1 && row.struggle_count >= 1) {
    return 'CONCEPT_LEAP'
  }
  return null
}

export function classifyRootCause(row: SubstrandHealthRow): RootCauseCode {
  return classifyRuleBased(row) ?? 'UNKNOWN'
}
