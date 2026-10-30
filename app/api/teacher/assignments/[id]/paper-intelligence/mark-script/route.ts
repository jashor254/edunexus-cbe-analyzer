// app/api/teacher/assignments/[id]/paper-intelligence/mark-script/route.ts
//
// Paper Intelligence Phase 1 — mark one learner's whole captured script.
//   POST { submissionId } → AI proposals per question, written as
//   pending_review evidence + paper_intelligence_script_marks rows. Never a
//   final mark: a teacher reviews every one (Commit 5).
//
// Authorization (currently teaches this learner's class) runs before any page
// is downloaded or any AI call is made.

import { z } from 'zod'
import { createClient } from '@/utils/supabase/server'
import { apiSuccess, apiError, apiUnauthorized, apiForbidden, apiNotFound, apiBadRequest } from '@/lib/api/response'
import { UnauthorizedError } from '@/lib/core/errors'
import { requireScriptAccess, ScriptAccessError, SubmissionNotFoundError } from '@/lib/paperIntelligence/auth'
import {
  markSubmissionScript,
  ScriptAlreadyReviewedError,
  ScriptNotReadyError,
  ScriptMarkingFailedError,
  type MarkScriptOutcome,
} from '@/lib/paperIntelligence/markScript'
import { checkDailyCallLimit, releaseDailyCall } from '@/lib/ai/rateLimit'
import { AttemptLimiterUnavailableError } from '@/lib/security/attemptLimiter'

// One vision call (~11s on the Phase 0 scripts) plus one retry on a malformed
// response, with headroom for a slow provider.
export const maxDuration = 120

const MarkScriptSchema = z.object({
  submissionId: z.string().uuid(),
})

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: assignmentId } = await params
  try {
    const parsed = MarkScriptSchema.safeParse(await req.json().catch(() => null))
    if (!parsed.success) return apiBadRequest(parsed.error.issues[0]?.message ?? 'Invalid input')

    const supabase = await createClient()
    let access: Awaited<ReturnType<typeof requireScriptAccess>>
    try {
      access = await requireScriptAccess(supabase, assignmentId, parsed.data.submissionId)
    } catch (err) {
      if (err instanceof UnauthorizedError) return apiUnauthorized()
      if (err instanceof SubmissionNotFoundError) return apiNotFound('Submission not found for this assignment')
      if (err instanceof ScriptAccessError) return apiForbidden()
      throw err
    }

    // Daily cap on vision calls, reserved before the script is sent.
    const quota = await checkDailyCallLimit(access.teacherUserId, 'paper_script_marking')
    if (quota.allowed === false) {
      return apiError(`Daily limit of ${quota.limit} script markings reached. Resets at ${quota.resetAt}`, 429)
    }

    try {
      const outcome = await markSubmissionScript({ assignmentId, submission: access.submission, teacherUserId: access.teacherUserId })
      return apiSuccess<MarkScriptOutcome>(outcome)
    } catch (err) {
      // No marking was produced — refund the slot whatever the reason.
      await releaseDailyCall(quota)
      if (err instanceof ScriptAlreadyReviewedError) return apiError(err.message, 409)
      if (err instanceof ScriptNotReadyError) return apiBadRequest(err.message)
      // Already logged durably in paper_intelligence_failure_log; no evidence written.
      if (err instanceof ScriptMarkingFailedError) return apiError(err.message, 502)
      throw err
    }
  } catch (e: unknown) {
    if (e instanceof AttemptLimiterUnavailableError) return apiError(e.message, 503)
    console.error('[paperIntelligence/mark-script POST]', e instanceof Error ? e.message : String(e))
    return apiError('Internal server error')
  }
}
