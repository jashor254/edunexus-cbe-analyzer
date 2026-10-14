// app/api/teacher/assignments/[id]/paper-intelligence/answers/route.test.ts
//
// Unit test of the class-wide answer decision route. Auth + lib mocked.
// Run: npx tsx --experimental-test-module-mocks --test 'app/api/teacher/assignments/*/paper-intelligence/answers/route.test.ts'
import { before, beforeEach, mock, test } from 'node:test'
import assert from 'node:assert/strict'

class FakeUnauthorizedError extends Error {}
class FakeAssignmentOwnershipError extends Error {}
class FakeAnswerDecisionError extends Error {}
let authThrow: Error | null = null
let decideThrow: Error | null = null
let decided: Record<string, unknown> | null = null

mock.module('@/lib/core/errors', { namedExports: { UnauthorizedError: FakeUnauthorizedError } })
mock.module('@/utils/supabase/server', { namedExports: { createClient: async () => ({}) } })
mock.module('@/lib/paperIntelligence/auth', {
  namedExports: {
    AssignmentOwnershipError: FakeAssignmentOwnershipError,
    requireOwnedAssignment: async () => {
      if (authThrow) throw authThrow
      return { teacherId: 'session-teacher', teacherUserId: 'session-user', assignment: { id: 'a1', class_id: 'c1', subject: null, max_score: 50 } }
    },
  },
})
mock.module('@/lib/paperIntelligence/answerReview', {
  namedExports: {
    AnswerDecisionError: FakeAnswerDecisionError,
    decidePlausibleAnswer: async (input: Record<string, unknown>) => {
      decided = input
      if (decideThrow) throw decideThrow
      return { decision: input.decision, answer: 'Courage', learnersAffected: 3 }
    },
  },
})

const R = '55555555-5555-4555-8555-555555555555'
let POST: (req: Request, ctx: { params: Promise<{ id: string }> }) => Promise<Response>
before(async () => { ({ POST } = await import('./route')) })
beforeEach(() => { authThrow = null; decideThrow = null; decided = null })
const ctx = { params: Promise.resolve({ id: 'a1' }) }
const req = (body: unknown) => new Request('http://t/answers', { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json' } })
const OK = { rubricId: R, answerKey: 'courage', decision: 'accept' }

test('auth failures stop before any decision', async () => {
  authThrow = new FakeUnauthorizedError()
  assert.equal((await POST(req(OK), ctx)).status, 401)
  authThrow = new FakeAssignmentOwnershipError()
  assert.equal((await POST(req(OK), ctx)).status, 404)
  assert.equal(decided, null)
})

test('malformed input → 400', async () => {
  for (const bad of [{ ...OK, decision: 'maybe' }, { ...OK, rubricId: 'x' }, { ...OK, answerKey: '' }, {}]) {
    assert.equal((await POST(req(bad), ctx)).status, 400, JSON.stringify(bad))
  }
  assert.equal(decided, null)
})

test('the actor is the session teacher, never the body', async () => {
  await POST(req({ ...OK, teacherId: 'forged' }), ctx)
  assert.equal(decided?.teacherId, 'session-teacher')
  assert.equal(decided?.teacherUserId, 'session-user')
})

test('a stale or foreign answer → 409 with its reason', async () => {
  decideThrow = new FakeAnswerDecisionError('No unreviewed learner has that answer any more')
  const res = await POST(req(OK), ctx)
  assert.equal(res.status, 409)
  assert.match((await res.json()).error, /any more/)
})

test('happy path reports how many learners were re-marked', async () => {
  const res = await POST(req(OK), ctx)
  assert.equal(res.status, 200)
  assert.equal((await res.json()).data.learnersAffected, 3)
})
