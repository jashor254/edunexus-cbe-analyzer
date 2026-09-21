// app/api/teacher/assignments/[id]/paper-intelligence/mark-page/route.ts
//
// Paper Intelligence Prototype 01 — the orchestrator the pre-build/adversarial
// audits both identified as the one remaining P0 boundary: takes an
// authorized teacher + assignment + an already-uploaded submission image,
// and produces validated, pending_review learner evidence.
//
// The ONLY client-supplied input is `submissionId` — never an image URL,
// never a studentId, never a rubric selection. Everything else (which
// image, which student, which class, which rubrics) is resolved
// server-side from trusted rows, exactly mirroring
// app/api/teacher/assignments/[id]/submissions/[submissionId]/file-url/route.ts's
// own trust boundary (same bucket, same ownership check, same "the
// submission row IS the authority for which file/class/student this is").
//
// Authorization happens BEFORE any image retrieval or Gemini call — no
// cross-tenant or expensive work occurs ahead of the ownership check.

import { z } from 'zod'
import { createClient } from '@/utils/supabase/server'
import { createServiceClient } from '@/utils/supabase/service'
import { apiSuccess, apiError, apiUnauthorized, apiForbidden, apiNotFound, apiBadRequest } from '@/lib/api/response'
import { requireAuthentication, requireClassTeacher } from '@/lib/core/permissions'
import { ResourceOwnershipError, UnauthorizedError } from '@/lib/core/errors'
import { isAllowedUploadType } from '@/lib/config/uploads'
import { recognizeAndMarkPage, PaperVisionInputError } from '@/lib/paperIntelligence/vision'
import { PaperVisionParseError } from '@/lib/paperIntelligence/validation'
import { findRubricsForAssignment, toRubricForMarking } from '@/lib/paperIntelligence/rubrics'
import { recordPaperIntelligenceEvidence } from '@/lib/paperIntelligence/evidence'
import { logPaperIntelligenceFailure } from '@/lib/paperIntelligence/failureLog'

const BUCKET = 'assignment-submissions'

const RequestSchema = z.object({
  submissionId: z.string().uuid(),
})

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: assignmentId } = await params
  let correlationId = 'unresolved'

  try {
    // ── 1/2. Authenticate + resolve teacher ──────────────────────────────
    const supabase = await createClient()
    let teacherUserId: string
    try {
      teacherUserId = (await requireAuthentication(supabase)).id
    } catch (err) {
      if (err instanceof UnauthorizedError) return apiUnauthorized()
      throw err
    }

    const parsed = RequestSchema.safeParse(await req.json())
    if (!parsed.success) return apiBadRequest(parsed.error.issues[0]?.message ?? 'Invalid input')
    const { submissionId } = parsed.data
    correlationId = `${assignmentId}:${submissionId}`

    const db = createServiceClient()

    // ── 3/4. Verify the submission belongs to THIS assignment, then verify
    // class ownership via the submission's own class_id — the exact
    // pattern the existing file-url route already uses. No client input
    // beyond submissionId is trusted for identity of image/student/class. ──
    const { data: submission } = await db
      .from('assignment_submissions')
      .select('id, assignment_id, class_id, student_id, file_path, file_type')
      .eq('id', submissionId)
      .maybeSingle()

    if (!submission) return apiNotFound('Submission not found')
    if (submission.assignment_id !== assignmentId) {
      // A real submissionId that belongs to a DIFFERENT assignment — even
      // one the same teacher owns — must never be paired with this
      // assignment's rubrics/questions. Reported as not-found, matching
      // requireClassTeacher's own "indistinguishable from doesn't exist"
      // convention rather than leaking which assignment it really belongs to.
      return apiNotFound('Submission not found for this assignment')
    }

    try {
      await requireClassTeacher(supabase, submission.class_id, db)
    } catch (err) {
      if (err instanceof ResourceOwnershipError) return apiForbidden()
      throw err
    }

    if (!submission.file_path) return apiBadRequest('This submission has no attached image')
    if (!submission.file_type || !isAllowedUploadType(submission.file_type)) {
      return apiBadRequest('Submitted file is not a supported image type')
    }

    // ── 5. Rubrics are resolved server-side for this assignment only —
    // never selected/supplied by the client. ────────────────────────────
    const rubricRows = await findRubricsForAssignment(assignmentId)
    if (rubricRows.length === 0) return apiBadRequest('No open-response rubrics configured for this assignment')

    // ── 6. Obtain the image server-side — download by the submission's own
    // trusted storage path, never a client-supplied URL/path. ───────────
    const { data: fileBlob, error: downloadError } = await db.storage.from(BUCKET).download(submission.file_path)
    if (downloadError || !fileBlob) {
      await logPaperIntelligenceFailure({
        assignmentId, studentId: submission.student_id, imageRef: submission.file_path,
        operation: 'vision_call', errorCategory: 'storage_download_failed',
        errorMessage: downloadError?.message ?? 'no file blob returned', correlationId,
      })
      return apiError('Failed to retrieve the submitted image', 500)
    }
    const imageBase64 = Buffer.from(await fileBlob.arrayBuffer()).toString('base64')

    // ── 7/8. Vision call + validation (recognizeAndMarkPage already
    // validates internally — see lib/paperIntelligence/validation.ts). ──
    let visionResult: Awaited<ReturnType<typeof recognizeAndMarkPage>>
    try {
      visionResult = await recognizeAndMarkPage({
        imageBase64,
        mimeType: submission.file_type as 'image/jpeg' | 'image/png' | 'image/webp',
        rubrics: rubricRows.map(toRubricForMarking),
        correlationId,
      })
    } catch (err) {
      const errorCategory = err instanceof PaperVisionInputError ? 'invalid_input'
        : err instanceof PaperVisionParseError ? 'model_response_invalid'
        : 'vision_provider_error'
      await logPaperIntelligenceFailure({
        assignmentId, studentId: submission.student_id, imageRef: submission.file_path,
        operation: 'vision_call', errorCategory,
        errorMessage: err instanceof Error ? err.message : String(err), correlationId,
      })
      // No evidence write ever happens on a vision failure — fail closed.
      return apiError('Could not process the submitted image', 502)
    }

    if (visionResult.response.questions.length === 0) {
      return apiSuccess({ evidenceCreated: 0, pendingReview: 0, rejected: visionResult.rejected, message: 'No answers were recognized on this page' })
    }

    // ── 9/10. Write evidence — always pending_review, never client-controlled. ──
    const { data: studentRow } = await db.from('students').select('school_id').eq('id', submission.student_id).maybeSingle()
    const { data: assignmentRow } = await db.from('assignments').select('subject').eq('id', assignmentId).single()

    const subStrandIdByRubricId = new Map(rubricRows.map(r => [r.id, r.sub_strand_id]))

    const evidenceResult = await recordPaperIntelligenceEvidence({
      assignmentId,
      studentId: submission.student_id,
      teacherUserId,
      schoolId: studentRow?.school_id ?? null,
      subject: assignmentRow?.subject ?? 'Unknown',
      academicYear: new Date().getFullYear(),
      term: null,
      imageRef: submission.file_path,
      subStrandIdByRubricId,
      answers: visionResult.response.questions,
    })

    // ── 11. Minimal result — enough for a teacher's review queue, never the raw image. ──
    return apiSuccess({
      evidenceCreated: visionResult.response.questions.length - evidenceResult.failedWrites,
      pendingReview: evidenceResult.pendingReviewCount,
      failedWrites: evidenceResult.failedWrites,
      rejectedByValidation: visionResult.rejected,
      questions: visionResult.response.questions.map(q => ({
        questionNumber: q.questionNumber,
        recognizedAnswer: q.recognizedAnswer,
        proposedMark: q.proposedMark,
        maxMark: q.maxMark,
        recognitionConfidence: q.recognitionConfidence,
        gradingConfidence: q.gradingConfidence,
        uncertain: q.uncertain,
      })),
      metadata: visionResult.response.metadata,
    })
  } catch (e: unknown) {
    console.error('[paperIntelligence/mark-page]', e instanceof Error ? e.message : String(e))
    return apiError('Internal server error')
  }
}
