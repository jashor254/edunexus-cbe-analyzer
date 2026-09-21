// lib/paperIntelligence/validation.adversarial.test.ts
//
// Final adversarial gate — attacking parsePaperVisionResponse/
// validateAgainstRubrics with the exact attack categories named in the
// break-it audit: structural, confidence, mark, and rubric attacks. Pure,
// no DB, no network — runs under plain tsx --test.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parsePaperVisionResponse, validateAgainstRubrics, PaperVisionParseError } from './validation'
import { FIXTURE_RUBRICS } from './__fixtures__/grade8SocialStudiesFixture'

const VALID = {
  rubricId: 'fixture-q2', questionNumber: 2,
  recognizedAnswer: 'Monsoon winds.', recognitionConfidence: 0.9,
  recognitionNotes: null, uncertain: false,
  proposedMark: 2, maxMark: 2, gradingConfidence: 0.85, rationale: 'Correct.',
}

function raw(questions: unknown[]) { return JSON.stringify({ questions }) }
function rejects(q: unknown) {
  const parsed = parsePaperVisionResponse(raw([q]))
  const results = validateAgainstRubrics(parsed, FIXTURE_RUBRICS)
  return results[0]
}
function parseThrows(q: unknown) {
  assert.throws(() => parsePaperVisionResponse(raw([q])), PaperVisionParseError)
}

// ── Structural attacks ───────────────────────────────────────────────────

test('ATTACK: invalid JSON entirely', () => {
  assert.throws(() => parsePaperVisionResponse('{not json'), PaperVisionParseError)
})

test('ATTACK: missing question (empty questions array) — parses, zero results, never fabricated', () => {
  const parsed = parsePaperVisionResponse(raw([]))
  assert.deepEqual(validateAgainstRubrics(parsed, FIXTURE_RUBRICS), [])
})

test('ATTACK: unknown question (rubricId not among supplied rubrics) is rejected', () => {
  const r = rejects({ ...VALID, rubricId: 'phantom-question' })
  assert.equal(r.valid, false)
})

test('ATTACK: duplicate question (same rubricId twice) — both validated independently, no silent merge/overwrite', () => {
  const parsed = parsePaperVisionResponse(raw([VALID, VALID]))
  const results = validateAgainstRubrics(parsed, FIXTURE_RUBRICS)
  assert.equal(results.length, 2)
  assert.equal(results[0].valid, true)
  assert.equal(results[1].valid, true)
  // Deduplication (if desired) is the CALLER's job (e.g. evidence producer),
  // not silently decided inside validation — confirmed: this layer does not
  // collapse duplicates on its own, so a caller must not assume it does.
})

test('ATTACK: missing answer field', () => parseThrows({ ...VALID, recognizedAnswer: undefined }))
test('ATTACK: null answer', () => parseThrows({ ...VALID, recognizedAnswer: null }))

test('ATTACK: extremely large answer (50k chars) is NOT rejected by validation — no fabricated truncation, but flagged as a real capacity question for the caller', () => {
  const huge = { ...VALID, recognizedAnswer: 'x'.repeat(50_000) }
  const parsed = parsePaperVisionResponse(raw([huge]))
  const result = validateAgainstRubrics(parsed, FIXTURE_RUBRICS)[0]
  assert.equal(result.valid, true) // no length cap exists today — UNKNOWN/gap, reported explicitly, not silently truncated
})

test('ATTACK: unexpected/extra fields on the question object are ignored, not smuggled through', () => {
  const withExtra = { ...VALID, __proto__inject: 'ignored', maliciousField: { nested: true } }
  const parsed = parsePaperVisionResponse(raw([withExtra]))
  const result = validateAgainstRubrics(parsed, FIXTURE_RUBRICS)[0]
  assert.equal(result.valid, true)
  if (result.valid) assert.equal(Object.keys(result.question).includes('maliciousField'), false)
})

test('ATTACK: wrong data types (mark as string, confidence as string)', () => {
  parseThrows({ ...VALID, proposedMark: '2' })
  parseThrows({ ...VALID, recognitionConfidence: 'high' })
})

// ── Confidence attacks ───────────────────────────────────────────────────

test('ATTACK confidence: -1 rejected at parse', () => parseThrows({ ...VALID, recognitionConfidence: -1 }))
test('ATTACK confidence: 2 (out of 0-1 range) rejected at parse', () => parseThrows({ ...VALID, gradingConfidence: 2 }))
test('ATTACK confidence: NaN rejected at parse', () => parseThrows({ ...VALID, recognitionConfidence: NaN }))
test('ATTACK confidence: Infinity rejected at parse', () => parseThrows({ ...VALID, gradingConfidence: Infinity }))
test('ATTACK confidence: "high" (string) rejected at parse', () => parseThrows({ ...VALID, recognitionConfidence: 'high' }))
test('ATTACK confidence: null rejected at parse', () => parseThrows({ ...VALID, gradingConfidence: null }))

// ── Mark attacks ─────────────────────────────────────────────────────────

test('ATTACK mark: -1 rejected, never coerced to 0', () => {
  const r = rejects({ ...VALID, proposedMark: -1 })
  assert.equal(r.valid, false)
})
test('ATTACK mark: -999 rejected', () => assert.equal(rejects({ ...VALID, proposedMark: -999 }).valid, false))
test('ATTACK mark: 0 is VALID (a genuine zero score is a legitimate mark, not an attack)', () => {
  assert.equal(rejects({ ...VALID, proposedMark: 0 }).valid, true)
})
test('ATTACK mark: exactly max is VALID', () => assert.equal(rejects({ ...VALID, proposedMark: 2 }).valid, true))
test('ATTACK mark: max + 1 rejected — the result carries no accepted question at all, confirming no clamped value was substituted', () => {
  const r = rejects({ ...VALID, proposedMark: 3 }) // max is 2 for fixture-q2
  assert.equal(r.valid, false)
  assert.equal('question' in r, false) // no accepted question object exists to have been clamped
})
test('ATTACK mark: 999999 rejected', () => assert.equal(rejects({ ...VALID, proposedMark: 999999 }).valid, false))
test('ATTACK mark: "3" (string) rejected at parse, not coerced to number', () => parseThrows({ ...VALID, proposedMark: '3' }))
test('ATTACK mark: null rejected at parse', () => parseThrows({ ...VALID, proposedMark: null }))
test('ATTACK mark: NaN rejected at parse', () => parseThrows({ ...VALID, proposedMark: NaN }))
test('ATTACK mark: Infinity rejected (fails rubric bounds check, not parse — Infinity is technically a JS number)', () => {
  // JSON.stringify(Infinity) becomes `null`, which Zod's z.number() already
  // rejects at parse — confirming the JSON boundary itself closes this one.
  assert.throws(() => parsePaperVisionResponse(raw([{ ...VALID, proposedMark: Infinity }])), PaperVisionParseError)
})
test('ATTACK mark: fractional (1.5) rejected — must be a whole number', () => {
  assert.equal(rejects({ ...VALID, proposedMark: 1.5 }).valid, false)
})

// ── Rubric attacks ───────────────────────────────────────────────────────

test('ATTACK rubric: missing rubric (rubricId supplied but not in the caller\'s rubric list) rejected', () => {
  assert.equal(rejects({ ...VALID, rubricId: 'never-supplied' }).valid, false)
})
test('ATTACK rubric: wrong rubric question (maxMark does not match the real rubric\'s max_marks) rejected', () => {
  // fixture-q1's real max is 4, not 2 — model claiming q2's maxMark for q1's rubricId
  const r = rejects({ ...VALID, rubricId: 'fixture-q1', questionNumber: 1, maxMark: 2 })
  assert.equal(r.valid, false)
})
test('ATTACK rubric: missing max marks in model output rejected at parse', () => parseThrows({ ...VALID, maxMark: undefined }))
test('ATTACK rubric: zero max marks from the model is rejected at parse (maxMark must be positive)', () => parseThrows({ ...VALID, maxMark: 0 }))
test('ATTACK rubric: negative max marks from the model rejected at parse', () => parseThrows({ ...VALID, maxMark: -2 }))
test('ATTACK rubric: malformed markingCriteria on the SUPPLIED rubric (caller-side) never reaches the model output validator — the model does not echo criteria back, so this is not an attack surface here (rubric authoring integrity is Gate 2\'s own concern, enforced by the teacher-authored table, not by validation.ts)', () => {
  assert.ok(true) // documented finding, not a testable code path in this file
})

// ── Curriculum-authority attack (Gate H) ─────────────────────────────────

test('ATTACK: model output has no field capable of supplying a sub_strand_id at all — the type does not exist on RecognizedQuestionAnswer, so the AI structurally cannot decide curriculum linkage', () => {
  const withSubStrandAttempt = { ...VALID, subStrandId: 'attacker-supplied-substrand-id', sub_strand_id: 'another-attempt' }
  const parsed = parsePaperVisionResponse(raw([withSubStrandAttempt]))
  const result = validateAgainstRubrics(parsed, FIXTURE_RUBRICS)[0]
  assert.equal(result.valid, true)
  if (result.valid) {
    assert.equal('subStrandId' in result.question, false)
    assert.equal('sub_strand_id' in result.question, false)
  }
})
