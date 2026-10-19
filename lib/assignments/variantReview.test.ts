// Pure tests for the teacher review view model (audit F-02). No I/O.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildVariantReviewModel, isBulkSelectable, type ReviewableVariant } from './variantReview'

const CANONICAL = {
  choices: ['A rubber eraser', 'A piece of paper', 'A metal coin', 'A glass marble'],
  correctIndex: 2,
}

function variant(overrides: Partial<ReviewableVariant> = {}): ReviewableVariant {
  return {
    variant_type: 'foundation',
    question_text: 'Which object will make the bulb light?',
    choices: [...CANONICAL.choices],
    correct_index: 2,
    learning_outcome: null,
    cognitive_intent: 'Identify a conductor',
    difficulty_rationale: 'Adds a worked example',
    expected_misconceptions: ['Thinks paper conducts'],
    teacher_explanation: 'Metals conduct electricity.',
    learner_explanation: null,
    generated_by: 'ai',
    ...overrides,
  }
}

test('A: multiple choice — every option is listed in order and the key resolves to the option TEXT, not just a position', () => {
  const m = buildVariantReviewModel(variant())
  assert.equal(m.responseFormat, 'select_one_option')
  assert.deepEqual(m.choices.map(c => `${c.label}. ${c.text}`), [
    'A. A rubber eraser', 'B. A piece of paper', 'C. A metal coin', 'D. A glass marble',
  ])
  assert.deepEqual(m.correctAnswer, { label: 'C', text: 'A metal coin', isCorrect: true })
  assert.equal(m.choices.filter(c => c.isCorrect).length, 1)
  assert.equal(m.answerKeyVerifiable, true)
  assert.deepEqual(m.issues, [])
})

test('B: two versions with different options/positions each resolve their OWN key — nothing is borrowed from another version or the original', () => {
  const reordered = buildVariantReviewModel(
    variant({ choices: ['A metal coin', 'A glass marble', 'A rubber eraser', 'A piece of paper'], correct_index: 0 }),
    CANONICAL,
  )
  const reworded = buildVariantReviewModel(
    variant({ choices: ['Rubber', 'Paper', 'Glass', 'Copper wire'], correct_index: 3 }),
    CANONICAL,
  )
  assert.deepEqual(reordered.correctAnswer, { label: 'A', text: 'A metal coin', isCorrect: true })
  assert.deepEqual(reworded.correctAnswer, { label: 'D', text: 'Copper wire', isCorrect: true })

  // Same answer, moved: flagged as moved, NOT as a different answer.
  assert.deepEqual(reordered.comparison, { choicesChanged: true, correctAnswerTextChanged: false, correctAnswerMoved: true, originalCorrectLabel: 'C' })
  // Different answer text: flagged as a changed answer.
  assert.equal(reworded.comparison?.correctAnswerTextChanged, true)
  assert.equal(reworded.comparison?.choicesChanged, true)
})

test('B: an unchanged version reports no differences from the original', () => {
  const m = buildVariantReviewModel(variant(), CANONICAL)
  assert.deepEqual(m.comparison, { choicesChanged: false, correctAnswerTextChanged: false, correctAnswerMoved: false, originalCorrectLabel: 'C' })
})

test('B: whitespace/case-only option differences are not reported as changes', () => {
  const m = buildVariantReviewModel(variant({ choices: ['a rubber  eraser', 'A piece of paper ', 'A METAL COIN', 'A glass marble'] }), CANONICAL)
  assert.equal(m.comparison?.choicesChanged, false)
  assert.equal(m.comparison?.correctAnswerTextChanged, false)
})

test('F: optional notes absent — still fully reviewable, notes reported as absent, nothing invented', () => {
  const m = buildVariantReviewModel(variant({
    cognitive_intent: null, difficulty_rationale: '', expected_misconceptions: [], teacher_explanation: '   ', learner_explanation: null,
  }))
  assert.equal(m.answerKeyVerifiable, true)
  assert.equal(m.hasGuidance, false)
  assert.deepEqual(m.guidance, {
    learningOutcome: null, cognitiveIntent: null, difficultyRationale: null, teacherExplanation: null, learnerExplanation: null, expectedMisconceptions: [],
  })
})

test('F: no stored options — unknown format, no invented options or key, not reviewable', () => {
  for (const choices of [null, undefined, []]) {
    const m = buildVariantReviewModel(variant({ choices, correct_index: 0 }))
    assert.equal(m.responseFormat, 'unknown')
    assert.deepEqual(m.choices, [])
    assert.equal(m.correctAnswer, null)
    assert.equal(m.answerKeyVerifiable, false)
    assert.ok(m.issues.includes('missing_choices'))
  }
})

test('F: malformed options (not an array of strings) are reported, never coerced', () => {
  const m = buildVariantReviewModel(variant({ choices: ['ok', 3, null] }))
  // The key can't be checked against unreadable options; that is explained once, by the options issue.
  assert.deepEqual(m.issues, ['malformed_choices'])
  assert.deepEqual(m.choices, [])
  assert.equal(m.correctAnswer, null)
  assert.equal(m.answerKeyVerifiable, false)
})

test('F: missing or out-of-range answer key — no option is marked correct and nothing is guessed', () => {
  const missing = buildVariantReviewModel(variant({ correct_index: null }))
  assert.ok(missing.issues.includes('missing_answer_key'))
  assert.equal(missing.correctAnswer, null)
  assert.equal(missing.choices.some(c => c.isCorrect), false)
  assert.equal(missing.answerKeyVerifiable, false)

  for (const key of [4, -1, 1.5, '2']) {
    const m = buildVariantReviewModel(variant({ correct_index: key }))
    assert.ok(m.issues.includes('answer_key_out_of_range'), `key ${String(key)}`)
    assert.equal(m.correctAnswer, null)
    assert.equal(m.answerKeyVerifiable, false)
  }
})

test('F: missing question text or a blank option makes the version unreviewable', () => {
  const noText = buildVariantReviewModel(variant({ question_text: '  ' }))
  assert.equal(noText.questionText, null)
  assert.ok(noText.issues.includes('missing_question_text'))
  assert.equal(noText.answerKeyVerifiable, false)

  const blank = buildVariantReviewModel(variant({ choices: ['A metal coin', '', 'Glass', 'Paper'], correct_index: 0 }))
  assert.ok(blank.issues.includes('blank_choice'))
  assert.equal(blank.answerKeyVerifiable, false)
})

test('comparison is omitted (not guessed) when the original is unknown or its key is invalid', () => {
  assert.equal(buildVariantReviewModel(variant()).comparison, null)
  assert.equal(buildVariantReviewModel(variant(), { choices: CANONICAL.choices, correctIndex: 9 }).comparison, null)
})

test('H: bulk selection — drafts with a visible key only; approved/rejected/archived or unreviewable never', () => {
  const ok = buildVariantReviewModel(variant())
  const broken = buildVariantReviewModel(variant({ correct_index: 7 }))
  assert.equal(isBulkSelectable('draft', ok), true)
  assert.equal(isBulkSelectable('draft', broken), false)
  for (const status of ['approved', 'rejected', 'archived']) assert.equal(isBulkSelectable(status, ok), false)
})

test('teacher-edited versions are labelled as such', () => {
  assert.equal(buildVariantReviewModel(variant({ generated_by: 'teacher_edited' })).teacherEdited, true)
  assert.equal(buildVariantReviewModel(variant()).teacherEdited, false)
})

// ── Audit F-01: answer-giveaway screen + figure references in the review model ──

test('F-01: a version whose stem states its answer is screened as a possible giveaway and left out of bulk selection — but stays individually approvable', () => {
  const m = buildVariantReviewModel(variant({
    question_text: 'If a material does not let electricity pass, the bulb stays dark. The bulb stays dark for rubber. Which material is a non-conductor?',
    choices: ['Copper wire', 'Aluminium foil', 'Rubber', 'A steel spoon'],
    correct_index: 2,
  }))
  assert.equal(m.answerScreen.status, 'possible_leak')
  assert.equal(m.answerKeyVerifiable, true) // nothing blocks an individual approval
  assert.equal(isBulkSelectable('draft', m), false)
})

test('F-01: a reference to a missing figure is reported and also keeps the version out of bulk selection', () => {
  const m = buildVariantReviewModel(variant({ question_text: 'Look at the circuit shown below. Which object will make the bulb light?' }))
  assert.deepEqual(m.figureReferences, [{ excerpt: 'Look at the circuit shown below.' }])
  assert.equal(isBulkSelectable('draft', m), false)
})

test('F-01: a clean screen does not block bulk selection; a missing key means the screen did not run (never "clean")', () => {
  const clean = buildVariantReviewModel(variant())
  assert.equal(clean.answerScreen.status, 'no_signal')
  assert.equal(isBulkSelectable('draft', clean), true)

  const noKey = buildVariantReviewModel(variant({ correct_index: null }))
  assert.deepEqual(noKey.answerScreen, { status: 'not_checked', reason: 'no_answer_key' })
  const noOptions = buildVariantReviewModel(variant({ choices: [] }))
  assert.equal(noOptions.answerScreen.status, 'not_checked')
})
