// lib/paperIntelligence/vision.ts
//
// Paper Intelligence Prototype 01 — Gate 1. Its own, dedicated Gemini
// vision call path. Deliberately NOT part of lib/ai-orchestration/:
// AIRequest/AIResponse/routedCompletion are text-only and stay that way
// (see the pre-build forensic audit §8) — DeepSeek has no vision API in
// its current integration, so this call cannot transparently join the
// existing DeepSeek->Gemini fallback chain. That is a real, accepted
// reliability tradeoff for this one feature, not an oversight.
//
// The model is untrusted input (§22 of the coding prompt this implements).
// Every field it returns is validated (validation.ts) before anything
// downstream treats it as real.

import { GoogleGenerativeAI } from '@google/generative-ai'
import { GEMINI_PRIMARY } from '@/lib/ai/models'
import { isAllowedUploadType, UPLOAD_LIMITS } from '@/lib/config/uploads'
import { parsePaperVisionResponse, validateAgainstRubrics, type QuestionValidationResult } from './validation'
import type { PaperVisionRequest, PaperVisionResponse, RubricForMarking } from './types'

export class PaperVisionInputError extends Error {}

function assertValidInput(request: PaperVisionRequest): void {
  if (!isAllowedUploadType(request.mimeType)) {
    throw new PaperVisionInputError(`Unsupported MIME type: ${request.mimeType}`)
  }
  if (!request.imageBase64 || request.imageBase64.length === 0) {
    throw new PaperVisionInputError('Empty image payload')
  }
  // Base64 inflates size by ~4/3 — bound the encoded length against the
  // same limit every other upload in this platform respects
  // (lib/config/uploads.ts), rather than inventing a second number.
  const approxBytes = Math.ceil(request.imageBase64.length * 0.75)
  if (approxBytes > UPLOAD_LIMITS.maxFileSizeBytes) {
    throw new PaperVisionInputError(`Image exceeds the ${UPLOAD_LIMITS.maxFileSizeBytes} byte upload limit`)
  }
  if (request.rubrics.length === 0) {
    throw new PaperVisionInputError('No rubrics supplied — nothing to mark against')
  }
}

function buildPrompt(rubrics: RubricForMarking[]): string {
  const rubricBlock = rubrics
    .map(r => `Question ${r.questionNumber} (rubricId: "${r.rubricId}", max marks: ${r.maxMarks}):
"${r.questionText}"
Expected answer summary: ${r.expectedAnswerSummary}
Marking criteria: ${JSON.stringify(r.markingCriteria)}`)
    .join('\n\n')

  return `You are transcribing and marking ONE photographed page of a Kenyan learner's handwritten exercise-book answers, against teacher-authored rubrics supplied below. You are not an authority — a teacher will review every mark you propose before it counts as anything.

Rubrics for this page:
${rubricBlock}

For EACH question you can find an answer for on the page, report:
- recognizedAnswer: transcribe exactly what the learner wrote, as literally as you can
- recognitionConfidence (0-1): your confidence in the TRANSCRIPTION itself, independent of whether the answer is correct
- uncertain: true if you genuinely cannot make out the handwriting for this answer — say so honestly, never guess and hide it
- proposedMark: a whole number, 0 to the rubric's own max marks for that question — NEVER outside that range
- maxMark: restate the rubric's own max marks for that question, verbatim
- gradingConfidence (0-1): your confidence in the MARK you proposed, independent of recognitionConfidence
- rationale: one or two sentences on why you proposed that mark against the marking criteria

If a question has no answer visible on this page at all, omit it from your response rather than inventing one.

Respond with valid JSON only, no markdown, exactly this shape:
{"questions": [{"rubricId": string, "questionNumber": number, "recognizedAnswer": string, "recognitionConfidence": number, "recognitionNotes": string | null, "uncertain": boolean, "proposedMark": number, "maxMark": number, "gradingConfidence": number, "rationale": string}]}`
}

/**
 * The one call site that sends an image to an AI provider in this
 * codebase. Returns validated, per-question results — an invalid question
 * (e.g. a rejected out-of-bounds mark) is reported in `rejected`, never
 * silently dropped or clamped into `response`.
 */
export async function recognizeAndMarkPage(request: PaperVisionRequest): Promise<{
  response: PaperVisionResponse
  rejected: Array<Extract<QuestionValidationResult, { valid: false }>>
}> {
  assertValidInput(request)

  const apiKey = process.env.GOOGLE_GEMINI_API_KEY
  if (!apiKey) throw new Error('Missing GOOGLE_GEMINI_API_KEY in environment variables')

  const model = new GoogleGenerativeAI(apiKey).getGenerativeModel({
    model: GEMINI_PRIMARY,
    generationConfig: { temperature: 0.1, maxOutputTokens: 2000 },
  })

  const startedAt = Date.now()
  const result = await model.generateContent([
    { text: buildPrompt(request.rubrics) },
    { inlineData: { mimeType: request.mimeType, data: request.imageBase64 } },
  ])
  const latencyMs = Date.now() - startedAt

  const usage = result.response.usageMetadata
  const rawText = result.response.text()

  const parsed = parsePaperVisionResponse(rawText)
  const validated = validateAgainstRubrics(parsed, request.rubrics)

  const accepted = validated.filter((v): v is Extract<QuestionValidationResult, { valid: true }> => v.valid)
  const rejected = validated.filter((v): v is Extract<QuestionValidationResult, { valid: false }> => !v.valid)

  return {
    response: {
      questions: accepted.map(a => a.question),
      metadata: {
        provider: 'gemini',
        model: GEMINI_PRIMARY,
        promptTokens: usage?.promptTokenCount ?? null,
        completionTokens: usage?.candidatesTokenCount ?? null,
        totalTokens: usage?.totalTokenCount ?? null,
        // Gemini's SDK does not expose a dollar cost directly — record the
        // real token counts (§15/cost accounting) and mark cost itself
        // explicitly unavailable rather than fabricating a figure from the
        // shared router's character-count heuristic (pre-build audit §8).
        costStatus: 'unavailable',
        costUsd: null,
        latencyMs,
      },
    },
    rejected,
  }
}
