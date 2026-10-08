// lib/paperIntelligence/schemeValidation.test.ts
// Pure unit tests — no DB, no network, no SDK import. Runs under the real
// `npm test`.
// Run with: npm test -- lib/paperIntelligence/schemeValidation.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  parseSchemeExtractionResponse,
  validateExtractedRubrics,
  SchemeExtractionParseError,
} from './schemeValidation'

function rawResponse(rubrics: unknown[]): string {
  return JSON.stringify({ rubrics })
}

// A well-formed "Any 4x2=8" rubric (Q4-shaped, from the Phase 0 scheme).
const VALID_RUBRIC = {
  questionId: '4',
  commandWord: 'Explain',
  topic: 'Qualities of a good leader (Chapter 6)',
  pointsRequired: 4,
  marksPerPoint: 2,
  maxMarks: 8,
  mode: 'accept_relevant',
  curriculumStrand: 'Leadership & Integrity',
  acceptedAnswers: [{ text: 'Honesty', synonyms: ['truthfulness'] }],
  uncertain: false,
  uncertaintyNote: null,
}

test('parseSchemeExtractionResponse: valid structured response parses cleanly', () => {
  const parsed = parseSchemeExtractionResponse(rawResponse([VALID_RUBRIC]))
  assert.equal(parsed.rubrics.length, 1)
  assert.equal(parsed.rubrics[0].questionId, '4')
})

test('parseSchemeExtractionResponse: strips a markdown code fence', () => {
  const fenced = '```json\n' + rawResponse([VALID_RUBRIC]) + '\n```'
  const parsed = parseSchemeExtractionResponse(fenced)
  assert.equal(parsed.rubrics.length, 1)
})

test('parseSchemeExtractionResponse: malformed JSON throws', () => {
  assert.throws(() => parseSchemeExtractionResponse('not json {{{'), SchemeExtractionParseError)
})

test('parseSchemeExtractionResponse: missing required field throws', () => {
  const { pointsRequired: _drop, ...missing } = VALID_RUBRIC
  assert.throws(() => parseSchemeExtractionResponse(rawResponse([missing])), SchemeExtractionParseError)
})

test('parseSchemeExtractionResponse: invalid mode value throws', () => {
  assert.throws(() => parseSchemeExtractionResponse(rawResponse([{ ...VALID_RUBRIC, mode: 'lenient' }])), SchemeExtractionParseError)
})

test('parseSchemeExtractionResponse: acceptedAnswers defaults to [] when omitted', () => {
  const { acceptedAnswers: _drop, ...noAnswers } = VALID_RUBRIC
  const parsed = parseSchemeExtractionResponse(rawResponse([noAnswers]))
  assert.deepEqual(parsed.rubrics[0].acceptedAnswers, [])
})

test('validateExtractedRubrics: consistent "Any 4x2=8" rubric is valid', () => {
  const parsed = parseSchemeExtractionResponse(rawResponse([VALID_RUBRIC]))
  const results = validateExtractedRubrics(parsed)
  assert.equal(results.length, 1)
  assert.equal(results[0].valid, true)
})

test('validateExtractedRubrics: "Any 5x1=5" (marksPerPoint 1) is valid', () => {
  const recall = { ...VALID_RUBRIC, questionId: '1a', commandWord: 'Give', pointsRequired: 5, marksPerPoint: 1, maxMarks: 5 }
  const parsed = parseSchemeExtractionResponse(rawResponse([recall]))
  const results = validateExtractedRubrics(parsed)
  assert.equal(results[0].valid, true)
})

test('validateExtractedRubrics: mark arithmetic that does not add up is REJECTED', () => {
  // "4x2" must equal 8, not 9 — a misread the teacher must see.
  const badArithmetic = { ...VALID_RUBRIC, pointsRequired: 4, marksPerPoint: 2, maxMarks: 9 }
  const parsed = parseSchemeExtractionResponse(rawResponse([badArithmetic]))
  const results = validateExtractedRubrics(parsed)
  assert.equal(results[0].valid, false)
  if (!results[0].valid) assert.match(results[0].reason, /arithmetic does not add up/)
})

test('validateExtractedRubrics: an uncertain rubric is still VALID (flagged, never dropped)', () => {
  const flagged = { ...VALID_RUBRIC, uncertain: true, uncertaintyNote: 'tally line blurred' }
  const parsed = parseSchemeExtractionResponse(rawResponse([flagged]))
  const results = validateExtractedRubrics(parsed)
  assert.equal(results[0].valid, true)
  if (results[0].valid) {
    assert.equal(results[0].rubric.uncertain, true)
    assert.equal(results[0].rubric.uncertaintyNote, 'tally line blurred')
  }
})

test('validateExtractedRubrics: a duplicated questionId is rejected', () => {
  const parsed = parseSchemeExtractionResponse(rawResponse([VALID_RUBRIC, { ...VALID_RUBRIC }]))
  const results = validateExtractedRubrics(parsed)
  assert.equal(results[0].valid, true)
  assert.equal(results[1].valid, false)
  if (!results[1].valid) assert.match(results[1].reason, /Duplicate/)
})

test('validateExtractedRubrics: one bad rubric never invalidates the rest', () => {
  const good = VALID_RUBRIC
  const bad = { ...VALID_RUBRIC, questionId: '5', maxMarks: 99 }
  const parsed = parseSchemeExtractionResponse(rawResponse([good, bad]))
  const results = validateExtractedRubrics(parsed)
  assert.equal(results.length, 2)
  assert.equal(results[0].valid, true)
  assert.equal(results[1].valid, false)
})
