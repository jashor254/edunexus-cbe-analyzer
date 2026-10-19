// lib/paperIntelligence/review.test.ts
// Unit tests for review. Every collaborator is mocked — no DB, no lifecycle
// writes, no network. recordSubmissionMark stays mocked so the tests can prove
// review never files a mark (mark first, file after — upload.ts files).
// Run with: npm test -- lib/paperIntelligence/review.test.ts
import { before, beforeEach, mock, test } from 'node:test'
import assert from 'node:assert/strict'
import type { ScriptMarkRow } from './scriptMarks'

const lifecycle: string[] = []
let applied: Array<{ ids: string[]; status: string; finalMark: number }> = []
let entered: Array<{ rubricId: string; finalMark: number }> = []
let finalizedScores: Array<{ submissionId: string; score: number }> = []
let marks: ScriptMarkRow[] = []
let maxScore: number | null = 10

function mark(submission_id: string, rubric_id: string, over: Partial<ScriptMarkRow> = {}): ScriptMarkRow {
  return {
    id: `${submission_id}-${rubric_id}`, submission_id, assignment_id: 'a1', rubric_id, evidence_id: `ev-${submission_id}-${rubric_id}`, recognized_answer: '', points: [],
    proposed_mark: 4, plausible_mark: 5, max_mark: 5, recognition_confidence: 0.9, grading_confidence: 0.9, uncertain: false,
    rationale: null, page_numbers: [], status: 'proposed', final_mark: null, created_at: '', ...over,
  }
}

mock.module('@/lib/intelligence/evidenceLifecycle', {
  namedExports: {
    confirmReview: async (id: string) => { lifecycle.push(`confirm:${id}`); return {} },
    rejectReview: async (id: string, _a: string, reason: string) => { lifecycle.push(`reject:${id}:${reason}`); return {} },
    retractEvidence: async (id: string) => { lifecycle.push(`retract:${id}`); return {} },
  },
})
mock.module('@/lib/assignments/markSubmission', {
  namedExports: {
    recordSubmissionMark: async (input: { target: { submissionId: string }; score: number }) => {
      finalizedScores.push({ submissionId: input.target.submissionId, score: input.score })
      return { submission: { id: input.target.submissionId, student_id: 'x' }, followUp: async () => {} }
    },
  },
})
mock.module('./rubrics', {
  namedExports: {
    findRubricsForAssignment: async () => [
      { id: 'r1', question_number: 1, question_label: '1a', question_text: 'q1', max_marks: 5, mode: 'accept_relevant', accepted_answers: [] },
      { id: 'r2', question_number: 2, question_label: '1b', question_text: 'q2', max_marks: 5, mode: 'strict', accepted_answers: [] },
    ],
  },
})
mock.module('./scriptMarks', {
  namedExports: {
    findScriptMarksForAssignment: async () => marks,
    findScriptMarksForSubmissions: async (ids: string[]) => marks.filter(m => ids.includes(m.submission_id)),
    applyReviewDecision: async (ids: string[], d: { status: 'confirmed' | 'overridden'; finalMark: number }) => {
      applied.push({ ids, status: d.status, finalMark: d.finalMark })
      // Reflect it, so finalize sees the fresh state.
      marks = marks.map(m => ids.includes(m.id) ? { ...m, status: d.status, final_mark: d.finalMark } : m)
    },
    insertTeacherEnteredMarks: async (rows: Array<{ submissionId: string; rubricId: string; finalMark: number }>) => {
      entered.push(...rows)
      marks = [...marks, ...rows.map(r => mark(r.submissionId, r.rubricId, { status: 'overridden', final_mark: r.finalMark, evidence_id: null }))]
    },
  },
})
mock.module('./reviewContext', {
  namedExports: {
    findReviewSubmissions: async () => [
      { submissionId: 's1', studentId: 'st1', classId: 'c1', name: 'Amani' },
      { submissionId: 's2', studentId: 'st2', classId: 'c1', name: 'Bravin' },
      { submissionId: 'sX', studentId: 'stX', classId: 'OTHER', name: 'Elsewhere' },
    ],
    findMarkableAssignment: async () => ({ id: 'a1', max_score: maxScore, subject: 'Social Studies', topic: null, substrand_id: null }),
  },
})

let review: typeof import('./review')
before(async () => { review = await import('./review') })
beforeEach(() => {
  lifecycle.length = 0; applied = []; entered = []; finalizedScores = []; maxScore = 10
  marks = [mark('s1', 'r1'), mark('s1', 'r2'), mark('s2', 'r1')]
})

const base = { assignmentId: 'a1', classId: 'c1', teacherId: 't1', teacherUserId: 'u1' }

test('agreeing with the AI confirms its evidence; a different mark rejects it with both marks in the reason', async () => {
  await review.confirmQuestionMarks({ ...base, decisions: [{ submissionId: 's1', rubricId: 'r1', finalMark: 4 }, { submissionId: 's2', rubricId: 'r1', finalMark: 5 }] })
  assert.deepEqual(lifecycle.sort(), ['confirm:ev-s1-r1', 'reject:ev-s2-r1:Teacher marked 5/5; Paper Intelligence proposed 4'])
  assert.deepEqual(applied.map(a => [a.ids, a.status, a.finalMark]).sort(), [[['s1-r1'], 'confirmed', 4], [['s2-r1'], 'overridden', 5]])
})

test('a group decision is one batched update', async () => {
  marks = [mark('s1', 'r1'), mark('s2', 'r1')]
  await review.confirmQuestionMarks({ ...base, decisions: [{ submissionId: 's1', rubricId: 'r1', finalMark: 4 }, { submissionId: 's2', rubricId: 'r1', finalMark: 4 }] })
  assert.equal(applied.length, 1)
  assert.deepEqual(applied[0].ids.sort(), ['s1-r1', 's2-r1'])
})

test('changing an already-confirmed mark retracts its evidence', async () => {
  marks = [mark('s1', 'r1', { status: 'confirmed', final_mark: 4 })]
  await review.confirmQuestionMarks({ ...base, decisions: [{ submissionId: 's1', rubricId: 'r1', finalMark: 2 }] })
  assert.deepEqual(lifecycle, ['retract:ev-s1-r1'])
})

test('invalid decisions are refused before anything is written', async () => {
  const cases = [
    [{ submissionId: 's1', rubricId: 'r1', finalMark: 6 }],
    [{ submissionId: 's1', rubricId: 'r1', finalMark: -1 }],
    [{ submissionId: 's1', rubricId: 'r1', finalMark: 2.5 }],
    [{ submissionId: 's1', rubricId: 'rX', finalMark: 1 }],
    [{ submissionId: 'sX', rubricId: 'r1', finalMark: 1 }],
    [{ submissionId: 'nope', rubricId: 'r1', finalMark: 1 }],
    [{ submissionId: 's1', rubricId: 'r1', finalMark: 1 }, { submissionId: 's1', rubricId: 'r1', finalMark: 2 }],
    [],
  ]
  for (const decisions of cases) {
    await assert.rejects(review.confirmQuestionMarks({ ...base, decisions }), review.ReviewDecisionError, JSON.stringify(decisions))
  }
  assert.deepEqual([lifecycle.length, applied.length, entered.length, finalizedScores.length], [0, 0, 0, 0])
})

test('a script is reported complete once its last question is reviewed — and never filed by review', async () => {
  const first = await review.confirmQuestionMarks({ ...base, decisions: [{ submissionId: 's1', rubricId: 'r1', finalMark: 4 }] })
  assert.deepEqual(first.completed, [], 'one question still unreviewed')
  const out = await review.confirmQuestionMarks({ ...base, decisions: [{ submissionId: 's1', rubricId: 'r2', finalMark: 3 }] })
  assert.deepEqual(out.completed, [{ submissionId: 's1', learnerName: 'Amani', total: 7 }])
  assert.deepEqual(finalizedScores, [], 'nothing reaches the gradebook until the teacher uploads')
})

test('a question the AI found nothing for is entered by the teacher and completes the script', async () => {
  const out = await review.confirmQuestionMarks({ ...base, decisions: [{ submissionId: 's2', rubricId: 'r1', finalMark: 4 }, { submissionId: 's2', rubricId: 'r2', finalMark: 2 }] })
  assert.deepEqual(entered.map(e => [e.rubricId, e.finalMark]), [['r2', 2]])
  assert.deepEqual(out.completed, [{ submissionId: 's2', learnerName: 'Bravin', total: 6 }])
})

test('a total above the paper’s "marked out of" is held back, not clamped', async () => {
  maxScore = 8
  const out = await review.confirmQuestionMarks({ ...base, decisions: [{ submissionId: 's1', rubricId: 'r1', finalMark: 5 }, { submissionId: 's1', rubricId: 'r2', finalMark: 5 }] })
  assert.deepEqual(out.completed, [])
  assert.deepEqual(out.overMarkedOutOf, [{ submissionId: 's1', learnerName: 'Amani', total: 10, markedOutOf: 8 }])
})

test('getAssignmentReview reports marked vs complete scripts and the paper’s out-of', async () => {
  marks = [mark('s1', 'r1', { status: 'confirmed', final_mark: 4 }), mark('s1', 'r2', { status: 'confirmed', final_mark: 4 }), mark('s2', 'r1')]
  const r = await review.getAssignmentReview('a1')
  assert.deepEqual(r.scripts, { marked: 2, complete: 1 })
  assert.equal(r.markedOutOf, 10)
  assert.deepEqual(r.questions.map(q => q.label), ['1a', '1b'])
})
