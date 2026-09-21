// lib/paperIntelligence/validation.ts
//
// Structured validation of the Gemini vision model's raw JSON output.
// Gate 4/6 (Prototype 01 spec): the model is untrusted input, never an
// authority. An out-of-bounds mark is a MODEL-OUTPUT ERROR requiring
// rejection, never silently clamped — "7/5" must not become "5/5", and
// "-1/5" must not become "0/5".

import { z } from 'zod'
import type { RecognizedQuestionAnswer, RubricForMarking } from './types'

const RawQuestionSchema = z.object({
  rubricId: z.string().min(1),
  questionNumber: z.number().int().positive(),
  recognizedAnswer: z.string(),
  recognitionConfidence: z.number().min(0).max(1),
  recognitionNotes: z.string().nullable().optional().default(null),
  uncertain: z.boolean(),
  proposedMark: z.number(),
  maxMark: z.number().int().positive(),
  gradingConfidence: z.number().min(0).max(1),
  rationale: z.string(),
})

const RawVisionResponseSchema = z.object({
  questions: z.array(RawQuestionSchema),
})

export type QuestionValidationResult =
  | { valid: true; question: RecognizedQuestionAnswer }
  | { valid: false; rubricId: string; questionNumber: number; reason: string }

export class PaperVisionParseError extends Error {}

/**
 * Parses the model's raw text response into the expected JSON shape.
 * Throws PaperVisionParseError on malformed JSON or a structurally invalid
 * response (missing fields, wrong types) — these are not per-question
 * recoverable, the whole response is unusable.
 */
export function parsePaperVisionResponse(rawText: string): z.infer<typeof RawVisionResponseSchema> {
  const cleaned = rawText.trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/, '')
  let json: unknown
  try {
    json = JSON.parse(cleaned)
  } catch {
    throw new PaperVisionParseError('Model response was not valid JSON')
  }
  const parsed = RawVisionResponseSchema.safeParse(json)
  if (!parsed.success) {
    throw new PaperVisionParseError(`Model response failed schema validation: ${parsed.error.issues[0]?.message ?? 'unknown'}`)
  }
  return parsed.data
}

/**
 * Per-question bounds/consistency validation against the rubric the
 * question claims to answer. Each question is validated independently —
 * one bad question never invalidates the rest of the page's real,
 * usable answers.
 */
export function validateAgainstRubrics(
  parsed: z.infer<typeof RawVisionResponseSchema>,
  rubrics: RubricForMarking[],
): QuestionValidationResult[] {
  const rubricById = new Map(rubrics.map(r => [r.rubricId, r]))

  return parsed.questions.map((q): QuestionValidationResult => {
    const rubric = rubricById.get(q.rubricId)
    if (!rubric) {
      return { valid: false, rubricId: q.rubricId, questionNumber: q.questionNumber, reason: `No rubric supplied for rubricId ${q.rubricId} — model referenced a question it was not given` }
    }
    if (q.maxMark !== rubric.maxMarks) {
      return { valid: false, rubricId: q.rubricId, questionNumber: q.questionNumber, reason: `Model's maxMark (${q.maxMark}) does not match the rubric's max_marks (${rubric.maxMarks})` }
    }
    // The non-negotiable bounds check — reject, never clamp.
    if (q.proposedMark < 0 || q.proposedMark > rubric.maxMarks) {
      return { valid: false, rubricId: q.rubricId, questionNumber: q.questionNumber, reason: `proposedMark ${q.proposedMark} is out of bounds for max_marks ${rubric.maxMarks} — rejected, not clamped` }
    }
    if (!Number.isInteger(q.proposedMark)) {
      return { valid: false, rubricId: q.rubricId, questionNumber: q.questionNumber, reason: `proposedMark ${q.proposedMark} is not a whole number` }
    }
    return {
      valid: true,
      question: {
        rubricId: q.rubricId,
        questionNumber: q.questionNumber,
        recognizedAnswer: q.recognizedAnswer,
        recognitionConfidence: q.recognitionConfidence,
        recognitionNotes: q.recognitionNotes ?? null,
        uncertain: q.uncertain,
        proposedMark: q.proposedMark,
        maxMark: q.maxMark,
        gradingConfidence: q.gradingConfidence,
        rationale: q.rationale,
      },
    }
  })
}
