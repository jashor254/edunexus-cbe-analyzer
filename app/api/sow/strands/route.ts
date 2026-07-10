// app/api/sow/strands/route.ts
// GET: Return strands + substrands for a given learning area
// Query params: learningAreaId

import { createClient } from '@/utils/supabase/server'
import { repos } from '@/lib/repositories'
import { CurriculumService } from '@/lib/curriculum/service'
import {
  apiSuccess,
  apiError,
  apiUnauthorized,
  apiBadRequest,
  apiForbidden,
} from '@/lib/api/response'

// In-memory sliding window: max 30 requests per user per minute.
// Resets on cold start — intentional, this is abuse prevention not billing.
const requestLog = new Map<string, number[]>()
const WINDOW_MS  = 60_000
const MAX_HITS   = 30

function isRateLimited(userId: string): boolean {
  const now  = Date.now()
  const hits  = (requestLog.get(userId) ?? []).filter(t => now - t < WINDOW_MS)
  hits.push(now)
  requestLog.set(userId, hits)
  return hits.length > MAX_HITS
}

export async function GET(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return apiUnauthorized()

    const url = new URL(req.url)
    const learningAreaId = url.searchParams.get('learningAreaId')?.trim()
    if (!learningAreaId) return apiBadRequest('Missing learningAreaId')

    // Curriculum data is teacher-only — students and parents have no access
    const teacher = await repos.teachers.findTeacherByUserId(user.id)
    if (!teacher) return apiForbidden()

    // Sliding-window rate limit: 30 requests/minute per teacher
    if (isRateLimited(user.id)) {
      return apiError('Too many requests — slow down and try again in a minute', 429)
    }

    const strands = await CurriculumService.resolveStrandsWithSubstrands(learningAreaId)

    const response = apiSuccess({ strands })
    response.headers.set('Cache-Control', 'private, max-age=600, stale-while-revalidate=120')
    return response
  } catch (err: unknown) {
    console.error('[sow/strands]', err)
    return apiError(err instanceof Error ? err.message : 'Failed to load strands')
  }
}
