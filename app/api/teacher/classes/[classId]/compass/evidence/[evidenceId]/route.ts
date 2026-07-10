// app/api/teacher/classes/[classId]/compass/evidence/[evidenceId]/route.ts
// PATCH — teacher confirms or rejects a pending Compass evidence claim.
//
// This is Compass v2 Wave 2, Phase 10: the missing review flow the Evidence
// Domain and Projection Engine were already built to expect (per the audit,
// confirmReview/rejectReview had zero production callers before this route).
// Reuses the existing Evidence Domain lifecycle verbatim — no second review
// mechanism, no new lifecycle states. Illegal transitions (e.g. confirming an
// already-rejected or already-superseded row) are rejected by the existing
// database trigger (enforce_evidence_lifecycle_transition); this route only
// adds a clean pre-check so a teacher gets a readable error instead of a raw
// 500 when that happens.

import { NextRequest } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { repos } from '@/lib/repositories'
import { resolveTeacherOwnership } from '@/lib/compass/ownership'
import { confirmReview, rejectReview } from '@/lib/intelligence/evidenceLifecycle'
import { apiSuccess, apiError, apiUnauthorized, apiForbidden, apiBadRequest, apiNotFound, getErrorMessage } from '@/lib/api/response'
import { z } from 'zod'

const BodySchema = z.object({
  studentId: z.string().uuid(),
  action:    z.enum(['confirm', 'reject']),
  reason:    z.string().min(1).optional(),
}).refine(
  body => body.action !== 'reject' || !!body.reason,
  { message: 'reason is required when rejecting evidence', path: ['reason'] },
)

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ classId: string; evidenceId: string }> }
) {
  try {
    const { evidenceId } = await params

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return apiUnauthorized()

    const parsed = BodySchema.safeParse(await req.json())
    if (!parsed.success) return apiBadRequest(parsed.error.issues[0]?.message ?? 'Invalid request')
    const { studentId, action, reason } = parsed.data

    const ownership = await resolveTeacherOwnership(user.id, studentId)
    if (!ownership.allowed) return apiForbidden()

    const evidence = await repos.evidence.findEvidenceById(evidenceId)
    if (!evidence) return apiNotFound('Evidence not found')

    // Scope this surface to Compass evidence for the student the teacher was
    // just verified against — a teacher authorized for student A must not be
    // able to review student B's evidence by supplying an arbitrary evidenceId.
    if (evidence.learner_id !== studentId) return apiForbidden()
    if (evidence.evidence_source !== 'compass_session') return apiForbidden()

    if (evidence.lifecycle_state !== 'pending_review') {
      return apiBadRequest(`Evidence is already ${evidence.lifecycle_state} — only pending_review evidence can be reviewed`)
    }

    const updated = action === 'confirm'
      ? await confirmReview(evidenceId, user.id, reason ?? null)
      : await rejectReview(evidenceId, user.id, reason as string)

    return apiSuccess({
      id:             updated.id,
      lifecycleState: updated.lifecycle_state,
      reviewedAt:      updated.reviewed_at,
      reviewReason:    updated.review_reason,
    })
  } catch (err) {
    console.error('[teacher/classes/compass/evidence PATCH]', err)
    return apiError(getErrorMessage(err), 500)
  }
}
