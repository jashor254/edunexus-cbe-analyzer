// lib/paperIntelligence/types.ts
//
// Paper Intelligence Prototype 01 — its own multimodal contract, fully
// isolated from lib/ai-orchestration/ (AIRequest/AIResponse/routedCompletion
// remain text-only and untouched — see the pre-build forensic audit, §8).
// DeepSeek has no vision capability in its current integration, so this
// path is deliberately Gemini-only and does not reuse the shared
// DeepSeek->Gemini fallback chain.
//
// Recognition confidence (did the model read the page correctly) and
// grading confidence (is the proposed mark right) are DIFFERENT questions
// with different failure modes — a page can be perfectly legible and
// wrongly marked, or illegible and "correctly" guessed. They are never
// collapsed into one value.

export type PaperVisionRequest = {
  /** Raw image bytes, base64-encoded — never a client-supplied external URL (Gate: server controls the image reference). */
  imageBase64: string
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp'
  /** The rubric-marked questions this page should be interpreted against — the AI marks against these, it never invents or redefines them. */
  rubrics: RubricForMarking[]
  /** Opaque, for observability only — never parsed/branched on inside the adapter. */
  correlationId: string
}

export type RubricForMarking = {
  rubricId: string
  questionNumber: number
  questionText: string
  expectedAnswerSummary: string
  markingCriteria: MarkingCriterion[]
  maxMarks: number
}

export type MarkingCriterion = {
  criterion: string
  points: number
}

export type RecognizedQuestionAnswer = {
  rubricId: string
  questionNumber: number
  /** What the vision model read off the page — a fact about the page, not a judgment. */
  recognizedAnswer: string
  /** 0-1. Confidence the transcription itself is accurate. Never conflated with gradingConfidence. */
  recognitionConfidence: number
  recognitionNotes: string | null
  /** True when the model could not confidently transcribe this answer at all — a real "I don't know," not a guess dressed up as one. */
  uncertain: boolean
  /** The AI's proposed mark against the supplied rubric — a proposal, never trusted evidence until a teacher confirms it. */
  proposedMark: number
  maxMark: number
  /** 0-1. Confidence in the MARK, independent of recognitionConfidence. */
  gradingConfidence: number
  rationale: string
}

export type PaperRecognitionMetadata = {
  provider: 'gemini'
  model: string
  /** Real provider-reported usage where available — never the shared router's character-count estimate (pre-build audit §8). */
  promptTokens: number | null
  completionTokens: number | null
  totalTokens: number | null
  /** Explicit 'unavailable' rather than a fabricated number when the provider doesn't expose cost. */
  costStatus: 'available' | 'unavailable'
  costUsd: number | null
  latencyMs: number
}

export type PaperVisionResponse = {
  questions: RecognizedQuestionAnswer[]
  metadata: PaperRecognitionMetadata
}

// ── Scheme extraction (Phase 1) ──────────────────────────────────────────
// Reading a photographed marking scheme into structured, teacher-editable
// rubrics. The AI PROPOSES; the teacher authors on confirm — open_response_
// rubrics stays teacher-authored (Prototype 01 Gate 2), the AI never writes
// it directly. Extraction output is shown on an editable screen first; only
// a teacher's Confirm persists it.

export type SchemeImage = {
  /** Raw image bytes, base64-encoded — a scheme page the teacher photographed. */
  imageBase64: string
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp'
}

export type AcceptedAnswer = {
  text: string
  synonyms: string[]
}

export type RubricMode = 'strict' | 'accept_relevant'

export type ExtractedRubric = {
  /** Question label as printed, e.g. "1a", "2", "7". Not a DB id. */
  questionId: string
  /** The verb that sets the marking bar — "State", "Explain", "Discuss", … */
  commandWord: string
  topic: string
  /** "Any 5x1=5" → 5; "Any 4x2=8" → 4. How many points earn marks. */
  pointsRequired: number
  /** "5x1" → 1; "4x2" → 2 (a 2-mark point = named + explained). */
  marksPerPoint: number
  maxMarks: number
  mode: RubricMode
  curriculumStrand: string | null
  acceptedAnswers: AcceptedAnswer[]
  /** True when part of this question could not be read confidently — surfaced for teacher review, never guessed past. */
  uncertain: boolean
  uncertaintyNote: string | null
}

export type SchemeExtractionResponse = {
  rubrics: ExtractedRubric[]
  metadata: PaperRecognitionMetadata
}

// ── Whole-script marking (Phase 1, Commit 4) ─────────────────────────────
// A learner's script is several photographed pages; answers run across page
// breaks. All pages go to the model in one call. The model only READS and
// CLASSIFIES each point the learner wrote — the marks themselves are derived
// in code (scriptScoring.ts) from those classifications and the rubric's
// structure, so the arithmetic is deterministic and re-applicable when a
// teacher later accepts an answer (Commit 6).

export type ScriptPage = {
  /** 1-based, the order the teacher captured the pages in. */
  pageNumber: number
  imageBase64: string
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp'
}

export type RubricForScriptMarking = RubricForMarking & {
  /** Printed label ("1a"); null on Prototype 01 rubrics. */
  questionLabel: string | null
  mode: RubricMode
  /** "Any N×M": null on Prototype 01 rubrics, which carry no point structure. */
  pointsRequired: number | null
  marksPerPoint: number | null
  acceptedAnswers: AcceptedAnswer[]
}

/**
 * The three Phase 0 classes. `plausible_not_in_scheme` is never awarded by the
 * AI — it is a correct-looking answer the scheme does not list, surfaced for
 * the teacher to accept (which re-applies to every learner) or leave out.
 */
export type PointClassification = 'matches_scheme' | 'plausible_not_in_scheme' | 'incorrect'

export type MarkedPoint = {
  /** The point as the learner wrote it. */
  text: string
  classification: PointClassification
  /** The model's read: did the learner correctly explain the point (only matters on 2-mark points)? */
  explained: boolean
  /**
   * What this point is worth on its own quality, 0..marksPerPoint — on a
   * 2-mark point, 1 for the name alone, 2 with a correct explanation.
   * Computed in code from classification + explained, never taken from the
   * model. Earned only when the point matches the scheme (or is later accepted).
   */
  merit: number
  /** False when the point falls beyond the first N the question asks for — a teacher marks the first N written, not the best N. */
  counted: boolean
  /** Marks awarded now: merit when counted and matches_scheme, otherwise 0. */
  awarded: number
  /** The scheme answer this point matched, when it matched one. */
  matchedAnswer: string | null
  /** One line: why it was classified this way (e.g. "repeats point 2", "real trait, not listed"). */
  note: string | null
}

export type ScriptQuestionMark = RecognizedQuestionAnswer & {
  questionLabel: string | null
  points: MarkedPoint[]
  /** The mark if every plausible_not_in_scheme point were accepted. Always ≥ proposedMark. */
  plausibleMark: number
  /** Which captured pages the answer was read from. */
  pageNumbers: number[]
}
