// app/api/teacher/assignments/[id]/paper-intelligence/answers/route.ts
//
// Paper Intelligence Phase 1, Commit 6 — decide one "plausible, not in the
// scheme" answer for the whole class.
//   POST { rubricId, answerKey, decision: 'accept' | 'reject' }
// accept adds it to the scheme (audited) and re-scores every unreviewed
// learner who wrote it; reject re-scores them with it as incorrect.
// Gated on owning the assignment — the same authority that confirms the
// scheme itself (rubrics route), since accept changes the scheme.

import { z } from 'zod'
import { createClient } from '@/utils/supabase/server'
import { apiSuccess, apiError, apiUnauthorized, apiNotFound, apiBadRequest } from '@/lib/api/response'
import { UnauthorizedError } from '@/lib/core/errors'
import { requireOwnedAssignment, AssignmentOwnershipError } from '@/lib/paperIntelligence/auth'
import { decidePlausibleAnswer, AnswerDecisionError, type AnswerDecisionOutcome } from '@/lib/paperIntelligence/answerReview'

const DecisionSchema = z.object({
  rubricId: z.string().uuid(),
  answerKey: z.string().min(1).max(300),
  decision: z.enum(['accept', 'reject']),
})

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: assignmentId } = await params
  try {
    const parsed = DecisionSchema.safeParse(await req.json().catch(() => null))
    if (!parsed.success) return apiBadRequest(parsed.error.issues[0]?.message ?? 'Invalid input')

    const supabase = await createClient()
    let owned: Awaited<ReturnType<typeof requireOwnedAssignment>>
    try {
      owned = await requireOwnedAssignment(supabase, assignmentId)
    } catch (err) {
      if (err instanceof UnauthorizedError) return apiUnauthorized()
      if (err instanceof AssignmentOwnershipError) return apiNotFound('Assignment not found')
      throw err
    }

    try {
      const outcome = await decidePlausibleAnswer({
        assignmentId,
        rubricId: parsed.data.rubricId,
        answerKey: parsed.data.answerKey,
        decision: parsed.data.decision,
        teacherId: owned.teacherId,
        teacherUserId: owned.teacherUserId,
      })
      return apiSuccess<AnswerDecisionOutcome>(outcome)
    } catch (err) {
      if (err instanceof AnswerDecisionError) return apiError(err.message, 409)
      throw err
    }
  } catch (e: unknown) {
    console.error('[paperIntelligence/answers POST]', e instanceof Error ? e.message : String(e))
    return apiError('Internal server error')
  }
}
