// lib/assignments/submissionEligibility.http.integration.test.ts
//
// PHASE 0 — Submission Eligibility + Isolation Guardrails. Proves the
// containment fix for the gap identified by the read-only architecture
// audit: the three student submission routes (submit / submit-file /
// submit-quiz) verified the authenticated user maps to the claimed
// `studentId` (identity), but did NOT verify the student is actually
// enrolled (via `class_students`) in the class that owns the target
// assignment (eligibility). A learner who knew a foreign assignment id
// could submit against it.
//
// The fix: lib/core/permissions.ts's requireClassMembership(studentId,
// assignment.class_id) — the assignment row's own class_id (never a
// client-supplied one) is the authority for which class owns it.
//
// Requires a server already running at TEST_BASE_URL (default
// http://localhost:3100).
//
// Run: TEST_BASE_URL=http://localhost:3000 npx tsx --test lib/assignments/submissionEligibility.http.integration.test.ts
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createTestServiceClient as createServiceClient } from '@/utils/supabase/test-service'
import { signInForHttpTest, type SyntheticSession } from '@/lib/testing/httpAuthTestHelper'

const BASE_URL = process.env.TEST_BASE_URL ?? process.env.LMS_TEST_BASE_URL ?? 'http://localhost:3100'
const SYNTHETIC_MARKER = 'SYNTHETIC_SUBMIT_ELIGIBILITY_HTTP_TEST'
const db = createServiceClient()

type Fixture = {
  teacherAAuthId: string
  teacherAId: string
  teacherASession: SyntheticSession
  teacherBAuthId: string
  teacherBId: string
  teacherBSession: SyntheticSession
  studentAAuthId: string
  studentAId: string
  studentASession: SyntheticSession
  studentBAuthId: string
  studentBId: string
  studentBSession: SyntheticSession
  parentAAuthId: string
  parentASession: SyntheticSession
  classAId: string
  classBId: string
  assignmentAId: string   // typed assignment, owned by classA
  assignmentBId: string   // typed assignment, owned by classB (different "school")
  quizBId: string         // quiz assignment, owned by classB
  quizBQuestionIds: string[]
}

let fx: Fixture

// See lib/assignments/create.http.integration.test.ts's identical comment —
// same confirmed, sustained, intermittent flake against Supabase Auth's
// admin endpoints this session. Bounded setup retries only.
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
  const teacherA = await createSyntheticUser('teacher-a')
  const teacherB = await createSyntheticUser('teacher-b')
  const studentA = await createSyntheticUser('student-a')
  const studentB = await createSyntheticUser('student-b')
  const parentA = await createSyntheticUser('parent-a')

  const { data: teacherARow, error: teacherAErr } = await db
    .from('teachers').insert({ user_id: teacherA.authId, full_name: SYNTHETIC_MARKER, school: `${SYNTHETIC_MARKER}_SCHOOL_A` })
    .select('id').single()
  if (teacherAErr) throw teacherAErr

  // Distinct "school" free-text value — assignments/class_students carry no
  // real school_id FK (pre-Core legacy tables), so this is the closest this
  // fixture can get to "unrelated school." The isolation boundary under
  // test is class_students membership itself, which must fail closed
  // regardless of any school-level relationship.
  const { data: teacherBRow, error: teacherBErr } = await db
    .from('teachers').insert({ user_id: teacherB.authId, full_name: SYNTHETIC_MARKER, school: `${SYNTHETIC_MARKER}_SCHOOL_B` })
    .select('id').single()
  if (teacherBErr) throw teacherBErr

  const { data: classA, error: classAErr } = await db
    .from('teacher_classes')
    .insert({ teacher_id: teacherARow.id, name: SYNTHETIC_MARKER, grade: 8, subject: 'Mathematics', class_code: `${SYNTHETIC_MARKER}_A_${Date.now()}` })
    .select('id').single()
  if (classAErr) throw classAErr

  const { data: classB, error: classBErr } = await db
    .from('teacher_classes')
    .insert({ teacher_id: teacherBRow.id, name: SYNTHETIC_MARKER, grade: 8, subject: 'Mathematics', class_code: `${SYNTHETIC_MARKER}_B_${Date.now()}` })
    .select('id').single()
  if (classBErr) throw classBErr

  const { data: studentARow, error: studentAErr } = await db
    .from('students').insert({ user_id: studentA.authId, parent_user_id: parentA.authId, name: 'Student A', grade: 8, level: 'Junior School' })
    .select('id').single()
  if (studentAErr) throw studentAErr
  await db.from('class_students').insert({ class_id: classA.id, student_id: studentARow.id })

  const { data: studentBRow, error: studentBErr } = await db
    .from('students').insert({ user_id: studentB.authId, name: 'Student B', grade: 8, level: 'Junior School' })
    .select('id').single()
  if (studentBErr) throw studentBErr
  await db.from('class_students').insert({ class_id: classB.id, student_id: studentBRow.id })

  const { data: assignmentA, error: assignmentAErr } = await db
    .from('assignments')
    .insert({
      class_id: classA.id, teacher_id: teacherARow.id, title: 'Class A Typed Assignment',
      subject: 'Mathematics', topic: 'Ratios', instructions: 'Solve 1-10',
      due_date: new Date(Date.now() + 86400_000).toISOString(),
    })
    .select('id').single()
  if (assignmentAErr) throw assignmentAErr

  const { data: assignmentB, error: assignmentBErr } = await db
    .from('assignments')
    .insert({
      class_id: classB.id, teacher_id: teacherBRow.id, title: 'Class B Typed Assignment',
      subject: 'Mathematics', topic: 'Fractions', instructions: 'Solve 1-10',
      due_date: new Date(Date.now() + 86400_000).toISOString(),
    })
    .select('id').single()
  if (assignmentBErr) throw assignmentBErr

  const { data: quizB, error: quizBErr } = await db
    .from('assignments')
    .insert({
      class_id: classB.id, teacher_id: teacherBRow.id, title: 'Class B Quiz',
      subject: 'Mathematics', topic: 'Fractions', instructions: 'Answer all questions',
      due_date: new Date(Date.now() + 86400_000).toISOString(),
      is_quiz: true, max_score: 20,
    })
    .select('id').single()
  if (quizBErr) throw quizBErr

  const { data: quizBQuestions, error: quizBQErr } = await db
    .from('assignment_questions')
    .insert([
      { assignment_id: quizB.id, question_text: '1/2 + 1/2 = ?', choices: ['1', '2', '0'], correct_index: 0, order_index: 0 },
      { assignment_id: quizB.id, question_text: '3/4 - 1/4 = ?', choices: ['1/2', '1', '2'], correct_index: 0, order_index: 1 },
    ])
    .select('id')
  if (quizBQErr) throw quizBQErr

  fx = {
    teacherAAuthId: teacherA.authId, teacherAId: teacherARow.id, teacherASession: teacherA.session,
    teacherBAuthId: teacherB.authId, teacherBId: teacherBRow.id, teacherBSession: teacherB.session,
    studentAAuthId: studentA.authId, studentAId: studentARow.id, studentASession: studentA.session,
    studentBAuthId: studentB.authId, studentBId: studentBRow.id, studentBSession: studentB.session,
    parentAAuthId: parentA.authId, parentASession: parentA.session,
    classAId: classA.id, classBId: classB.id,
    assignmentAId: assignmentA.id, assignmentBId: assignmentB.id,
    quizBId: quizB.id, quizBQuestionIds: (quizBQuestions ?? []).map(q => q.id as string),
  }
})

after(async () => {
  if (!fx) return
  await removeAllUnder(db, 'assignment-submissions', fx.assignmentAId)
  await removeAllUnder(db, 'assignment-submissions', fx.assignmentBId)
  await removeAllUnder(db, 'assignment-submissions', fx.quizBId)

  await db.from('learner_evidence').delete().eq('learner_id', fx.studentAId)
  await db.from('learner_evidence').delete().eq('learner_id', fx.studentBId)

  await db.from('teacher_classes').delete().eq('id', fx.classAId) // cascades assignments/submissions/class_students/questions
  await db.from('teacher_classes').delete().eq('id', fx.classBId)
  await db.from('students').delete().eq('id', fx.studentAId)
  await db.from('students').delete().eq('id', fx.studentBId)
  await db.from('teachers').delete().eq('id', fx.teacherAId)
  await db.from('teachers').delete().eq('id', fx.teacherBId)
  for (const authId of [fx.teacherAAuthId, fx.teacherBAuthId, fx.studentAAuthId, fx.studentBAuthId, fx.parentAAuthId]) {
    await db.auth.admin.deleteUser(authId)
  }
})

function cookie(session: SyntheticSession) {
  return { Cookie: session.cookieHeader }
}

async function removeAllUnder(client: ReturnType<typeof createServiceClient>, bucket: string, prefix: string): Promise<void> {
  const { data: entries } = await client.storage.from(bucket).list(prefix)
  if (!entries?.length) return
  const filePaths: string[] = []
  for (const entry of entries) {
    const path = `${prefix}/${entry.name}`
    if (entry.id === null) {
      await removeAllUnder(client, bucket, path)
    } else {
      filePaths.push(path)
    }
  }
  if (filePaths.length) await client.storage.from(bucket).remove(filePaths)
}

async function submissionRowFor(assignmentId: string, studentId: string) {
  const { data } = await db
    .from('assignment_submissions')
    .select('id, status, class_id, work_text, file_path, score')
    .eq('assignment_id', assignmentId)
    .eq('student_id', studentId)
    .maybeSingle()
  return data
}

async function eventCountFor(assignmentId: string, studentId: string): Promise<number> {
  const { data } = await db
    .from('platform_events')
    .select('id')
    .eq('resource_type', 'assignment_submission')
    .eq('event_type', 'student.assignment.submitted')
    .contains('payload', { assignment_id: assignmentId, student_id: studentId })
  return data?.length ?? 0
}

async function evidenceCountFor(assignmentId: string, studentId: string): Promise<number> {
  const { data } = await db
    .from('learner_evidence')
    .select('id')
    .eq('learner_id', studentId)
    .like('raw_input_ref', `assignment:${assignmentId}%`)
  return data?.length ?? 0
}

// ── Unauthenticated / wrong-identity baseline (unchanged behavior) ───────

test('POST /api/student/submit: unauthenticated request is rejected with 401', async () => {
  const res = await fetch(`${BASE_URL}/api/student/submit`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ assignmentId: fx.assignmentAId, studentId: fx.studentAId, work_text: 'x' }),
  })
  assert.equal(res.status, 401)
})

test('POST /api/student/submit: a learner impersonating another studentId is rejected with 403', async () => {
  const res = await fetch(`${BASE_URL}/api/student/submit`, {
    method: 'POST', headers: { ...cookie(fx.studentBSession), 'Content-Type': 'application/json' },
    body: JSON.stringify({ assignmentId: fx.assignmentAId, studentId: fx.studentAId, work_text: 'x' }),
  })
  assert.equal(res.status, 403)
})

// ── Case A / Case C — typed submission (app/api/student/submit) ──────────

test('POST /api/student/submit: enrolled student, own class assignment succeeds (Case C, unchanged)', async () => {
  const res = await fetch(`${BASE_URL}/api/student/submit`, {
    method: 'POST', headers: { ...cookie(fx.studentASession), 'Content-Type': 'application/json' },
    body: JSON.stringify({ assignmentId: fx.assignmentAId, studentId: fx.studentAId, work_text: 'my real answer' }),
  })
  assert.equal(res.status, 200)
  const body = await res.json()
  assert.equal(body.data.submission.status, 'submitted')
  assert.equal(body.data.submission.class_id, fx.classAId)
})

test('POST /api/student/submit: same identity, wrong-class assignment is denied 403 with zero side effects (Case A)', async () => {
  const before = await eventCountFor(fx.assignmentBId, fx.studentAId)

  const res = await fetch(`${BASE_URL}/api/student/submit`, {
    method: 'POST', headers: { ...cookie(fx.studentASession), 'Content-Type': 'application/json' },
    body: JSON.stringify({ assignmentId: fx.assignmentBId, studentId: fx.studentAId, work_text: 'attempted intrusion' }),
  })
  assert.equal(res.status, 403)

  const row = await submissionRowFor(fx.assignmentBId, fx.studentAId)
  assert.equal(row, null, 'no assignment_submissions row must be created for the ineligible attempt')

  const after = await eventCountFor(fx.assignmentBId, fx.studentAId)
  assert.equal(after, before, 'no student.assignment.submitted event must be published')

  const evidenceRows = await evidenceCountFor(fx.assignmentBId, fx.studentAId)
  assert.equal(evidenceRows, 0, 'no learner_evidence row must be written for the ineligible attempt')
})

test('POST /api/student/submit: unrelated-school assignment is denied 403 (Case B — class_students fails closed even with no school_id column)', async () => {
  const res = await fetch(`${BASE_URL}/api/student/submit`, {
    method: 'POST', headers: { ...cookie(fx.studentBSession), 'Content-Type': 'application/json' },
    body: JSON.stringify({ assignmentId: fx.assignmentAId, studentId: fx.studentBId, work_text: 'attempted intrusion' }),
  })
  assert.equal(res.status, 403)
  const row = await submissionRowFor(fx.assignmentAId, fx.studentBId)
  assert.equal(row, null)
})

test('POST /api/student/submit: an existing (pre-created) submission row does not bypass eligibility (Step 5)', async () => {
  // Simulate a reachable submission row existing ahead of time for the
  // wrong (assignment, student) pair — proves the eligibility check runs
  // against assignment.class_id x class_students, not merely
  // "does a submission row already exist for me."
  const { data: rogueRow, error } = await db
    .from('assignment_submissions')
    .insert({ assignment_id: fx.assignmentBId, student_id: fx.studentAId, class_id: fx.classAId, status: 'pending' })
    .select('id, status').single()
  if (error) throw error

  const res = await fetch(`${BASE_URL}/api/student/submit`, {
    method: 'POST', headers: { ...cookie(fx.studentASession), 'Content-Type': 'application/json' },
    body: JSON.stringify({ assignmentId: fx.assignmentBId, studentId: fx.studentAId, work_text: 'exploit via existing row' }),
  })
  assert.equal(res.status, 403)

  const { data: rowAfter } = await db
    .from('assignment_submissions')
    .select('status, work_text')
    .eq('id', rogueRow.id)
    .single()
  assert.equal(rowAfter?.status, 'pending', 'the pre-existing row must remain unmutated')
  assert.equal(rowAfter?.work_text, null)

  await db.from('assignment_submissions').delete().eq('id', rogueRow.id)
})

// ── File submission (app/api/student/submit-file) ────────────────────────

test('POST /api/student/submit-file: enrolled student, own class assignment succeeds (unchanged)', async () => {
  const form = new FormData()
  form.set('assignmentId', fx.assignmentAId)
  form.set('studentId', fx.studentAId)
  form.set('file', new Blob([new TextEncoder().encode('legit homework bytes')], { type: 'application/pdf' }), 'homework.pdf')

  const res = await fetch(`${BASE_URL}/api/student/submit-file`, {
    method: 'POST', headers: cookie(fx.studentASession), body: form,
  })
  assert.equal(res.status, 200)
  const body = await res.json()
  assert.equal(body.data.submission.status, 'submitted')
  assert.equal(body.data.submission.file_name, 'homework.pdf')
})

test('POST /api/student/submit-file: wrong-class assignment is denied 403 with no submission row and no durable Storage object (Step 7)', async () => {
  const form = new FormData()
  form.set('assignmentId', fx.assignmentBId)
  form.set('studentId', fx.studentAId)
  form.set('file', new Blob([new TextEncoder().encode('intrusion bytes')], { type: 'application/pdf' }), 'intrusion.pdf')

  const res = await fetch(`${BASE_URL}/api/student/submit-file`, {
    method: 'POST', headers: cookie(fx.studentASession), body: form,
  })
  assert.equal(res.status, 403)

  const row = await submissionRowFor(fx.assignmentBId, fx.studentAId)
  assert.equal(row, null)

  const { data: storageEntries } = await db.storage.from('assignment-submissions').list(`${fx.assignmentBId}/${fx.studentAId}`)
  assert.equal(storageEntries?.length ?? 0, 0, 'no Storage object must exist under the denied attempt\'s path')
})

// ── Quiz submission (app/api/student/submit-quiz) ─────────────────────────

test('POST /api/student/submit-quiz: enrolled student, own class quiz grades and marks (unchanged)', async () => {
  const res = await fetch(`${BASE_URL}/api/student/submit-quiz`, {
    method: 'POST', headers: { ...cookie(fx.studentBSession), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      assignmentId: fx.quizBId, studentId: fx.studentBId,
      answers: [
        { questionId: fx.quizBQuestionIds[0], selectedIndex: 0 },
        { questionId: fx.quizBQuestionIds[1], selectedIndex: 0 },
      ],
    }),
  })
  assert.equal(res.status, 200)
  const body = await res.json()
  assert.equal(body.data.submission.status, 'marked')
  assert.equal(body.data.grade.score, 20)

  // Evidence should exist for this legitimate, correctly-scoped submission.
  await new Promise(resolve => setTimeout(resolve, 400)) // evidence emission is fire-and-forget
  const evidenceRows = await evidenceCountFor(fx.quizBId, fx.studentBId)
  assert.equal(evidenceRows, 1)
})

test('POST /api/student/submit-quiz: wrong-class quiz is denied 403 with zero grade/status/evidence/event side effects (Step 6)', async () => {
  const res = await fetch(`${BASE_URL}/api/student/submit-quiz`, {
    method: 'POST', headers: { ...cookie(fx.studentASession), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      assignmentId: fx.quizBId, studentId: fx.studentAId,
      answers: [
        { questionId: fx.quizBQuestionIds[0], selectedIndex: 0 },
        { questionId: fx.quizBQuestionIds[1], selectedIndex: 0 },
      ],
    }),
  })
  assert.equal(res.status, 403)

  const row = await submissionRowFor(fx.quizBId, fx.studentAId)
  assert.equal(row, null, 'no assignment_submissions row (no score, no marked status) for the ineligible attempt')

  await new Promise(resolve => setTimeout(resolve, 400)) // give any wrongly-fired evidence emission time to land
  const evidenceRows = await evidenceCountFor(fx.quizBId, fx.studentAId)
  assert.equal(evidenceRows, 0, 'no quiz_auto_grade evidence for the ineligible attempt')

  const events = await eventCountFor(fx.quizBId, fx.studentAId)
  assert.equal(events, 0)
})

// ── Evidence integrity regression (Step 10) ────────────────────────────

test('a valid plain-text submission produces no evidence until a teacher marks it', async () => {
  const evidenceBefore = await evidenceCountFor(fx.assignmentAId, fx.studentAId)
  assert.equal(evidenceBefore, 0, 'submitting is not marking — no evidence should exist yet')

  const markRes = await fetch(`${BASE_URL}/api/teacher/assignments/${fx.assignmentAId}/mark`, {
    method: 'POST', headers: { ...cookie(fx.teacherASession), 'Content-Type': 'application/json' },
    body: JSON.stringify({ studentId: fx.studentAId, score: 8, feedback: 'Good work' }),
  })
  assert.equal(markRes.status, 200)

  await new Promise(resolve => setTimeout(resolve, 400)) // evidence emission is fire-and-forget
  const evidenceAfter = await evidenceCountFor(fx.assignmentAId, fx.studentAId)
  assert.equal(evidenceAfter, 1, 'teacher marking must still produce exactly one teacher_upload evidence row')

  const { data: evidenceRow } = await db
    .from('learner_evidence')
    .select('evidence_source')
    .eq('learner_id', fx.studentAId)
    .like('raw_input_ref', `assignment:${fx.assignmentAId}%`)
    .single()
  assert.equal(evidenceRow?.evidence_source, 'teacher_upload')
})

// ── GET /api/student/assignments — read isolation (Step 8) ────────────────

test('GET /api/student/assignments: excludes assignments from a class the learner is not enrolled in', async () => {
  const res = await fetch(`${BASE_URL}/api/student/assignments?studentId=${fx.studentAId}`, { headers: cookie(fx.studentASession) })
  assert.equal(res.status, 200)
  const body = await res.json()
  const ids = (body.data.assignments as Array<{ id: string }>).map(a => a.id)
  assert.ok(ids.includes(fx.assignmentAId), 'own-class assignment must be visible')
  assert.ok(!ids.includes(fx.assignmentBId), 'unrelated-class assignment must not be visible')
  assert.ok(!ids.includes(fx.quizBId), 'unrelated-class quiz must not be visible')
})

test('GET /api/student/assignments: excludes assignments from an unrelated-school class (Case B)', async () => {
  const res = await fetch(`${BASE_URL}/api/student/assignments?studentId=${fx.studentBId}`, { headers: cookie(fx.studentBSession) })
  assert.equal(res.status, 200)
  const body = await res.json()
  const ids = (body.data.assignments as Array<{ id: string }>).map(a => a.id)
  assert.ok(!ids.includes(fx.assignmentAId))
})

test('GET /api/student/assignments: a parent may only reach their own linked child, never an unrelated student', async () => {
  const ownChildRes = await fetch(`${BASE_URL}/api/student/assignments?studentId=${fx.studentAId}`, { headers: cookie(fx.parentASession) })
  assert.equal(ownChildRes.status, 200)

  const unrelatedRes = await fetch(`${BASE_URL}/api/student/assignments?studentId=${fx.studentBId}`, { headers: cookie(fx.parentASession) })
  assert.equal(unrelatedRes.status, 403)
})
