// app/api/parent/assessments/process/route.ts
// Parent-side entry point for the assessment processing pipeline — for teacherless
// students whose parent has just entered scores via /dashboard/assessments/add.

import { z } from 'zod'
import { createClient } from '@/utils/supabase/server'
import { createServiceClient } from '@/utils/supabase/service'
import { apiSuccess, apiError, apiUnauthorized, apiForbidden, apiBadRequest } from '@/lib/api/response'
import { runAssessmentPipeline } from '@/lib/academicClinic/assessmentPipeline'
import { recordReportCardAssessmentEvidence } from '@/lib/assessments/reportCardEvidence'
import { requireAuthentication, requireStudent, requireParent } from '@/lib/core/permissions'
import { UnauthorizedError } from '@/lib/core/errors'

/**
 * Preserves the exact original union check
 * (`student.user_id === user.id || student.parent_user_id === user.id`)
 * using the canonical self/parent gates, composed rather than reimplemented.
 * `requireParent` additionally checks Core's `learner_guardians` — a no-op
 * superset here since Core learner IDs are a disjoint UUID space from this
 * legacy `students.id`, so this does not weaken or change the decision.
 */
async function isSelfOrParentOf(client: Awaited<ReturnType<typeof createClient>>, studentId: string): Promise<boolean> {
  try {
    await requireStudent(client, studentId)
    return true
  } catch {
    // fall through to the parent check
  }
  try {
    await requireParent(client, studentId)
    return true
  } catch {
    return false
  }
}

const BodySchema = z.object({
  assessment_id: z.string().uuid(),
  student_id:    z.string().uuid(),
})

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    let userId: string
    try {
      userId = (await requireAuthentication(supabase)).id
    } catch (err) {
      if (err instanceof UnauthorizedError) return apiUnauthorized()
      throw err
    }

    const parsed = BodySchema.safeParse(await req.json())
    if (!parsed.success) {
      return apiBadRequest(parsed.error.issues.map(i => i.message).join(', '))
    }
    const { assessment_id, student_id } = parsed.data

    const db = createServiceClient()

    // Ownership check: student must belong to this parent (self-created OR teacher-linked)
    const { data: student } = await db
      .from('students')
      .select('id, user_id, parent_user_id, name')
      .eq('id', student_id)
      .single()
    if (!student) return apiForbidden()
    if (!(await isSelfOrParentOf(supabase, student_id))) return apiForbidden()

    const result = await runAssessmentPipeline({
      studentId:    student_id,
      assessmentId: assessment_id,
      actorName:    'Parent',
      actorUserId:  userId,
      notify:       false,
    })

    if (result.status === 'error') return apiError(result.error ?? 'Failed to process assessment')

    // Phase 1 / P0-B — the same canonical producer the teacher route already
    // calls (app/api/teacher/assessments/process). Until now this route wrote
    // an `assessments` row and a `student_learning_context` row and emitted
    // no Evidence at all, so a parent-entered assessment shaped what Compass
    // taught while staying invisible to the learner's canonical record.
    //
    // `teacherId` is null because this path genuinely has no teacher; the
    // producer reads `assessments.source` to emit `parent_observation`
    // (tier 1), which the existing confidence ceiling keeps at
    // `pending_review` — a parent-reported score can only reach canonical
    // state through a real teacher review.
    //
    // Fire-and-forget with the same failure isolation as the teacher route:
    // the pipeline has already succeeded by this point, and an Evidence
    // write failing must never fail the parent's request, their report, or
    // their PDF.
    recordReportCardAssessmentEvidence(assessment_id, student_id, null, userId).catch((e: unknown) =>
      console.error('[parent/assessments/process] recordReportCardAssessmentEvidence failed:', e instanceof Error ? e.message : String(e))
    )

    return apiSuccess({ result })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[parent/assessments/process POST]', msg)
    return apiError('Internal server error')
  }
}
