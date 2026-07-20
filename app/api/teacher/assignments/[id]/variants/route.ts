// app/api/teacher/assignments/[id]/variants/route.ts
// Sprint 8 (Assessment Excellence) — GET every variant (any status) for
// every question of one assignment, in a single request. Replaces the
// Review Dashboard's prior pattern of one GET per question (N round trips
// for an N-question quiz) — same underlying data, same auth, just fetched
// once. No new authorization pattern: identical requireClassTeacher gate
// every sibling variant route already uses.

import { createClient } from '@/utils/supabase/server'
import { apiSuccess, apiError, apiUnauthorized, apiForbidden, apiNotFound } from '@/lib/api/response'
import { requireClassTeacher } from '@/lib/core/permissions'
import { UnauthorizedError, ResourceOwnershipError } from '@/lib/core/errors'
import { findQuestionsForTeacher } from '@/lib/quiz/quiz'
import { findVariantsForQuestionIds } from '@/lib/assignments/variants'
import { loadAssignmentGenerationContext } from '@/lib/assignments/variantOrchestration'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: assignmentId } = await params
    const ctx = await loadAssignmentGenerationContext(assignmentId)
    if (!ctx) return apiNotFound('Assignment not found')

    const supabase = await createClient()
    try {
      await requireClassTeacher(supabase, ctx.classId)
    } catch (err) {
      if (err instanceof UnauthorizedError) return apiUnauthorized()
      if (err instanceof ResourceOwnershipError) return apiForbidden()
      throw err
    }

    const questions = await findQuestionsForTeacher(assignmentId)
    const variants = await findVariantsForQuestionIds(questions.map(q => q.id))

    return apiSuccess({ variants })
  } catch (e: unknown) {
    console.error('[assignment variants GET]', e instanceof Error ? e.message : String(e))
    return apiError('Internal server error')
  }
}
