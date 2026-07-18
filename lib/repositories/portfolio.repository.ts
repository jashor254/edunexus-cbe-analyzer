// lib/repositories/portfolio.repository.ts
//
// Owns `learner_portfolios`, `portfolio_items`, `portfolio_media`,
// `portfolio_tags` exclusively (Sprint 12V, ADR-0011). Only the canonical
// operations the mission named — no business logic (no permission checks,
// no lifecycle validation, no category rules): that all lives in
// lib/learnerPortfolio/portfolio.ts. This repository only knows how to
// read and write rows; the DB's own trigger
// (`enforce_portfolio_item_immutability`) is the final backstop against a
// published item ever being edited, even if a future bug in the service
// layer tried to call `updateDraft` on one.
//
// Per ADR-0011 Phase 11 (Repository Discipline): no generic
// update()/delete() on items — every lifecycle transition gets its own
// named method, and there is no deletePublished/updatePublished path at
// all (matching CLAUDE.md's evidence-lifecycle discipline).

import { BaseRepository } from './base'

export type PortfolioCategory =
  | 'projects' | 'creative_work' | 'research' | 'presentations'
  | 'writing' | 'design' | 'photography' | 'programming' | 'media' | 'other'

export type PortfolioItemStatus = 'draft' | 'submitted' | 'verified' | 'rejected' | 'published' | 'archived'

export type LearnerPortfolioRow = {
  id: string
  learner_id: string
  school_id: string
  created_at: string
  updated_at: string
}

export type PortfolioItemRow = {
  id: string
  portfolio_id: string
  learner_id: string
  school_id: string
  category: PortfolioCategory
  title: string
  description: string | null
  reflection: string | null
  supporting_evidence_ids: string[]
  status: PortfolioItemStatus
  created_by: string | null
  verified_by: string | null
  verified_at: string | null
  rejected_reason: string | null
  published_at: string | null
  archived_at: string | null
  created_at: string
  updated_at: string
  /** ADR-0013 "Relationship to ADR-0011" — Portfolio references a Project, never duplicates one. Nullable: a `projects`-category item with no link yet is Reserved (service layer), never fabricated. */
  project_id: string | null
}

export type PortfolioMediaRow = {
  id: string
  portfolio_item_id: string
  url: string
  label: string | null
  created_at: string
}

export type PortfolioTagRow = {
  id: string
  portfolio_item_id: string
  tag: string
  created_at: string
}

export type CreateItemInput = {
  portfolio_id: string
  learner_id: string
  school_id: string
  category: PortfolioCategory
  title: string
  description: string | null
  reflection: string | null
  supporting_evidence_ids: string[]
  created_by: string | null
}

export type UpdateDraftItemInput = Partial<
  Pick<PortfolioItemRow, 'category' | 'title' | 'description' | 'reflection' | 'supporting_evidence_ids'>
>

const ITEM_COLS =
  'id, portfolio_id, learner_id, school_id, category, title, description, reflection, supporting_evidence_ids, status, created_by, verified_by, verified_at, rejected_reason, published_at, archived_at, created_at, updated_at, project_id'

export class PortfolioRepository extends BaseRepository {
  // ── learner_portfolios ──────────────────────────────────────────────────

  async findOrCreatePortfolio(learnerId: string, schoolId: string): Promise<LearnerPortfolioRow> {
    const existing = await this.findPortfolioByLearner(learnerId, schoolId)
    if (existing) return existing

    const { data, error } = await this.db
      .from('learner_portfolios')
      .insert({ learner_id: learnerId, school_id: schoolId })
      .select('id, learner_id, school_id, created_at, updated_at')
      .single()
    if (error) throw new Error(`findOrCreatePortfolio: ${error.message}`)
    return data as unknown as LearnerPortfolioRow
  }

  async findPortfolioByLearner(learnerId: string, schoolId: string): Promise<LearnerPortfolioRow | null> {
    const { data, error } = await this.db
      .from('learner_portfolios')
      .select('id, learner_id, school_id, created_at, updated_at')
      .eq('learner_id', learnerId)
      .eq('school_id', schoolId)
      .maybeSingle()
    if (error) throw new Error(`findPortfolioByLearner: ${error.message}`)
    return data as unknown as LearnerPortfolioRow | null
  }

  // ── portfolio_items ──────────────────────────────────────────────────────

  async createItem(input: CreateItemInput): Promise<PortfolioItemRow> {
    const { data, error } = await this.db
      .from('portfolio_items')
      .insert({ ...input, status: 'draft' })
      .select(ITEM_COLS)
      .single()
    if (error) throw new Error(`createItem: ${error.message}`)
    return data as unknown as PortfolioItemRow
  }

  /** Only succeeds while the item is still `draft` — the DB trigger rejects any attempt once it is published/archived. */
  async updateDraftItem(id: string, schoolId: string, input: UpdateDraftItemInput): Promise<PortfolioItemRow> {
    const { data, error } = await this.db
      .from('portfolio_items')
      .update(input)
      .eq('id', id)
      .eq('school_id', schoolId)
      .select(ITEM_COLS)
      .single()
    if (error) throw new Error(`updateDraftItem: ${error.message}`)
    return data as unknown as PortfolioItemRow
  }

  /**
   * ADR-0013 "Relationship to ADR-0011" — links a `projects`-category item
   * to a real Project entity. Only meaningful while the item is still
   * `draft` (the DB trigger's normal draft-only-edit rule already covers
   * this column since it's a plain field update, not a special case).
   */
  async linkToProject(id: string, schoolId: string, projectId: string): Promise<PortfolioItemRow> {
    const { data, error } = await this.db
      .from('portfolio_items')
      .update({ project_id: projectId })
      .eq('id', id)
      .eq('school_id', schoolId)
      .select(ITEM_COLS)
      .single()
    if (error) throw new Error(`linkToProject: ${error.message}`)
    return data as unknown as PortfolioItemRow
  }

  async submitItem(id: string, schoolId: string): Promise<PortfolioItemRow> {
    const { data, error } = await this.db
      .from('portfolio_items')
      .update({ status: 'submitted' })
      .eq('id', id)
      .eq('school_id', schoolId)
      .select(ITEM_COLS)
      .single()
    if (error) throw new Error(`submitItem: ${error.message}`)
    return data as unknown as PortfolioItemRow
  }

  async verifyItem(id: string, schoolId: string, verifiedBy: string): Promise<PortfolioItemRow> {
    const { data, error } = await this.db
      .from('portfolio_items')
      .update({ status: 'verified', verified_by: verifiedBy, verified_at: new Date().toISOString() })
      .eq('id', id)
      .eq('school_id', schoolId)
      .select(ITEM_COLS)
      .single()
    if (error) throw new Error(`verifyItem: ${error.message}`)
    return data as unknown as PortfolioItemRow
  }

  async rejectItem(id: string, schoolId: string, reason: string): Promise<PortfolioItemRow> {
    const { data, error } = await this.db
      .from('portfolio_items')
      .update({ status: 'rejected', rejected_reason: reason })
      .eq('id', id)
      .eq('school_id', schoolId)
      .select(ITEM_COLS)
      .single()
    if (error) throw new Error(`rejectItem: ${error.message}`)
    return data as unknown as PortfolioItemRow
  }

  /** Transitions `verified` -> `published`. The DB trigger prevents any further field edits once published, only an `archived` transition remains legal. */
  async publishItem(id: string, schoolId: string): Promise<PortfolioItemRow> {
    const { data, error } = await this.db
      .from('portfolio_items')
      .update({ status: 'published', published_at: new Date().toISOString() })
      .eq('id', id)
      .eq('school_id', schoolId)
      .select(ITEM_COLS)
      .single()
    if (error) throw new Error(`publishItem: ${error.message}`)
    return data as unknown as PortfolioItemRow
  }

  /** The one field change the DB trigger still allows on a published row. */
  async archiveItem(id: string, schoolId: string): Promise<PortfolioItemRow> {
    const { data, error } = await this.db
      .from('portfolio_items')
      .update({ status: 'archived', archived_at: new Date().toISOString() })
      .eq('id', id)
      .eq('school_id', schoolId)
      .select(ITEM_COLS)
      .single()
    if (error) throw new Error(`archiveItem: ${error.message}`)
    return data as unknown as PortfolioItemRow
  }

  async findItemById(id: string, schoolId: string): Promise<PortfolioItemRow | null> {
    const { data, error } = await this.db
      .from('portfolio_items')
      .select(ITEM_COLS)
      .eq('id', id)
      .eq('school_id', schoolId)
      .maybeSingle()
    if (error) throw new Error(`findItemById: ${error.message}`)
    return data as unknown as PortfolioItemRow | null
  }

  /** Every item for a learner, regardless of status — teacher/admin/owning-learner view. */
  async listAllItems(learnerId: string, schoolId: string): Promise<PortfolioItemRow[]> {
    const { data, error } = await this.db
      .from('portfolio_items')
      .select(ITEM_COLS)
      .eq('learner_id', learnerId)
      .eq('school_id', schoolId)
      .order('created_at', { ascending: false })
    if (error) throw new Error(`listAllItems: ${error.message}`)
    return (data ?? []) as unknown as PortfolioItemRow[]
  }

  /** Published items only — the only status external/summary consumers (Blueprint) may read. */
  async listPublishedItems(learnerId: string, schoolId: string): Promise<PortfolioItemRow[]> {
    const { data, error } = await this.db
      .from('portfolio_items')
      .select(ITEM_COLS)
      .eq('learner_id', learnerId)
      .eq('school_id', schoolId)
      .eq('status', 'published')
      .order('published_at', { ascending: false })
    if (error) throw new Error(`listPublishedItems: ${error.message}`)
    return (data ?? []) as unknown as PortfolioItemRow[]
  }

  // ── portfolio_media / portfolio_tags ────────────────────────────────────

  async addMedia(portfolioItemId: string, url: string, label: string | null): Promise<PortfolioMediaRow> {
    const { data, error } = await this.db
      .from('portfolio_media')
      .insert({ portfolio_item_id: portfolioItemId, url, label })
      .select('id, portfolio_item_id, url, label, created_at')
      .single()
    if (error) throw new Error(`addMedia: ${error.message}`)
    return data as unknown as PortfolioMediaRow
  }

  async listMedia(portfolioItemId: string): Promise<PortfolioMediaRow[]> {
    const { data, error } = await this.db
      .from('portfolio_media')
      .select('id, portfolio_item_id, url, label, created_at')
      .eq('portfolio_item_id', portfolioItemId)
    if (error) throw new Error(`listMedia: ${error.message}`)
    return (data ?? []) as unknown as PortfolioMediaRow[]
  }

  async addTag(portfolioItemId: string, tag: string): Promise<PortfolioTagRow> {
    const { data, error } = await this.db
      .from('portfolio_tags')
      .insert({ portfolio_item_id: portfolioItemId, tag })
      .select('id, portfolio_item_id, tag, created_at')
      .single()
    if (error) throw new Error(`addTag: ${error.message}`)
    return data as unknown as PortfolioTagRow
  }

  async listTags(portfolioItemId: string): Promise<PortfolioTagRow[]> {
    const { data, error } = await this.db
      .from('portfolio_tags')
      .select('id, portfolio_item_id, tag, created_at')
      .eq('portfolio_item_id', portfolioItemId)
    if (error) throw new Error(`listTags: ${error.message}`)
    return (data ?? []) as unknown as PortfolioTagRow[]
  }
}
