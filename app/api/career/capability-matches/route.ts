// app/api/career/capability-matches/route.ts
// GET ?studentId=<uuid>
//   → Returns a CapabilityMatchReport: 4-tier career matches derived purely
//     from the student's capability profile (no AI, no tokens).
//
// POST { studentId } — recomputes the capability profile first, then matches.
//   → Use this when you want a fresh compute + fresh matches in one call.

import { NextRequest } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/utils/supabase/server'
import { createServiceClient } from '@/utils/supabase/service'
import { apiSuccess, apiError, apiUnauthorized, apiBadRequest, apiForbidden } from '@/lib/api/response'
import {
  getCapabilityProfile,
  saveCapabilityProfile,
  getAllCareersWithCOS,
} from '@/lib/career/careerEngine'
import { extractCapabilityProfile } from '@/lib/career/capabilityExtractor'
import { computeCapabilityMatches } from '@/lib/career/capabilityMatchEngine'

export const dynamic = 'force-dynamic'

const GetSchema = z.object({
  studentId: z.string().uuid(),
})

const PostSchema = z.object({
  studentId: z.string().uuid(),
})

// ── Shared: verify student ownership ─────────────────────────────────────────

async function verifyStudent(userId: string, studentId: string) {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('students')
    .select('id, user_id')
    .eq('id', studentId)
    .single()
  if (error || !data) return null
  if (data.user_id !== userId) return null
  return data
}

// ── GET — fetch matches from stored capability profile ────────────────────────

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return apiUnauthorized()

    const { searchParams } = new URL(req.url)
    const parsed = GetSchema.safeParse({ studentId: searchParams.get('studentId') })
    if (!parsed.success) return apiBadRequest('studentId (UUID) is required')

    const { studentId } = parsed.data
    const student = await verifyStudent(user.id, studentId)
    if (!student) return apiForbidden()

    const profile = await getCapabilityProfile(studentId)
    if (!profile) {
      return apiBadRequest(
        'No capability profile found for this student. Call POST /api/career/capability first to compute one.'
      )
    }

    const careers = await getAllCareersWithCOS()
    const report  = computeCapabilityMatches(studentId, profile, careers)

    return apiSuccess(report)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return apiError(message, 500)
  }
}

// ── POST — recompute profile then return matches ──────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return apiUnauthorized()

    const body = await req.json()
    const parsed = PostSchema.safeParse(body)
    if (!parsed.success) return apiBadRequest('studentId (UUID) is required')

    const { studentId } = parsed.data
    const student = await verifyStudent(user.id, studentId)
    if (!student) return apiForbidden()

    // Load assessment history — oldest first for correct trend direction
    const service = createServiceClient()
    const { data: assessments, error: assessErr } = await service
      .from('assessments')
      .select('subject_scores, created_at')
      .eq('student_id', studentId)
      .not('subject_scores', 'is', null)
      .order('created_at', { ascending: true })
      .limit(20)

    if (assessErr) throw new Error(`Failed to load assessments: ${assessErr.message}`)
    if (!assessments || assessments.length === 0) {
      return apiBadRequest('No assessments found for this student — add assessments first.')
    }

    const scoreHistory = assessments.map(a => a.subject_scores as Record<string, number>)
    const profile      = extractCapabilityProfile(scoreHistory)
    await saveCapabilityProfile(studentId, profile)

    const careers = await getAllCareersWithCOS()
    const report  = computeCapabilityMatches(studentId, profile, careers)

    return apiSuccess({ ...report, profile_recomputed: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return apiError(message, 500)
  }
}
