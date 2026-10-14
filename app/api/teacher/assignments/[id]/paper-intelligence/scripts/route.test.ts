// app/api/teacher/assignments/[id]/paper-intelligence/scripts/route.test.ts
//
// Unit test of the capture-roster route. Auth + roster lib are mocked.
//
// NOT in scripts/standard-tests.json — the [id] segment defeats the standard
// runner's path glob (see extract-rubric/route.test.ts). Run:
//   npx tsx --experimental-test-module-mocks --test 'app/api/teacher/assignments/*/paper-intelligence/scripts/route.test.ts'
import { before, beforeEach, mock, test } from 'node:test'
import assert from 'node:assert/strict'

class FakeUnauthorizedError extends Error {}
class FakeAssignmentOwnershipError extends Error {}

let authThrow: Error | null = null
let rosterCalls = 0

mock.module('@/lib/core/errors', { namedExports: { UnauthorizedError: FakeUnauthorizedError } })
mock.module('@/utils/supabase/server', { namedExports: { createClient: async () => ({}) } })
mock.module('@/lib/paperIntelligence/auth', {
  namedExports: {
    AssignmentOwnershipError: FakeAssignmentOwnershipError,
    requireAssignmentClassTeacher: async () => {
      if (authThrow) throw authThrow
      return { teacherUserId: 'u1', assignment: { id: 'a1', class_id: 'c1', subject: 'Social Studies', title: 'SBA' } }
    },
  },
})
mock.module('@/lib/paperIntelligence/scriptRoster', {
  namedExports: {
    getScriptRoster: async () => {
      rosterCalls++
      return { learners: [{ submissionId: 's', studentId: 'st', name: 'Learner A', pageNumbers: [1, 2], marks: null }], rubricCount: 8, maxTotal: 50 }
    },
  },
})

let GET: (req: Request, ctx: { params: Promise<{ id: string }> }) => Promise<Response>
before(async () => { ({ GET } = await import('./route')) })
beforeEach(() => { authThrow = null; rosterCalls = 0 })
const ctx = { params: Promise.resolve({ id: 'a1' }) }

test('unauthenticated → 401; not this class’s teacher → 404; roster never read', async () => {
  authThrow = new FakeUnauthorizedError()
  assert.equal((await GET(new Request('http://t'), ctx)).status, 401)
  authThrow = new FakeAssignmentOwnershipError()
  assert.equal((await GET(new Request('http://t'), ctx)).status, 404)
  assert.equal(rosterCalls, 0)
})

test('happy path returns the roster with the assignment title', async () => {
  const res = await GET(new Request('http://t'), ctx)
  assert.equal(res.status, 200)
  const body = await res.json()
  assert.equal(body.data.assignmentTitle, 'SBA')
  assert.equal(body.data.learners[0].pageNumbers.length, 2)
  assert.equal(body.data.maxTotal, 50)
})
