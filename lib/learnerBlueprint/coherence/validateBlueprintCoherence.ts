// lib/learnerBlueprint/coherence/validateBlueprintCoherence.ts
//
// The pure orchestrator — no I/O, no Supabase client, no network. Runs
// every deterministic coherence rule against an already-composed Blueprint
// plus its learner's already-fetched approved action items, and reduces
// the findings into one canonical PASS/PASS_WITH_WARNINGS/FAIL report.
// Keeping this pure (vs. `composeBlueprintCoherence.ts`, which does the
// fetch) is what makes every rule deterministically, cheaply unit-testable
// with hand-built fixtures — no live database required.

import type { LearnerBlueprint } from '@/lib/learnerBlueprint/types'
import type { BlueprintActionItem } from '@/lib/learnerBlueprint/actionPlan/types'
import type { CoherenceReport } from './types'
import { toCoherenceReport } from './types'
import { checkEvidenceSufficiency } from './rules/evidenceSufficiency'
import { checkNarrativeAlignment } from './rules/narrativeAlignment'
import { checkRecommendationAlignment } from './rules/recommendationAlignment'
import { checkActionAlignment } from './rules/actionAlignment'
import { checkCareerAlignment } from './rules/careerAlignment'
import { checkReviewAlignment } from './rules/reviewAlignment'
import { checkFrictionDetection } from './rules/frictionDetection'

export function validateBlueprintCoherence(
  blueprint: LearnerBlueprint,
  actionItems: BlueprintActionItem[]
): CoherenceReport {
  const findings = [
    ...checkEvidenceSufficiency(blueprint),
    ...checkNarrativeAlignment(blueprint),
    ...checkRecommendationAlignment(blueprint, actionItems),
    ...checkActionAlignment(actionItems),
    ...checkCareerAlignment(blueprint),
    ...checkReviewAlignment(actionItems),
    ...checkFrictionDetection(blueprint, actionItems),
  ]

  return toCoherenceReport(findings)
}
