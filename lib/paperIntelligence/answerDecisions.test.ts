// lib/paperIntelligence/answerDecisions.test.ts
// Pure unit tests — no DB, no network.
// Run with: npm test -- lib/paperIntelligence/answerDecisions.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { normalizeAnswer, answerName, answerKey, collectPlausibleAnswers, applyAnswerDecision } from './answerDecisions'
import type { MarkedPoint } from './types'

function pt(text: string, classification: MarkedPoint['classification'], explained = false): MarkedPoint {
  return { text, classification, explained, merit: 1, counted: true, awarded: 0, matchedAnswer: null, note: null }
}
const ANY_5x1 = { maxMarks: 5, pointsRequired: 5, marksPerPoint: 1 }
const ANY_4x2 = { maxMarks: 8, pointsRequired: 4, marksPerPoint: 2 }

test('normalizeAnswer ignores case, punctuation and spacing', () => {
  assert.equal(normalizeAnswer('Self-awareness.'), 'self awareness')
  assert.equal(normalizeAnswer('  self   AWARENESS '), 'self awareness')
  assert.equal(normalizeAnswer('Socio-economic status'), 'socio economic status')
  assert.equal(normalizeAnswer('...'), '')
})

test('answerName strips bullets, numbering and the explanation', () => {
  assert.equal(answerName('-Ethics -> involves having good behaviour'), 'Ethics')
  assert.equal(answerName('2. Transparency — having humanity to people'), 'Transparency')
  assert.equal(answerName('-> Carrying out agricultural practices properly'), 'Carrying out agricultural practices properly')
  assert.equal(answerName('Insecurity because of crime in towns'), 'Insecurity')
  assert.equal(answerName('Unemployment: lack of jobs'), 'Unemployment')
  assert.equal(answerName('Self-awareness'), 'Self-awareness')
  assert.equal(answerName('Socio-economic status'), 'Socio-economic status')
  assert.equal(answerKey('-Ethics -> involves having good behaviour'), answerKey('Ethics'))
})

test('a named-and-explained answer groups with the same name written bare', () => {
  const groups = collectPlausibleAnswers([
    { submission_id: 's1', points: [pt('-Ethics -> involves having good behaviour', 'plausible_not_in_scheme', true)] },
    { submission_id: 's2', points: [pt('Ethics', 'plausible_not_in_scheme')] },
  ])
  assert.deepEqual(groups.map(g => [g.text, g.submissionIds.length]), [['Ethics', 2]])
})

test('collectPlausibleAnswers groups the same answer across learners, most common first', () => {
  const groups = collectPlausibleAnswers([
    { submission_id: 's1', points: [pt('Courage', 'plausible_not_in_scheme'), pt('Honesty', 'matches_scheme')] },
    { submission_id: 's2', points: [pt('courage', 'plausible_not_in_scheme'), pt('Kindness', 'plausible_not_in_scheme')] },
    { submission_id: 's3', points: [pt('Courage', 'plausible_not_in_scheme'), pt('Warrior', 'incorrect')] },
  ])
  assert.deepEqual(groups.map(g => [g.key, g.text, g.submissionIds.length]), [['courage', 'Courage', 3], ['kindness', 'Kindness', 1]])
  assert.deepEqual(groups[0].variants.sort(), ['Courage', 'courage'])
})

test('a learner who repeats the same plausible answer counts once', () => {
  const [g] = collectPlausibleAnswers([{ submission_id: 's1', points: [pt('Courage', 'plausible_not_in_scheme'), pt('courage', 'plausible_not_in_scheme')] }])
  assert.equal(g.submissionIds.length, 1)
})

test('accept: the answer now matches the scheme and the mark rises', () => {
  const points = [pt('Patient', 'matches_scheme'), pt('Honesty', 'matches_scheme'), pt('Courage', 'plausible_not_in_scheme')]
  const r = applyAnswerDecision(points, 'courage', 'accept', 'Courage', ANY_5x1)
  assert.equal(r.changed, true)
  assert.equal(r.proposedMark, 3)
  assert.equal(r.plausibleMark, 3)
  assert.equal(r.points[2].classification, 'matches_scheme')
  assert.equal(r.points[2].matchedAnswer, 'Courage')
})

test('reject: the answer becomes incorrect and the if-accepted mark falls', () => {
  const points = [pt('Patient', 'matches_scheme'), pt('Courage', 'plausible_not_in_scheme'), pt('Kindness', 'plausible_not_in_scheme')]
  const r = applyAnswerDecision(points, 'courage', 'reject', 'Courage', ANY_5x1)
  assert.equal(r.proposedMark, 1)
  assert.equal(r.plausibleMark, 2) // Kindness still pending
  assert.equal(r.points[1].classification, 'incorrect')
})

test('marks are re-derived with the rubric structure — a 2-mark point keeps its explanation', () => {
  const r = applyAnswerDecision([pt('Transparency — leaders share information', 'plausible_not_in_scheme', true)], answerKey('Transparency'), 'accept', 'Transparency', ANY_4x2)
  assert.equal(r.proposedMark, 2)
})

test('first-N still applies after a decision', () => {
  const points = [pt('a', 'matches_scheme'), pt('b', 'matches_scheme'), pt('c', 'matches_scheme'), pt('d', 'matches_scheme'), pt('e', 'matches_scheme'), pt('Courage', 'plausible_not_in_scheme')]
  const r = applyAnswerDecision(points, 'courage', 'accept', 'Courage', ANY_5x1)
  assert.equal(r.proposedMark, 5)
  assert.equal(r.points[5].counted, false)
})

test('only plausible points with that answer are touched; others report unchanged', () => {
  const points = [pt('Courage', 'incorrect'), pt('Honesty', 'matches_scheme')]
  const r = applyAnswerDecision(points, 'courage', 'accept', 'Courage', ANY_5x1)
  assert.equal(r.changed, false)
  assert.equal(r.points[0].classification, 'incorrect')
})
