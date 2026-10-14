// app/api/teacher/assignments/[id]/paper-intelligence/review/route.test.ts
//
// Unit test of the review-data route. Auth + review lib are mocked.
// Run: npx tsx --experimental-test-module-mocks --test 'app/api/teacher/assignments/*/paper-intelligence/review/route.test.ts'
import { before, beforeEach, mock, test } from 'node:test'
import assert from 'node:assert/strict'

class FakeUnauthorizedError extends Error {}
class FakeAssignmentOwnershipError extends Error {}
let authThrow: Error | null = null
let reads = 0

mock.module('@/lib/core/errors', { namedExports: { UnauthorizedError: FakeUnauthorizedError } })
mock.module('@/utils/supabase/server', { namedExports: { createClient: async () => ({}) } })
mock.module('@/lib/paperIntelligence/auth', {
  namedExports: {
    AssignmentOwnershipError: FakeAssignmentOwnershipError,
    requireAssignmentClassTeacher: async () => { if (authThrow) throw authThrow; return {} },
  },
})
mock.module('@/lib/paperIntelligence/review', {
  namedExports: { getAssignmentReview: async () => { reads++; return { markedOutOf: 50, questions: [], scripts: { marked: 2, complete: 0 } } } },
})

let GET: (req: Request, ctx: { params: Promise<{ id: string }> }) => Promise<Response>
before(async () => { ({ GET } = await import('./route')) })
beforeEach(() => { authThrow = null; reads = 0 })
const ctx = { params: Promise.resolve({ id: 'a1' }) }

test('401 / 404 before reading anything', async () => {
  authThrow = new FakeUnauthorizedError()
  assert.equal((await GET(new Request('http://t'), ctx)).status, 401)
  authThrow = new FakeAssignmentOwnershipError()
  assert.equal((await GET(new Request('http://t'), ctx)).status, 404)
  assert.equal(reads, 0)
})

test('happy path returns the review', async () => {
  const res = await GET(new Request('http://t'), ctx)
  assert.equal(res.status, 200)
  assert.equal((await res.json()).data.scripts.marked, 2)
})
