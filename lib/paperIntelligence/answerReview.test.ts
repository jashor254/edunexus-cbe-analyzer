// lib/paperIntelligence/answerReview.test.ts
// Unit tests for class-wide answer decisions. Every collaborator is mocked —
// no DB, no lifecycle writes.
// Run with: npm test -- lib/paperIntelligence/answerReview.test.ts
import { before, beforeEach, mock, test } from 'node:test'
import assert from 'node:assert/strict'
import type { ScriptMarkRow } from './scriptMarks'
import type { MarkedPoint } from './types'

const calls: string[] = []
let saved: ScriptMarkRow[] = []
let appended: Array<{ text: string; synonyms: string[] }> = []
let audits: Array<{ learnersReaffected: number; answerAdded: unknown }> = []
let retired: Array<{ id: string; reason: string }> = []
let proposals: ScriptMarkRow[] = []
let rubricAssignment = 'a1'

const pt = (text: string, classification: MarkedPoint['classification']): MarkedPoint =>
  ({ text, classification, explained: false, merit: 1, counted: true, awarded: classification === 'matches_scheme' ? 1 : 0, matchedAnswer: null, note: null })

function row(id: string, points: MarkedPoint[], evidence_id: string | null = `ev-${id}`): ScriptMarkRow {
  return {
    id, submission_id: `sub-${id}`, assignment_id: 'a1', rubric_id: 'r1', evidence_id, recognized_answer: '', points,
    proposed_mark: points.filter(p => p.classification === 'matches_scheme').length,
    plausible_mark: points.filter(p => p.classification !== 'incorrect').length,
    max_mark: 5, recognition_confidence: 0.9, grading_confidence: 0.9, uncertain: false, rationale: null,
    page_numbers: [], status: 'proposed', final_mark: null, created_at: '',
  }
}

mock.module('./rubrics', {
  namedExports: {
    findRubricById: async (id: string) => id === 'r1'
      ? { id: 'r1', assignment_id: rubricAssignment, max_marks: 5, points_required: 5, marks_per_point: 1, accepted_answers: [] }
      : null,
    appendAcceptedAnswer: async (_r: unknown, a: { text: string; synonyms: string[] }) => { calls.push('append'); appended.push(a) },
    recordRubricAudit: async (e: { learnersReaffected: number; answerAdded: unknown }) => { calls.push('audit'); audits.push(e) },
  },
})
mock.module('./scriptMarks', {
  namedExports: {
    findProposedMarksForRubric: async () => proposals,
    saveRescoredProposals: async (rows: ScriptMarkRow[]) => { calls.push('save'); saved = rows },
  },
})
mock.module('@/lib/intelligence/evidenceLifecycle', {
  namedExports: { rejectReview: async (id: string, _a: string, reason: string) => { calls.push('retire'); retired.push({ id, reason }); return {} } },
})

let mod: typeof import('./answerReview')
before(async () => { mod = await import('./answerReview') })
beforeEach(() => {
  calls.length = 0; saved = []; appended = []; audits = []; retired = []; rubricAssignment = 'a1'
  proposals = [
    row('1', [pt('Honesty', 'matches_scheme'), pt('Courage', 'plausible_not_in_scheme')]),
    row('2', [pt('courage', 'plausible_not_in_scheme')], null),
    row('3', [pt('Honesty', 'matches_scheme'), pt('Kindness', 'plausible_not_in_scheme')]),
  ]
})

const base = { assignmentId: 'a1', rubricId: 'r1', answerKey: 'courage', teacherId: 't1', teacherUserId: 'u1' }

test('accept: every learner with the answer is re-scored, the scheme gains it, the change is audited', async () => {
  const out = await mod.decidePlausibleAnswer({ ...base, decision: 'accept' })
  assert.deepEqual(out, { decision: 'accept', answer: 'Courage', learnersAffected: 2 })
  assert.deepEqual(saved.map(r => [r.id, r.proposed_mark, r.plausible_mark, r.evidence_id]), [['1', 2, 2, null], ['2', 1, 1, null]])
  assert.deepEqual(appended, [{ text: 'Courage', synonyms: ['courage'] }])
  assert.equal(audits[0].learnersReaffected, 2)
  assert.deepEqual(retired.map(r => r.id), ['ev-1'])
  assert.match(retired[0].reason, /accepted "Courage" into the scheme/)
})

test('reject: re-scored as incorrect, scheme untouched, no audit', async () => {
  const out = await mod.decidePlausibleAnswer({ ...base, decision: 'reject' })
  assert.equal(out.learnersAffected, 2)
  assert.deepEqual(saved.map(r => [r.id, r.proposed_mark, r.plausible_mark]), [['1', 1, 1], ['2', 0, 0]])
  assert.deepEqual([appended.length, audits.length], [0, 0])
  assert.match(retired[0].reason, /does not earn marks/)
})

test('evidence is retired only after the proposals are saved', async () => {
  await mod.decidePlausibleAnswer({ ...base, decision: 'accept' })
  assert.ok(calls.indexOf('save') < calls.indexOf('retire'), calls.join(','))
})

test('a question from another assignment, or an answer nobody unreviewed has, is refused with nothing written', async () => {
  rubricAssignment = 'other'
  await assert.rejects(mod.decidePlausibleAnswer({ ...base, decision: 'accept' }), mod.AnswerDecisionError)
  rubricAssignment = 'a1'
  await assert.rejects(mod.decidePlausibleAnswer({ ...base, answerKey: 'bravery', decision: 'accept' }), mod.AnswerDecisionError)
  await assert.rejects(mod.decidePlausibleAnswer({ ...base, rubricId: 'rX', decision: 'accept' }), mod.AnswerDecisionError)
  assert.deepEqual(calls, [])
})

test('learners without the answer are left exactly as they were', async () => {
  await mod.decidePlausibleAnswer({ ...base, decision: 'accept' })
  assert.ok(!saved.some(r => r.id === '3'))
})
