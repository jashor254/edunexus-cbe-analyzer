// lib/paperIntelligence/schemeExtraction.ts
//
// Paper Intelligence Phase 1 — scheme → rubric extraction. Its own Gemini
// vision call, exactly mirroring vision.ts's posture: Gemini-only (DeepSeek
// has no vision), model output is untrusted and fully validated
// (schemeValidation.ts) before anything downstream treats it as real, real
// token usage recorded, cost marked unavailable rather than fabricated.
//
// This function only PROPOSES rubrics. It never writes open_response_rubrics —
// the teacher reviews and confirms on an editable screen first (Prototype 01
// Gate 2: the AI may not author the rubric).

import { GoogleGenerativeAI } from '@google/generative-ai'
import { GEMINI_PRIMARY } from '@/lib/ai/models'
import { isAllowedUploadType, UPLOAD_LIMITS } from '@/lib/config/uploads'
import {
  parseSchemeExtractionResponse,
  validateExtractedRubrics,
  type ExtractedRubricValidationResult,
} from './schemeValidation'
import type { SchemeImage, SchemeExtractionResponse } from './types'

export class SchemeExtractionInputError extends Error {}

function assertValidInput(images: SchemeImage[]): void {
  if (images.length === 0) {
    throw new SchemeExtractionInputError('No scheme images supplied — nothing to extract')
  }
  for (const [i, img] of images.entries()) {
    if (!isAllowedUploadType(img.mimeType)) {
      throw new SchemeExtractionInputError(`Scheme page ${i + 1}: unsupported MIME type ${img.mimeType}`)
    }
    if (!img.imageBase64 || img.imageBase64.length === 0) {
      throw new SchemeExtractionInputError(`Scheme page ${i + 1}: empty image payload`)
    }
    const approxBytes = Math.ceil(img.imageBase64.length * 0.75)
    if (approxBytes > UPLOAD_LIMITS.maxFileSizeBytes) {
      throw new SchemeExtractionInputError(`Scheme page ${i + 1} exceeds the ${UPLOAD_LIMITS.maxFileSizeBytes} byte upload limit`)
    }
  }
}

function buildPrompt(): string {
  return `You are reading the photographed MARKING SCHEME pages of a Kenyan junior-school exam, and converting them into structured rubrics a teacher will edit and confirm. You are not an authority — the teacher corrects everything you produce before it is used.

Read every numbered question and sub-question (e.g. "1a", "1b", "2", "7"). For EACH one, output:
- questionId: the label exactly as printed ("1a", "2", "7")
- commandWord: the instruction verb ("State", "Identify", "Give", "Explain", "Discuss", "Evaluate", "Examine", …)
- topic: a short description of what the question asks
- pointsRequired: how many points earn marks. Read the scheme's own tally line: "Any 5x1=5 marks" → 5; "Any 4x2=8 marks" → 4; "Any 3x2=6" → 3.
- marksPerPoint: marks for each point. "5x1" → 1 (naming is enough). "4x2" → 2 (a 2-mark point needs the point NAMED and correctly EXPLAINED).
- maxMarks: the total for the question — this MUST equal pointsRequired × marksPerPoint ("Any 4x2=8" → 8). Never report a maxMarks that does not equal that product.
- mode: "strict" only when the scheme is a closed, fixed list where no other answer is ever acceptable; otherwise "accept_relevant" (the default — relevant correct answers beyond the printed list may be awarded).
- curriculumStrand: the strand/topic if the scheme states one, else null
- acceptedAnswers: the list of model answers the scheme prints for this question, each as {"text": "...", "synonyms": ["..."]}. Include every answer the scheme lists. synonyms is your best guess at obvious equivalents, or [].
- uncertain: true if any part of this question's scheme is genuinely unreadable in the photo — say so honestly, NEVER guess and hide it
- uncertaintyNote: one short sentence on what was unreadable, or null

Rules:
- If a tally line like "Any 5x1=5" is unreadable, set uncertain=true and uncertaintyNote, and give your best readable estimate — never silently invent a number.
- Do not merge two questions, do not split one, do not drop any.
- A scheme that lists the same quality/answer twice (e.g. "Accountability" appearing twice) should appear ONCE in acceptedAnswers.

Respond with valid JSON only, no markdown, exactly this shape:
{"rubrics": [{"questionId": string, "commandWord": string, "topic": string, "pointsRequired": number, "marksPerPoint": number, "maxMarks": number, "mode": "strict" | "accept_relevant", "curriculumStrand": string | null, "acceptedAnswers": [{"text": string, "synonyms": string[]}], "uncertain": boolean, "uncertaintyNote": string | null}]}`
}

/**
 * The one scheme-extraction call site. Returns validated rubrics plus any the
 * model produced that failed validation (e.g. mark arithmetic that does not
 * add up) — rejected ones are surfaced to the teacher, never silently dropped.
 */
export async function extractRubricsFromScheme(images: SchemeImage[]): Promise<{
  response: SchemeExtractionResponse
  rejected: Array<Extract<ExtractedRubricValidationResult, { valid: false }>>
}> {
  assertValidInput(images)

  const apiKey = process.env.GOOGLE_GEMINI_API_KEY
  if (!apiKey) throw new Error('Missing GOOGLE_GEMINI_API_KEY in environment variables')

  const model = new GoogleGenerativeAI(apiKey).getGenerativeModel({
    model: GEMINI_PRIMARY,
    generationConfig: { temperature: 0.1, maxOutputTokens: 4000 },
  })

  const startedAt = Date.now()
  const result = await model.generateContent([
    { text: buildPrompt() },
    ...images.map(img => ({ inlineData: { mimeType: img.mimeType, data: img.imageBase64 } })),
  ])
  const latencyMs = Date.now() - startedAt

  const usage = result.response.usageMetadata
  const rawText = result.response.text()

  const parsed = parseSchemeExtractionResponse(rawText)
  const validated = validateExtractedRubrics(parsed)

  const accepted = validated.filter((v): v is Extract<ExtractedRubricValidationResult, { valid: true }> => v.valid)
  const rejected = validated.filter((v): v is Extract<ExtractedRubricValidationResult, { valid: false }> => !v.valid)

  return {
    response: {
      rubrics: accepted.map(a => a.rubric),
      metadata: {
        provider: 'gemini',
        model: GEMINI_PRIMARY,
        promptTokens: usage?.promptTokenCount ?? null,
        completionTokens: usage?.candidatesTokenCount ?? null,
        totalTokens: usage?.totalTokenCount ?? null,
        costStatus: 'unavailable',
        costUsd: null,
        latencyMs,
      },
    },
    rejected,
  }
}
