// app/api/teacher/assignments/[id]/paper-intelligence/review/route.ts
//
// Paper Intelligence Phase 1 — review data, question by question across the
// class: agree-with-AI groups, "your call" cards, reviewed marks.
//   GET → AssignmentReview
// Gated on currently teaching the assignment's class.

import { createClient } from '@/utils/supabase/server'
import { apiSuccess, apiError, apiUnauthorized, apiNotFound } from '@/lib/api/response'
import { UnauthorizedError } from '@/lib/core/errors'
import { requireAssignmentClassTeacher, AssignmentOwnershipError } from '@/lib/paperIntelligence/auth'
import { getAssignmentReview, type AssignmentReview } from '@/lib/paperIntelligence/review'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: assignmentId } = await params
  try {
    const supabase = await createClient()
    try {
      await requireAssignmentClassTeacher(supabase, assignmentId)
    } catch (err) {
      if (err instanceof UnauthorizedError) return apiUnauthorized()
      if (err instanceof AssignmentOwnershipError) return apiNotFound('Assignment not found')
      throw err
    }
    return apiSuccess<AssignmentReview>(await getAssignmentReview(assignmentId))
  } catch (e: unknown) {
    console.error('[paperIntelligence/review GET]', e instanceof Error ? e.message : String(e))
    return apiError('Internal server error')
  }
}
