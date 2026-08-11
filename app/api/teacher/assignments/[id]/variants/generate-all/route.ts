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

    // Adaptive Remediation Phase 1, Stage 7. This used to skip any question
    // that already had a single non-archived variant, which meant a question
    // holding (say) foundation + supported_practice could never acquire an
    // extension variant later — so a learner who improved into `on_track`
    // after the first generation was permanently served the canonical
    // question. The skip is now "this question is missing nothing", not
    // "this question has something".
    //
    // Which tiers are actually missing is decided per question inside
    // generateAdaptiveVariants() (the one place that knows what the class
    // roster currently needs). This route only avoids paying for a question
    // that already has all three deliverable tiers — the only case where
    // that call is guaranteed to be a no-op.
    const liveTypesByQuestion = new Map<string, Set<string>>()
    for (const v of existingVariants) {
      if (v.status === 'archived' || v.status === 'rejected') continue
      const set = liveTypesByQuestion.get(v.question_id) ?? new Set<string>()
      set.add(v.variant_type)
      liveTypesByQuestion.set(v.question_id, set)
    }
    const ALL_TIERS = 3
    const targetQuestions = questions.filter(q => (liveTypesByQuestion.get(q.id)?.size ?? 0) < ALL_TIERS)

    // Token-tier users are billed per question actually generated, deducted
    // immediately after each successful call — never before, and never for
    // questions that fail. If a token user's balance runs out mid-batch, the
    // batch stops there rather than generating further questions for free.
    const perQuestion: Array<{ questionId: string; created: number; failed: number }> = []
    for (const question of targetQuestions) {
      try {
        const result = await generateVariantsForAssignmentQuestion(assignmentId, question.id, ctx)
        perQuestion.push({ questionId: question.id, created: result.created.length, failed: result.failed.length })
        // Charge only for questions that actually produced a variant. Stage
        // 7 made generation additive, so a question whose needed tiers all
        // already exist is now a legitimate no-op reached without an AI
        // call — billing it would charge a teacher for nothing.
        if (access.deductTokens && result.created.length > 0) {
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
