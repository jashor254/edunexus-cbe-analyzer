// app/api/career/match/route.ts
//
// Career Contradiction Closure Sprint (2026-08-03) — no longer calls the
// deprecated `getMatchesForStudent()`/`generateCareerMatches()` (AI-generated,
// persisted-table) path. Thin route: authenticate, authorize (student belongs
// to this user), call the one canonical service
// (`resolveCanonicalCareerMatches`), map its result onto this route's
// existing response shape, return. No matching logic lives here.
import { NextRequest } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/utils/supabase/server'
import { apiSuccess, apiError, apiBadRequest, apiForbidden, apiUnauthorized } from '@/lib/api/response'
import { resolveCanonicalCareerMatches } from '@/lib/learnerIntelligence/careerIntelligence'

export const dynamic = 'force-dynamic'

const BodySchema = z.object({
  studentId: z.string().uuid(),
  // `force` accepted for backward API compatibility — the canonical engine
  // always computes live from current Projection, so there is no persisted
  // cache left to bypass; this field is now a no-op.
  force: z.boolean().optional().default(false),
})

async function authorizeStudent(studentId: string) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return { error: apiUnauthorized() } as const

  const { data: student, error: studentError } = await supabase
    .from('students')
    .select('id')
    .eq('id', studentId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (studentError || !student) return { error: apiForbidden() } as const
  return { error: null } as const
}

export async function POST(req: NextRequest) {
  try {
    const parsed = BodySchema.safeParse(await req.json())
    if (!parsed.success) return apiBadRequest('studentId (UUID) is required')

    const { studentId } = parsed.data
    const { error } = await authorizeStudent(studentId)
    if (error) return error

    const result = await resolveCanonicalCareerMatches(studentId)
    return apiSuccess({ matches: result.matches, source: 'canonical', generated_at: result.generatedAt })
  } catch (err) {
    console.error('[career/match]', err)
    return apiError('Failed to load career matches. Please try again.')
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const studentId = searchParams.get('studentId')
    if (!studentId) return apiBadRequest('studentId is required')

    const { error } = await authorizeStudent(studentId)
    if (error) return error

    const result = await resolveCanonicalCareerMatches(studentId)
    return apiSuccess({ matches: result.matches, source: 'canonical', generated_at: result.generatedAt })
  } catch (err) {
    console.error('[career/match GET]', err)
    return apiError('Failed to load career matches')
  }
}
