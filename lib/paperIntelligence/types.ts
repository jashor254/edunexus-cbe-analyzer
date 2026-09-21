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
