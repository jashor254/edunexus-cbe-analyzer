// app/api/teacher/assignments/[id]/variants/generate-all/route.ts
// Sprint 8 (Assessment Excellence) — the Review Dashboard's "Generate All"
// action. A prior sprint's friction finding: a 10-question adaptive quiz
// required 10 separate generate clicks, each a synchronous wait. This
// route loops the exact same generateVariantsForAssignmentQuestion()
// (lib/assignments/variantOrchestration.ts) the single-question generate
// route calls, one question at a time — no new AI pipeline, no new
// generation logic, only orchestration. Sequential (not parallel): each
// call is a real AI invocation with its own cost/rate-limit footprint;
// flooding the AI router with N concurrent requests for one click is a
// cost/reliability risk this route deliberately avoids. Skips questions
// that already have any non-archived variant, so re-running "Generate
// All" after reviewing some questions doesn't regenerate ones already in
// progress — a teacher who wants to regenerate a specific question still
// uses that question's own Regenerate button.

import { createClient } from '@/utils/supabase/server'
import { apiSuccess, apiError, apiUnauthorized, apiForbidden, apiNotFound } from '@/lib/api/response'
import { requireClassTeacher } from '@/lib/core/permissions'
import { UnauthorizedError, ResourceOwnershipError } from '@/lib/core/errors'
import { findQuestionsForTeacher } from '@/lib/quiz/quiz'
import { findVariantsForQuestionIds } from '@/lib/assignments/variants'
import { loadAssignmentGenerationContext, generateVariantsForAssignmentQuestion } from '@/lib/assignments/variantOrchestration'

export async function POST(
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
    const existingVariants = await findVariantsForQuestionIds(questions.map(q => q.id))
    const questionsWithVariants = new Set(existingVariants.filter(v => v.status !== 'archived').map(v => v.question_id))
    const targetQuestions = questions.filter(q => !questionsWithVariants.has(q.id))

    const perQuestion: Array<{ questionId: string; created: number; failed: number }> = []
    for (const question of targetQuestions) {
      try {
        const result = await generateVariantsForAssignmentQuestion(assignmentId, question.id, ctx)
        perQuestion.push({ questionId: question.id, created: result.created.length, failed: result.failed.length })
      } catch (e: unknown) {
        console.error('[variants generate-all]', question.id, e instanceof Error ? e.message : String(e))
        perQuestion.push({ questionId: question.id, created: 0, failed: 1 })
      }
    }

    return apiSuccess({
      processedCount: targetQuestions.length,
      skippedCount: questions.length - targetQuestions.length,
      perQuestion,
    })
  } catch (e: unknown) {
    console.error('[variants generate-all POST]', e instanceof Error ? e.message : String(e))
    return apiError('Internal server error')
  }
}
