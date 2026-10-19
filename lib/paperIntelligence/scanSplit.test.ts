// lib/paperIntelligence/scanSplit.test.ts
//
// A scanned class PDF splits into scripts in class-list order, N pages each,
// skipping absent learners — and a stack that does not add up is reported,
// never silently shifted onto the wrong child.
//
// Run: npm test -- lib/paperIntelligence/scanSplit.test.ts

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { planScanSplit, suggestPagesPerLearner, type ScanLearner } from './scanSplit'

const learners: ScanLearner[] = [
  { submissionId: 'a', name: 'Amani', absent: false },
  { submissionId: 'b', name: 'Bravin', absent: true },
  { submissionId: 'c', name: 'Chebet', absent: false },
  { submissionId: 'd', name: 'Dorcas', absent: false },
]

test('splits in class-list order, N pages each, skipping absent learners', () => {
  const plan = planScanSplit(6, learners, 2, 12)
  assert.deepEqual(plan.assignments, [
    { submissionId: 'a', name: 'Amani', pdfPages: [1, 2] },
    { submissionId: 'c', name: 'Chebet', pdfPages: [3, 4] },
    { submissionId: 'd', name: 'Dorcas', pdfPages: [5, 6] },
  ])
  assert.equal(plan.expectedPages, 6)
  assert.deepEqual(plan.unassignedPages, [])
  assert.deepEqual(plan.shortLearners, [])
})

test('a PDF that is too long reports the leftover pages', () => {
  const plan = planScanSplit(7, learners, 2, 12)
  assert.deepEqual(plan.unassignedPages, [7])
})

test('a PDF that is too short reports who is short — and gives no pages to those it cannot reach', () => {
  const plan = planScanSplit(3, learners, 2, 12)
  assert.deepEqual(plan.assignments.map(a => [a.name, a.pdfPages]), [['Amani', [1, 2]], ['Chebet', [3]]])
  assert.deepEqual(plan.shortLearners, ['Chebet', 'Dorcas'])
})

test('refuses a pages-per-learner the script limit cannot hold', () => {
  assert.throws(() => planScanSplit(26, learners, 13, 12), /at most 12/)
  assert.throws(() => planScanSplit(6, learners, 0, 12))
})

test('suggests pages per learner only when the PDF divides evenly', () => {
  assert.equal(suggestPagesPerLearner(90, 30, 12), 3)
  assert.equal(suggestPagesPerLearner(91, 30, 12), null)
  assert.equal(suggestPagesPerLearner(400, 20, 12), null, '20 pages each exceeds the script limit')
  assert.equal(suggestPagesPerLearner(10, 0, 12), null)
})
