// lib/paperIntelligence/schemeValidation.ts
//
// Structured validation of the Gemini scheme-extraction output. Same posture
// as validation.ts: the model is untrusted input. A rubric whose mark
// arithmetic does not add up ("Any 4x2 = 9") is a MISREAD to be surfaced for
// the teacher to fix, never silently accepted. Pure — no network, no DB, no
// SDK import — so it runs under the real `npm test`.

import { z } from 'zod'
import type { ExtractedRubric } from './types'

const AcceptedAnswerSchema = z.object({
  text: z.string().min(1),
  synonyms: z.array(z.string()).optional().default([]),
})

const RawRubricSchema = z.object({
  questionId: z.string().min(1),
  commandWord: z.string(),
  topic: z.string(),
  pointsRequired: z.number().int().positive(),
  marksPerPoint: z.number().int().positive(),
  maxMarks: z.number().int().positive(),
  mode: z.enum(['strict', 'accept_relevant']),
  curriculumStrand: z.string().nullable().optional().default(null),
  acceptedAnswers: z.array(AcceptedAnswerSchema).optional().default([]),
  uncertain: z.boolean(),
  uncertaintyNote: z.string().nullable().optional().default(null),
})

const RawSchemeResponseSchema = z.object({
  rubrics: z.array(RawRubricSchema),
})

export type ExtractedRubricValidationResult =
  | { valid: true; rubric: ExtractedRubric }
  | { valid: false; questionId: string; reason: string }

export class SchemeExtractionParseError extends Error {}

/**
 * Parses the model's raw text into the expected JSON shape. Throws on
 * malformed JSON or a structurally invalid response — the whole response is
 * unusable, not per-rubric recoverable.
 */
export function parseSchemeExtractionResponse(rawText: string): z.infer<typeof RawSchemeResponseSchema> {
  const cleaned = rawText.trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/, '')
  let json: unknown
  try {
    json = JSON.parse(cleaned)
  } catch {
    throw new SchemeExtractionParseError('Scheme extraction response was not valid JSON')
  }
  const parsed = RawSchemeResponseSchema.safeParse(json)
  if (!parsed.success) {
    throw new SchemeExtractionParseError(`Scheme extraction failed schema validation: ${parsed.error.issues[0]?.message ?? 'unknown'}`)
  }
  return parsed.data
}

/**
 * Per-rubric consistency validation. Each rubric is checked independently —
 * one unparseable question never discards the rest. The one hard check is the
 * mark arithmetic: maxMarks must equal pointsRequired × marksPerPoint, because
 * every "Any N×M = T" scheme line is internally consistent by construction, so
 * a mismatch is a misread the teacher must see and fix, not a mark to trust.
 * An `uncertain` rubric is still returned as valid (flagged) — the teacher
 * edits it; it is never dropped.
 */
export function validateExtractedRubrics(
  parsed: z.infer<typeof RawSchemeResponseSchema>,
): ExtractedRubricValidationResult[] {
  const seen = new Set<string>()

  return parsed.rubrics.map((r): ExtractedRubricValidationResult => {
    if (seen.has(r.questionId)) {
      return { valid: false, questionId: r.questionId, reason: `Duplicate questionId "${r.questionId}" — the model listed the same question twice` }
    }
    seen.add(r.questionId)

    if (r.maxMarks !== r.pointsRequired * r.marksPerPoint) {
      return {
        valid: false,
        questionId: r.questionId,
        reason: `Mark arithmetic does not add up: pointsRequired ${r.pointsRequired} × marksPerPoint ${r.marksPerPoint} ≠ maxMarks ${r.maxMarks} — likely a misread of the "N×M=T" line`,
      }
    }

    return {
      valid: true,
      rubric: {
        questionId: r.questionId,
        commandWord: r.commandWord,
        topic: r.topic,
        pointsRequired: r.pointsRequired,
        marksPerPoint: r.marksPerPoint,
        maxMarks: r.maxMarks,
        mode: r.mode,
        curriculumStrand: r.curriculumStrand ?? null,
        acceptedAnswers: r.acceptedAnswers.map(a => ({ text: a.text, synonyms: a.synonyms })),
        uncertain: r.uncertain,
        uncertaintyNote: r.uncertaintyNote ?? null,
      },
    }
  })
}
