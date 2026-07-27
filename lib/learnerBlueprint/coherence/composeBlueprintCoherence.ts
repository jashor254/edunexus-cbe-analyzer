// lib/learnerBlueprint/coherence/composeBlueprintCoherence.ts
//
// The one I/O wrapper around the pure validator — fetches the learner's
// approved Blueprint action items (the same read `composeRecommendedNextSteps
// .ts`'s canonical path and `projections.ts` already use:
// `repos.blueprintActionItems.listApprovedForLearner` + `toBlueprintActionItem`,
// no new query, no new table) and calls `validateBlueprintCoherence()`.
// This is the function `composeBlueprint()` calls; nothing else should
// need to fetch action items again just to validate coherence.
//
// No Supabase client / auth check here, deliberately — same reasoning as
// every other composer-support function Blueprint calls internally
// (`getLatestBlueprintSnapshot`, `listApprovedParentActionsForLearner`):
// the caller has already authorized access to compose this learner's
// Blueprint at all; this function's job is only to read+validate, never a
// second authorization decision.

import { repos } from '@/lib/repositories'
import { toBlueprintActionItem } from '@/lib/learnerBlueprint/actionPlan/types'
import type { LearnerBlueprint } from '@/lib/learnerBlueprint/types'
import type { CoherenceReport } from './types'
import { validateBlueprintCoherence } from './validateBlueprintCoherence'

export async function composeBlueprintCoherence(
  coreLearnerId: string,
  schoolId: string,
  blueprint: LearnerBlueprint
): Promise<CoherenceReport> {
  const rows = await repos.blueprintActionItems.listApprovedForLearner(coreLearnerId, schoolId)
  const actionItems = rows.map(toBlueprintActionItem)
  return validateBlueprintCoherence(blueprint, actionItems)
}
