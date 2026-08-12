// lib/learnerBlueprint/composePortfolio.ts
//
// Portfolio -> one canonical read only (ADR-0011 Phase 4). Reads via
// `getPortfolioSummary()` (lib/learnerPortfolio/portfolio.ts) only —
// never the repository or raw tables directly, and never more than the
// summary shape that function already caps itself to (counts/highlights).
// Blueprint never duplicates a Portfolio entry's content, never re-renders
// a project description, never recomputes a published count independently
// of Portfolio's own canonical count (ADR-0011 Phase 4, restated).
//
// Portfolio is keyed on the Core learner directly (`learners.id`) — unlike
// Career/Compass/Academic Record, it has no legacy `students.id` space to
// resolve, so this composer needs no `resolveLegacyStudentId` call.
//
// The availability/failure wrapper lives in `summarySection.ts`, shared
// with composeAchievement.ts — this file owns only Portfolio's field
// mapping and its learner-facing copy.

import { getPortfolioSummary } from '@/lib/learnerPortfolio/portfolio'
import { composeSummarySection } from './summarySection'
import type { BlueprintSection, PortfolioData } from './types'

const OWNER = 'lib/learnerPortfolio/portfolio.getPortfolioSummary'

export function composePortfolio(coreLearnerId: string, schoolId: string): Promise<BlueprintSection<PortfolioData>> {
  return composeSummarySection({
    owner: OWNER,
    load: () => getPortfolioSummary(coreLearnerId, schoolId),
    emptyReason: 'This learner has no published Portfolio items yet.',
    failureReason: 'Portfolio composition failed',
    map: summary => ({
      publishedCount: summary.publishedCount,
      latestItem: summary.latestItem,
      featuredItem: summary.featuredItem,
      // Sprint 6 — app/student/portfolio/[learnerId] now exists; the
      // summary itself still never carries a URL of its own (Portfolio
      // stays "compose, never own" all the way through), so Blueprint is
      // the one place that knows both the learner id and the real route.
      portfolioUrl: `/student/portfolio/${coreLearnerId}`,
    }),
  })
}
