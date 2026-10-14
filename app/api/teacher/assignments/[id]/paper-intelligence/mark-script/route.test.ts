// app/api/teacher/assignments/[id]/paper-intelligence/mark-script/route.test.ts
//
// Unit test of the whole-script marking route. Auth + markSubmissionScript are
// mocked. Proves: authorization runs before any marking work, each domain
// failure maps to its status (409 reviewed, 400 not ready, 502 unreadable),
// and the happy path returns the proposals.
//
// NOT in scripts/standard-tests.json — the [id] segment defeats the standard
// runner's path glob (see extract-rubric/route.test.ts). Run:
//   npx tsx --experimental-test-module-mocks --test 'app/api/teacher/assignments/*/paper-intelligence/mark-script/route.test.ts'
import { before, beforeEach, mock, test } from 'node:test'
import assert from 'node:assert/strict'

class FakeUnauthorizedError extends Error {}
class FakeSubmissionNotFoundError extends Error {}
class FakeScriptAccessError extends Error {}
class FakeAlreadyReviewed extends Error {}
class FakeNotReady extends Error {}
class FakeMarkingFailed extends Error {}

let authThrow: Error | null = null
let markThrow: Error | null = null
let markCalls = 0
let markedSubmission: unknown = null

mock.module('@/lib/core/errors', { namedExports: { UnauthorizedError: FakeUnauthorizedError } })
mock.module('@/utils/supabase/server', { namedExports: { createClient: async () => ({}) } })
mock.module('@/lib/paperIntelligence/auth', {
  namedExports: {
    SubmissionNotFoundError: FakeSubmissionNotFoundError,
    ScriptAccessError: FakeScriptAccessError,
    requireScriptAccess: async () => {
      if (authThrow) throw authThrow
      return { teacherUserId: 'u1', submission: { id: SUB, assignment_id: 'a1', class_id: 'c1', student_id: 's1' } }
    },
  },
})
mock.module('@/lib/paperIntelligence/markScript', {
  namedExports: {
    ScriptAlreadyReviewedError: FakeAlreadyReviewed,
    ScriptNotReadyError: FakeNotReady,
    ScriptMarkingFailedError: FakeMarkingFailed,
    markSubmissionScript: async (input: { submission: unknown }) => {
      markCalls++
      markedSubmission = input.submission
      if (markThrow) throw markThrow
      return { proposedTotal: 23, plausibleTotal: 38, maxTotal: 50, questions: [], rejected: [], unanswered: [], pendingReview: 8, failedWrites: 0, metadata: { model: 'm' } }
    },
  },
})

const SUB = '22222222-2222-4222-8222-222222222222'
let POST: (req: Request, ctx: { params: Promise<{ id: string }> }) => Promise<Response>

before(async () => { ({ POST } = await import('./route')) })
beforeEach(() => { authThrow = null; markThrow = null; markCalls = 0; markedSubmission = null })

const ctx = { params: Promise.resolve({ id: 'a1' }) }
const req = (body: unknown) => new Request('http://t/mark-script', { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json' } })

test('auth failures stop before any marking work', async () => {
  for (const [err, status] of [[new FakeUnauthorizedError(), 401], [new FakeSubmissionNotFoundError(), 404], [new FakeScriptAccessError(), 403]] as const) {
    authThrow = err
    assert.equal((await POST(req({ submissionId: SUB }), ctx)).status, status)
  }
  assert.equal(markCalls, 0)
})

test('a non-uuid submissionId → 400, no marking', async () => {
  assert.equal((await POST(req({ submissionId: 'x' }), ctx)).status, 400)
  assert.equal(markCalls, 0)
})

test('the submission marked is the one resolved by auth, not anything from the body', async () => {
  await POST(req({ submissionId: SUB, studentId: 'someone-else', classId: 'other' }), ctx)
  assert.deepEqual(markedSubmission, { id: SUB, assignment_id: 'a1', class_id: 'c1', student_id: 's1' })
})

test('domain failures map to their status codes', async () => {
  for (const [err, status] of [[new FakeAlreadyReviewed('reviewed'), 409], [new FakeNotReady('no pages'), 400], [new FakeMarkingFailed('unreadable'), 502]] as const) {
    markThrow = err
    const res = await POST(req({ submissionId: SUB }), ctx)
    assert.equal(res.status, status)
    assert.equal((await res.json()).error, err.message)
  }
})

test('an unexpected error → 500 without leaking its message', async () => {
  markThrow = new Error('db password is hunter2')
  const res = await POST(req({ submissionId: SUB }), ctx)
  assert.equal(res.status, 500)
  assert.doesNotMatch((await res.json()).error, /hunter2/)
})

test('happy path returns the proposals', async () => {
  const res = await POST(req({ submissionId: SUB }), ctx)
  assert.equal(res.status, 200)
  const body = await res.json()
  assert.equal(body.data.proposedTotal, 23)
  assert.equal(body.data.plausibleTotal, 38)
})
