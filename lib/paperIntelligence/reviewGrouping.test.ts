// lib/paperIntelligence/reviewGrouping.test.ts
// Pure unit tests — no DB, no network.
// Run with: npm test -- lib/paperIntelligence/reviewGrouping.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildQuestionReviews, scriptCompletion, needsAttention, type ReviewRubric } from './reviewGrouping'
import type { ScriptMarkRow } from './scriptMarks'

const R1: ReviewRubric = { id: 'r1', questionNumber: 1, label: '1a', questionText: 'Give: traits', maxMarks: 5, acceptedAnswers: ['Honesty'] }
const R2: ReviewRubric = { id: 'r2', questionNumber: 2, label: '1b', questionText: 'State: problems', maxMarks: 5, acceptedAnswers: [] }

function mark(submission_id: string, rubric_id: string, over: Partial<ScriptMarkRow> = {}): ScriptMarkRow {
  return {
    id: `${submission_id}-${rubric_id}`, submission_id, assignment_id: 'a', rubric_id, evidence_id: 'e', recognized_answer: 'x', points: [],
    proposed_mark: 5, plausible_mark: 5, max_mark: 5, recognition_confidence: 0.9, grading_confidence: 0.9, uncertain: false,
    rationale: null, page_numbers: [1], status: 'proposed', final_mark: null, created_at: '', ...over,
  }
}
const LEARNERS = [{ submissionId: 's1', name: 'Zuri' }, { submissionId: 's2', name: 'Amani' }, { submissionId: 's3', name: 'Bravin' }, { submissionId: 's4', name: 'Never captured' }]

test('confident proposals with nothing to decide group by mark, highest first', () => {
  const [q1] = buildQuestionReviews([R1], [mark('s1', 'r1'), mark('s2', 'r1', { proposed_mark: 4, plausible_mark: 4 }), mark('s3', 'r1')], LEARNERS)
  assert.deepEqual(q1.agreeGroups.map(g => [g.mark, g.items.map(i => i.learnerName)]), [[5, ['Bravin', 'Zuri']], [4, ['Amani']]])
  assert.equal(q1.yourCall.length, 0)
})

test('unreadable, unsure, or plausible-pending proposals go to "your call"', () => {
  const [q1] = buildQuestionReviews([R1], [
    mark('s1', 'r1', { uncertain: true }),
    mark('s2', 'r1', { grading_confidence: 0.5 }),
    mark('s3', 'r1', { proposed_mark: 4, plausible_mark: 5 }),
  ], LEARNERS)
  assert.equal(q1.agreeGroups.length, 0)
  assert.deepEqual(q1.yourCall.map(i => i.learnerName), ['Amani', 'Bravin', 'Zuri'])
})

test('reviewed proposals are listed separately, still changeable', () => {
  const [q1] = buildQuestionReviews([R1], [mark('s1', 'r1', { status: 'overridden', final_mark: 3 }), mark('s2', 'r1')], LEARNERS)
  assert.equal(q1.reviewed[0].finalMark, 3)
  assert.equal(q1.agreeGroups[0].items[0].learnerName, 'Amani')
})

test('a question the AI found no answer for on a marked script is a "missing" card; never-captured learners are absent', () => {
  const reviews = buildQuestionReviews([R1, R2], [mark('s1', 'r1')], LEARNERS)
  const q2 = reviews.find(q => q.id === 'r2')!
  assert.deepEqual(q2.yourCall.map(i => [i.learnerName, i.status, i.markId]), [['Zuri', 'missing', null]])
  assert.ok(reviews.every(q => [...q.yourCall, ...q.reviewed, ...q.agreeGroups.flatMap(g => g.items)].every(i => i.learnerName !== 'Never captured')))
})

test('scriptCompletion: complete only when every question has a reviewed mark', () => {
  assert.deepEqual(scriptCompletion(['r1', 'r2'], [{ rubric_id: 'r1', status: 'confirmed', final_mark: 5 }]), { complete: false, reviewedQuestions: 1, totalQuestions: 2 })
  assert.deepEqual(scriptCompletion(['r1', 'r2'], [{ rubric_id: 'r1', status: 'confirmed', final_mark: 5 }, { rubric_id: 'r2', status: 'proposed', final_mark: null }]).complete, false)
  assert.deepEqual(scriptCompletion(['r1', 'r2'], [{ rubric_id: 'r1', status: 'confirmed', final_mark: 5 }, { rubric_id: 'r2', status: 'overridden', final_mark: 0 }]), { complete: true, total: 5 })
  assert.equal(scriptCompletion([], []).complete, false)
})

test('needsAttention', () => {
  const base = { uncertain: false, grading_confidence: 0.9, proposed_mark: 3, plausible_mark: 3 }
  assert.equal(needsAttention(base), false)
  assert.equal(needsAttention({ ...base, uncertain: true }), true)
  assert.equal(needsAttention({ ...base, grading_confidence: 0.69 }), true)
  assert.equal(needsAttention({ ...base, grading_confidence: null }), true)
  assert.equal(needsAttention({ ...base, plausible_mark: 4 }), true)
})
