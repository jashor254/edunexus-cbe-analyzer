// lib/learnerBlueprint/composeInnovation.ts
//
// Innovation -> one canonical read only (mission Phase 6). Reads via
// `getInnovationsSummary()` (lib/learnerInnovation/innovation.ts) only —
// never the repository or raw tables directly, and never more than the
// summary shape that function already caps itself to (availability,
// current stage, iteration count, latest milestone, latest implementation
// date, URL). Blueprint never renders a full Innovation record, never
// exposes iteration history, teacher notes, internal review, artifacts,
// or testing data — the identical discipline
// composeCompetitions.ts/composeLeadership.ts already apply.
//
// Innovation is keyed on the Core learner directly (`learners.id`), like
// every sibling domain except legacy-space Academic Record/Compass/Career
// — no legacy `students.id` space to resolve.

import { getInnovationsSummary } from '@/lib/learnerInnovation/innovation'
import type { BlueprintSection, InnovationsData } from './types'

const OWNER = 'lib/learnerInnovation/innovation.getInnovationsSummary'

export async function composeInnovation(coreLearnerId: string, schoolId: string): Promise<BlueprintSection<InnovationsData>> {
  try {
    const summary = await getInnovationsSummary(coreLearnerId, schoolId)

    if (!summary.available) {
      return {
        status: 'unavailable',
        owner: OWNER,
        freshness: 'live',
        data: null,
        unavailableReason: 'This learner has no implemented or in-progress innovations yet.',
      }
    }

    const data: InnovationsData = {
      currentStage: summary.currentStage,
      iterationCount: summary.iterationCount,
      latestMilestone: summary.latestMilestone,
      latestImplementationDate: summary.latestImplementationDate,
      innovationsUrl: summary.innovationsUrl,
    }

    return { status: 'available', owner: OWNER, freshness: 'live', data }
  } catch (error) {
    return {
      status: 'unavailable',
      owner: OWNER,
      freshness: 'live',
      data: null,
      unavailableReason: error instanceof Error ? error.message : 'Innovation composition failed',
    }
  }
}
