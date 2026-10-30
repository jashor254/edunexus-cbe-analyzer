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
import { apiPaymentRequired } from '@/lib/payments/paywall'
import { reserveDailyCall, dailyLimitMessage } from '@/lib/ai/rateLimit'
import { BAND_TO_TIER } from '@/lib/assignments/variantGeneration'
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
      if (access.reason === 'insufficient_tokens') return apiPaymentRequired('adaptive_variant_generate')
      return apiError(
        'Access denied',
        access.reason === 'unauthenticated' ? 401 : 403,
      )
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
    // Every tier the pipeline can produce (BAND_TO_TIER is the one
    // band→tier map). This was a hard-coded `3` while there are four tiers,
    // so a question holding any three — or three legacy-typed rows — was
    // skipped even though a current tier was still missing.
    const ALL_TIERS = [...new Set(Object.values(BAND_TO_TIER))]
    const targetQuestions = questions.filter(q => {
      const live = liveTypesByQuestion.get(q.id)
      return ALL_TIERS.some(tier => !live?.has(tier))
    })

    // Token-tier users are billed per question actually generated, deducted
    // immediately after each successful call — never before, and never for
    // questions that fail. If a token user's balance runs out mid-batch, the
    // batch stops there rather than generating further questions for free.
    // One unit of today's cap per question, reserved just before that
    // question's AI work (the cap is "variant generations", and a batch must
    // not be a way around it). Exhausting the cap mid-batch stops the batch
    // there and says so, rather than silently generating the rest.
    const perQuestion: Array<{ questionId: string; created: number; failed: number }> = []
    let stoppedByDailyLimit: string | null = null
    for (const question of targetQuestions) {
      const quota = await reserveDailyCall(access.userId, 'adaptive_variant_generate')
      if (quota.allowed === false) {
        stoppedByDailyLimit = dailyLimitMessage(quota, 'variant generations')
        break
      }
      try {
        const result = await generateVariantsForAssignmentQuestion(assignmentId, question.id, ctx)
        if (result.created.length === 0) await quota.release('no variant produced')
        perQuestion.push({ questionId: question.id, created: result.created.length, failed: result.failed.length })
        // Charge only for questions that actually produced a variant. Stage
        // 7 made generation additive, so a question whose needed tiers all
        // already exist is now a legitimate no-op reached without an AI
        // call — billing it would charge a teacher for nothing.
        if (access.deductTokens && result.created.length > 0) {
          await deductFeatureTokens(access.userId, 'adaptive_variant_generate', access.cost)
        }
      } catch (e: unknown) {
        await quota.release('variant generation failed')
        console.error('[variants generate-all]', question.id, e instanceof Error ? e.message : String(e))
        perQuestion.push({ questionId: question.id, created: 0, failed: 1 })
        if (access.deductTokens && e instanceof Error && e.message.includes('Token deduction failed')) {
          break
        }
      }
    }

    if (stoppedByDailyLimit !== null && perQuestion.length === 0) {
      return apiError(stoppedByDailyLimit, 429)
    }

    return apiSuccess({
      processedCount: perQuestion.length,
      skippedCount: questions.length - targetQuestions.length,
      perQuestion,
      ...(stoppedByDailyLimit !== null ? { stoppedByDailyLimit } : {}),
    })
  } catch (e: unknown) {
    console.error('[variants generate-all POST]', e instanceof Error ? e.message : String(e))
    return apiError('Internal server error')
  }
}
