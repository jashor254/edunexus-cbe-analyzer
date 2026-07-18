// lib/learnerPortfolio/portfolioProjectLink.ts
//
// ADR-0013 "Relationship to ADR-0011" — the one canonical resolver for
// "what does this Portfolio item's `projects` category actually point at."
// Portfolio references Projects, never duplicates it (ADR-0013 Phase 2/7):
// this function reads `learner_projects` via the repository directly (a
// minimal reference lookup, not a business mutation) and returns only a
// highlight, never a full Project record.
//
// Never fabricates a link — a `projects`-category item with no `project_id`
// set is `reserved`, not silently treated as if a project existed.

import { repos } from '@/lib/repositories'
import type { PortfolioItem } from './types'
import type { PortfolioProjectReference } from '@/lib/learnerProjects/types'

export async function resolveProjectReference(item: PortfolioItem, schoolId: string): Promise<PortfolioProjectReference> {
  if (item.category !== 'projects') {
    return { status: 'not_applicable' }
  }
  if (!item.projectId) {
    return { status: 'reserved' }
  }

  const project = await repos.projects.findById(item.projectId, schoolId)
  if (!project) {
    // The link points at a project that no longer resolves in this school
    // scope — never fabricate a reference to something that isn't really
    // there; treat identically to "not yet linked."
    return { status: 'reserved' }
  }

  return {
    status: 'linked',
    project: { title: project.title, category: project.category, publishedAt: project.published_at },
  }
}
