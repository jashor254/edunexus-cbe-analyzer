// lib/paperIntelligence/scriptMarking.ts
//
// Paper Intelligence Phase 1 — whole-script marking. All of one learner's
// photographed pages go to the model in ONE call, because answers run across
// page breaks (Phase 0: Q5 started on one page and finished on the next).
// Same posture as vision.ts: Gemini-only (DeepSeek has no vision), the model
// output is untrusted and fully validated (scriptValidation.ts), real token
// usage recorded, cost marked unavailable rather than fabricated.
//
// The model reads and classifies each point the learner wrote and says
// whether it was explained; it never gives a number. scriptScoring.ts derives
// the marks from that.
// Everything this returns is a proposal — it becomes pending_review evidence,
// never a final mark, until a teacher confirms it.

import { GoogleGenerativeAI, SchemaType, type Part, type ResponseSchema } from '@google/generative-ai'
import { GEMINI_SCRIPT_MARKING } from '@/lib/ai/models'
import { generateGeminiWithTimeout } from '@/lib/ai/gemini'
import { startLogicalCall } from '@/lib/ai/usageTelemetry'
import { isAllowedUploadType, UPLOAD_LIMITS } from '@/lib/config/uploads'
import { PAPER_INTELLIGENCE_LIMITS } from '@/lib/config/paperIntelligence'
import {
  parseScriptMarkingResponse,
  validateScriptMarking,
  ScriptMarkingParseError,
  type RawScriptResponse,
  type ScriptQuestionValidationResult,
} from './scriptValidation'
import { buildScriptMarkingPrompt } from './scriptMarkingPrompt'
import type { PaperRecognitionMetadata, RubricForScriptMarking, ScriptPage, ScriptQuestionMark } from './types'

export class ScriptMarkingInputError extends Error {}

export type ScriptMarkingRequest = {
  pages: ScriptPage[]
  rubrics: RubricForScriptMarking[]
  /** Opaque, for observability only. */
  correlationId: string
}

export type ScriptMarkingResult = {
  questions: ScriptQuestionMark[]
  rejected: Array<Extract<ScriptQuestionValidationResult, { valid: false }>>
  /** Rubric questions the model found no answer for on any page. */
  unanswered: Array<{ rubricId: string; questionNumber: number; questionLabel: string | null }>
  metadata: PaperRecognitionMetadata
}

/**
 * 8 questions × ~6 points with notes is ~4k tokens of JSON, but on thinking
 * models the hidden reasoning counts against this cap too — at 8192 the
 * Gemini 3.x models truncated mid-JSON on the Phase 0 scripts (2026-10-14).
 */
const MAX_OUTPUT_TOKENS = 24576
/** One retry on a malformed response; a second failure is reported, not looped. */
const MAX_ATTEMPTS = 2
/**
 * Per-attempt abort. The mark-script route allows 120s (maxDuration), so two
 * attempts × 50s still leave room to persist the result. ~11s is typical
 * (models.ts); a request still running at 50s is abandoned, not awaited.
 */
const SCRIPT_MARKING_TIMEOUT_MS = 50_000

/**
 * Structured output: the API itself enforces this shape, so a classification
 * outside the three, a boolean where text belongs, or an invented rubricId
 * cannot come back (each happened without it, 2026-10-14 eval).
 * scriptValidation.ts still validates everything — defence in depth.
 */
function responseSchema(rubricIds: string[]): ResponseSchema {
  const nullableString = { type: SchemaType.STRING, nullable: true } as const
  return {
    type: SchemaType.OBJECT,
    properties: {
      questions: {
        type: SchemaType.ARRAY,
        items: {
          type: SchemaType.OBJECT,
          properties: {
            rubricId: { type: SchemaType.STRING, format: 'enum', enum: rubricIds },
            recognizedAnswer: { type: SchemaType.STRING },
            pageNumbers: { type: SchemaType.ARRAY, items: { type: SchemaType.INTEGER } },
            recognitionConfidence: { type: SchemaType.NUMBER },
            recognitionNotes: nullableString,
            uncertain: { type: SchemaType.BOOLEAN },
            points: {
              type: SchemaType.ARRAY,
              items: {
                type: SchemaType.OBJECT,
                properties: {
                  text: { type: SchemaType.STRING },
                  classification: { type: SchemaType.STRING, format: 'enum', enum: ['matches_scheme', 'plausible_not_in_scheme', 'incorrect'] },
                  explained: { type: SchemaType.BOOLEAN },
                  matchedAnswer: nullableString,
                  note: nullableString,
                },
                required: ['text', 'classification', 'explained'],
              },
            },
            gradingConfidence: { type: SchemaType.NUMBER },
            rationale: { type: SchemaType.STRING },
          },
          required: ['rubricId', 'recognizedAnswer', 'pageNumbers', 'recognitionConfidence', 'uncertain', 'points', 'gradingConfidence', 'rationale'],
        },
      },
    },
    required: ['questions'],
  }
}

function assertValidInput(request: ScriptMarkingRequest): void {
  if (request.pages.length === 0) throw new ScriptMarkingInputError('No script pages supplied — nothing to mark')
  if (request.pages.length > PAPER_INTELLIGENCE_LIMITS.maxPagesPerScript) {
    throw new ScriptMarkingInputError(`A script may have at most ${PAPER_INTELLIGENCE_LIMITS.maxPagesPerScript} pages`)
  }
  if (request.rubrics.length === 0) throw new ScriptMarkingInputError('No rubrics supplied — nothing to mark against')
  for (const page of request.pages) {
    if (!isAllowedUploadType(page.mimeType)) {
      throw new ScriptMarkingInputError(`Page ${page.pageNumber}: unsupported MIME type ${page.mimeType}`)
    }
    if (!page.imageBase64) throw new ScriptMarkingInputError(`Page ${page.pageNumber}: empty image payload`)
    if (Math.ceil(page.imageBase64.length * 0.75) > UPLOAD_LIMITS.maxFileSizeBytes) {
      throw new ScriptMarkingInputError(`Page ${page.pageNumber} exceeds the ${UPLOAD_LIMITS.maxFileSizeBytes} byte upload limit`)
    }
  }
}

/**
 * The one whole-script marking call site. Returns validated per-question
 * proposals, the questions rejected by validation (surfaced, never dropped),
 * and the rubric questions the model found no answer for.
 */
export async function recognizeAndMarkScript(request: ScriptMarkingRequest, modelName: string = GEMINI_SCRIPT_MARKING): Promise<ScriptMarkingResult> {
  assertValidInput(request)

  const apiKey = process.env.GOOGLE_GEMINI_API_KEY
  if (!apiKey) throw new Error('Missing GOOGLE_GEMINI_API_KEY in environment variables')

  const model = new GoogleGenerativeAI(apiKey).getGenerativeModel({
    model: modelName,
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: MAX_OUTPUT_TOKENS,
      responseMimeType: 'application/json',
      responseSchema: responseSchema(request.rubrics.map(r => r.rubricId)),
    },
  })

  const pages = [...request.pages].sort((a, b) => a.pageNumber - b.pageNumber)
  const content: Part[] = [
    { text: buildScriptMarkingPrompt(request.rubrics, pages.length) },
    ...pages.flatMap((p, i): Part[] => [
      { text: `Page ${i + 1}:` },
      { inlineData: { mimeType: p.mimeType, data: p.imageBase64 } },
    ]),
  ]

  const startedAt = Date.now()
  let parsed: RawScriptResponse | null = null
  let promptTokens = 0
  let completionTokens = 0
  let totalTokens = 0
  // One logical call shared by the parse-retry, so telemetry shows it as a
  // retry (attempt 2) — each attempt resends every page image.
  const call = startLogicalCall({ feature: 'paper_intelligence_mark_script', correlationId: request.correlationId })
  for (let attempt = 1; parsed === null; attempt++) {
    const result = await generateGeminiWithTimeout(model, content, { timeoutMs: SCRIPT_MARKING_TIMEOUT_MS, modelName, call })
    const usage = result.response.usageMetadata
    promptTokens += usage?.promptTokenCount ?? 0
    completionTokens += usage?.candidatesTokenCount ?? 0
    totalTokens += usage?.totalTokenCount ?? 0
    try {
      parsed = parseScriptMarkingResponse(result.response.text())
    } catch (err) {
      if (!(err instanceof ScriptMarkingParseError) || attempt >= MAX_ATTEMPTS) {
        const finish = result.response.candidates?.[0]?.finishReason ?? 'unknown'
        throw err instanceof ScriptMarkingParseError
          ? new ScriptMarkingParseError(`${err.message} (finishReason ${finish}, attempt ${attempt})`)
          : err
      }
    }
  }
  const latencyMs = Date.now() - startedAt

  const { results, unanswered } = validateScriptMarking(parsed, request.rubrics, pages.length)

  // The model numbers pages 1..n in capture order; map back to the stored
  // page numbers in case the teacher's numbering has gaps (a deleted retake).
  const storedPageNumber = (n: number) => pages[n - 1]?.pageNumber ?? n

  return {
    questions: results
      .filter((v): v is Extract<ScriptQuestionValidationResult, { valid: true }> => v.valid)
      .map(v => ({ ...v.question, pageNumbers: v.question.pageNumbers.map(storedPageNumber) })),
    rejected: results.filter((v): v is Extract<ScriptQuestionValidationResult, { valid: false }> => !v.valid),
    unanswered: unanswered.map(r => ({ rubricId: r.rubricId, questionNumber: r.questionNumber, questionLabel: r.questionLabel })),
    metadata: {
      provider: 'gemini',
      model: modelName,
      // Summed across attempts — a retry costs real tokens.
      promptTokens,
      completionTokens,
      totalTokens,
      costStatus: 'unavailable',
      costUsd: null,
      latencyMs,
    },
  }
}
