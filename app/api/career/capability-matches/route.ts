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
  getAllCareersWithCOS,
  recomputeAndSaveCapabilityProfile,
} from '@/lib/career/careerEngine'
import { computeCapabilityMatches } from '@/lib/career/capabilityMatchEngine'
import { familiesFromMatches, careerModeForGrade } from '@/lib/learnerIntelligence/careerIntelligence'
import { resolveFreshCapabilityProfile } from '@/lib/learnerIntelligence/careerIntelligenceOrchestration'
import { canAccessLegacyStudent } from '@/lib/core/permissions'
import type { CapabilityMatchReport } from '@/lib/career/types'

export const dynamic = 'force-dynamic'

const GetSchema = z.object({
  studentId: z.string().uuid(),
})

const PostSchema = z.object({
  studentId: z.string().uuid(),
})

// ── Shared: verify student ownership ─────────────────────────────────────────

async function verifyStudent(userId: string, studentId: string) {
  const allowed = await canAccessLegacyStudent(userId, studentId)
  if (!allowed) return null

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('students')
    .select('id, grade')
    .eq('id', studentId)
    .single()
  if (error || !data) return null
  return data
}

// Junior (Grade 7–9) never sees a ranked/percentage career prediction — the
// Career Principle requires exploration, not prediction, at this stage.
// Same matcher, same data (computeCapabilityMatches, unchanged) — just
// regrouped into broad families via the one shared helper every career
// consumer uses for this gate. Grade boundary itself comes from
// careerModeForGrade() (lib/learnerIntelligence/careerIntelligence.ts) —
// the single canonical Career Principle gate, never re-derived here.
function shapeForGrade(grade: number, report: CapabilityMatchReport) {
  const isJunior = careerModeForGrade(grade) === 'exploration'
  if (!isJunior) return { ...report, mode: 'planning' as const }

  return {
    mode:                 'exploration' as const,
    student_id:            report.student_id,
    families:              familiesFromMatches([...report.primary, ...report.stretch]),
    total_careers_scored:  report.total_careers_scored,
    assessment_count:      report.assessment_count,
    dominant_cluster:      report.dominant_cluster,
    generated_at:          report.generated_at,
    disclaimer:            report.disclaimer,
  }
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

    // Sourced live from Projection via the one canonical resolver — the same
    // path Blueprint, Career Intelligence, and Parent Career Intelligence
    // already use — instead of the separately-stored, potentially-diverging
    // `students.capability_profile` snapshot, so the matches shown here
    // always agree with what those other surfaces conclude from the same
    // evidence.
    const resolved = await resolveFreshCapabilityProfile(studentId)
    if (!resolved) {
      return apiBadRequest('No evidence found for this student yet. Add an assessment first.')
    }

    const careers = await getAllCareersWithCOS()
    const report  = computeCapabilityMatches(studentId, resolved.profile, careers)

    return apiSuccess(shapeForGrade(student.grade, report))
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

    // Still recomputes-and-persists the legacy `students.capability_profile`
    // snapshot — the profile bars (`/api/career/capability`) and growth
    // trend (`/api/career/growth`) are deliberately out of this wave's scope
    // (they need persisted history Projection doesn't keep; see
    // docs/architecture/migration-ledger.md). Its return value is used only
    // for that side effect here, not for the matches below — matching
    // always comes from the same Projection-sourced profile GET uses, so
    // "Refresh" can never show a different match than a plain reload.
    const saved = await recomputeAndSaveCapabilityProfile(studentId)
    if (!saved) {
      return apiBadRequest('No assessments found for this student — add assessments first.')
    }

    const resolved = await resolveFreshCapabilityProfile(studentId)
    if (!resolved) {
      return apiBadRequest('No evidence found for this student yet. Add an assessment first.')
    }

    const careers = await getAllCareersWithCOS()
    const report  = computeCapabilityMatches(studentId, resolved.profile, careers)

    return apiSuccess({ ...shapeForGrade(student.grade, report), profile_recomputed: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return apiError(message, 500)
  }
}
