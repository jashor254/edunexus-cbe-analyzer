// lib/paperIntelligence/validation.test.ts
// Pure unit tests — no DB, no network, no repos import (this file has zero
// dependency on lib/repositories, so it is NOT subject to the eager
// service-client-construction issue that excludes lib/adaptiveLearning/
// recommend.test.ts and lib/remedial/planner.test.ts from the CI harness —
// this one runs under the real `npm test`.
// Run with: npx tsx --test lib/paperIntelligence/validation.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parsePaperVisionResponse, validateAgainstRubrics, PaperVisionParseError } from './validation'
import { FIXTURE_RUBRICS } from './__fixtures__/grade8SocialStudiesFixture'

function rawResponse(questions: unknown[]): string {
  return JSON.stringify({ questions })
}

const VALID_Q = {
  rubricId: 'fixture-q2', questionNumber: 2,
  recognizedAnswer: 'Monsoon winds allowed trade with Arabia.',
  recognitionConfidence: 0.9, recognitionNotes: null, uncertain: false,
  proposedMark: 2, maxMark: 2, gradingConfidence: 0.85, rationale: 'Correct.',
}

test('parsePaperVisionResponse: valid structured response parses cleanly', () => {
  const parsed = parsePaperVisionResponse(rawResponse([VALID_Q]))
  assert.equal(parsed.questions.length, 1)
  assert.equal(parsed.questions[0].rubricId, 'fixture-q2')
})

test('parsePaperVisionResponse: strips a markdown code fence before parsing', () => {
  const fenced = '```json\n' + rawResponse([VALID_Q]) + '\n```'
  const parsed = parsePaperVisionResponse(fenced)
  assert.equal(parsed.questions.length, 1)
})

test('parsePaperVisionResponse: malformed JSON throws PaperVisionParseError', () => {
  assert.throws(() => parsePaperVisionResponse('not json at all {{{'), PaperVisionParseError)
})

test('parsePaperVisionResponse: missing answer field throws', () => {
  const { recognizedAnswer: _drop, ...missingAnswer } = VALID_Q
  assert.throws(() => parsePaperVisionResponse(rawResponse([missingAnswer])), PaperVisionParseError)
})

test('parsePaperVisionResponse: missing question reference (rubricId) throws', () => {
  const { rubricId: _drop, ...missingRubricId } = VALID_Q
  assert.throws(() => parsePaperVisionResponse(rawResponse([missingRubricId])), PaperVisionParseError)
})

test('parsePaperVisionResponse: invalid confidence (out of 0-1 range) throws', () => {
  assert.throws(() => parsePaperVisionResponse(rawResponse([{ ...VALID_Q, recognitionConfidence: 1.5 }])), PaperVisionParseError)
  assert.throws(() => parsePaperVisionResponse(rawResponse([{ ...VALID_Q, gradingConfidence: -0.1 }])), PaperVisionParseError)
})

test('validateAgainstRubrics: a mark within bounds is accepted', () => {
  const parsed = parsePaperVisionResponse(rawResponse([VALID_Q]))
  const results = validateAgainstRubrics(parsed, FIXTURE_RUBRICS)
  assert.equal(results.length, 1)
  assert.equal(results[0].valid, true)
})

test('validateAgainstRubrics: proposedMark exceeding maxMark is REJECTED, never clamped', () => {
  const overMax = { ...VALID_Q, proposedMark: 7, maxMark: 2 } // "7/2" — the exact spec example shape
  const parsed = parsePaperVisionResponse(rawResponse([overMax]))
  const results = validateAgainstRubrics(parsed, FIXTURE_RUBRICS)
  assert.equal(results.length, 1)
  assert.equal(results[0].valid, false)
  if (!results[0].valid) {
    assert.match(results[0].reason, /out of bounds/)
    assert.doesNotMatch(results[0].reason, /clamped to/) // never silently converted
  }
})

test('validateAgainstRubrics: a negative proposedMark is REJECTED, never coerced to 0', () => {
  const negative = { ...VALID_Q, proposedMark: -1 }
  const parsed = parsePaperVisionResponse(rawResponse([negative]))
  const results = validateAgainstRubrics(parsed, FIXTURE_RUBRICS)
  assert.equal(results[0].valid, false)
  if (!results[0].valid) assert.match(results[0].reason, /out of bounds/)
})

test('validateAgainstRubrics: a non-integer proposedMark is rejected', () => {
  const fractional = { ...VALID_Q, proposedMark: 1.5 }
  const parsed = parsePaperVisionResponse(rawResponse([fractional]))
  const results = validateAgainstRubrics(parsed, FIXTURE_RUBRICS)
  assert.equal(results[0].valid, false)
})

test('validateAgainstRubrics: a maxMark mismatched against the rubric is rejected, even if the mark itself is in range', () => {
  const wrongMax = { ...VALID_Q, maxMark: 99 } // model claims a different scale than the rubric's own max_marks
  const parsed = parsePaperVisionResponse(rawResponse([wrongMax]))
  const results = validateAgainstRubrics(parsed, FIXTURE_RUBRICS)
  assert.equal(results[0].valid, false)
})

test('validateAgainstRubrics: a rubricId the caller never supplied is rejected, not silently matched to something else', () => {
  const unknownRubric = { ...VALID_Q, rubricId: 'not-a-real-rubric' }
  const parsed = parsePaperVisionResponse(rawResponse([unknownRubric]))
  const results = validateAgainstRubrics(parsed, FIXTURE_RUBRICS)
  assert.equal(results[0].valid, false)
})

test('validateAgainstRubrics: one bad question never invalidates the rest of the page', () => {
  const good = VALID_Q
  const bad = { ...VALID_Q, rubricId: 'fixture-q1', questionNumber: 1, proposedMark: 99, maxMark: 4 }
  const parsed = parsePaperVisionResponse(rawResponse([good, bad]))
  const results = validateAgainstRubrics(parsed, FIXTURE_RUBRICS)
  assert.equal(results.length, 2)
  assert.equal(results[0].valid, true)
  assert.equal(results[1].valid, false)
})
