// lib/paperIntelligence/markScript.test.ts
// Unit tests for the whole-script marking orchestrator. Every collaborator is
// mocked — no DB, no storage, no AI call.
// Run with: npm test -- lib/paperIntelligence/markScript.test.ts
import { before, beforeEach, mock, test } from 'node:test'
import assert from 'node:assert/strict'

class FakeInputError extends Error {}
class FakeParseError extends Error {}

type Existing = { status: string; evidence_id: string | null }
const calls: string[] = []
let existing: Existing[] = []
let pageCount = 2
let rubricCount = 1
let visionThrow: Error | null = null
let replaced: { marks: unknown[]; ids: Map<string, string> } | null = null
let rejected: string[] = []
let failures: Array<{ errorCategory: string }> = []
let evidenceInput: { model?: string; extractionMethod?: string; subject: string; schoolId: string | null; imageRef: string } | null = null

const QUESTION = {
  rubricId: 'r1', questionNumber: 1, questionLabel: '1a', recognizedAnswer: 'Patient', recognitionConfidence: 0.9, recognitionNotes: null,
  uncertain: false, points: [], proposedMark: 4, plausibleMark: 5, maxMark: 5, gradingConfidence: 0.9, rationale: 'r', pageNumbers: [1],
}

mock.module('./rubrics', {
  namedExports: {
    findRubricsForAssignment: async () => Array.from({ length: rubricCount }, (_, i) => ({ id: `r${i + 1}`, sub_strand_id: null, max_marks: 5 })),
    toRubricForScriptMarking: (r: { id: string }) => ({ rubricId: r.id }),
  },
})
mock.module('./scriptPages', {
  namedExports: {
    listScriptPages: async () => Array.from({ length: pageCount }, (_, i) => ({ page_number: i + 1, file_path: `p${i + 1}.jpg`, file_type: 'image/jpeg' })),
    loadScriptPages: async () => { calls.push('load'); return [] },
  },
})
mock.module('./scriptMarking', {
  namedExports: {
    ScriptMarkingInputError: FakeInputError,
    recognizeAndMarkScript: async () => {
      calls.push('vision')
      if (visionThrow) throw visionThrow
      return { questions: [QUESTION], rejected: [], unanswered: [], metadata: { model: 'gemini-test', latencyMs: 1 } }
    },
  },
})
mock.module('./scriptValidation', { namedExports: { ScriptMarkingParseError: FakeParseError } })
mock.module('./scriptMarks', {
  namedExports: {
    findScriptMarksForSubmission: async () => existing,
    replaceScriptMarks: async (_a: string, _s: string, marks: unknown[], ids: Map<string, string>) => { calls.push('replace'); replaced = { marks, ids }; return [] },
  },
})
mock.module('./evidence', {
  namedExports: {
    recordPaperIntelligenceEvidence: async (input: typeof evidenceInput) => {
      calls.push('evidence')
      evidenceInput = input
      return { inserted: [], confirmedCount: 0, pendingReviewCount: 1, noOpCount: 0, failedWrites: 0, evidenceIdByRubricId: new Map([['r1', 'ev-new']]) }
    },
  },
})
mock.module('./evidenceContext', {
  namedExports: { resolveEvidenceContext: async () => ({ schoolId: 'school-1', subject: 'Social Studies' }) },
})
mock.module('./failureLog', {
  namedExports: { logPaperIntelligenceFailure: async (f: { errorCategory: string }) => { failures.push(f) } },
})
mock.module('@/lib/intelligence/evidenceLifecycle', {
  namedExports: { rejectReview: async (id: string) => { calls.push('reject'); rejected.push(id); return {} } },
})

let markSubmissionScript: typeof import('./markScript').markSubmissionScript
let errors: typeof import('./markScript')
before(async () => {
  errors = await import('./markScript')
  markSubmissionScript = errors.markSubmissionScript
})
beforeEach(() => {
  calls.length = 0; existing = []; pageCount = 2; rubricCount = 1; visionThrow = null
  replaced = null; rejected = []; failures = []; evidenceInput = null
})

const INPUT = { assignmentId: 'a1', submission: { id: 'sub1', assignment_id: 'a1', class_id: 'c1', student_id: 'st1' }, teacherUserId: 'u1' }

test('happy path: vision → evidence → proposals, linked by evidence id', async () => {
  const out = await markSubmissionScript(INPUT)
  assert.deepEqual(calls, ['load', 'vision', 'evidence', 'replace'])
  assert.equal(out.proposedTotal, 4)
  assert.equal(out.plausibleTotal, 5)
  assert.equal(out.maxTotal, 5)
  assert.equal(replaced?.ids.get('r1'), 'ev-new')
  assert.equal(evidenceInput?.model, 'gemini-test')
  assert.equal(evidenceInput?.extractionMethod, 'paper_intelligence_script_v1')
  assert.equal(evidenceInput?.subject, 'Social Studies')
  assert.equal(evidenceInput?.imageRef, 'p1.jpg,p2.jpg')
})

test('a script with any reviewed question is never re-marked', async () => {
  existing = [{ status: 'proposed', evidence_id: 'e1' }, { status: 'confirmed', evidence_id: 'e2' }]
  await assert.rejects(markSubmissionScript(INPUT), errors.ScriptAlreadyReviewedError)
  assert.deepEqual(calls, [])
})

test('no pages or no rubric → not ready, no AI call', async () => {
  pageCount = 0
  await assert.rejects(markSubmissionScript(INPUT), errors.ScriptNotReadyError)
  pageCount = 2; rubricCount = 0
  await assert.rejects(markSubmissionScript(INPUT), errors.ScriptNotReadyError)
  assert.deepEqual(calls, [])
})

test('re-mark retires the previous pending evidence — only after the new pass succeeded', async () => {
  existing = [{ status: 'proposed', evidence_id: 'old-1' }, { status: 'proposed', evidence_id: null }, { status: 'proposed', evidence_id: 'old-2' }]
  await markSubmissionScript(INPUT)
  assert.deepEqual(rejected.sort(), ['old-1', 'old-2'])
  assert.ok(calls.indexOf('vision') < calls.indexOf('reject'), calls.join(','))
  assert.ok(calls.lastIndexOf('reject') < calls.indexOf('evidence'), calls.join(','))
})

test('a failed AI pass is logged durably, writes nothing, and keeps the old proposals', async () => {
  existing = [{ status: 'proposed', evidence_id: 'old-1' }]
  for (const [err, category] of [[new FakeParseError('bad json'), 'model_response_invalid'], [new FakeInputError('bad page'), 'invalid_input'], [new Error('503'), 'vision_provider_error']] as const) {
    visionThrow = err
    failures = []
    await assert.rejects(markSubmissionScript(INPUT), errors.ScriptMarkingFailedError)
    assert.equal(failures[0]?.errorCategory, category)
  }
  assert.deepEqual(rejected, [])
  assert.equal(replaced, null)
  assert.equal(evidenceInput, null)
})
