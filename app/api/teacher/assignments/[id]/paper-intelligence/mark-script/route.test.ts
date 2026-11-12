// app/api/teacher/assignments/[id]/paper-intelligence/mark-script/route.test.ts
//
// Unit test of the whole-script marking route. Auth + markSubmissionScript are
// mocked. Proves: authorization runs before any marking work, each domain
// failure maps to its status (409 reviewed, 400 not ready, 502 unreadable),
// the happy path returns the proposals, and a concurrent duplicate pass is
// refused before any AI work (markingClaim.ts).
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
let claimHeld = false
let releases: string[] = []

let paused = false
// The containment switch is read through these two named exports only; the real module is pinned OFF
// (lib/ai/childDataPolicy.test.ts). `paused` lets this file prove both states of the route.
mock.module('@/lib/ai/childDataPolicy', {
  namedExports: {
    isChildDataAIPaused: () => paused,
    CHILD_DATA_AI_PAUSED_CODE: 'AI_FEATURE_PAUSED_FOR_REVIEW',
    CHILD_DATA_AI_PAUSED_STATUS: 503,
    CHILD_DATA_AI_PAUSED_MESSAGE: 'This AI feature is paused while we review our AI service providers\u2019 terms for use with learners. Your records and the rest of EduNexus are not affected.',
  },
})

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

mock.module('@/lib/paperIntelligence/markingClaim', {
  namedExports: {
    claimScriptMarking: async () => claimHeld
      ? { claimed: false }
      : { claimed: true, release: async (outcome: string) => { releases.push(outcome) } },
  },
})

const SUB = '22222222-2222-4222-8222-222222222222'
let POST: (req: Request, ctx: { params: Promise<{ id: string }> }) => Promise<Response>

before(async () => { ({ POST } = await import('./route')) })
beforeEach(() => { paused = false; authThrow = null; markThrow = null; markCalls = 0; markedSubmission = null; claimHeld = false; releases = [] })

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

test('a script already being marked → 409 and NO second marking pass (no AI call)', async () => {
  claimHeld = true
  const res = await POST(req({ submissionId: SUB }), ctx)
  assert.equal(res.status, 409)
  assert.match((await res.json()).error, /already being marked/)
  assert.equal(markCalls, 0)
})

test('the marking claim is released on success and on failure', async () => {
  await POST(req({ submissionId: SUB }), ctx)
  markThrow = new FakeMarkingFailed('unreadable')
  await POST(req({ submissionId: SUB }), ctx)
  assert.deepEqual(releases, ['completed', 'failed'])
})

test('auth failure never takes a marking claim', async () => {
  authThrow = new FakeScriptAccessError()
  await POST(req({ submissionId: SUB }), ctx)
  assert.deepEqual(releases, [])
})

// ── Containment: learner-data AI paused ──────────────────────────────────────

test('paused: 503 with a stable code and an honest message, no claim taken, zero marking passes', async () => {
  paused = true
  const res = await POST(req({ submissionId: SUB }), ctx)
  assert.equal(res.status, 503)
  const body = await res.json()
  assert.equal(body.code, 'AI_FEATURE_PAUSED_FOR_REVIEW')
  assert.equal(body.success, false)
  assert.match(body.error, /review/i)
  assert.doesNotMatch(body.error, /maintenance|technical/i)
  assert.equal(res.headers.get('cache-control'), 'no-store')
  assert.equal(markCalls, 0)
  assert.deepEqual(releases, [], 'no marking claim may be taken (it would be left in "processing")')
})

test('paused: authorisation still runs first — an unauthorised caller gets 401/403/404, never the pause notice', async () => {
  paused = true
  for (const [err, status] of [[new FakeUnauthorizedError(), 401], [new FakeSubmissionNotFoundError(), 404], [new FakeScriptAccessError(), 403]] as const) {
    authThrow = err
    assert.equal((await POST(req({ submissionId: SUB }), ctx)).status, status)
  }
  assert.equal(markCalls, 0)
})
