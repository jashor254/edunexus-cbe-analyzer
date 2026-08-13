// lib/career/knowledgeRequests.ts
//
// What happens when a learner asks about a career the platform does not know.
//
// What this replaces, and why
// ---------------------------
// `searchOrGenerateCareer()` used to generate a full career profile with
// DeepSeek and `upsert` it straight into `careers` — the same table the match
// engine reads and every learner-facing surface renders as canonical knowledge.
// A single learner's search could therefore introduce AI-authored salary bands,
// KCSE minimums and capability requirements into the corpus with no human ever
// seeing them, and they would immediately be matched against real learners.
//
// In production that path had never fired (0 rows with source='ai_generated'),
// so this is closing a door before someone walks through it rather than
// cleaning up after them.
//
// The rule
// --------
// **Generated knowledge is never canonical knowledge.** It goes to
// `career_review_queue` for a human, and the learner who asked gets an honest,
// deliberately narrow preview in the meantime.
//
// Why the preview is narrow
// -------------------------
// The generated profile is mostly numbers: entry/mid/senior salary bands, cost
// to qualify, time to income, KCSE grades, capability minimums. Those are
// exactly the fields a language model will produce fluently and wrongly, and
// exactly the fields a Kenyan family will act on. So the preview carries the
// orientation — what this work is, which pathway it sits under, which subjects
// matter — and withholds every figure until a human has checked it.
//
// This is the same discipline the Career Principle grade gate already applies
// (juniors get a cluster, never a job title) and that ADR-0031 applies to
// educational actions: the system may propose, a human decides.

import { repos } from '@/lib/repositories'
import { generateCareerProfile, getCareerBySlug, slugify } from './careerEngine'
import { buildProvisionalPreview } from './provisionalPreview'
import type { ProvisionalCareerPreview } from './provisionalPreview'
import type { Career } from './types'

export type CareerKnowledgeRequest =
  | { status: 'known'; career: Career }
  | { status: 'provisional'; preview: ProvisionalCareerPreview; newlyQueued: boolean; requestCount: number }

/**
 * Answer a learner's career query.
 *
 * Resolution order: exact slug, then a title match, then generation. Only the
 * first two can return canonical knowledge; generation always yields a
 * provisional preview plus a queue entry.
 *
 * `requestedBy` is the asking user, recorded so a reviewer can see who wanted
 * it. Pass null for unattributed/system requests.
 */
export async function requestCareerKnowledge(
  query: string,
  requestedBy: string | null,
): Promise<CareerKnowledgeRequest> {
  const trimmed = query.trim()
  if (!trimmed) throw new Error('Career search query cannot be empty')

  const slug = slugify(trimmed)

  const bySlug = await getCareerBySlug(slug)
  if (bySlug) return { status: 'known', career: bySlug }

  const byTitle = await repos.careers.findCareerByTitleLike(trimmed)
  if (byTitle) return { status: 'known', career: byTitle }

  // Not in the corpus. Generate a candidate for a human to review — never for
  // the learner to be shown as fact, and never for the match engine to use.
  const generated = await generateCareerProfile(trimmed)

  const { queued, requestCount } = await repos.careers.enqueueCareerReview({
    slug:         generated.slug,
    career_name:  generated.title,
    payload:      generated as unknown as Record<string, unknown>,
    submitted_by: requestedBy,
    origin:       'learner_search',
  })

  return {
    status: 'provisional',
    newlyQueued: queued,
    requestCount,
    preview: buildProvisionalPreview(generated),
  }
}

/**
 * Publish a reviewed career into the corpus.
 *
 * This is the ONLY path by which generated knowledge becomes canonical. It
 * stamps `knowledge_verified_at` at publication because a human has, at that
 * moment, actually confirmed the facts — which is precisely what that column
 * means and the only honest time to set it.
 */
export async function publishReviewedCareer(
  reviewId: string,
  reviewerId: string,
  reviewerNotes: string | null,
): Promise<Career> {
  const review = await repos.careers.findCareerReviewById(reviewId)
  if (!review) throw new Error(`Career review ${reviewId} not found`)
  if (review.status !== 'pending') {
    throw new Error(`Career review ${reviewId} is already ${review.status}`)
  }
  if (!review.payload) {
    throw new Error(`Career review ${reviewId} has no payload to publish`)
  }

  const now = new Date().toISOString()
  const career = {
    ...(review.payload as unknown as Omit<Career, 'id' | 'created_at' | 'updated_at'>),
    source:                'ai_generated',
    knowledge_verified_at: now,
    knowledge_source_note: `Reviewed and published by ${reviewerId}${reviewerNotes ? ` — ${reviewerNotes}` : ''}`,
  }

  const published = await repos.careers.upsertCareer(
    career as unknown as Omit<Career, 'id' | 'created_at' | 'updated_at'>,
  )
  await repos.careers.markCareerReviewDecided(reviewId, 'published', reviewerId, reviewerNotes)
  return published
}

export async function rejectReviewedCareer(
  reviewId: string,
  reviewerId: string,
  reviewerNotes: string | null,
): Promise<void> {
  const review = await repos.careers.findCareerReviewById(reviewId)
  if (!review) throw new Error(`Career review ${reviewId} not found`)
  if (review.status !== 'pending') {
    throw new Error(`Career review ${reviewId} is already ${review.status}`)
  }
  await repos.careers.markCareerReviewDecided(reviewId, 'rejected', reviewerId, reviewerNotes)
}
