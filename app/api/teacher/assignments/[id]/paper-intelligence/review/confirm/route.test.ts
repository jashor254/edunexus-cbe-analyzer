// app/api/teacher/assignments/[id]/paper-intelligence/review/confirm/route.test.ts
//
// Unit test of the review-confirm route. Auth + review lib are mocked; next's
// after() is captured. Proves: auth before any write, the reviewer identity
// comes from the session (never the body), validation errors → 400, and the
// completed scripts are reported with nothing scheduled — review files no
// marks (mark first, file after; upload files).
//
// NOT in scripts/standard-tests.json — the [id] segment defeats the standard
// runner's path glob. Run:
//   npx tsx --experimental-test-module-mocks --test 'app/api/teacher/assignments/*/paper-intelligence/review/confirm/route.test.ts'
import { before, beforeEach, mock, test } from 'node:test'
import assert from 'node:assert/strict'

class FakeUnauthorizedError extends Error {}
class FakeAssignmentOwnershipError extends Error {}
class FakeReviewDecisionError extends Error {}

let authThrow: Error | null = null
let confirmThrow: Error | null = null
let confirmInput: Record<string, unknown> | null = null
let scheduled = 0
let followUpRan = 0

mock.module('next/server', {
  namedExports: {
    after: (fn: () => Promise<void>) => { scheduled++; return fn().then(() => { followUpRan++ }) },
    NextResponse: { json: (body: unknown, init?: ResponseInit) => Response.json(body, init) },
  },
})
mock.module('@/lib/core/errors', { namedExports: { UnauthorizedError: FakeUnauthorizedError } })
mock.module('@/utils/supabase/server', { namedExports: { createClient: async () => ({}) } })
mock.module('@/lib/paperIntelligence/auth', {
  namedExports: {
    AssignmentOwnershipError: FakeAssignmentOwnershipError,
    requireAssignmentClassTeacher: async () => {
      if (authThrow) throw authThrow
      return { teacherUserId: 'session-user', teacherId: 'session-teacher', assignment: { id: 'a1', class_id: 'class-1', subject: null, title: null, max_score: 50 } }
    },
  },
})
mock.module('@/lib/paperIntelligence/review', {
  namedExports: {
    ReviewDecisionError: FakeReviewDecisionError,
    confirmQuestionMarks: async (input: Record<string, unknown>) => {
      confirmInput = input
      if (confirmThrow) throw confirmThrow
      return { saved: 1, completed: [{ submissionId: S, learnerName: 'Amani', total: 37 }], overMarkedOutOf: [] }
    },
  },
})

const S = '33333333-3333-4333-8333-333333333333'
const R = '44444444-4444-4444-8444-444444444444'
let POST: (req: Request, ctx: { params: Promise<{ id: string }> }) => Promise<Response>
before(async () => { ({ POST } = await import('./route')) })
beforeEach(() => { authThrow = null; confirmThrow = null; confirmInput = null; scheduled = 0; followUpRan = 0 })

const ctx = { params: Promise.resolve({ id: 'a1' }) }
const req = (body: unknown) => new Request('http://t/confirm', { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json' } })
const ONE = { decisions: [{ submissionId: S, rubricId: R, finalMark: 4 }] }

test('auth failures stop before any write', async () => {
  authThrow = new FakeUnauthorizedError()
  assert.equal((await POST(req(ONE), ctx)).status, 401)
  authThrow = new FakeAssignmentOwnershipError()
  assert.equal((await POST(req(ONE), ctx)).status, 404)
  assert.equal(confirmInput, null)
})

test('malformed decisions → 400 before auth or write', async () => {
  for (const bad of [{ decisions: [] }, { decisions: [{ submissionId: 'x', rubricId: R, finalMark: 1 }] }, { decisions: [{ submissionId: S, rubricId: R, finalMark: -1 }] }, { decisions: [{ submissionId: S, rubricId: R, finalMark: 1.5 }] }, {}]) {
    assert.equal((await POST(req(bad), ctx)).status, 400, JSON.stringify(bad))
  }
  assert.equal(confirmInput, null)
})

test('reviewer and class come from the session, not the body', async () => {
  await POST(req({ ...ONE, teacherId: 'forged', teacherUserId: 'forged', classId: 'forged' }), ctx)
  assert.equal(confirmInput?.teacherId, 'session-teacher')
  assert.equal(confirmInput?.teacherUserId, 'session-user')
  assert.equal(confirmInput?.classId, 'class-1')
})

test('a decision the scheme rejects → 400 with its reason', async () => {
  confirmThrow = new FakeReviewDecisionError('A mark must be a whole number from 0 to 5.')
  const res = await POST(req(ONE), ctx)
  assert.equal(res.status, 400)
  assert.match((await res.json()).error, /0 to 5/)
})

test('happy path returns the completed learners and schedules nothing — review files no marks', async () => {
  const res = await POST(req(ONE), ctx)
  assert.equal(res.status, 200)
  const body = await res.json()
  assert.deepEqual(body.data.completed, [{ submissionId: S, learnerName: 'Amani', total: 37 }])
  assert.equal(scheduled, 0)
  assert.equal(followUpRan, 0)
})
