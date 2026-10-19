// lib/assignments/variantReview.ts
//
// Teacher review of one adaptive variant (audit F-02,
// docs/audits/differentiated-assignment-deep-audit.md). Pure and
// client-safe: no I/O, no imports with side effects.
//
// The review card used to render only `question_text`, so a teacher approved
// versions whose answer options and answer key they never saw. This turns the
// stored row into what a teacher needs to judge it — what the learner sees,
// what they must do, the marked answer, and the generator's stated guidance —
// and names every gap instead of filling it in.
//
// Format: `assignment_question_variants` stores exactly one shape —
// `choices text[]` + `correct_index int` (single-answer multiple choice;
// enforced by validateStructure() in variantGeneration.ts). Short-answer and
// structured items exist only as Paper Intelligence rubrics, which are not
// variants. Nothing here infers another format from the question text: a row
// without usable choices is reported as unreviewable, never re-labelled.

import type { VariantType } from './variants'
import { findMissingFigureReferences, screenAnswerLeakage, type FigureReference, type LeakageScreen } from './answerLeakage'

/** The stored fields this review reads. Typed loosely on purpose: the review must survive malformed rows, not trust them. */
export type ReviewableVariant = {
  variant_type: VariantType | string
  question_text: string | null | undefined
  choices: unknown
  correct_index: unknown
  learning_outcome?: string | null
  cognitive_intent?: string | null
  difficulty_rationale?: string | null
  expected_misconceptions?: unknown
  teacher_explanation?: string | null
  learner_explanation?: string | null
  generated_by?: string | null
}

/** The teacher's saved canonical question, for "what changed in this version". */
export type CanonicalForComparison = { choices: string[]; correctIndex: number }

export type ReviewChoice = { label: string; text: string; isCorrect: boolean }

export type VariantReviewIssue =
  | 'missing_question_text'
  | 'missing_choices'
  | 'malformed_choices'
  | 'blank_choice'
  | 'missing_answer_key'
  | 'answer_key_out_of_range'

export type VariantReviewComparison = {
  /** The option list differs (wording, number or order) from the saved original. */
  choicesChanged: boolean
  /** The marked answer's text differs from the original's marked answer. */
  correctAnswerTextChanged: boolean
  /** The marked answer sits at a different letter than in the original. */
  correctAnswerMoved: boolean
  originalCorrectLabel: string
}

export type VariantReviewGuidance = {
  learningOutcome: string | null
  cognitiveIntent: string | null
  difficultyRationale: string | null
  teacherExplanation: string | null
  learnerExplanation: string | null
  expectedMisconceptions: string[]
}

export type VariantReviewModel = {
  /** 'select_one_option' is the only response format variants can store; 'unknown' when the stored row can't be read as one. */
  responseFormat: 'select_one_option' | 'unknown'
  questionText: string | null
  choices: ReviewChoice[]
  correctAnswer: ReviewChoice | null
  guidance: VariantReviewGuidance
  hasGuidance: boolean
  comparison: VariantReviewComparison | null
  issues: VariantReviewIssue[]
  /** True only when the question, every option and a valid marked answer are all visible — the precondition for an informed approval. */
  answerKeyVerifiable: boolean
  /** Whether a teacher has edited this version (`generated_by = 'teacher_edited'`) rather than it being the AI's text. */
  teacherEdited: boolean
  /** Audit F-01 — automatic screen for an answer stated in the stem. A prompt for judgment, never a verdict. */
  answerScreen: LeakageScreen
  /** Confirmed: text that points at a picture/drawn shape a variant cannot carry. */
  figureReferences: FigureReference[]
}

export const REVIEW_ISSUE_MESSAGE: Record<VariantReviewIssue, string> = {
  missing_question_text: 'This version has no question text stored.',
  missing_choices: 'No answer options are stored for this version.',
  malformed_choices: 'The stored answer options could not be read.',
  blank_choice: 'At least one answer option is blank.',
  missing_answer_key: 'No correct answer is marked for this version.',
  answer_key_out_of_range: 'The marked correct answer does not match any stored option.',
}

/** A–Z option letters, matching the quiz editor's own "Choice A/B/…" labels. */
export function optionLabel(index: number): string {
  return String.fromCharCode(65 + index)
}

function textOrNull(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null
  return value.trim() === '' ? null : value
}

function normaliseChoice(text: string): string {
  return text.trim().replace(/\s+/g, ' ').toLowerCase()
}

export function buildVariantReviewModel(
  variant: ReviewableVariant,
  canonical?: CanonicalForComparison | null,
): VariantReviewModel {
  const issues: VariantReviewIssue[] = []

  const questionText = textOrNull(variant.question_text)
  if (!questionText) issues.push('missing_question_text')

  let rawChoices: string[] = []
  if (variant.choices === null || variant.choices === undefined) {
    issues.push('missing_choices')
  } else if (!Array.isArray(variant.choices) || !variant.choices.every(c => typeof c === 'string')) {
    issues.push('malformed_choices')
  } else if (variant.choices.length === 0) {
    issues.push('missing_choices')
  } else {
    rawChoices = variant.choices as string[]
    if (rawChoices.some(c => c.trim() === '')) issues.push('blank_choice')
  }

  const key = variant.correct_index
  let correctIndex: number | null = null
  if (key === null || key === undefined) {
    issues.push('missing_answer_key')
  } else if (typeof key !== 'number' || !Number.isInteger(key) || key < 0 || key >= rawChoices.length) {
    // With no readable options a whole-number key can't be checked, but the
    // options issue above already explains why (and keeps the key
    // unverifiable) — reporting it twice would only add noise.
    if (rawChoices.length > 0 || typeof key !== 'number' || !Number.isInteger(key)) issues.push('answer_key_out_of_range')
  } else {
    correctIndex = key
  }

  const choices: ReviewChoice[] = rawChoices.map((text, i) => ({ label: optionLabel(i), text, isCorrect: i === correctIndex }))
  const correctAnswer = correctIndex === null ? null : choices[correctIndex]

  const misconceptions = Array.isArray(variant.expected_misconceptions)
    ? variant.expected_misconceptions.filter((m): m is string => typeof m === 'string' && m.trim() !== '')
    : []
  const guidance: VariantReviewGuidance = {
    learningOutcome: textOrNull(variant.learning_outcome),
    cognitiveIntent: textOrNull(variant.cognitive_intent),
    difficultyRationale: textOrNull(variant.difficulty_rationale),
    teacherExplanation: textOrNull(variant.teacher_explanation),
    learnerExplanation: textOrNull(variant.learner_explanation),
    expectedMisconceptions: misconceptions,
  }
  const hasGuidance = misconceptions.length > 0
    || [guidance.learningOutcome, guidance.cognitiveIntent, guidance.difficultyRationale, guidance.teacherExplanation, guidance.learnerExplanation].some(v => v !== null)

  const answerKeyVerifiable = questionText !== null && choices.length >= 2 && correctAnswer !== null
    && !issues.includes('blank_choice')

  let comparison: VariantReviewComparison | null = null
  const canonicalKeyValid = canonical
    && Number.isInteger(canonical.correctIndex)
    && canonical.correctIndex >= 0
    && canonical.correctIndex < canonical.choices.length
  if (canonical && canonicalKeyValid && correctAnswer) {
    const sameChoices = canonical.choices.length === rawChoices.length
      && canonical.choices.every((c, i) => normaliseChoice(c) === normaliseChoice(rawChoices[i]))
    comparison = {
      choicesChanged: !sameChoices,
      correctAnswerTextChanged: normaliseChoice(canonical.choices[canonical.correctIndex]) !== normaliseChoice(correctAnswer.text),
      correctAnswerMoved: canonical.correctIndex !== correctIndex,
      originalCorrectLabel: optionLabel(canonical.correctIndex),
    }
  }

  return {
    responseFormat: choices.length > 0 ? 'select_one_option' : 'unknown',
    questionText,
    choices,
    correctAnswer,
    guidance,
    hasGuidance,
    comparison,
    issues,
    answerKeyVerifiable,
    teacherEdited: variant.generated_by === 'teacher_edited',
    answerScreen: screenAnswerLeakage({ questionText, choices: rawChoices, correctIndex }),
    figureReferences: findMissingFigureReferences(questionText),
  }
}

/**
 * Bulk approve/reject may only cover drafts whose answer key the teacher can
 * see and that nothing has flagged. A flagged version (possible giveaway, or a
 * reference to a picture that can't be shown) stays individually approvable —
 * legitimate scaffolding can trip the screen — but must be looked at on its
 * own rather than approved in a batch.
 */
export function isBulkSelectable(status: string, model: VariantReviewModel): boolean {
  return status === 'draft'
    && model.answerKeyVerifiable
    && model.answerScreen.status !== 'possible_leak'
    && model.figureReferences.length === 0
}
