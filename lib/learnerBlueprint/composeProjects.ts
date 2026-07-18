// lib/learnerBlueprint/composeProjects.ts
//
// Projects -> one canonical read only (ADR-0013 Phase 2/6). Reads via
// `getProjectsSummary()` (lib/learnerProjects/project.ts) only — never the
// repository or raw tables directly, and never more than the summary
// shape that function already caps itself to (count, latest published,
// current active, featured, URL). Blueprint never renders a full project
// record, never exposes internal lifecycle state (ADR-0013 Phase 6:
// "never expose internal lifecycle") — the identical discipline
// composePortfolio.ts/composeAchievement.ts already apply.
//
// Projects is keyed on the Core learner directly (`learners.id`), like
// Portfolio/Achievement — no legacy `students.id` space to resolve.

import { getProjectsSummary } from '@/lib/learnerProjects/project'
import type { BlueprintSection, ProjectsData } from './types'

const OWNER = 'lib/learnerProjects/project.getProjectsSummary'

export async function composeProjects(coreLearnerId: string, schoolId: string): Promise<BlueprintSection<ProjectsData>> {
  try {
    const summary = await getProjectsSummary(coreLearnerId, schoolId)

    if (!summary.available) {
      return {
        status: 'unavailable',
        owner: OWNER,
        freshness: 'live',
        data: null,
        unavailableReason: 'This learner has no published or active projects yet.',
      }
    }

    const data: ProjectsData = {
      projectCount: summary.projectCount,
      latestPublishedProject: summary.latestPublishedProject,
      currentActiveProject: summary.currentActiveProject,
      featuredProject: summary.featuredProject,
      projectsUrl: summary.projectsUrl,
    }

    return { status: 'available', owner: OWNER, freshness: 'live', data }
  } catch (error) {
    return {
      status: 'unavailable',
      owner: OWNER,
      freshness: 'live',
      data: null,
      unavailableReason: error instanceof Error ? error.message : 'Projects composition failed',
    }
  }
}
