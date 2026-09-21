// app/api/teacher/assignments/[id]/mark/route.http.integration.test.ts
//
// Gate 5 (Paper Intelligence Prototype 01 pre-build audit) — the one write
// route in its sibling family (questions, file-url, variants, assignment
// PATCH) with no dedicated non-owning-teacher regression test, despite its
// authorization code (an inline `.eq('teacher_id', teacher.id)` filter,
// route.ts:44-49) looking correct on direct reading. This is precisely the
// route Paper Intelligence's AI-derived score would eventually flow
// through, so it is closed before any Paper Intelligence code is wired to
// it, not after.
//
// Requires a server already running at TEST_BASE_URL (default
// http://localhost:3100) and a disposable TEST_SUPABASE_* target — same
// requirement as every other *.http.integration.test.ts file in this repo.
//
// Run: TEST_BASE_URL=http://localhost:3100 npx tsx --test app/api/teacher/assignments/[id]/mark/route.http.integration.test.ts
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createTestServiceClient as createServiceClient } from '@/utils/supabase/test-service'
import { signInForHttpTest, type SyntheticSession } from '@/lib/testing/httpAuthTestHelper'

const BASE_URL = process.env.TEST_BASE_URL ?? process.env.LMS_TEST_BASE_URL ?? 'http://localhost:3100'
const SYNTHETIC_MARKER = 'SYNTHETIC_MARK_AUTH_HTTP_TEST'
const db = createServiceClient()

type Fixture = {
  teacherAAuthId: string
  teacherAId: string
  teacherASession: SyntheticSession
  teacherBAuthId: string
  teacherBId: string
  teacherBSession: SyntheticSession
  studentId: string
  classId: string
  assignmentId: string
  submissionId: string
}

let fx: Fixture

// Same confirmed, sustained, intermittent flake against Supabase Auth's
// admin endpoints noted identically in every sibling *.http.integration.test.ts
// file in this repo. Bounded setup retries only.
async function retryAsync<T>(fn: () => Promise<T>, attempts = 6): Promise<T> {
  let lastError: unknown
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try { return await fn() } catch (err) { lastError = err }
    await new Promise(resolve => setTimeout(resolve, 500 * attempt))
  }
  throw lastError
}

async function createSyntheticUser(label: string): Promise<{ authId: string; session: SyntheticSession }> {
  const email = `${SYNTHETIC_MARKER.toLowerCase()}-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.com`
  const password = `Test!${Math.random().toString(36).slice(2, 10)}`
  const { data } = await retryAsync(async () => {
    const res = await db.auth.admin.createUser({ email, password, email_confirm: true })
    if (res.error) throw res.error
    return res
  })
  const session = await retryAsync(() => signInForHttpTest(email, password))
  return { authId: data.user.id, session }
}

before(async () => {
  // Teacher A owns the class/assignment/submission under test.
  const teacherA = await createSyntheticUser('teacher-a')
  // Teacher B is a real, distinct, cross-tenant teacher — owns nothing here.
  const teacherB = await createSyntheticUser('teacher-b')

  const { data: teacherARow } = await db.from('teachers')
    .insert({ user_id: teacherA.authId, full_name: SYNTHETIC_MARKER, school: `${SYNTHETIC_MARKER}_SCHOOL_A` })
    .select('id').single()
  const { data: teacherBRow } = await db.from('teachers')
    .insert({ user_id: teacherB.authId, full_name: SYNTHETIC_MARKER, school: `${SYNTHETIC_MARKER}_SCHOOL_B` })
    .select('id').single()

  const { data: cls } = await db.from('teacher_classes')
    .insert({ teacher_id: teacherARow!.id, name: SYNTHETIC_MARKER, grade: 8, subject: 'Social Studies', class_code: `${SYNTHETIC_MARKER}_${Date.now()}` })
    .select('id').single()

  const { data: student } = await db.from('students')
    .insert({ user_id: null, name: `${SYNTHETIC_MARKER} Student`, grade: 8, level: 'Junior School' })
    .select('id').single()
  await db.from('class_students').insert({ class_id: cls!.id, student_id: student!.id })

  const { data: assignment } = await db.from('assignments')
    .insert({
      class_id: cls!.id, teacher_id: teacherARow!.id, title: SYNTHETIC_MARKER,
      subject: 'Social Studies', topic: 'Test topic', instructions: 'Test',
      due_date: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
      type: 'practice', max_score: 10, is_quiz: false, is_adaptive: false,
      status: 'active',
    })
    .select('id').single()

  const { data: submission } = await db.from('assignment_submissions')
    .insert({ assignment_id: assignment!.id, student_id: student!.id, class_id: cls!.id, status: 'submitted' })
    .select('id').single()

  fx = {
    teacherAAuthId: teacherA.authId, teacherAId: teacherARow!.id, teacherASession: teacherA.session,
    teacherBAuthId: teacherB.authId, teacherBId: teacherBRow!.id, teacherBSession: teacherB.session,
    studentId: student!.id, classId: cls!.id, assignmentId: assignment!.id, submissionId: submission!.id,
  }
})

after(async () => {
  if (fx?.assignmentId) {
    await db.from('assignment_submissions').delete().eq('assignment_id', fx.assignmentId)
    await db.from('assignments').delete().eq('id', fx.assignmentId)
  }
  if (fx?.classId) {
    await db.from('class_students').delete().eq('class_id', fx.classId)
    await db.from('teacher_classes').delete().eq('id', fx.classId)
  }
  if (fx?.studentId) await db.from('students').delete().eq('id', fx.studentId)
  if (fx?.teacherAId) await db.from('teachers').delete().eq('id', fx.teacherAId)
  if (fx?.teacherBId) await db.from('teachers').delete().eq('id', fx.teacherBId)
})

function cookie(session: SyntheticSession): Record<string, string> {
  return { Cookie: session.cookieHeader }
}

async function postMark(body: Record<string, unknown>, headers: Record<string, string>) {
  return fetch(`${BASE_URL}/api/teacher/assignments/${fx.assignmentId}/mark`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  })
}

test('1. owning teacher (A) can mark the submission — permitted', async () => {
  const res = await postMark({ submissionId: fx.submissionId, score: 7, feedback: 'Good work' }, cookie(fx.teacherASession))
  assert.equal(res.status, 200)
  const body = await res.json()
  assert.equal(body.data.submission.score, 7)
  assert.equal(body.data.submission.status, 'marked')
})

test('2. non-owning teacher (B) cannot mark teacher A\'s submission — denied', async () => {
  const res = await postMark({ submissionId: fx.submissionId, score: 3, feedback: 'Should never apply' }, cookie(fx.teacherBSession))
  assert.equal(res.status, 404, 'assignment lookup is filtered by teacher_id — a non-owning teacher must see "not found," not the real assignment')
  const { data: submission } = await db.from('assignment_submissions').select('score, status').eq('id', fx.submissionId).single()
  assert.notEqual(submission!.score, 3, 'the forged mark must never have been written')
})

test('3. unauthenticated caller cannot mark — denied', async () => {
  const res = await postMark({ submissionId: fx.submissionId, score: 9 }, {})
  assert.equal(res.status, 401)
})

test('4. cross-tenant caller (teacher B, a different school entirely) cannot mark — denied', async () => {
  // Same mechanism as test 2 (ownership is teacher-scoped, not a separate
  // school_id check on this route) — asserted as its own case because
  // Gate 5 names cross-tenant denial as a distinct requirement, not because
  // this route enforces it via a different code path than plain
  // non-ownership. If this route ever grows a genuinely separate
  // school/tenant check, this test starts covering that path for free.
  const res = await postMark({ submissionId: fx.submissionId, score: 1 }, cookie(fx.teacherBSession))
  assert.equal(res.status, 404)
})
