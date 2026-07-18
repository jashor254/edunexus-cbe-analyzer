// lib/learnerBlueprint/composeCompetitions.ts
//
// Competitions -> one canonical read only (mission Phase 7). Reads via
// `getCompetitionsSummary()` (lib/learnerCompetitions/competition.ts)
// only — never the repository or raw tables directly, and never more
// than the summary shape that function already caps itself to (total,
// verified count, latest, current participation, URL). Blueprint never
// renders a full Competition Entry, never exposes judging or raw
// feedback, never exposes unpublished work — the identical discipline
// composePortfolio.ts/composeAchievement.ts/composeProjects.ts already
// apply.
//
// Competitions is keyed on the Core learner directly (`learners.id`),
// like Portfolio/Achievement/Projects — no legacy `students.id` space to
// resolve.

import { getCompetitionsSummary } from '@/lib/learnerCompetitions/competition'
import type { BlueprintSection, CompetitionsData } from './types'

const OWNER = 'lib/learnerCompetitions/competition.getCompetitionsSummary'

export async function composeCompetitions(coreLearnerId: string, schoolId: string): Promise<BlueprintSection<CompetitionsData>> {
  try {
    const summary = await getCompetitionsSummary(coreLearnerId, schoolId)

    if (!summary.available) {
      return {
        status: 'unavailable',
        owner: OWNER,
        freshness: 'live',
        data: null,
        unavailableReason: 'This learner has no published or in-progress competitions yet.',
      }
    }

    const data: CompetitionsData = {
      totalCompetitions: summary.totalCompetitions,
      verifiedCompetitions: summary.verifiedCompetitions,
      latestCompetition: summary.latestCompetition,
      currentParticipation: summary.currentParticipation,
      competitionsUrl: summary.competitionsUrl,
    }

    return { status: 'available', owner: OWNER, freshness: 'live', data }
  } catch (error) {
    return {
      status: 'unavailable',
      owner: OWNER,
      freshness: 'live',
      data: null,
      unavailableReason: error instanceof Error ? error.message : 'Competitions composition failed',
    }
  }
}
