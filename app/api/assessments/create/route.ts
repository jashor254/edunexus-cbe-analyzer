// app/api/assessments/create/route.ts
//
// DEPRECATED — DEAD, SAFE REMOVAL CANDIDATE (Phase 5.5 audit, learner-
// intelligence-authority series). Confirmed by convergent evidence, not a
// single grep: zero UI callers found by direct source search across the
// entire app/ tree; independently confirmed dead across six separate prior
// audits already in this repo (docs/implementation-wave-3-educational-
// truth-convergence.md, docs/architecture/adr-0029-addendum-h2d-capability-
// convergence.md, docs/architecture/migration-ledger.md, docs/architecture/
// learner-record-layer-review.md, docs/pilot-readiness-wave-1-teacher-
// classroom-journey.md, docs/engineering/sprint-3-assessment-domain-
// audit.md); the developer-portal's own public API documentation
// (edunexus-devportal/content/docs/) never references it either, so it is
// not an external contract. The real, live parent-facing assessment intake
// (app/dashboard/assessments/add/page.tsx) writes directly to `assessments`
// via a raw client-side insert (itself a separately-flagged architecture
// issue, not this route's problem) and then calls
// POST /api/parent/assessments/process, which DOES emit canonical Evidence
// (recordReportCardAssessmentEvidence) — so today's real production
// assessment-intake surfaces are Evidence-covered; only this specific,
// apparently-uncalled route is not. This route itself was NOT extended to
// emit Evidence (per the Phase 5.5 mandate: fix the writer only if it is
// live) and was NOT deleted (repository convention throughout this
// codebase's own prior audits is to flag, not silently remove, an
// undecided legacy route — see sprint-3-assessment-domain-audit.md's own
// "Not Yet Decided" status for this exact route). If a future audit
// reconfirms zero callers and no external usage, this is the safe-removal
// candidate to act on.
import { z } from 'zod'
import { createClient } from '@/utils/supabase/server'
import { createServiceClient } from '@/utils/supabase/service'
import { apiSuccess, apiError, apiUnauthorized, apiBadRequest } from '@/lib/api/response'
import { recomputeAndSaveCapabilityProfile } from '@/lib/career/careerEngine'
import { requireStudent } from '@/lib/core/permissions'
import { UnauthorizedError, isEduNexusError } from '@/lib/core/errors'

const CreateAssessmentSchema = z.object({
  student_id:              z.string().uuid(),
  grade:                   z.number().int().optional(),
  term:                    z.number().int().min(1).max(3),
  year:                    z.number().int(),
  grade_level:             z.enum(['junior', 'senior']).optional(),
  subject_scores:          z.record(z.string(), z.unknown()).refine(s => Object.keys(s).length >= 5, {
    message: 'At least 5 subject scores are required',
  }),
  curriculum_type:         z.string().optional(),
  assessment_style:        z.string().optional(),
  mathematics_type:        z.string().optional(),
  pathway_electives:       z.unknown().optional(),
  pathway_recommendations: z.unknown().optional(),
  source:                  z.enum(['teacher', 'parent']).optional(),
  raw_marks:               z.record(z.string(), z.unknown()).optional(),
})

export async function POST(request: Request) {
  try {
    const supabase = await createClient()

    const parsed = CreateAssessmentSchema.safeParse(await request.json())
    if (!parsed.success) return apiBadRequest(parsed.error.issues[0]?.message ?? 'Invalid input')

    const {
      student_id,
      grade,
      term,
      year,
      grade_level,
      subject_scores,
      curriculum_type,
      assessment_style,
      mathematics_type,
      pathway_electives,
      pathway_recommendations,
      source,
      raw_marks,
    } = parsed.data

    // Verify student belongs to this user — same response for "doesn't exist"
    // and "not yours" as the original inline check (don't leak which).
    let userId: string
    try {
      userId = (await requireStudent(supabase, student_id)).id
    } catch (err) {
      if (err instanceof UnauthorizedError) return apiUnauthorized()
      if (isEduNexusError(err)) return apiBadRequest('Student not found or does not belong to you')
      throw err
    }

    const service = createServiceClient()
    const { data: student, error: studentError } = await service
      .from('students')
      .select('id, grade, curriculum_type')
      .eq('id', student_id)
      .single()

    if (studentError || !student) return apiBadRequest('Student not found or does not belong to you')

    const resolvedCurriculumType = curriculum_type ?? student.curriculum_type ?? 'cbc'
    const resolvedAssessmentStyle = assessment_style ?? 'formative'

    const { data: assessment, error: insertError } = await service
      .from('assessments')
      .insert({
        student_id,
        user_id:                 userId,
        grade:                   grade ?? student.grade,
        term,
        year,
        grade_level:             grade_level ?? (student.grade <= 9 ? 'junior' : 'senior'),
        subject_scores,
        curriculum_type:         resolvedCurriculumType,
        assessment_style:        resolvedAssessmentStyle,
        mathematics_type:        mathematics_type ?? null,
        pathway_electives:       pathway_electives ?? null,
        pathway_recommendations: pathway_recommendations ?? null,
        source:                  source === 'teacher' ? 'teacher' : 'parent',
        raw_marks:               raw_marks ?? {},
      })
      .select()
      .single()

    if (insertError) {
      console.error('[assessments/create] insert error:', insertError)
      return apiError(insertError.message)
    }

    // This route was previously a dead end: nothing else in the platform
    // (no Evidence Domain row, no learner_profiles update, no capability
    // recompute) reacted to a write here, so a student's capability_profile
    // stayed stale until someone happened to hit the Career Explorer's
    // "Update" button. Reuse the same canonical recompute every other
    // assessment-entry path already triggers, fire-and-forget so it never
    // blocks this response.
    recomputeAndSaveCapabilityProfile(student_id).catch(err =>
      console.error('[assessments/create] capability recompute failed:', err instanceof Error ? err.message : String(err))
    )

    return apiSuccess({ assessment }, 201)
  } catch (err) {
    console.error('[assessments/create]', err)
    return apiError('Server error')
  }
}
