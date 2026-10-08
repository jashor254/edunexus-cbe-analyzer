// app/api/teacher/assignments/[id]/paper-intelligence/rubrics/route.ts
//
// Paper Intelligence Phase 1 — rubric persistence + read.
//   GET  → the current confirmed rubrics for this assignment (editor preload).
//   POST → persist the teacher-CONFIRMED (and possibly edited) rubric set.
//
// POST is the only path that writes open_response_rubrics for this feature,
// and it runs exclusively on teacher-submitted, teacher-reviewed data — the
// AI's extract-rubric output never reaches this route except through the
// teacher's own Confirm. The same arithmetic contract the model output is held
// to is re-checked here, so a bad hand-edit ("Any 4x2 = 9") is refused too.

import { z } from 'zod'
import { createClient } from '@/utils/supabase/server'
import { apiSuccess, apiError, apiUnauthorized, apiNotFound, apiBadRequest } from '@/lib/api/response'
import { UnauthorizedError } from '@/lib/core/errors'
import { requireOwnedAssignment, AssignmentOwnershipError } from '@/lib/paperIntelligence/auth'
import { replaceRubricsForAssignment, findRubricsForAssignment } from '@/lib/paperIntelligence/rubrics'
import { ExtractedRubricSchema, validateExtractedRubrics } from '@/lib/paperIntelligence/schemeValidation'

const PersistSchema = z.object({
  rubrics: z.array(ExtractedRubricSchema).min(1).max(50),
})

async function authorize(supabase: Awaited<ReturnType<typeof createClient>>, assignmentId: string) {
  try {
    return { owned: await requireOwnedAssignment(supabase, assignmentId) }
  } catch (err) {
    if (err instanceof UnauthorizedError) return { response: apiUnauthorized() }
    if (err instanceof AssignmentOwnershipError) return { response: apiNotFound('Assignment not found') }
    throw err
  }
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: assignmentId } = await params
  try {
    const supabase = await createClient()
    const auth = await authorize(supabase, assignmentId)
    if (auth.response) return auth.response

    const rows = await findRubricsForAssignment(assignmentId)
    return apiSuccess({
      rubrics: rows.map(r => ({
        id: r.id,
        questionNumber: r.question_number,
        questionLabel: r.question_label,
        questionText: r.question_text,
        maxMarks: r.max_marks,
        mode: r.mode,
        pointsRequired: r.points_required,
        marksPerPoint: r.marks_per_point,
        acceptedAnswers: r.accepted_answers,
      })),
    })
  } catch (e: unknown) {
    console.error('[paperIntelligence/rubrics GET]', e instanceof Error ? e.message : String(e))
    return apiError('Internal server error')
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: assignmentId } = await params
  try {
    const supabase = await createClient()
    const auth = await authorize(supabase, assignmentId)
    if (auth.response) return auth.response

    const parsed = PersistSchema.safeParse(await req.json())
    if (!parsed.success) return apiBadRequest(parsed.error.issues[0]?.message ?? 'Invalid input')

    // Re-check the mark arithmetic on the confirmed set — a hand-edit that no
    // longer adds up is refused with the offending questions named.
    const invalid = validateExtractedRubrics({ rubrics: parsed.data.rubrics })
      .filter((v): v is Extract<ReturnType<typeof validateExtractedRubrics>[number], { valid: false }> => !v.valid)
    if (invalid.length > 0) {
      return apiBadRequest(`Some rubrics do not add up: ${invalid.map(i => `${i.questionId} (${i.reason})`).join('; ')}`)
    }

    const saved = await replaceRubricsForAssignment(assignmentId, auth.owned.teacherId, parsed.data.rubrics)
    return apiSuccess({ saved: saved.length })
  } catch (e: unknown) {
    console.error('[paperIntelligence/rubrics POST]', e instanceof Error ? e.message : String(e))
    return apiError('Internal server error')
  }
}
