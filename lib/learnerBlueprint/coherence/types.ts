// lib/learnerBlueprint/coherence/types.ts
//
// The Blueprint Intelligence Coherence Engine's own types (Phase 4A). This
// is a distinct concern from `lib/learnerBlueprint/validation.ts`'s
// `validateBlueprint()` — that function checks structural completeness
// (every section present, owner declared, metadata well-formed); this
// engine checks EDUCATIONAL coherence (does every claim/recommendation/
// action trace back to real Evidence/Projection without contradiction).
// A Blueprint can be structurally valid and educationally incoherent at
// the same time — the two reports are never merged into one.
//
// See docs/architecture/blueprint-intelligence-coherence-engine.md for the
// full reasoning-chain model (Evidence -> Projection -> Narrative ->
// Recommendation -> Action -> Review Goal) this engine checks links of.

export type CoherenceSeverity = 'warning' | 'critical'

export type CoherenceRuleId =
  | 'evidence_sufficiency'
  | 'narrative_alignment'
  | 'recommendation_alignment'
  | 'action_alignment'
  | 'career_alignment'
  | 'review_alignment'
  | 'friction_detection'

/** One diagnosed problem. Diagnosis only — never a rewritten value, per the phase's own rule ("validation diagnoses problems; it does not invent corrections"). */
export type CoherenceFinding = {
  rule: CoherenceRuleId
  severity: CoherenceSeverity
  /** Which Blueprint section, or which action item, this finding is about — e.g. 'learningStory', 'career', 'actionItem:<id>'. */
  section: string
  explanation: string
  /** A pointer to the evidence/projection/action fact that grounds this finding (evidence ids, a projection field name, an action item id) — never fabricated, always something the caller could look up. Null when the finding is about an absence (e.g. "no review date set"), which has nothing to point at. */
  evidenceReference: string | null
  /** What a human should check/change — never applied automatically. */
  suggestedCorrection: string
}

export type CoherenceResult = 'PASS' | 'PASS_WITH_WARNINGS' | 'FAIL'

export type CoherenceReport = {
  result: CoherenceResult
  findings: CoherenceFinding[]
  generatedAt: string
  /** Bumped whenever a rule's logic changes meaningfully — lets a caller/log distinguish "this Blueprint changed" from "the rules changed." */
  ruleVersion: string
}

export const COHERENCE_RULE_VERSION = '1.0.0'

/** A finding array in, a report out — the one place PASS/PASS_WITH_WARNINGS/FAIL is decided, so no rule module or caller ever re-derives this independently. */
export function toCoherenceReport(findings: CoherenceFinding[]): CoherenceReport {
  const hasCritical = findings.some(f => f.severity === 'critical')
  const hasWarning = findings.some(f => f.severity === 'warning')
  const result: CoherenceResult = hasCritical ? 'FAIL' : hasWarning ? 'PASS_WITH_WARNINGS' : 'PASS'
  return {
    result,
    findings,
    generatedAt: new Date().toISOString(),
    ruleVersion: COHERENCE_RULE_VERSION,
  }
}
