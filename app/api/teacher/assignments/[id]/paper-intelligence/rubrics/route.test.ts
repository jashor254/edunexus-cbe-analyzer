// app/api/teacher/assignments/[id]/paper-intelligence/rubrics/route.test.ts
//
// Unit test of the rubric persist/read route. Auth + the rubrics DB lib are
// mocked; the real schemeValidation is used so the arithmetic guard is
// exercised end-to-end. Proves: unauthorized/non-owner rejected before any
// write, a hand-edit that no longer adds up is refused, the happy path saves.
//
// NOT in scripts/standard-tests.json (see extract-rubric/route.test.ts for
// why — the [id] segment defeats the standard runner's path glob). Run:
//   npx tsx --experimental-test-module-mocks --test 'app/api/teacher/assignments/*/paper-intelligence/rubrics/route.test.ts'
import { before, beforeEach, mock, test } from 'node:test'
import assert from 'node:assert/strict'

let authThrow: Error | null = null
let saveCalls = 0
let lastSaved: unknown[] = []

class FakeUnauthorizedError extends Error {}
class FakeAssignmentOwnershipError extends Error {}

mock.module('@/lib/core/errors', {
  namedExports: { UnauthorizedError: FakeUnauthorizedError },
})

mock.module('@/lib/paperIntelligence/auth', {
  namedExports: {
    AssignmentOwnershipError: FakeAssignmentOwnershipError,
    requireOwnedAssignment: async () => {
      if (authThrow) throw authThrow
      return { teacherId: 't1', teacherUserId: 'u1', assignment: { id: 'a1', class_id: 'c1', subject: 'Social Studies', max_score: 50 } }
    },
  },
})

mock.module('@/lib/paperIntelligence/rubrics', {
  namedExports: {
    replaceRubricsForAssignment: async (_a: string, _t: string, rubrics: unknown[]) => { saveCalls++; lastSaved = rubrics; return rubrics.map((_, i) => ({ id: `r${i}` })) },
    findRubricsForAssignment: async () => ([
      { id: 'r1', question_number: 1, question_label: '1a', question_text: 'Give: traits', max_marks: 5, mode: 'accept_relevant', points_required: 5, marks_per_point: 1, accepted_answers: [{ text: 'Patience', synonyms: [] }] },
    ]),
  },
})

let outOfThrow: Error | null = null
let outOfSet: number | null = null
class FakeMarkedOutOfLockedError extends Error {}
mock.module('@/lib/paperIntelligence/markedOutOf', {
  namedExports: {
    MarkedOutOfLockedError: FakeMarkedOutOfLockedError,
    setMarkedOutOf: async (_a: string, n: number) => { if (outOfThrow) throw outOfThrow; outOfSet = n },
  },
})

mock.module('@/utils/supabase/server', {
  namedExports: { createClient: async () => ({}) },
})

let POST: (req: Request, ctx: { params: Promise<{ id: string }> }) => Promise<Response>
let GET: (req: Request, ctx: { params: Promise<{ id: string }> }) => Promise<Response>

before(async () => { ({ POST, GET } = await import('./route')) })
beforeEach(() => { authThrow = null; saveCalls = 0; lastSaved = []; outOfThrow = null; outOfSet = null })

const ctx = { params: Promise.resolve({ id: 'a1' }) }
function req(body: unknown) {
  return new Request('http://t/rubrics', { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json' } })
}
const RUBRIC = { questionId: '1a', commandWord: 'Give', topic: 'traits', pointsRequired: 5, marksPerPoint: 1, maxMarks: 5, mode: 'accept_relevant', curriculumStrand: null, acceptedAnswers: [{ text: 'Patience', synonyms: [] }], uncertain: false, uncertaintyNote: null }

test('POST unauthorized → 401, no save', async () => {
  authThrow = new FakeUnauthorizedError()
  const res = await POST(req({ rubrics: [RUBRIC], markedOutOf: 50 }), ctx)
  assert.equal(res.status, 401)
  assert.equal(saveCalls, 0)
})

test('POST non-owner → 404, no save', async () => {
  authThrow = new FakeAssignmentOwnershipError()
  const res = await POST(req({ rubrics: [RUBRIC], markedOutOf: 50 }), ctx)
  assert.equal(res.status, 404)
  assert.equal(saveCalls, 0)
})

test('POST rubric whose marks do not add up → 400, no save', async () => {
  const bad = { ...RUBRIC, maxMarks: 9 } // 5×1 ≠ 9
  const res = await POST(req({ rubrics: [bad], markedOutOf: 50 }), ctx)
  assert.equal(res.status, 400)
  assert.equal(saveCalls, 0)
})

test('POST happy path → 200, saved count, lib called with the rubrics', async () => {
  const res = await POST(req({ rubrics: [RUBRIC], markedOutOf: 50 }), ctx)
  assert.equal(res.status, 200)
  const body = await res.json()
  assert.equal(body.data.saved, 1)
  assert.equal(saveCalls, 1)
  assert.equal(lastSaved.length, 1)
})

test('POST without a "marked out of" → 400, no save', async () => {
  const res = await POST(req({ rubrics: [RUBRIC] }), ctx)
  assert.equal(res.status, 400)
  assert.equal(saveCalls, 0)
})

test('POST sets the marked-out-of before saving', async () => {
  const res = await POST(req({ rubrics: [RUBRIC], markedOutOf: 40 }), ctx)
  assert.equal(res.status, 200)
  assert.equal(outOfSet, 40)
  assert.equal((await res.json()).data.markedOutOf, 40)
})

test('POST when learners already have scores on another scale → 409, rubric NOT replaced', async () => {
  outOfThrow = new FakeMarkedOutOfLockedError('3 learner(s) already have scores out of 100.')
  const res = await POST(req({ rubrics: [RUBRIC], markedOutOf: 50 }), ctx)
  assert.equal(res.status, 409)
  assert.match((await res.json()).error, /already have scores/)
  assert.equal(saveCalls, 0)
})

test('GET unauthorized → 401', async () => {
  authThrow = new FakeUnauthorizedError()
  const res = await GET(new Request('http://t/rubrics'), ctx)
  assert.equal(res.status, 401)
})

test('GET happy path → returns mapped rubrics', async () => {
  const res = await GET(new Request('http://t/rubrics'), ctx)
  assert.equal(res.status, 200)
  const body = await res.json()
  assert.equal(body.data.rubrics.length, 1)
  assert.equal(body.data.rubrics[0].questionLabel, '1a')
  assert.equal(body.data.rubrics[0].pointsRequired, 5)
  assert.equal(body.data.markedOutOf, 50)
})
