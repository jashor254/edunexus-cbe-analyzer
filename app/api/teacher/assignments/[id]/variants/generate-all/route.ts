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
import { checkFeatureAccess, deductFeatureTokens } from '@/lib/payments/access'
import { checkDailyCallLimit } from '@/lib/ai/rateLimit'
import { findQuestionsForTeacher } from '@/lib/quiz/quiz'
import { findVariantsForQuestionIds } from '@/lib/assignments/variants'
import { loadAssignmentGenerationContext, generateVariantsForAssignmentQuestion } from '@/lib/assignments/variantOrchestration'

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const access = await checkFeatureAccess('adaptive_variant_generate')
    if (access.allowed === false) {
      return apiError(
        access.reason === 'insufficient_tokens' ? 'Insufficient tokens. Please top up to generate adaptive variants.' : 'Access denied',
        access.reason === 'unauthenticated' ? 401 : 403,
      )
    }

    const rateLimit = await checkDailyCallLimit(access.userId, 'adaptive_variant_generate')
    if (rateLimit.allowed === false) {
      return apiError(`Daily limit of ${rateLimit.limit} variant generations reached. Resets at ${rateLimit.resetAt}`, 429)
    }

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

    // Token-tier users are billed per question actually generated, deducted
    // immediately after each successful call — never before, and never for
    // questions that fail. If a token user's balance runs out mid-batch, the
    // batch stops there rather than generating further questions for free.
    const perQuestion: Array<{ questionId: string; created: number; failed: number }> = []
    for (const question of targetQuestions) {
      try {
        const result = await generateVariantsForAssignmentQuestion(assignmentId, question.id, ctx)
        perQuestion.push({ questionId: question.id, created: result.created.length, failed: result.failed.length })
        if (access.deductTokens) {
          await deductFeatureTokens(access.userId, 'adaptive_variant_generate', access.cost)
        }
      } catch (e: unknown) {
        console.error('[variants generate-all]', question.id, e instanceof Error ? e.message : String(e))
        perQuestion.push({ questionId: question.id, created: 0, failed: 1 })
        if (access.deductTokens && e instanceof Error && e.message.includes('Token deduction failed')) {
          break
        }
      }
    }

    return apiSuccess({
      processedCount: perQuestion.length,
      skippedCount: questions.length - targetQuestions.length,
      perQuestion,
    })
  } catch (e: unknown) {
    console.error('[variants generate-all POST]', e instanceof Error ? e.message : String(e))
    return apiError('Internal server error')
  }
}
