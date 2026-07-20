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

import { getPortfolioSummary } from '@/lib/learnerPortfolio/portfolio'
import type { BlueprintSection, PortfolioData } from './types'

const OWNER = 'lib/learnerPortfolio/portfolio.getPortfolioSummary'

export async function composePortfolio(coreLearnerId: string, schoolId: string): Promise<BlueprintSection<PortfolioData>> {
  try {
    const summary = await getPortfolioSummary(coreLearnerId, schoolId)

    if (!summary.available) {
      return {
        status: 'unavailable',
        owner: OWNER,
        freshness: 'live',
        data: null,
        unavailableReason: 'This learner has no published Portfolio items yet.',
      }
    }

    const data: PortfolioData = {
      publishedCount: summary.publishedCount,
      latestItem: summary.latestItem,
      featuredItem: summary.featuredItem,
      // Sprint 6 — app/student/portfolio/[learnerId] now exists; the
      // summary itself still never carries a URL of its own (Portfolio
      // stays "compose, never own" all the way through), so Blueprint is
      // the one place that knows both the learner id and the real route.
      portfolioUrl: `/student/portfolio/${coreLearnerId}`,
    }

    return { status: 'available', owner: OWNER, freshness: 'live', data }
  } catch (error) {
    return {
      status: 'unavailable',
      owner: OWNER,
      freshness: 'live',
      data: null,
      unavailableReason: error instanceof Error ? error.message : 'Portfolio composition failed',
    }
  }
}
