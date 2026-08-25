// app/api/career/capability/route.ts
// GET  → return current capability profile for a student
// POST → compute (or recompute) capability profile from assessment history

import { NextRequest } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/utils/supabase/server'
import { apiSuccess, apiError, apiUnauthorized, apiBadRequest, apiForbidden } from '@/lib/api/response'
import {
  getCapabilityHistory,
  recomputeAndSaveCapabilityProfile,
} from '@/lib/career/careerEngine'
import { resolveCurrentCapabilityProfile } from '@/lib/learnerIntelligence/careerIntelligenceOrchestration'
import { canAccessLegacyStudent } from '@/lib/core/permissions'

export const dynamic = 'force-dynamic'

const GetSchema = z.object({
  studentId: z.string().uuid(),
  history:   z.coerce.boolean().optional().default(false),
})

const PostSchema = z.object({
  studentId: z.string().uuid(),
})

// ── GET — fetch stored capability profile (+ optional history) ────────────────

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return apiUnauthorized()

    const { searchParams } = new URL(req.url)
    const parsed = GetSchema.safeParse({
      studentId: searchParams.get('studentId'),
      history:   searchParams.get('history'),
    })
    if (!parsed.success) return apiBadRequest('studentId (UUID) is required')

    const { studentId, history } = parsed.data

    // Verify student belongs to this user — legacy self/parent link, or the
    // institutional Phase 1C compatibility bridge (canAccessLegacyStudent,
    // lib/core/permissions.ts). includeParent: true preserves this route's
    // existing, broader-than-its-siblings self-OR-parent semantics.
    const allowed = await canAccessLegacyStudent(user.id, studentId, { includeParent: true })
    if (!allowed) return apiForbidden()

    // Phase 5 (Career Intelligence Convergence): canonical Projection first,
    // the persisted (Evidence + legacy) snapshot only when Projection has no
    // evidence at all for this student — see
    // resolveCurrentCapabilityProfile's own doc comment. This is what
    // previously let this route disagree with /api/career/capability-matches
    // (Projection-only, live) for the same learner.
    const profile = await resolveCurrentCapabilityProfile(studentId)

    if (history) {
      const historyItems = await getCapabilityHistory(studentId, 10)
      return apiSuccess({ profile, history: historyItems })
    }

    return apiSuccess({ profile })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return apiError(message, 500)
  }
}

// ── POST — compute/recompute capability profile ────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return apiUnauthorized()

    const body = await req.json()
    const parsed = PostSchema.safeParse(body)
    if (!parsed.success) return apiBadRequest('studentId (UUID) is required')

    const { studentId } = parsed.data

    // Verify student belongs to this user — legacy self/parent link, or the
    // institutional Phase 1C compatibility bridge (see GET handler above).
    const allowed = await canAccessLegacyStudent(user.id, studentId, { includeParent: true })
    if (!allowed) return apiForbidden()

    const profile = await recomputeAndSaveCapabilityProfile(studentId)

    if (!profile) {
      return apiBadRequest('No assessment data found for this student — add assessments first')
    }

    return apiSuccess({ profile, assessment_count: profile.assessment_count })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return apiError(message, 500)
  }
}
