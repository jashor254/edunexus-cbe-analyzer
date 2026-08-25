// app/api/career/search/route.ts
import { NextRequest } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/utils/supabase/server'
import { apiSuccess, apiError, apiUnauthorized } from '@/lib/api/response'
import { searchCareers, getAllCareers } from '@/lib/career/careerEngine'
import { requestCareerKnowledge } from '@/lib/career/knowledgeRequests'
import type { CareerSearchFilters } from '@/lib/career/types'

export const dynamic = 'force-dynamic'

const QuerySchema = z.object({
  // trim + reject-blank + a reasonable max length (Phase 9.1 §23) — no
  // career title/search phrase legitimately needs more than this, and it
  // bounds what reaches the unknown-career LLM prompt (Phase 9 §12's
  // unmitigated-prompt-injection finding is not fixed by this, just capped).
  q: z.string().trim().min(1).max(100).optional(),
  category: z.string().optional(),
  pathway: z.enum(['STEM', 'Social Sciences', 'Arts & Sports Science']).optional(),
  ai_impact_level: z.enum(['low', 'medium', 'high', 'transforming']).optional(),
})

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return apiUnauthorized()

    const { searchParams } = new URL(req.url)
    const parsed = QuerySchema.safeParse(Object.fromEntries(searchParams))

    if (!parsed.success) {
      return apiError('Invalid query parameters', 400)
    }

    const filters: CareerSearchFilters = parsed.data as CareerSearchFilters

    const careers = (filters.q || filters.category || filters.pathway || filters.ai_impact_level)
      ? await searchCareers(filters)
      : await getAllCareers()

    // No career matched. The learner still gets an answer rather than a dead
    // end, but an unreviewed one: an outline with no salary figures, entry
    // grades or course costs, plus a queue entry so a person researches it.
    // See lib/career/knowledgeRequests.ts for why the preview is this narrow.
    if (careers.length === 0 && filters.q) {
      const result = await requestCareerKnowledge(filters.q, user.id)
      if (result.status === 'known') {
        return apiSuccess({ careers: [result.career], provisional: false })
      }
      if (result.status === 'rate_limited') {
        // Never a fabricated career and never a hard failure of the search
        // itself (Phase 9.1 §17) — canonical search above this branch was
        // already unaffected; only the AI-generation attempt was skipped.
        return apiSuccess({
          careers: [],
          provisional: false,
          rateLimited: true,
          message: "We don't have this career in our verified library yet. Try again later, or explore related careers.",
        })
      }
      return apiSuccess({
        careers: [],
        provisional: true,
        preview: result.preview,
        requestCount: result.requestCount,
      })
    }

    return apiSuccess({ careers, provisional: false })
  } catch (err) {
    console.error('[career/search]', err)
    return apiError('Failed to search careers')
  }
}
