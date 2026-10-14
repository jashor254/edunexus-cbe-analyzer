// lib/paperIntelligence/scriptValidation.test.ts
// Pure unit tests — no DB, no network, no SDK import.
// Run with: npm test -- lib/paperIntelligence/scriptValidation.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseScriptMarkingResponse, validateScriptMarking, ScriptMarkingParseError } from './scriptValidation'
import { buildScriptMarkingPrompt } from './scriptMarkingPrompt'
import type { RubricForScriptMarking } from './types'

function rubric(id: string, n: number, label: string, pointsRequired: number | null, marksPerPoint: number | null, maxMarks: number): RubricForScriptMarking {
  return {
    rubricId: id, questionNumber: n, questionLabel: label, questionText: `Q${label}`, expectedAnswerSummary: '',
    markingCriteria: [], maxMarks, mode: 'accept_relevant', pointsRequired, marksPerPoint, acceptedAnswers: [{ text: 'Honesty', synonyms: [] }],
  }
}

const RUBRICS = [rubric('r1a', 1, '1a', 5, 1, 5), rubric('r4', 2, '4', 4, 2, 8)]

function question(rubricId: string, points: unknown[], extra: Record<string, unknown> = {}) {
  return {
    rubricId, recognizedAnswer: 'x', pageNumbers: [1], recognitionConfidence: 0.9, recognitionNotes: null,
    uncertain: false, points, gradingConfidence: 0.8, rationale: 'r', ...extra,
  }
}

const raw = (questions: unknown[]) => JSON.stringify({ questions })

test('parses fenced JSON and derives marks from classifications, not from the model', () => {
  const parsed = parseScriptMarkingResponse('```json\n' + raw([
    question('r4', [
      { text: 'Honesty — keeps promises', classification: 'matches_scheme', explained: true, matchedAnswer: 'Honesty', note: null },
      { text: 'Transparency', classification: 'plausible_not_in_scheme', explained: false, matchedAnswer: null, note: 'not listed' },
    ]),
  ]) + '\n```')
  const { results } = validateScriptMarking(parsed, RUBRICS, 3)
  assert.equal(results.length, 1)
  assert.ok(results[0].valid)
  if (!results[0].valid) return
  assert.equal(results[0].question.proposedMark, 2)
  assert.equal(results[0].question.plausibleMark, 3)
  assert.equal(results[0].question.maxMark, 8)
  assert.equal(results[0].question.questionLabel, '4')
  assert.equal(results[0].question.questionNumber, 2)
})

test('a number smuggled in by the model is ignored — marks come only from scoring', () => {
  const parsed = parseScriptMarkingResponse(raw([
    question('r1a', [{ text: 'Honesty', classification: 'matches_scheme', explained: false, merit: 99, proposedMark: 99 }], { proposedMark: 99 }),
  ]))
  const { results } = validateScriptMarking(parsed, RUBRICS, 1)
  assert.ok(results[0].valid && results[0].question.proposedMark === 1)
})

test('malformed JSON or a structurally wrong response is unusable as a whole', () => {
  assert.throws(() => parseScriptMarkingResponse('not json'), ScriptMarkingParseError)
  assert.throws(() => parseScriptMarkingResponse(raw([{ rubricId: 'r1a' }])), ScriptMarkingParseError)
  assert.throws(() => parseScriptMarkingResponse(raw([question('r1a', [{ text: 'a', classification: 'great' }])])), ScriptMarkingParseError)
  assert.throws(() => parseScriptMarkingResponse(raw([question('r1a', [], { recognitionConfidence: 1.4 })])), ScriptMarkingParseError)
})

test('a question for a rubric that was never supplied is rejected, not attached somewhere', () => {
  const { results, unanswered } = validateScriptMarking(parseScriptMarkingResponse(raw([question('rX', [])])), RUBRICS, 1)
  assert.equal(results[0].valid, false)
  assert.equal(unanswered.length, 2)
})

test('a question returned twice keeps the first answer and rejects the repeat', () => {
  const p = [{ text: 'Honesty', classification: 'matches_scheme', explained: false }]
  const { results } = validateScriptMarking(parseScriptMarkingResponse(raw([question('r1a', p), question('r1a', [...p, ...p])])), RUBRICS, 1)
  assert.equal(results[0].valid, true)
  assert.equal(results[1].valid, false)
})

test('questions the model did not return are reported as unanswered', () => {
  const { unanswered } = validateScriptMarking(parseScriptMarkingResponse(raw([question('r1a', [])])), RUBRICS, 1)
  assert.deepEqual(unanswered.map(u => u.rubricId), ['r4'])
})

test('a rubric whose N×M disagrees with its max is rejected rather than clamped', () => {
  const bad = [rubric('rBad', 1, '9', 4, 2, 5)] // 4×2 = 8, but max says 5
  const pts = Array.from({ length: 4 }, () => ({ text: 'a', classification: 'matches_scheme', explained: true }))
  const { results } = validateScriptMarking(parseScriptMarkingResponse(raw([question('rBad', pts)])), bad, 1)
  assert.equal(results[0].valid, false)
  if (!results[0].valid) assert.match(results[0].reason, /not clamped/)
})

test('page references outside the captured pages are dropped; the marks stand', () => {
  const { results } = validateScriptMarking(parseScriptMarkingResponse(raw([question('r1a', [], { pageNumbers: [2, 0, 7, 2, 1] })])), RUBRICS, 3)
  assert.ok(results[0].valid)
  if (results[0].valid) assert.deepEqual(results[0].question.pageNumbers, [1, 2])
})

test('missing optional fields default safely (explained=false, no notes)', () => {
  const { results } = validateScriptMarking(parseScriptMarkingResponse(raw([
    question('r4', [{ text: 'Integrity', classification: 'matches_scheme' }], { pageNumbers: undefined, recognitionNotes: undefined }),
  ])), RUBRICS, 1)
  assert.ok(results[0].valid)
  if (!results[0].valid) return
  assert.equal(results[0].question.proposedMark, 1)
  assert.deepEqual(results[0].question.pageNumbers, [])
  assert.equal(results[0].question.points[0].explained, false)
})

test('the prompt carries the rubric structure, the reading rules, and never asks the model for marks', () => {
  const prompt = buildScriptMarkingPrompt(RUBRICS, 3)
  assert.match(prompt, /Page 1 to Page 3/)
  assert.match(prompt, /Any 4 × 2 = 8 marks \(each point: name it \+ explain it\)/)
  assert.match(prompt, /CONTINUES at the top of the next page/)
  assert.match(prompt, /rubricId "r1a"/)
  assert.doesNotMatch(prompt, /"merit"|"proposedMark"/)
})
