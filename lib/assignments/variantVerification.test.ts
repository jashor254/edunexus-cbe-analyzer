// P0-2 — verifier output contract and the bounded generate→verify→retry
// policy. Pure: verifier responses and model calls are scripted, no AI, no DB.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  decideVerification, generateWithVerification, parseVerifierVerdict, verifyResponse,
  type DraftAttempt, type VerificationOutcome, type VerifierVerdict,
} from './variantVerification'

const CLEAN: VerifierVerdict = {
  keyCorrect: true, sameConcept: true, singleQuestion: true,
  answerGiveaway: 'none', giveawayEvidence: '', factualError: 'none', factualEvidence: '', reason: 'ok',
}
/** Deliberately loose: malformed-output tests pass wrong types on purpose. */
const json = (v: Record<string, unknown>): string => JSON.stringify({ ...CLEAN, ...v })

// ── Contract: outcomes ─────────────────────────────────────────────────────

test('E/J: a fully clean verdict is the only pass', () => {
  assert.deepEqual(verifyResponse(json({})), { kind: 'pass' })
  assert.deepEqual(verifyResponse('```json\n' + json({}) + '\n```'), { kind: 'pass' }) // fenced output is still parsed
})

test('A/B/D: a clear factual or logical error is an actionable retry, quoting the sentence', () => {
  const fullTurn = verifyResponse(json({ factualError: 'clear', factualEvidence: 'Together they make the full turn from one end of the line to the other.' }))
  assert.deepEqual(fullTurn, { kind: 'retry', problems: ['factual or logical error: "Together they make the full turn from one end of the line to the other."'] })

  const arithmetic = verifyResponse(json({ factualError: 'clear', factualEvidence: '70° + 120° = 180°' }))
  assert.equal(arithmetic.kind, 'retry')
})

test('semantic giveaway (clear) is an actionable retry, separate from factual checks', () => {
  const out = verifyResponse(json({ answerGiveaway: 'clear', giveawayEvidence: 'Copper lets electricity flow through it easily.' }))
  assert.deepEqual(out, { kind: 'retry', problems: ['gives the answer away: "Copper lets electricity flow through it easily."'] })
})

test('a failed key / concept / single-question check is a retry carrying the reason', () => {
  const out = verifyResponse(json({ keyCorrect: false, reason: 'choices[1] is also defensible' }))
  assert.deepEqual(out, { kind: 'retry', problems: ['answer key: choices[1] is also defensible'] })
})

test('G: uncertainty is REVIEW, never pass', () => {
  const out = verifyResponse(json({ factualError: 'uncertain', factualEvidence: 'Kenya adopted this in 1963.' }))
  assert.deepEqual(out, { kind: 'review', concerns: ['claim that needs checking: "Kenya adopted this in 1963."'] })
  assert.equal(verifyResponse(json({ answerGiveaway: 'uncertain', giveawayEvidence: 'x' })).kind, 'review')
})

test('a clear problem outranks uncertainty elsewhere (retry, not review)', () => {
  const out = decideVerification({ ...CLEAN, answerGiveaway: 'uncertain', giveawayEvidence: 'a', factualError: 'clear', factualEvidence: 'b' })
  assert.equal(out.kind, 'retry')
})

test('leakage and factual checks are independent: passing one never implies the other', () => {
  assert.equal(verifyResponse(json({ answerGiveaway: 'none', factualError: 'clear', factualEvidence: 'wrong' })).kind, 'retry')
  assert.equal(verifyResponse(json({ answerGiveaway: 'clear', giveawayEvidence: 'given', factualError: 'none' })).kind, 'retry')
})

// ── Contract: malformed / incomplete / inconsistent output is never a pass ──

test('F: malformed or incomplete verifier output is invalid_output, never pass', () => {
  const cases: string[] = [
    'not json at all',
    '[]',
    'null',
    JSON.stringify({ valid: true, reason: 'looks fine' }), // the old one-boolean contract
    json({ keyCorrect: 'yes' }),
    json({ answerGiveaway: 'maybe' }),
    json({ factualError: undefined }),
    json({ reason: undefined }),
    json({ giveawayEvidence: 3 }),
  ]
  for (const text of cases) assert.equal(verifyResponse(text).kind, 'invalid_output', text)
})

test('F: a "clear"/"uncertain" judgement without the quoted sentence is rejected as inconsistent', () => {
  assert.equal(verifyResponse(json({ answerGiveaway: 'clear', giveawayEvidence: '  ' })).kind, 'invalid_output')
  assert.equal(verifyResponse(json({ factualError: 'uncertain', factualEvidence: '' })).kind, 'invalid_output')
  assert.equal(verifyResponse(json({ sameConcept: false, reason: '' })).kind, 'invalid_output')
})

test('parse reports WHY the output was unusable', () => {
  const parsed = parseVerifierVerdict(json({ factualError: 'clear', factualEvidence: '' }))
  assert.ok('invalid' in parsed && /without quoting the sentence/.test(parsed.invalid))
})

// ── Bounded retry policy ────────────────────────────────────────────────────

type Draft = { text: string }

function scripted(drafts: Array<DraftAttempt<Draft>>, verdicts: VerificationOutcome[]) {
  const feedbackSeen: Array<string | null> = []
  const verified: Draft[] = []
  let g = 0
  let v = 0
  return {
    feedbackSeen, verified,
    generate: async (feedback: string | null) => { feedbackSeen.push(feedback); return drafts[g++] },
    verify: async (d: Draft) => { verified.push(d); return verdicts[v++] },
  }
}

test('H: a regenerated draft is verified again and only THAT draft is returned', async () => {
  const s = scripted(
    [{ draft: { text: 'v1 full turn' } }, { draft: { text: 'v2 half turn' } }],
    [{ kind: 'retry', problems: ['factual or logical error: "full turn"'] }, { kind: 'pass' }],
  )
  const result = await generateWithVerification({ maxAttempts: 2, generate: s.generate, verify: s.verify })
  assert.deepEqual(result, { status: 'verified', draft: { text: 'v2 half turn' }, attempts: 2 })
  assert.deepEqual(s.verified.map(d => d.text), ['v1 full turn', 'v2 half turn'], 'both drafts were verified')
  assert.deepEqual(s.feedbackSeen, [null, 'factual or logical error: "full turn"'], 'the retry carried the specific problem')
})

test('I: retry exhaustion returns a failure — never the last draft as verified', async () => {
  const s = scripted(
    [{ draft: { text: 'v1' } }, { draft: { text: 'v2' } }, { draft: { text: 'never generated' } }],
    [{ kind: 'retry', problems: ['gives the answer away: "a"'] }, { kind: 'retry', problems: ['gives the answer away: "b"'] }],
  )
  const result = await generateWithVerification({ maxAttempts: 2, generate: s.generate, verify: s.verify })
  assert.equal(result.status, 'not_verified')
  assert.ok(result.status === 'not_verified' && result.failure === 'retry_exhausted' && result.attempts === 2)
  assert.ok(result.status === 'not_verified' && /^Independent verification failed: gives the answer away: "b"/.test(result.reason), 'reports the LAST round')
  assert.equal(s.feedbackSeen.length, 2, 'bounded: no third attempt')
})

test('G: a final REVIEW outcome is not saved and says it needs a teacher', async () => {
  const s = scripted([{ draft: { text: 'v1' } }, { draft: { text: 'v2' } }],
    [{ kind: 'review', concerns: ['claim that needs checking: "x"'] }, { kind: 'review', concerns: ['claim that needs checking: "y"'] }])
  const result = await generateWithVerification({ maxAttempts: 2, generate: s.generate, verify: s.verify })
  assert.ok(result.status === 'not_verified' && result.failure === 'needs_review')
  assert.ok(result.status === 'not_verified' && /needs a teacher's judgement, so it was not saved/.test(result.reason))
})

test('F: unusable verifier output on every attempt is a failure, and its draft is never returned', async () => {
  const s = scripted([{ draft: { text: 'v1' } }, { draft: { text: 'v2' } }],
    [{ kind: 'invalid_output', detail: 'not JSON' }, { kind: 'invalid_output', detail: 'not JSON' }])
  const result = await generateWithVerification({ maxAttempts: 2, generate: s.generate, verify: s.verify })
  assert.ok(result.status === 'not_verified' && result.failure === 'verifier_output_invalid')
  assert.ok(result.status === 'not_verified' && /nothing was verified/.test(result.reason))
  assert.deepEqual(s.feedbackSeen, [null, null], 'an unusable check says nothing about the draft, so no feedback is invented')
})

test('structural failures are retried, then reported with the existing "Structural validation failed" prefix', async () => {
  const s = scripted([{ structuralError: 'Missing questionText' }, { structuralError: 'Missing questionText' }], [])
  const result = await generateWithVerification({ maxAttempts: 2, generate: s.generate, verify: s.verify })
  assert.deepEqual(result, { status: 'not_verified', failure: 'structural', reason: 'Structural validation failed: Missing questionText', attempts: 2 })
  assert.equal(s.verified.length, 0, 'never verifies a structurally invalid draft')
})

test('a first-attempt pass makes exactly one generate and one verify call', async () => {
  const s = scripted([{ draft: { text: 'good' } }], [{ kind: 'pass' }])
  const result = await generateWithVerification({ maxAttempts: 2, generate: s.generate, verify: s.verify })
  assert.deepEqual(result, { status: 'verified', draft: { text: 'good' }, attempts: 1 })
  assert.equal(s.feedbackSeen.length, 1)
})

test('maxAttempts is bounded below at 1 (never zero or negative attempts)', async () => {
  const s = scripted([{ draft: { text: 'only' } }], [{ kind: 'pass' }])
  const result = await generateWithVerification({ maxAttempts: 0, generate: s.generate, verify: s.verify })
  assert.equal(result.status, 'verified')
})

test('the configured attempt limit is small and finite', async () => {
  const { ADAPTIVE_VARIANT_MAX_GENERATION_ATTEMPTS } = await import('@/lib/config/adaptiveVariants')
  assert.ok(Number.isInteger(ADAPTIVE_VARIANT_MAX_GENERATION_ATTEMPTS) && ADAPTIVE_VARIANT_MAX_GENERATION_ATTEMPTS >= 1 && ADAPTIVE_VARIANT_MAX_GENERATION_ATTEMPTS <= 3)
})
