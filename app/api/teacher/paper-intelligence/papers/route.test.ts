// app/api/teacher/paper-intelligence/papers/route.test.ts
//
// Unit test of the Mark Papers papers route. Auth + lib are mocked. Proves:
// auth runs before the body is read, a quick paper names exactly one class,
// and the list is scoped to the session's teacher.
//
// Run: npm test -- app/api/teacher/paper-intelligence/papers/route.test.ts
import { before, beforeEach, mock, test } from 'node:test'
import assert from 'node:assert/strict'

class FakeUnauthorizedError extends Error {}
class FakeForbiddenError extends Error {}
class FakeValidationError extends Error {}

let authThrow: Error | null = null
let created: Record<string, unknown> | null = null
let listedFor: string | null = null
let createThrow: Error | null = null

mock.module('next/server', {
  namedExports: { NextResponse: { json: (body: unknown, init?: ResponseInit) => Response.json(body, init) } },
})
mock.module('@/lib/core/errors', {
  namedExports: { UnauthorizedError: FakeUnauthorizedError, ForbiddenError: FakeForbiddenError, ValidationError: FakeValidationError },
})
mock.module('@/utils/supabase/server', { namedExports: { createClient: async () => ({}) } })
mock.module('@/lib/core/permissions', {
  namedExports: { requireAuthentication: async () => { if (authThrow) throw authThrow; return { id: 'session-user' } } },
})
mock.module('@/lib/core/identity', { namedExports: { resolveTeacher: async () => ({ id: 'session-teacher' }) } })
mock.module('@/lib/paperIntelligence/papers', {
  namedExports: {
    listMarkablePapers: async (teacherId: string) => { listedFor = teacherId; return [] },
    quickCreatePaper: async (_s: unknown, input: Record<string, unknown>) => { if (createThrow) throw createThrow; created = input; return { id: 'paper-1' } },
  },
})

let GET: () => Promise<Response>
let POST: (req: Request) => Promise<Response>
before(async () => { ({ GET, POST } = await import('./route')) })
beforeEach(() => { authThrow = null; created = null; listedFor = null; createThrow = null })

const CLASS = '00000000-0000-4000-8000-000000000001'
const post = (body: unknown) => new Request('http://x/papers', { method: 'POST', body: JSON.stringify(body) })

test('no session → 401 before anything is created', async () => {
  authThrow = new FakeUnauthorizedError()
  assert.equal((await POST(post({ class_id: CLASS, title: 'T', subject: 'Maths', max_score: 50 }))).status, 401)
  assert.equal(created, null)
  assert.equal((await GET()).status, 401)
})

test('a quick paper must name exactly one class', async () => {
  assert.equal((await POST(post({ title: 'T', subject: 'Maths', max_score: 50 }))).status, 400)
  assert.equal((await POST(post({ class_id: CLASS, class_subject_id: CLASS, title: 'T', subject: 'Maths', max_score: 50 }))).status, 400)
  assert.equal((await POST(post({ class_id: CLASS, title: '', subject: 'Maths', max_score: 50 }))).status, 400)
  assert.equal(created, null)
})

test('happy path creates the paper and returns its id', async () => {
  const res = await POST(post({ class_id: CLASS, title: 'Fractions test', subject: 'Mathematics', max_score: 50 }))
  assert.equal(res.status, 201)
  assert.equal((await res.json()).data.paperId, 'paper-1')
  assert.deepEqual(created, { classId: CLASS, classSubjectId: undefined, title: 'Fractions test', subject: 'Mathematics', maxScore: 50 })
})

test('a class the teacher does not teach → 403 (createAssignment authorizes from the session)', async () => {
  createThrow = new FakeForbiddenError('not your class')
  assert.equal((await POST(post({ class_id: CLASS, title: 'T', subject: 'Maths', max_score: 50 }))).status, 403)
})

test('the list is the session teacher’s', async () => {
  const res = await GET()
  assert.equal(res.status, 200)
  assert.equal(listedFor, 'session-teacher')
})
