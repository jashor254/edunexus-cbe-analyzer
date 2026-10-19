// app/api/teacher/assignments/[id]/paper-intelligence/upload/route.test.ts
//
// Unit test of the upload route. Auth + upload lib are mocked; next's after()
// is captured. Proves: auth before any body is read or anything filed, the
// filer comes from the session (never the body), a malformed or ambiguous
// destination → 400, a refused upload (already filed elsewhere, locked…) →
// 409, and follow-ups run after the response.
//
// NOT in scripts/standard-tests.json — the [id] segment defeats the standard
// runner's path glob. Run:
//   npx tsx --experimental-test-module-mocks --test 'app/api/teacher/assignments/*/paper-intelligence/upload/route.test.ts'
import { before, beforeEach, mock, test } from 'node:test'
import assert from 'node:assert/strict'

class FakeUnauthorizedError extends Error {}
class FakeAssignmentOwnershipError extends Error {}
class FakeUploadError extends Error {}
class FakePaperNotFoundError extends Error {}

let authThrow: Error | null = null
let uploadThrow: Error | null = null
let uploadInput: Record<string, unknown> | null = null
let scheduled = 0

mock.module('next/server', {
  namedExports: {
    after: (fn: () => Promise<void>) => { scheduled++; return fn() },
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
mock.module('@/lib/paperIntelligence/upload', {
  namedExports: {
    UploadError: FakeUploadError,
    PaperNotFoundError: FakePaperNotFoundError,
    getUploadReadiness: async () => ({
      paper: { id: 'a1', classId: 'class-1' }, rosterCount: 3, incomplete: 1, overMarkedOutOf: [], existing: null,
      complete: [{ submissionId: 's1', studentId: 'st1', learnerName: 'Amani', total: 37 }],
    }),
    uploadPaperMarks: async (input: Record<string, unknown>) => {
      uploadInput = input
      if (uploadThrow) throw uploadThrow
      return { destination: 'topical', classAssessmentId: null, filed: [{ learnerName: 'Amani', total: 37, filedScore: 37 }], refused: [], overMarkedOutOf: [], incomplete: 0, followUps: [async () => {}] }
    },
  },
})
mock.module('@/lib/assessments/getters', {
  namedExports: {
    getClassAssessments: async () => [
      { id: 'as1', title: 'Term 3 End-Term 2026', assessment_type: 'endterm', term: '3', year: 2026, max_score: 100, subjects: ['English'], is_published: false },
      { id: 'as2', title: 'Homework', assessment_type: 'assignment', term: '3', year: 2026, max_score: 20, subjects: [], is_published: false },
    ],
  },
})

let GET: (req: Request, ctx: { params: Promise<{ id: string }> }) => Promise<Response>
let POST: (req: Request, ctx: { params: Promise<{ id: string }> }) => Promise<Response>
before(async () => { ({ GET, POST } = await import('./route')) })
beforeEach(() => { authThrow = null; uploadThrow = null; uploadInput = null; scheduled = 0 })

const ctx = { params: Promise.resolve({ id: 'a1' }) }
const post = (body: unknown) => new Request('http://x/upload', { method: 'POST', body: JSON.stringify(body) })

test('no session → 401 and nothing is filed', async () => {
  authThrow = new FakeUnauthorizedError()
  const res = await POST(post({ destination: 'topical' }), ctx)
  assert.equal(res.status, 401)
  assert.equal(uploadInput, null)
})

test('not this class’s teacher → 404', async () => {
  authThrow = new FakeAssignmentOwnershipError()
  assert.equal((await GET(new Request('http://x'), ctx)).status, 404)
})

test('GET returns readiness without learner ids, and only termly assessments', async () => {
  const res = await GET(new Request('http://x'), ctx)
  assert.equal(res.status, 200)
  const { data } = await res.json()
  assert.deepEqual(data.complete, [{ learnerName: 'Amani', total: 37 }])
  assert.deepEqual(data.assessments.map((a: { id: string }) => a.id), ['as1'])
})

test('a termly upload must name exactly one assessment: existing or new', async () => {
  assert.equal((await POST(post({ destination: 'termly', subject: 'Maths' }), ctx)).status, 400)
  assert.equal((await POST(post({
    destination: 'termly', subject: 'Maths', assessmentId: '00000000-0000-4000-8000-000000000000',
    newAssessment: { assessmentType: 'endterm', term: '3', year: 2026, maxScore: 100 },
  }), ctx)).status, 400)
  assert.equal((await POST(post({ destination: 'somewhere' }), ctx)).status, 400)
  assert.equal(uploadInput, null)
})

test('the filer is the session teacher, never the body', async () => {
  await POST(post({ destination: 'topical', teacherId: 'attacker' }), ctx)
  assert.equal(uploadInput?.teacherId, 'session-teacher')
  assert.equal(uploadInput?.teacherUserId, 'session-user')
})

test('a refused upload (already filed elsewhere, locked, nothing reviewed) → 409 with the reason', async () => {
  uploadThrow = new FakeUploadError('These marks were already uploaded to a topical assignment.')
  const res = await POST(post({ destination: 'topical' }), ctx)
  assert.equal(res.status, 409)
  assert.match((await res.json()).error, /already uploaded/)
})

test('happy path returns what was filed and runs follow-ups after the response', async () => {
  const res = await POST(post({ destination: 'termly', subject: 'Mathematics', assessmentId: '00000000-0000-4000-8000-000000000000' }), ctx)
  assert.equal(res.status, 200)
  const { data } = await res.json()
  assert.deepEqual(data.filed, [{ learnerName: 'Amani', total: 37, filedScore: 37 }])
  assert.equal(data.followUps, undefined)
  assert.equal(scheduled, 1)
  assert.deepEqual(uploadInput?.target, { destination: 'termly', subject: 'Mathematics', assessmentId: '00000000-0000-4000-8000-000000000000' })
})
