// app/api/teacher/assignments/[id]/paper-intelligence/extract-rubric/route.test.ts
//
// Direct unit test of the extract-rubric route — same convention as
// mark-page/route.test.ts: mock.module intercepts every dependency, import
// {POST} directly, no live server / DB / Gemini. Proves the critical gate:
// an unauthorized or non-owner request is rejected BEFORE any vision call.
//
// NOT in scripts/standard-tests.json: this route lives under a [id] dynamic
// segment, and the standard runner's `node --test` globs positional paths, so
// a literal "[id]" is read as a char-class and matches nothing (the same
// reason mark-page/route.test.ts is not in the manifest). Match the bracket
// dir with a `*` wildcard instead:
//   npx tsx --experimental-test-module-mocks --test 'app/api/teacher/assignments/*/paper-intelligence/extract-rubric/route.test.ts'
import { before, beforeEach, mock, test } from 'node:test'
import assert from 'node:assert/strict'
import { SchemeExtractionParseError } from '@/lib/paperIntelligence/schemeValidation'

let authThrow: Error | null = null
let extractThrow: Error | null = null
let extractCalls = 0

class FakeUnauthorizedError extends Error {}
class FakeAssignmentOwnershipError extends Error {}
class FakeSchemeExtractionInputError extends Error {}

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

mock.module('@/lib/paperIntelligence/schemeExtraction', {
  namedExports: {
    SchemeExtractionInputError: FakeSchemeExtractionInputError,
    extractRubricsFromScheme: async () => {
      extractCalls++
      if (extractThrow) throw extractThrow
      return {
        response: {
          rubrics: [{ questionId: '1a', commandWord: 'Give', topic: 'traits', pointsRequired: 5, marksPerPoint: 1, maxMarks: 5, mode: 'accept_relevant', curriculumStrand: null, acceptedAnswers: [], uncertain: false, uncertaintyNote: null }],
          metadata: { provider: 'gemini', model: 'm', promptTokens: null, completionTokens: null, totalTokens: null, costStatus: 'unavailable', costUsd: null, latencyMs: 1 },
        },
        rejected: [],
      }
    },
  },
})

mock.module('@/utils/supabase/server', {
  namedExports: { createClient: async () => ({}) },
})

let POST: (req: Request, ctx: { params: Promise<{ id: string }> }) => Promise<Response>

before(async () => { ({ POST } = await import('./route')) })
beforeEach(() => { authThrow = null; extractThrow = null; extractCalls = 0 })

const ctx = { params: Promise.resolve({ id: 'a1' }) }
function req(body: unknown) {
  return new Request('http://t/extract-rubric', { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json' } })
}
const VALID_BODY = { images: [{ imageBase64: 'abc', mimeType: 'image/jpeg' }] }

test('unauthorized request → 401, no vision call', async () => {
  authThrow = new FakeUnauthorizedError()
  const res = await POST(req(VALID_BODY), ctx)
  assert.equal(res.status, 401)
  assert.equal(extractCalls, 0)
})

test('non-owner request → 404, no vision call', async () => {
  authThrow = new FakeAssignmentOwnershipError()
  const res = await POST(req(VALID_BODY), ctx)
  assert.equal(res.status, 404)
  assert.equal(extractCalls, 0)
})

test('empty images → 400, no vision call', async () => {
  const res = await POST(req({ images: [] }), ctx)
  assert.equal(res.status, 400)
  assert.equal(extractCalls, 0)
})

test('happy path → 200 with extracted rubrics', async () => {
  const res = await POST(req(VALID_BODY), ctx)
  assert.equal(res.status, 200)
  const body = await res.json()
  assert.equal(body.data.rubrics.length, 1)
  assert.equal(body.data.rubrics[0].questionId, '1a')
  assert.equal(extractCalls, 1)
})

test('input error from engine → 400', async () => {
  extractThrow = new FakeSchemeExtractionInputError('unsupported')
  const res = await POST(req(VALID_BODY), ctx)
  assert.equal(res.status, 400)
})

test('unreadable model output (parse error) → 502', async () => {
  extractThrow = new SchemeExtractionParseError('bad json')
  const res = await POST(req(VALID_BODY), ctx)
  assert.equal(res.status, 502)
})
