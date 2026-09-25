// lib/ai/learnerPseudonym.test.ts
// Pure unit tests — no DB, no network.
//
// Run with: npm test -- lib/ai/learnerPseudonym.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { LEARNER_NAME_TOKEN, learnerFirstName, restoreLearnerName } from './learnerPseudonym'

test('restores the token inside nested JSON strings', () => {
  const response = {
    summary: `${LEARNER_NAME_TOKEN} is building strength in Mathematics.`,
    insight: { opportunities: [`Let ${LEARNER_NAME_TOKEN} lead a group`, `Praise ${LEARNER_NAME_TOKEN}'s effort`] },
    score: 3,
    note: null,
  }
  assert.deepEqual(restoreLearnerName(response, 'Wanjiku'), {
    summary: 'Wanjiku is building strength in Mathematics.',
    insight: { opportunities: ['Let Wanjiku lead a group', "Praise Wanjiku's effort"] },
    score: 3,
    note: null,
  })
})

test('tolerates whitespace the model adds inside the braces', () => {
  assert.equal(restoreLearnerName('Hi! {{ LEARNER }} is ready.', 'Otieno'), 'Hi! Otieno is ready.')
})

test('learnerFirstName takes the first word and never returns empty', () => {
  assert.equal(learnerFirstName('  Brian Kipchoge Mutua '), 'Brian')
  assert.equal(learnerFirstName(''), 'your child')
  assert.equal(learnerFirstName(null), 'your child')
})
