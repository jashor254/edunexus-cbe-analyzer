// lib/assignments/variantGeneration.ts
// Adaptive Variant Generation Pipeline (Sprint 9 Slice 2 — ADR-0025/0026,
// Sprint 5A design, now implemented). Consumes Sprint 9 Slice 1's schema
// exactly as built; introduces zero new persistence model, zero new
// curriculum resolution, zero new instructional classifier, zero new AI
// invocation path.
//
// Canonical reasoning chain, every link reused, none recomputed:
//   recommendForClass()          — Recommendation (Phase 3, unmodified)
//   deriveEducationalAIContext() — Sprint 7A, pure reshape, zero new computation
//   CurriculumService            — ADR-0024, resolved once, reused verbatim
//   routedCompletion()           — Sprint 6B, the one canonical AI invocation path
//   createDraftVariants()/regenerateVariant() — Sprint 9 Slice 1's own repository
//
// Prompt safety (verified, not assumed): AdaptiveTask.observation/action
// embed the learner's first name (e.g. "Amina is currently at Level 2...").
// EducationalAIContext is built from a real, evidence-grounded learner
// (never a synthetic aggregate — "never fabricate" applies to context
// construction too), but only a redacted subset of it — band, academicGrain,
// curriculum, confidence — ever reaches the AI prompt. learnerId,
// observation, action, and supportingEvidenceIds never leave this module.

import { recommendForClass, type AdaptiveGroupType, type AdaptiveTask } from '@/lib/adaptiveLearning/recommend'
import { deriveEducationalAIContext, type EducationalAIContext } from '@/lib/ai/educationalContext'
import { CurriculumService, type CurriculumContext } from '@/lib/curriculum/service'
import { routedCompletion } from '@/lib/ai-orchestration/router'
import type { AIRequest, AIResponse } from '@/lib/ai-orchestration/types'
import { findQuestionById, type TeacherQuestionRow } from '@/lib/quiz/quiz'
import { createDraftVariants, findLiveVariantTypesForQuestion, findVariantById, regenerateVariant, type VariantInput, type VariantRow, type VariantType } from './variants'
import { buildGenerationPrompt, buildVerificationPrompt, type RedactedContext } from './variantPrompt'
import { generateWithVerification, verifyResponse, type VerifiedGenerationFailureKind } from './variantVerification'
import { ADAPTIVE_VARIANT_MAX_GENERATION_ATTEMPTS } from '@/lib/config/adaptiveVariants'

/**
 * The AI call surface this module depends on — real dependency injection,
 * not module mocking. Every exported function below defaults this to the
 * real routedCompletion() (Sprint 6B, the one canonical AI invocation path
 * in production) but accepts an override so tests can inject a fake
 * implementation directly, deterministically, with zero real AI calls and
 * zero cost. Node's `--experimental-test-module-mocks` (mock.module) was
 * tried first and rejected: it intermittently failed to intercept this
 * module's import in practice — confirmed by real DeepSeek API calls
 * appearing in a test run that was supposed to be fully mocked — which is
 * both a real-money risk and makes failure-path tests non-deterministic.
 * Plain parameter injection has neither problem.
 */
export type RoutedCompletionFn = (request: AIRequest) => Promise<AIResponse>

// The one band-to-tier mapping, now a straight 1:1 with Kenya's real CBC
// level rubric — one tier per level, never two levels collapsed into one
// tier as the former critical_gap/prerequisite_gap split into 'foundation'
// used to. 'extension' remains the only tier gated on a real EE (Exceeding
// Expectations) learner actually being present — never generated
// speculatively for a class with nobody currently at that level.
export const BAND_TO_TIER: Record<AdaptiveGroupType, VariantType> = {
  BE: 'foundation',
  AE: 'guided_practice',
  ME: 'supported_practice',
  EE: 'extension',
}

function redactForPrompt(ctx: EducationalAIContext): RedactedContext {
  return { subject: ctx.subject, band: ctx.band, academicGrain: ctx.academicGrain, confidence: ctx.confidence }
}

export type GenerationFailure = {
  tier: VariantType
  reason: string
  /** P0-2 — why verification did not produce a savable draft. Absent for provider errors. */
  failure?: VerifiedGenerationFailureKind
  attempts?: number
}
export type GenerationResult = { created: VariantRow[]; failed: GenerationFailure[]; tiersConsidered: VariantType[] }

/**
 * Determines which tiers this class roster actually needs, per the frozen
 * cost discipline (ADR-0025/Sprint 5A): never all three unconditionally,
 * only the tiers a real learner in the class is actually classified into.
 * Reuses recommendForClass() exactly — no independent band computation.
 */
export async function resolveTiersForClass(
  learners: Array<{ learnerId: string; learnerName: string }>,
  subject: string,
  subStrandId?: string | null,
): Promise<Map<VariantType, AdaptiveTask>> {
  const groups = await recommendForClass(learners, subject, { subStrandId })
  const representativeTaskByTier = new Map<VariantType, AdaptiveTask>()

  for (const [band, tasks] of Object.entries(groups) as Array<[AdaptiveGroupType | 'insufficient_data', AdaptiveTask[]]>) {
    const tier = BAND_TO_TIER[band as AdaptiveGroupType]
    if (!tier || tasks.length === 0) continue
    if (!representativeTaskByTier.has(tier)) representativeTaskByTier.set(tier, tasks[0])
  }

  return representativeTaskByTier
}

// buildGenerationPrompt / buildVerificationPrompt live in ./variantPrompt
// (pure, so the prompt itself is unit-tested in the STANDARD tier).

type ParsedVariant = {
  questionText: string
  choices: string[]
  correctIndex: number
  cognitiveIntent?: string
  difficultyRationale?: string
  expectedMisconceptions?: string[]
  teacherExplanation?: string
  learnerExplanation?: string
}

/** Deterministic structural checks — no AI call, no new intelligence. */
function validateStructure(v: ParsedVariant | null): string | null {
  if (!v) return 'Response was not valid JSON'
  if (!v.questionText?.trim()) return 'Missing questionText'
  if (!Array.isArray(v.choices) || v.choices.length < 2) return 'choices must have at least 2 entries'
  if (new Set(v.choices.map(c => c.trim().toLowerCase())).size !== v.choices.length) return 'choices contains duplicates'
  if (!Number.isInteger(v.correctIndex) || v.correctIndex < 0 || v.correctIndex >= v.choices.length) return 'correctIndex out of range'
  return null
}

function parseJsonResponse<T>(text: string): T | null {
  try {
    const cleaned = text.trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/, '')
    return JSON.parse(cleaned) as T
  } catch {
    return null
  }
}

type OneTierResult = { parsed: ParsedVariant } | { error: string; failure?: VerifiedGenerationFailureKind; attempts?: number }

/**
 * Generation + independent verification for exactly one (question, tier)
 * pair — the one place both AI calls in this pipeline happen. Shared by
 * generateAdaptiveVariants() (new tiers) and regenerateOneVariant()
 * (Sprint 9 Slice 1's atomic regenerate operation) so neither reimplements
 * the prompt/verification logic independently.
 */
async function generateOneTier(
  canonical: TeacherQuestionRow,
  curriculum: CurriculumContext | null,
  tier: VariantType,
  context: RedactedContext,
  callAI: RoutedCompletionFn,
): Promise<OneTierResult> {
  try {
    // P0-2 — bounded generate → verify → retry (variantVerification.ts). Only
    // a fully clean verdict is returned as `parsed` (and so ever persisted);
    // a regenerated draft is re-verified from scratch, and exhausted attempts
    // come back as an error, never as the last unverified draft.
    const result = await generateWithVerification<ParsedVariant>({
      maxAttempts: ADAPTIVE_VARIANT_MAX_GENERATION_ATTEMPTS,
      generate: async (feedback) => {
        const { system, prompt } = buildGenerationPrompt(canonical, curriculum, tier, context, feedback)
        const generation = await callAI({ prompt, system, mode: 'quality', max_tokens: 700, temperature: 0.4, feature: 'adaptive_variant.generate' })
        const parsed = parseJsonResponse<ParsedVariant>(generation.text)
        const structuralError = validateStructure(parsed)
        return structuralError ? { structuralError } : { draft: parsed! }
      },
      verify: async (draft) => {
        const { system, prompt } = buildVerificationPrompt({
          canonical,
          learningOutcome: curriculum?.learningOutcomes[0] ?? null,
          tier,
          variant: draft,
        })
        const verification = await callAI({ prompt, system, mode: 'quality', max_tokens: 500, temperature: 0, feature: 'adaptive_variant.verify' })
        return verifyResponse(verification.text)
      },
    })

    if (result.status === 'verified') return { parsed: result.draft }
    return { error: result.reason, failure: result.failure, attempts: result.attempts }
  } catch (err) {
    // Router/provider failure (both providers down, timeout, etc.) — the
    // canonical question and any already-persisted variants are untouched;
    // only this one generation attempt fails.
    return { error: err instanceof Error ? err.message : String(err) }
  }
}

/**
 * Generates draft variants for one canonical question, for exactly the
 * tiers this class roster needs (never all three unconditionally). Every
 * AI call goes through routedCompletion() — no direct provider call
 * anywhere in this module. A tier that fails structural validation or the
 * independent verification pass is never persisted — it's reported in
 * `failed`, not silently defaulted or auto-approved.
 */
export async function generateAdaptiveVariants(input: {
  questionId: string
  learners: Array<{ learnerId: string; learnerName: string }>
  subject: string
  subStrandId?: string | null
  /** Defaults to the real AI Router (routedCompletion) — override only in tests. */
  callAI?: RoutedCompletionFn
}): Promise<GenerationResult> {
  const callAI = input.callAI ?? routedCompletion
  const canonical = await findQuestionById(input.questionId)
  if (!canonical) throw new Error(`Canonical question ${input.questionId} not found`)

  const [tierTasks, curriculum] = await Promise.all([
    resolveTiersForClass(input.learners, input.subject, input.subStrandId),
    input.subStrandId ? CurriculumService.resolveSubstrandContext(input.subStrandId) : Promise.resolve(null),
  ])

  // Adaptive Remediation Phase 1, Stage 7 — generation is ADDITIVE.
  //
  // The set generated is (tiers a real learner in this class needs right
  // now) MINUS (tiers this question already has in a deliverable state).
  // Both halves matter:
  //
  //   - the first half is the frozen cost discipline, unchanged: never all
  //     three unconditionally, only tiers a real learner is classified into.
  //   - the second half is new, and closes the gap where a learner who
  //     improved AFTER the first generation could be classified `on_track`
  //     with no `extension` variant in existence, silently falling back to
  //     the canonical question forever. A teacher clicking Generate again
  //     now fills exactly the newly-needed tier and re-generates nothing
  //     already in review.
  //
  // This deliberately does NOT auto-generate on the learner's behalf at
  // delivery time: every variant still enters as a draft a teacher must
  // approve. When a needed tier genuinely does not exist yet, the learner
  // receives the canonical question and that fact is now recorded as real
  // provenance on the resulting evidence (Stage 1), rather than being
  // invisible.
  const existingTypes = await findLiveVariantTypesForQuestion(input.questionId)
  const neededTiers = [...tierTasks.keys()]
  const tiersConsidered = neededTiers.filter(tier => !existingTypes.has(tier))
  const created: VariantRow[] = []
  const failed: GenerationFailure[] = []

  for (const tier of tiersConsidered) {
    const task = tierTasks.get(tier)!
    const context = redactForPrompt(deriveEducationalAIContext(task))
    const result = await generateOneTier(canonical, curriculum, tier, context, callAI)

    if ('error' in result) {
      failed.push({ tier, reason: result.error, ...(result.failure ? { failure: result.failure, attempts: result.attempts } : {}) })
      continue
    }

    const variantInput: VariantInput = {
      questionId: input.questionId,
      variantType: tier,
      questionText: result.parsed.questionText,
      choices: result.parsed.choices,
      correctIndex: result.parsed.correctIndex,
      cognitiveIntent: result.parsed.cognitiveIntent ?? null,
      difficultyRationale: result.parsed.difficultyRationale ?? null,
      expectedMisconceptions: result.parsed.expectedMisconceptions ?? [],
      teacherExplanation: result.parsed.teacherExplanation ?? null,
      learnerExplanation: result.parsed.learnerExplanation ?? null,
      generatedBy: 'ai',
      subStrandId: curriculum?.subStrandId ?? null,
      learningOutcome: curriculum?.learningOutcomes[0] ?? null,
    }

    const [row] = await createDraftVariants([variantInput])
    created.push(row)
  }

  return { created, failed, tiersConsidered }
}

/**
 * Regenerates exactly one already-existing variant — same generation +
 * verification pipeline as a new tier, but persisted via Sprint 9 Slice 1's
 * regenerateVariant() (archive old + insert new, atomically), never a plain
 * insert. The old (now archived) row remains fully readable — a learner
 * already served it keeps a permanently valid reference (Sprint 4C design).
 */
export async function regenerateOneVariant(input: {
  variantId: string
  learners: Array<{ learnerId: string; learnerName: string }>
  subject: string
  /** Defaults to the real AI Router (routedCompletion) — override only in tests. */
  callAI?: RoutedCompletionFn
}): Promise<{ variant: VariantRow } | { error: string }> {
  const callAI = input.callAI ?? routedCompletion
  const existing = await findVariantById(input.variantId)
  if (!existing) return { error: `Variant ${input.variantId} not found` }

  const canonical = await findQuestionById(existing.question_id)
  if (!canonical) return { error: `Canonical question ${existing.question_id} not found` }

  const curriculum = existing.sub_strand_id ? await CurriculumService.resolveSubstrandContext(existing.sub_strand_id) : null

  const tierTasks = await resolveTiersForClass(input.learners, input.subject, existing.sub_strand_id)
  const task = tierTasks.get(existing.variant_type)
  if (!task) return { error: `No learner in this class is currently classified into the ${existing.variant_type} tier — cannot ground a regeneration in a real learner` }

  const context = redactForPrompt(deriveEducationalAIContext(task))
  const result = await generateOneTier(canonical, curriculum, existing.variant_type, context, callAI)
  if ('error' in result) return { error: result.error }

  const variant = await regenerateVariant(input.variantId, {
    questionText: result.parsed.questionText,
    choices: result.parsed.choices,
    correctIndex: result.parsed.correctIndex,
    cognitiveIntent: result.parsed.cognitiveIntent ?? null,
    difficultyRationale: result.parsed.difficultyRationale ?? null,
    expectedMisconceptions: result.parsed.expectedMisconceptions ?? [],
    teacherExplanation: result.parsed.teacherExplanation ?? null,
    learnerExplanation: result.parsed.learnerExplanation ?? null,
  })

  return { variant }
}
