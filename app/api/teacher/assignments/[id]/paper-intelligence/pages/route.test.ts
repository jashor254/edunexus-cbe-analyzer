// app/api/teacher/assignments/[id]/paper-intelligence/pages/route.test.ts
//
// Unit test of the script-page capture route. Auth + the pages lib are mocked.
// Proves: authorization runs before anything is stored, a blurry page is
// refused with 422 and not stored, bad input never reaches storage, and the
// happy path saves.
//
// NOT in scripts/standard-tests.json — the [id] segment defeats the standard
// runner's path glob (see extract-rubric/route.test.ts). Run:
//   npx tsx --experimental-test-module-mocks --test 'app/api/teacher/assignments/*/paper-intelligence/pages/route.test.ts'
import { before, beforeEach, mock, test } from 'node:test'
import assert from 'node:assert/strict'

class FakeUnauthorizedError extends Error {}
class FakeSubmissionNotFoundError extends Error {}
class FakeScriptAccessError extends Error {}
class FakeBlurryPageError extends Error { sharpness = { score: 0.05, acceptable: false } }
class FakeInvalidPageError extends Error {}

let authThrow: Error | null = null
let saveThrow: Error | null = null
let saveCalls = 0
let deleteResult = true
let signCalls = 0

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
mock.module('@/lib/paperIntelligence/scriptPages', {
  namedExports: {
    BlurryPageError: FakeBlurryPageError,
    InvalidPageError: FakeInvalidPageError,
    saveScriptPage: async (input: { pageNumber: number }) => {
      saveCalls++
      if (saveThrow) throw saveThrow
      return { page: { page_number: input.pageNumber }, sharpness: { score: 0.8, acceptable: true } }
    },
    deleteScriptPage: async () => deleteResult,
    signScriptPageUrls: async () => { signCalls++; return [{ pageNumber: 1, url: 'https://signed/p1' }] },
  },
})

const SUB = '11111111-1111-4111-8111-111111111111'
let POST: (req: Request, ctx: { params: Promise<{ id: string }> }) => Promise<Response>
let DELETE: (req: Request, ctx: { params: Promise<{ id: string }> }) => Promise<Response>
let GET: (req: Request, ctx: { params: Promise<{ id: string }> }) => Promise<Response>

before(async () => { ({ POST, DELETE, GET } = await import('./route')) })
beforeEach(() => { authThrow = null; saveThrow = null; saveCalls = 0; deleteResult = true; signCalls = 0 })

const ctx = { params: Promise.resolve({ id: 'a1' }) }
const req = (method: string, body: unknown) => new Request('http://t/pages', { method, body: JSON.stringify(body), headers: { 'content-type': 'application/json' } })
const PAGE = { submissionId: SUB, pageNumber: 1, imageBase64: 'aGVsbG8=', mimeType: 'image/jpeg' }

test('unauthenticated → 401, nothing stored', async () => {
  authThrow = new FakeUnauthorizedError()
  assert.equal((await POST(req('POST', PAGE), ctx)).status, 401)
  assert.equal(saveCalls, 0)
})

test('submission from another assignment → 404, nothing stored', async () => {
  authThrow = new FakeSubmissionNotFoundError()
  assert.equal((await POST(req('POST', PAGE), ctx)).status, 404)
  assert.equal(saveCalls, 0)
})

test('teacher who does not teach this learner’s class → 403, nothing stored', async () => {
  authThrow = new FakeScriptAccessError()
  assert.equal((await POST(req('POST', PAGE), ctx)).status, 403)
  assert.equal(saveCalls, 0)
})

test('invalid input never reaches storage', async () => {
  for (const bad of [
    { ...PAGE, submissionId: 'not-a-uuid' },
    { ...PAGE, pageNumber: 0 },
    { ...PAGE, pageNumber: 99 },
    { ...PAGE, mimeType: 'application/pdf' },
    { ...PAGE, imageBase64: '' },
  ]) {
    assert.equal((await POST(req('POST', bad), ctx)).status, 400, JSON.stringify(bad))
  }
  const notJson = new Request('http://t/pages', { method: 'POST', body: 'nope' })
  assert.equal((await POST(notJson, ctx)).status, 400)
  assert.equal(saveCalls, 0)
})

test('a blurry page → 422 asking for a retake', async () => {
  saveThrow = new FakeBlurryPageError()
  const res = await POST(req('POST', PAGE), ctx)
  assert.equal(res.status, 422)
  assert.match((await res.json()).error, /retake/i)
})

test('an unreadable image → 400', async () => {
  saveThrow = new FakeInvalidPageError('The photo could not be read as an image')
  assert.equal((await POST(req('POST', PAGE), ctx)).status, 400)
})

test('happy path saves and returns the sharpness', async () => {
  const res = await POST(req('POST', { ...PAGE, pageNumber: 3 }), ctx)
  assert.equal(res.status, 200)
  const body = await res.json()
  assert.equal(body.data.pageNumber, 3)
  assert.equal(body.data.sharpness.acceptable, true)
})

test('DELETE: auth first, 404 when the page does not exist, 200 when removed', async () => {
  authThrow = new FakeScriptAccessError()
  assert.equal((await DELETE(req('DELETE', { submissionId: SUB, pageNumber: 2 }), ctx)).status, 403)
  authThrow = null
  deleteResult = false
  assert.equal((await DELETE(req('DELETE', { submissionId: SUB, pageNumber: 2 }), ctx)).status, 404)
  deleteResult = true
  assert.equal((await DELETE(req('DELETE', { submissionId: SUB, pageNumber: 2 }), ctx)).status, 200)
})

test('GET signed page links: needs a submissionId, auth before signing, then returns links', async () => {
  assert.equal((await GET(new Request('http://t/pages'), ctx)).status, 400)
  authThrow = new FakeScriptAccessError()
  assert.equal((await GET(new Request(`http://t/pages?submissionId=${SUB}`), ctx)).status, 403)
  assert.equal(signCalls, 0)
  authThrow = null
  const res = await GET(new Request(`http://t/pages?submissionId=${SUB}`), ctx)
  assert.equal(res.status, 200)
  assert.equal((await res.json()).data.pages[0].url, 'https://signed/p1')
})
