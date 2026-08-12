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
//
// The availability/failure wrapper lives in `summarySection.ts`, shared
// with composePortfolio.ts — this file owns only Achievement's field
// mapping and its learner-facing copy.

import { getAchievementSummary } from '@/lib/learnerAchievement/achievement'
import { composeSummarySection } from './summarySection'
import type { BlueprintSection, AchievementData } from './types'

const OWNER = 'lib/learnerAchievement/achievement.getAchievementSummary'

export function composeAchievement(coreLearnerId: string, schoolId: string): Promise<BlueprintSection<AchievementData>> {
  return composeSummarySection({
    owner: OWNER,
    load: () => getAchievementSummary(coreLearnerId, schoolId),
    emptyReason: 'This learner has no published achievements yet.',
    failureReason: 'Achievement composition failed',
    map: summary => ({
      achievementCount: summary.achievementCount,
      latestVerifiedAchievement: summary.latestVerifiedAchievement,
      highestLevelAchievement: summary.highestLevelAchievement,
      // Sprint 6 — app/student/achievements/[learnerId] now exists; same
      // reasoning as composePortfolio.ts's portfolioUrl.
      profileUrl: `/student/achievements/${coreLearnerId}`,
    }),
  })
}
