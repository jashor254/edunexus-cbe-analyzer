// lib/learnerPortfolio/types.ts
//
// The canonical Learner Portfolio domain types (Sprint 12V, ADR-0011).
// Categories deliberately exclude every concept ADR-0012 assigns to the
// Achievement domain (Awards, Certificates, Leadership, Competitions,
// Community Service, Innovation) — Portfolio owns only the raw,
// unverified artefact, never a verifiable claim.

import type {
  PortfolioCategory,
  PortfolioItemStatus,
  PortfolioItemRow,
  PortfolioMediaRow,
  PortfolioTagRow,
} from '@/lib/repositories/portfolio.repository'

export type { PortfolioCategory, PortfolioItemStatus }

export const PORTFOLIO_CATEGORIES: readonly PortfolioCategory[] = [
  'projects', 'creative_work', 'research', 'presentations',
  'writing', 'design', 'photography', 'programming', 'media', 'other',
]

export type PortfolioItemFields = {
  category: PortfolioCategory
  title: string
  description: string | null
  reflection: string | null
  supportingEvidenceIds: string[]
}

export type PortfolioItem = {
  id: string
  portfolioId: string
  learnerId: string
  category: PortfolioCategory
  title: string
  description: string | null
  reflection: string | null
  supportingEvidenceIds: string[]
  status: PortfolioItemStatus
  createdBy: string | null
  verifiedBy: string | null
  verifiedAt: string | null
  rejectedReason: string | null
  publishedAt: string | null
  archivedAt: string | null
  createdAt: string
  updatedAt: string
  media: { url: string; label: string | null }[]
  tags: string[]
  /** ADR-0013 "Relationship to ADR-0011" — set only for `projects`-category items linked to a real Project. Never fabricated: null means unlinked, not "no project exists." */
  projectId: string | null
}

/**
 * Blueprint's field budget for Portfolio (ADR-0011 Phase 4) — counts and
 * highlights only, never full artefact content. This is the one shape
 * `composePortfolio()` is allowed to return.
 */
export type PortfolioSummary = {
  available: boolean
  publishedCount: number
  latestItem: { title: string; category: PortfolioCategory; publishedAt: string } | null
  featuredItem: { title: string; category: PortfolioCategory; publishedAt: string } | null
  portfolioUrl: string | null
}

export function toPortfolioItem(
  row: PortfolioItemRow,
  media: PortfolioMediaRow[],
  tags: PortfolioTagRow[]
): PortfolioItem {
  return {
    id: row.id,
    portfolioId: row.portfolio_id,
    learnerId: row.learner_id,
    category: row.category,
    title: row.title,
    description: row.description,
    reflection: row.reflection,
    supportingEvidenceIds: row.supporting_evidence_ids,
    status: row.status,
    createdBy: row.created_by,
    verifiedBy: row.verified_by,
    verifiedAt: row.verified_at,
    rejectedReason: row.rejected_reason,
    publishedAt: row.published_at,
    archivedAt: row.archived_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    media: media.map(m => ({ url: m.url, label: m.label })),
    tags: tags.map(t => t.tag),
    projectId: row.project_id,
  }
}
