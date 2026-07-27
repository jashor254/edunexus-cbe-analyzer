// lib/learnerBlueprint/coherence/rules/textSignals.ts
//
// Small, shared, explicit text-matching vocabulary used by more than one
// coherence rule. Deliberately not an LLM classifier or a general
// sentiment model — a short, auditable word list, per this phase's own
// rule ("use explicit educational rules first"). Coupled to this
// codebase's real composer wording as of the Phase 4 audit; see the
// engine doc's Residual Risks for what that coupling costs.

export const DEFICIENCY_MARKERS = [
  'below the level expected', 'below expectation', 'struggl', 'weak', 'needs improvement',
  'needs support', 'behind', 'not meeting', 'underperform', 'gap in', 'comprehension gap',
  // Phase 4B.1 — composeLearningStory's/composeParentSummary's own real
  // remediation-register phrasing, so a genuine remediation claim on a
  // strong/max-level subject is still caught by these markers.
  'least secure', 'insecure', 'needing attention', 'needs attention',
]

export const STRENGTH_MARKERS = [
  'exceptional', 'exceeding', 'strong', 'excelling', 'ahead', 'mastery', 'outstanding',
]

export function normalizeSubject(subject: string): string {
  return subject.toLowerCase().replace(/[_-]+/g, ' ').trim()
}

/**
 * Subject codes in this codebase (e.g. `kiswahili_lugha`) are often
 * compound, but a teacher's own plain-language rationale usually names
 * only the everyday part ("Kiswahili," not "Kiswahili Lugha"). Matching
 * only the full normalized string would silently never fire on real
 * teacher-authored text — so this also matches on any single word (4+
 * characters, to skip trivial words) from the normalized subject.
 */
export function textMentionsSubject(text: string, subject: string): boolean {
  const lower = text.toLowerCase()
  const normalized = normalizeSubject(subject)
  if (lower.includes(normalized)) return true
  return normalized.split(' ').some(word => word.length >= 4 && lower.includes(word))
}

export function textAssertsDeficiency(text: string): boolean {
  const lower = text.toLowerCase()
  return DEFICIENCY_MARKERS.some(marker => lower.includes(marker))
}

export function textAssertsStrength(text: string): boolean {
  const lower = text.toLowerCase()
  return STRENGTH_MARKERS.some(marker => lower.includes(marker))
}
