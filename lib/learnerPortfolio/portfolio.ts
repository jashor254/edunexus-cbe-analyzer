// lib/learnerPortfolio/portfolio.ts
//
// The canonical Learner Portfolio service (Sprint 12V, ADR-0011/0012).
// Owns: permission checks, lifecycle transitions (Draft -> Submitted ->
// Verified -> Published -> Archived, with Rejected reachable from
// Submitted), and field validation. No Supabase client is ever used
// directly here — every read/write goes through `repos.portfolios`
// (lib/repositories/portfolio.repository.ts), which owns the tables
// exclusively.
//
// Verification workflow (Phase 10): Teacher Verify, Teacher Reject,
// Teacher Publish only — no AI verification, no automatic approval, the
// teacher remains accountable for every state transition past Draft.
//
// Business rules enforced here, not the repository (Phase 12):
//  - Cannot publish an item that hasn't been verified first.
//  - Cannot edit a published item (repository/DB trigger is the final
//    backstop; this throws a clean error before that raw exception).
//  - Cannot archive anything but a published item.
//  - Cannot verify/reject an item that hasn't been submitted.

import type { SupabaseClient } from '@supabase/supabase-js'
import { requireSchoolStaff } from '@/lib/core/permissions'
import { repos } from '@/lib/repositories'
import { validateItemFields } from './validation'
import { toPortfolioItem, type PortfolioItem, type PortfolioItemFields, type PortfolioSummary } from './types'

/** Ensures the learner has exactly one Portfolio container, creating it on first use (ADR-0011 Phase 2: one portfolio per learner). */
export async function ensurePortfolio(learnerId: string, schoolId: string): Promise<{ id: string }> {
  return repos.portfolios.findOrCreatePortfolio(learnerId, schoolId)
}

/** Adds a new Draft item to a learner's Portfolio. */
export async function addItem(
  client: SupabaseClient,
  schoolId: string,
  learnerId: string,
  actorUserId: string,
  fields: PortfolioItemFields
): Promise<PortfolioItem> {
  await requireSchoolStaff(client, schoolId)
  validateItemFields(fields)

  const portfolio = await ensurePortfolio(learnerId, schoolId)
  const creator = await repos.teachers.findSchoolUser(actorUserId, schoolId).catch(() => null)

  const row = await repos.portfolios.createItem({
    portfolio_id: portfolio.id,
    learner_id: learnerId,
    school_id: schoolId,
    category: fields.category,
    title: fields.title,
    description: fields.description,
    reflection: fields.reflection,
    supporting_evidence_ids: fields.supportingEvidenceIds,
    created_by: creator?.id ?? null,
  })
  return toPortfolioItem(row, [], [])
}

/** Edits an existing Draft item. Throws a clean error if the item has moved past Draft — the DB trigger is the final backstop. */
export async function updateDraftItem(
  client: SupabaseClient,
  schoolId: string,
  itemId: string,
  fields: Partial<PortfolioItemFields>
): Promise<PortfolioItem> {
  await requireSchoolStaff(client, schoolId)

  const existing = await repos.portfolios.findItemById(itemId, schoolId)
  if (!existing) throw new Error('Portfolio item not found.')
  if (existing.status !== 'draft') {
    throw new Error('This Portfolio item is no longer a draft and cannot be edited directly — reject it back to draft first, or archive it once published.')
  }

  const merged: PortfolioItemFields = {
    category: fields.category ?? existing.category,
    title: fields.title ?? existing.title,
    description: fields.description !== undefined ? fields.description : existing.description,
    reflection: fields.reflection !== undefined ? fields.reflection : existing.reflection,
    supportingEvidenceIds: fields.supportingEvidenceIds ?? existing.supporting_evidence_ids,
  }
  validateItemFields(merged)

  const row = await repos.portfolios.updateDraftItem(itemId, schoolId, {
    category: merged.category,
    title: merged.title,
    description: merged.description,
    reflection: merged.reflection,
    supporting_evidence_ids: merged.supportingEvidenceIds,
  })
  const [media, tags] = await Promise.all([repos.portfolios.listMedia(itemId), repos.portfolios.listTags(itemId)])
  return toPortfolioItem(row, media, tags)
}

/** Learner submits a Draft item for teacher review. */
export async function submitItem(client: SupabaseClient, schoolId: string, itemId: string): Promise<PortfolioItem> {
  await requireSchoolStaff(client, schoolId)

  const existing = await repos.portfolios.findItemById(itemId, schoolId)
  if (!existing) throw new Error('Portfolio item not found.')
  if (existing.status !== 'draft') throw new Error('Only a draft item can be submitted for review.')

  const row = await repos.portfolios.submitItem(itemId, schoolId)
  const [media, tags] = await Promise.all([repos.portfolios.listMedia(itemId), repos.portfolios.listTags(itemId)])
  return toPortfolioItem(row, media, tags)
}

/** Teacher Verify (Phase 10) — the item moves from Submitted to Verified, ready to publish. */
export async function verifyItem(client: SupabaseClient, schoolId: string, itemId: string): Promise<PortfolioItem> {
  const membership = await requireSchoolStaff(client, schoolId)

  const existing = await repos.portfolios.findItemById(itemId, schoolId)
  if (!existing) throw new Error('Portfolio item not found.')
  if (existing.status !== 'submitted') throw new Error('Only a submitted item can be verified.')

  const verifier = await repos.teachers.findSchoolUser(membership.userId, schoolId).catch(() => null)
  if (!verifier) throw new Error('Verifying staff member has no school_users record — cannot attribute this verification.')
  const row = await repos.portfolios.verifyItem(itemId, schoolId, verifier.id)
  const [media, tags] = await Promise.all([repos.portfolios.listMedia(itemId), repos.portfolios.listTags(itemId)])
  return toPortfolioItem(row, media, tags)
}

/** Teacher Reject (Phase 10) — a submitted item that doesn't pass review, with a reason so the learner/teacher aren't left guessing. */
export async function rejectItem(client: SupabaseClient, schoolId: string, itemId: string, reason: string): Promise<PortfolioItem> {
  await requireSchoolStaff(client, schoolId)
  if (!reason || !reason.trim()) throw new Error('A rejection reason is required.')

  const existing = await repos.portfolios.findItemById(itemId, schoolId)
  if (!existing) throw new Error('Portfolio item not found.')
  if (existing.status !== 'submitted') throw new Error('Only a submitted item can be rejected.')

  const row = await repos.portfolios.rejectItem(itemId, schoolId, reason)
  const [media, tags] = await Promise.all([repos.portfolios.listMedia(itemId), repos.portfolios.listTags(itemId)])
  return toPortfolioItem(row, media, tags)
}

/** Teacher Publish (Phase 10) — cannot publish an item that hasn't been verified first (Phase 12 business rule). */
export async function publishItem(client: SupabaseClient, schoolId: string, itemId: string): Promise<PortfolioItem> {
  await requireSchoolStaff(client, schoolId)

  const existing = await repos.portfolios.findItemById(itemId, schoolId)
  if (!existing) throw new Error('Portfolio item not found.')
  if (existing.status !== 'verified') throw new Error('Cannot publish: this item has not been verified yet.')

  const row = await repos.portfolios.publishItem(itemId, schoolId)
  const [media, tags] = await Promise.all([repos.portfolios.listMedia(itemId), repos.portfolios.listTags(itemId)])
  return toPortfolioItem(row, media, tags)
}

/** Cannot archive anything but a published item (Phase 12 business rule) — Draft/Submitted/Verified/Rejected have no archive path. */
export async function archiveItem(client: SupabaseClient, schoolId: string, itemId: string): Promise<PortfolioItem> {
  await requireSchoolStaff(client, schoolId)

  const existing = await repos.portfolios.findItemById(itemId, schoolId)
  if (!existing) throw new Error('Portfolio item not found.')
  if (existing.status !== 'published') throw new Error('Only a published item can be archived.')

  const row = await repos.portfolios.archiveItem(itemId, schoolId)
  const [media, tags] = await Promise.all([repos.portfolios.listMedia(itemId), repos.portfolios.listTags(itemId)])
  return toPortfolioItem(row, media, tags)
}

/** Every item for a learner, any status — the teacher/admin/owning-learner full view. */
export async function findCurrentPortfolio(client: SupabaseClient, schoolId: string, learnerId: string): Promise<PortfolioItem[]> {
  await requireSchoolStaff(client, schoolId)
  const rows = await repos.portfolios.listAllItems(learnerId, schoolId)
  return Promise.all(rows.map(async row => {
    const [media, tags] = await Promise.all([repos.portfolios.listMedia(row.id), repos.portfolios.listTags(row.id)])
    return toPortfolioItem(row, media, tags)
  }))
}

/** Published items only — the surface every non-staff/summary consumer may read. */
export async function listPublished(learnerId: string, schoolId: string): Promise<PortfolioItem[]> {
  const rows = await repos.portfolios.listPublishedItems(learnerId, schoolId)
  return Promise.all(rows.map(async row => {
    const [media, tags] = await Promise.all([repos.portfolios.listMedia(row.id), repos.portfolios.listTags(row.id)])
    return toPortfolioItem(row, media, tags)
  }))
}

/**
 * Blueprint's field budget for Portfolio (ADR-0011 Phase 4) — a small,
 * fixed set of counts/highlights, composed the same "ask, never compute"
 * way every other Blueprint section already is. Never a full item list.
 */
export async function getPortfolioSummary(learnerId: string, schoolId: string): Promise<PortfolioSummary> {
  const published = await repos.portfolios.listPublishedItems(learnerId, schoolId)

  if (published.length === 0) {
    return { available: false, publishedCount: 0, latestItem: null, featuredItem: null, portfolioUrl: null }
  }

  const sorted = [...published].sort((a, b) => (b.published_at ?? '').localeCompare(a.published_at ?? ''))
  const latest = sorted[0]

  return {
    available: true,
    publishedCount: published.length,
    latestItem: { title: latest.title, category: latest.category, publishedAt: latest.published_at! },
    // No curation/pinning mechanism exists yet (out of this sprint's scope) — the
    // most recent published item stands in as "featured" until one is built,
    // never a fabricated distinct selection.
    featuredItem: { title: latest.title, category: latest.category, publishedAt: latest.published_at! },
    portfolioUrl: null,
  }
}
