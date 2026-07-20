// lib/learnerBlueprint/composeAchievement.ts
//
// Achievement -> one canonical read only (ADR-0012 Phase 6/7). Reads via
// `getAchievementSummary()` (lib/learnerAchievement/achievement.ts) only —
// never the repository or raw tables directly, and never more than the
// summary shape that function already caps itself to (count, latest
// verified, highest-level, URL, availability). Blueprint never renders a
// full achievement record, never recomputes a count independently of
// Achievement's own canonical count — the identical discipline
// composePortfolio.ts already applies one layer earlier (ADR-0012 Phase 6:
// "Portfolio composes Achievement... Blueprint owns nothing achievement-
// related" applied here to Blueprint's own direct read).
//
// Achievement is keyed on the Core learner directly (`learners.id`), like
// Portfolio — no legacy `students.id` space to resolve.

import { getAchievementSummary } from '@/lib/learnerAchievement/achievement'
import type { BlueprintSection, AchievementData } from './types'

const OWNER = 'lib/learnerAchievement/achievement.getAchievementSummary'

export async function composeAchievement(coreLearnerId: string, schoolId: string): Promise<BlueprintSection<AchievementData>> {
  try {
    const summary = await getAchievementSummary(coreLearnerId, schoolId)

    if (!summary.available) {
      return {
        status: 'unavailable',
        owner: OWNER,
        freshness: 'live',
        data: null,
        unavailableReason: 'This learner has no published achievements yet.',
      }
    }

    const data: AchievementData = {
      achievementCount: summary.achievementCount,
      latestVerifiedAchievement: summary.latestVerifiedAchievement,
      highestLevelAchievement: summary.highestLevelAchievement,
      // Sprint 6 — app/student/achievements/[learnerId] now exists; same
      // reasoning as composePortfolio.ts's portfolioUrl.
      profileUrl: `/student/achievements/${coreLearnerId}`,
    }

    return { status: 'available', owner: OWNER, freshness: 'live', data }
  } catch (error) {
    return {
      status: 'unavailable',
      owner: OWNER,
      freshness: 'live',
      data: null,
      unavailableReason: error instanceof Error ? error.message : 'Achievement composition failed',
    }
  }
}
