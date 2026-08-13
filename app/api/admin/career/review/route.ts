// app/api/admin/career/review/route.ts
//
// The human review gate for career knowledge.
//
// `career_review_queue` existed in the schema with zero rows and no code
// touching it, which meant AI-generated careers had nowhere to go except
// straight into the corpus. Queuing them without also building the surface that
// empties the queue would just move the problem, so this route is the other
// half of lib/career/knowledgeRequests.ts, not a follow-up to it.
//
// GET  — pending careers, most-requested first (the demand signal decides what
//        a reviewer researches next).
// POST — publish or reject one. Publishing is the only path by which generated
//        knowledge becomes canonical, and it stamps `knowledge_verified_at`,
//        because that is the moment a person actually confirmed the facts.

import { NextRequest } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/utils/supabase/server'
import { apiSuccess, apiError, apiForbidden } from '@/lib/api/response'
import { requireGrowthUser } from '@/lib/growth/auth'
import { repos } from '@/lib/repositories'
import { publishReviewedCareer, rejectReviewedCareer } from '@/lib/career/knowledgeRequests'

export const dynamic = 'force-dynamic'

const DecisionSchema = z.object({
  reviewId: z.string().uuid(),
  decision: z.enum(['publish', 'reject']),
  notes: z.string().max(2000).nullable().optional(),
})

export async function GET() {
  try {
    const supabase = await createClient()
    const reviewer = await requireGrowthUser(supabase).catch(() => null)
    if (!reviewer) return apiForbidden()

    const pending = await repos.careers.listPendingCareerReviews()
    return apiSuccess({ pending, count: pending.length })
  } catch (err) {
    console.error('[admin/career/review] list failed', err)
    return apiError('Failed to load career review queue')
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const reviewer = await requireGrowthUser(supabase).catch(() => null)
    if (!reviewer) return apiForbidden()

    const body = await req.json().catch(() => null)
    const parsed = DecisionSchema.safeParse(body)
    if (!parsed.success) return apiError('Invalid review decision', 400)

    const { reviewId, decision, notes } = parsed.data

    if (decision === 'publish') {
      const career = await publishReviewedCareer(reviewId, reviewer.id, notes ?? null)
      return apiSuccess({ decision, slug: career.slug })
    }

    await rejectReviewedCareer(reviewId, reviewer.id, notes ?? null)
    return apiSuccess({ decision })
  } catch (err) {
    console.error('[admin/career/review] decision failed', err)
    return apiError(err instanceof Error ? err.message : 'Failed to record review decision')
  }
}
