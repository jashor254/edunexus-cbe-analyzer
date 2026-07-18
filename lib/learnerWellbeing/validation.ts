// lib/learnerWellbeing/validation.ts
//
// Field-level validation only — presence and length checks, the same
// honest limitation Teacher Reflection's own validation already
// documents (ADR-0006 §6): whether a concern summary or outcome is
// written in appropriately factual, non-diagnostic language is human
// editorial judgment, never something automated validation can verify
// without an AI content-classification step — which ADR-0017 Phase 9
// forbids outright. No AI, no scoring, no emotional inference anywhere
// in this module (Stop Condition).

import type { WellbeingCaseFields } from './types'
import type { WellbeingVisibilityClassification } from '@/lib/repositories/wellbeing.repository'

const MAX_TEXT_LENGTH = 4000

export function validateWellbeingCaseFields(fields: WellbeingCaseFields): void {
  if (!fields.concernSummary || !fields.concernSummary.trim()) {
    throw new Error('Wellbeing: "concernSummary" is required.')
  }
  if (fields.concernSummary.length > MAX_TEXT_LENGTH) {
    throw new Error(`Wellbeing: "concernSummary" exceeds ${MAX_TEXT_LENGTH} characters.`)
  }
}

export function validateUpdateContent(content: string | null): void {
  if (content && content.length > MAX_TEXT_LENGTH) {
    throw new Error(`Wellbeing: update content exceeds ${MAX_TEXT_LENGTH} characters.`)
  }
}

/**
 * ADR-0017 Phase 8: "visibility only ever tightens, never loosens." An
 * individual update's classification, when explicitly set, must be
 * equal-or-stricter than the case's own default. `core_team` is the
 * strictest tier; `school_leadership` is the loosest this domain models
 * (there is no looser tier — "general school staff" has no access at
 * all, per ADR-0017 Phase 8, so it is not a valid classification value).
 */
export function validateVisibilityOverride(
  caseDefault: WellbeingVisibilityClassification,
  override: WellbeingVisibilityClassification | null
): void {
  if (override === null) return
  if (caseDefault === 'core_team' && override === 'school_leadership') {
    throw new Error('Wellbeing: an update may never be classified more loosely than its case\'s own default visibility (ADR-0017 Phase 8).')
  }
}
