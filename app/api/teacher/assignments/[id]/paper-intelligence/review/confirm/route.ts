// app/api/teacher/assignments/[id]/paper-intelligence/review/confirm/route.ts
//
// Paper Intelligence Phase 1 — record the teacher's review decisions.
//   POST { decisions: [{ submissionId, rubricId, finalMark }] }
// One call per confirmed group or card. Reports the scripts whose last
// question this call reviewed; nothing is filed — the teacher uploads the
// whole paper once satisfied (…/paper-intelligence/upload).
// The reviewer is the session's teacher — never an id from the body.

import { z } from 'zod'
import { createClient } from '@/utils/supabase/server'
import { apiSuccess, apiError, apiUnauthorized, apiNotFound, apiBadRequest } from '@/lib/api/response'
import { UnauthorizedError } from '@/lib/core/errors'
import { requireAssignmentClassTeacher, AssignmentOwnershipError } from '@/lib/paperIntelligence/auth'
import { confirmQuestionMarks, ReviewDecisionError, type ConfirmOutcome } from '@/lib/paperIntelligence/review'

const ConfirmSchema = z.object({
  decisions: z.array(z.object({
    submissionId: z.string().uuid(),
    rubricId: z.string().uuid(),
    finalMark: z.number().int().min(0),
  })).min(1).max(300),
})

export type ConfirmResponse = ConfirmOutcome

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: assignmentId } = await params
  try {
    const parsed = ConfirmSchema.safeParse(await req.json().catch(() => null))
    if (!parsed.success) return apiBadRequest(parsed.error.issues[0]?.message ?? 'Invalid input')

    const supabase = await createClient()
    let access: Awaited<ReturnType<typeof requireAssignmentClassTeacher>>
    try {
      access = await requireAssignmentClassTeacher(supabase, assignmentId)
    } catch (err) {
      if (err instanceof UnauthorizedError) return apiUnauthorized()
      if (err instanceof AssignmentOwnershipError) return apiNotFound('Assignment not found')
      throw err
    }

    let outcome: ConfirmOutcome
    try {
      outcome = await confirmQuestionMarks({
        assignmentId,
        classId: access.assignment.class_id,
        teacherId: access.teacherId,
        teacherUserId: access.teacherUserId,
        decisions: parsed.data.decisions,
      })
    } catch (err) {
      if (err instanceof ReviewDecisionError) return apiBadRequest(err.message)
      throw err
    }

    return apiSuccess<ConfirmResponse>(outcome)
  } catch (e: unknown) {
    console.error('[paperIntelligence/review/confirm POST]', e instanceof Error ? e.message : String(e))
    return apiError('Internal server error')
  }
}
