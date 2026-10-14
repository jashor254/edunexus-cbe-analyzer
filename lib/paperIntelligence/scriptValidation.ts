// lib/paperIntelligence/scriptValidation.ts
//
// Validation of the model's whole-script marking output. Same posture as
// validation.ts (Prototype 01): the model is untrusted input; a malformed
// response is unusable as a whole, and a question that breaks a rubric bound
// is REJECTED and reported — never clamped into range, never silently dropped.
// The marks themselves are not taken from the model at all: the model reports
// each point's classification and whether it was explained, and
// scriptScoring.ts derives the marks.

import { z } from 'zod'
import { scorePoints } from './scriptScoring'
import type { RubricForScriptMarking, ScriptQuestionMark } from './types'

const RawPointSchema = z.object({
  text: z.string(),
  classification: z.enum(['matches_scheme', 'plausible_not_in_scheme', 'incorrect']),
  explained: z.boolean().optional().default(false),
  matchedAnswer: z.string().nullable().optional().default(null),
  note: z.string().nullable().optional().default(null),
})

const RawScriptQuestionSchema = z.object({
  rubricId: z.string().min(1),
  recognizedAnswer: z.string(),
  pageNumbers: z.array(z.number().int()).optional().default([]),
  recognitionConfidence: z.number().min(0).max(1),
  recognitionNotes: z.string().nullable().optional().default(null),
  uncertain: z.boolean(),
  points: z.array(RawPointSchema),
  gradingConfidence: z.number().min(0).max(1),
  rationale: z.string(),
})

const RawScriptResponseSchema = z.object({
  questions: z.array(RawScriptQuestionSchema),
})

export type RawScriptResponse = z.infer<typeof RawScriptResponseSchema>

export type ScriptQuestionValidationResult =
  | { valid: true; question: ScriptQuestionMark }
  | { valid: false; rubricId: string; questionNumber: number | null; reason: string }

export class ScriptMarkingParseError extends Error {}

export function parseScriptMarkingResponse(rawText: string): RawScriptResponse {
  const cleaned = rawText.trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/, '')
  let json: unknown
  try {
    json = JSON.parse(cleaned)
  } catch {
    throw new ScriptMarkingParseError('Model response was not valid JSON')
  }
  const parsed = RawScriptResponseSchema.safeParse(json)
  if (!parsed.success) {
    throw new ScriptMarkingParseError(`Model response failed schema validation: ${parsed.error.issues[0]?.message ?? 'unknown'}`)
  }
  return parsed.data
}

/**
 * Per-question validation against the rubric each answer claims to belong
 * to. One bad question never invalidates the rest of the script. Also reports
 * the rubric questions the model returned nothing for, so the teacher sees
 * "not found on the script" rather than a silent gap.
 */
export function validateScriptMarking(
  parsed: RawScriptResponse,
  rubrics: RubricForScriptMarking[],
  pageCount: number,
): { results: ScriptQuestionValidationResult[]; unanswered: RubricForScriptMarking[] } {
  const rubricById = new Map(rubrics.map(r => [r.rubricId, r]))
  const seen = new Set<string>()

  const results = parsed.questions.map((q): ScriptQuestionValidationResult => {
    const rubric = rubricById.get(q.rubricId)
    if (!rubric) {
      return { valid: false, rubricId: q.rubricId, questionNumber: null, reason: `No rubric supplied for rubricId ${q.rubricId} — model referenced a question it was not given` }
    }
    if (seen.has(q.rubricId)) {
      return { valid: false, rubricId: q.rubricId, questionNumber: rubric.questionNumber, reason: 'Model returned this question twice — only the first answer is used' }
    }
    seen.add(q.rubricId)

    const scored = scorePoints(q.points, { maxMarks: rubric.maxMarks, pointsRequired: rubric.pointsRequired, marksPerPoint: rubric.marksPerPoint })
    // Only reachable when a rubric's N×M disagrees with its max — the rubric
    // editor blocks that on confirm, so this guards hand-edited rows.
    if (scored.plausibleMark > rubric.maxMarks) {
      return { valid: false, rubricId: q.rubricId, questionNumber: rubric.questionNumber, reason: `Points add up to ${scored.plausibleMark}, above the question's max of ${rubric.maxMarks} — rejected, not clamped` }
    }

    return {
      valid: true,
      question: {
        rubricId: q.rubricId,
        questionNumber: rubric.questionNumber,
        questionLabel: rubric.questionLabel,
        recognizedAnswer: q.recognizedAnswer,
        recognitionConfidence: q.recognitionConfidence,
        recognitionNotes: q.recognitionNotes ?? null,
        uncertain: q.uncertain,
        points: scored.points,
        proposedMark: scored.proposedMark,
        plausibleMark: scored.plausibleMark,
        maxMark: rubric.maxMarks,
        gradingConfidence: q.gradingConfidence,
        rationale: q.rationale,
        // Page references are metadata, not marks — drop ones that point at
        // pages that were never sent rather than reject the question.
        pageNumbers: [...new Set(q.pageNumbers.filter(n => n >= 1 && n <= pageCount))].sort((a, b) => a - b),
      },
    }
  })

  const unanswered = rubrics.filter(r => !seen.has(r.rubricId))
  return { results, unanswered }
}
