// lib/testing/lmsRoutes.http.integration.test.ts
//
// LMS Basics — route-level (HTTP) integration tests. Unlike every other
// *.integration.test.ts in this repo (which import repository/lib
// functions directly), these hit real Next.js Route Handlers over HTTP
// against a running `next dev`/`next start` server, because
// utils/supabase/server.ts's createClient() reads the session via
// `next/headers` cookies() — that only resolves inside a real Next.js
// request, so a route handler can't be exercised correctly by importing
// and calling it directly. Authentication uses lib/testing/
// httpAuthTestHelper.ts, which signs a synthetic user in via
// @supabase/ssr's own createServerClient and captures the exact Cookie
// header a browser would send.
//
// Requires a server already running at LMS_TEST_BASE_URL (default
// http://localhost:3939) — this file does not start one, so a CI/local run
// must do `next dev -p 3939 &` (or `next start`) first. All data created is
// SYNTHETIC_-tagged and deleted in after(), including on failure.
//
// Run: LMS_TEST_BASE_URL=http://localhost:3939 npx tsx --env-file=.env.local --test lib/testing/lmsRoutes.http.integration.test.ts
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createServiceClient } from '@/utils/supabase/service'
import { signInForHttpTest, type SyntheticSession } from './httpAuthTestHelper'

const BASE_URL = process.env.LMS_TEST_BASE_URL ?? 'http://localhost:3939'
const SYNTHETIC_MARKER = 'SYNTHETIC_LMS_HTTP_TEST'
const db = createServiceClient()

type Fixture = {
  teacherAuthId: string
  teacherId: string
  teacherSession: SyntheticSession
  otherTeacherAuthId: string
  otherTeacherId: string
  otherTeacherSession: SyntheticSession
  studentAuthId: string
  studentId: string
  studentSession: SyntheticSession
  outsiderAuthId: string
  outsiderSession: SyntheticSession
  classId: string
  assignmentId: string
  submissionId: string
}

let fx: Fixture

// This session's environment has shown sustained, intermittent network
// flakiness against Supabase Auth's admin endpoints (documented identically
// in lib/learnerBlueprint/actionPlan/lifecycle.integration.test.ts's header)
// — bounded setup retries only, never around an authorization assertion.
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
  const teacher = await createSyntheticUser('teacher')
  const otherTeacher = await createSyntheticUser('other-teacher')
  const student = await createSyntheticUser('student')
  const outsider = await createSyntheticUser('outsider')

  const { data: teacherRow, error: teacherErr } = await db
    .from('teachers').insert({ user_id: teacher.authId, full_name: SYNTHETIC_MARKER, school: SYNTHETIC_MARKER })
    .select('id').single()
  if (teacherErr) throw teacherErr

  const { data: otherTeacherRow, error: otherTeacherErr } = await db
    .from('teachers').insert({ user_id: otherTeacher.authId, full_name: SYNTHETIC_MARKER, school: SYNTHETIC_MARKER })
    .select('id').single()
  if (otherTeacherErr) throw otherTeacherErr

  const { data: cls, error: clsErr } = await db
    .from('teacher_classes')
    .insert({
      teacher_id: teacherRow.id, name: SYNTHETIC_MARKER, grade: 8, subject: 'Mathematics',
      class_code: `${SYNTHETIC_MARKER}_${Date.now()}`,
    })
    .select('id').single()
  if (clsErr) throw clsErr

  const { data: studentRow, error: studentErr } = await db
    .from('students').insert({ user_id: student.authId, name: 'HTTP Test Student', grade: 8, level: 'Junior School' })
    .select('id').single()
  if (studentErr) throw studentErr

  await db.from('class_students').insert({ class_id: cls.id, student_id: studentRow.id })

  const { data: assignment, error: assignErr } = await db
    .from('assignments')
    .insert({
      class_id: cls.id, teacher_id: teacherRow.id, title: 'HTTP Test Assignment',
      subject: 'Mathematics', topic: 'Algebra', instructions: 'Solve 1-10',
      due_date: new Date(Date.now() + 86400_000).toISOString(),
    })
    .select('id').single()
  if (assignErr) throw assignErr

  const { data: submission, error: subErr } = await db
    .from('assignment_submissions')
    .insert({ assignment_id: assignment.id, student_id: studentRow.id, class_id: cls.id, status: 'pending' })
    .select('id').single()
  if (subErr) throw subErr

  fx = {
    teacherAuthId: teacher.authId, teacherId: teacherRow.id, teacherSession: teacher.session,
    otherTeacherAuthId: otherTeacher.authId, otherTeacherId: otherTeacherRow.id, otherTeacherSession: otherTeacher.session,
    studentAuthId: student.authId, studentId: studentRow.id, studentSession: student.session,
    outsiderAuthId: outsider.authId, outsiderSession: outsider.session,
    classId: cls.id, assignmentId: assignment.id, submissionId: submission.id,
  }
})

after(async () => {
  if (!fx) return

  // Storage objects are not cascade-deleted by the DB FKs — clean up the
  // whole per-class/per-assignment folder in each bucket explicitly.
  // class-resources is one level deep (classId/file); assignment-submissions
  // is two (assignmentId/studentId/file) — list must recurse to find real
  // object keys, since removing a "folder" path (an entry with no
  // extension, really just a common prefix) removes nothing.
  await removeAllUnder(db, 'class-resources', fx.classId)
  await removeAllUnder(db, 'assignment-submissions', fx.assignmentId)

  await db.from('teacher_classes').delete().eq('id', fx.classId) // cascades assignments/submissions/class_students/resources/materials
  await db.from('students').delete().eq('id', fx.studentId)
  await db.from('teachers').delete().eq('id', fx.teacherId)
  await db.from('teachers').delete().eq('id', fx.otherTeacherId)
  for (const authId of [fx.teacherAuthId, fx.otherTeacherAuthId, fx.studentAuthId, fx.outsiderAuthId]) {
    await db.auth.admin.deleteUser(authId)
  }
})

function cookie(session: SyntheticSession) {
  return { Cookie: session.cookieHeader }
}

/** Recursively deletes every object under a Storage prefix — Supabase's `list()` returns folders as entries with `id: null`, so a one-level `remove()` silently no-ops on nested paths. */
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

// ── Gradebook ────────────────────────────────────────────────────────────

test('GET /api/teacher/gradebook/[classId]: unauthenticated request is rejected', async () => {
  const res = await fetch(`${BASE_URL}/api/teacher/gradebook/${fx.classId}`)
  assert.equal(res.status, 401)
})

test('GET /api/teacher/gradebook/[classId]: a non-owning teacher is rejected', async () => {
  const res = await fetch(`${BASE_URL}/api/teacher/gradebook/${fx.classId}`, { headers: cookie(fx.otherTeacherSession) })
  assert.equal(res.status, 403)
})

test('GET /api/teacher/gradebook/[classId]: the owning teacher gets a gradebook back', async () => {
  const res = await fetch(`${BASE_URL}/api/teacher/gradebook/${fx.classId}`, { headers: cookie(fx.teacherSession) })
  assert.equal(res.status, 200)
  const body = await res.json()
  assert.ok(body.success)
  assert.ok(Array.isArray(body.data.gradebook.rows))
})

// ── Assignment file upload ──────────────────────────────────────────────

test('POST /api/student/submit-file: student uploads a file, submission is marked submitted with file metadata', async () => {
  const form = new FormData()
  form.set('assignmentId', fx.assignmentId)
  form.set('studentId', fx.studentId)
  form.set('file', new Blob([new TextEncoder().encode('synthetic homework photo bytes')], { type: 'application/pdf' }), 'homework.pdf')

  const res = await fetch(`${BASE_URL}/api/student/submit-file`, {
    method: 'POST', headers: cookie(fx.studentSession), body: form,
  })
  assert.equal(res.status, 200)
  const body = await res.json()
  assert.ok(body.success)
  assert.equal(body.data.submission.status, 'submitted')
  assert.equal(body.data.submission.file_name, 'homework.pdf')
})

test('POST /api/student/submit-file: a different student cannot submit on this student\'s behalf', async () => {
  const form = new FormData()
  form.set('assignmentId', fx.assignmentId)
  form.set('studentId', fx.studentId) // impersonating fx.studentId as the outsider
  form.set('file', new Blob([new TextEncoder().encode('x')], { type: 'application/pdf' }), 'x.pdf')

  const res = await fetch(`${BASE_URL}/api/student/submit-file`, {
    method: 'POST', headers: cookie(fx.outsiderSession), body: form,
  })
  assert.equal(res.status, 403)
})

test('GET /api/teacher/assignments/[id]/submissions/[submissionId]/file-url: owning teacher can mint a signed URL and fetch the real file', async () => {
  const res = await fetch(
    `${BASE_URL}/api/teacher/assignments/${fx.assignmentId}/submissions/${fx.submissionId}/file-url`,
    { headers: cookie(fx.teacherSession) },
  )
  assert.equal(res.status, 200)
  const body = await res.json()
  assert.ok(body.data.url)

  const fileRes = await fetch(body.data.url)
  assert.equal(fileRes.status, 200)
  const text = await fileRes.text()
  assert.equal(text, 'synthetic homework photo bytes')
})

test('GET /api/teacher/assignments/[id]/submissions/[submissionId]/file-url: a non-owning teacher is rejected', async () => {
  const res = await fetch(
    `${BASE_URL}/api/teacher/assignments/${fx.assignmentId}/submissions/${fx.submissionId}/file-url`,
    { headers: cookie(fx.otherTeacherSession) },
  )
  assert.equal(res.status, 403)
})

// ── Class Resources ──────────────────────────────────────────────────────

let resourceId: string

test('POST /api/teacher/resources/by-class/[classId]: teacher uploads a resource', async () => {
  const form = new FormData()
  form.set('title', 'Week 1 worksheet')
  form.set('file', new Blob([new TextEncoder().encode('synthetic worksheet bytes')], { type: 'application/pdf' }), 'worksheet.pdf')

  const res = await fetch(`${BASE_URL}/api/teacher/resources/by-class/${fx.classId}`, {
    method: 'POST', headers: cookie(fx.teacherSession), body: form,
  })
  assert.equal(res.status, 201)
  const body = await res.json()
  assert.ok(body.success)
  resourceId = body.data.resource.id
})

test('POST /api/teacher/resources/by-class/[classId]: a non-owning teacher cannot upload to this class', async () => {
  const form = new FormData()
  form.set('title', 'Intrusion attempt')
  form.set('file', new Blob([new TextEncoder().encode('x')], { type: 'application/pdf' }), 'x.pdf')
  const res = await fetch(`${BASE_URL}/api/teacher/resources/by-class/${fx.classId}`, {
    method: 'POST', headers: cookie(fx.otherTeacherSession), body: form,
  })
  assert.equal(res.status, 403)
})

test('GET /api/student/resources: the enrolled student sees the uploaded resource', async () => {
  const res = await fetch(`${BASE_URL}/api/student/resources`, { headers: cookie(fx.studentSession) })
  assert.equal(res.status, 200)
  const body = await res.json()
  assert.ok(body.data.resources.some((r: { id: string }) => r.id === resourceId))
})

test('GET /api/student/resources: an unenrolled outsider sees an empty list, not an error', async () => {
  const res = await fetch(`${BASE_URL}/api/student/resources`, { headers: cookie(fx.outsiderSession) })
  assert.equal(res.status, 200)
  const body = await res.json()
  assert.deepEqual(body.data.resources, [])
})

test('GET /api/resources/[id]/file-url: enrolled student can download; outsider is forbidden', async () => {
  const studentRes = await fetch(`${BASE_URL}/api/resources/${resourceId}/file-url`, { headers: cookie(fx.studentSession) })
  assert.equal(studentRes.status, 200)
  const studentBody = await studentRes.json()
  const fileRes = await fetch(studentBody.data.url)
  assert.equal(fileRes.status, 200)
  assert.equal(await fileRes.text(), 'synthetic worksheet bytes')

  const outsiderRes = await fetch(`${BASE_URL}/api/resources/${resourceId}/file-url`, { headers: cookie(fx.outsiderSession) })
  assert.equal(outsiderRes.status, 403)
})

test('DELETE /api/teacher/resources/[id]: a non-owning teacher cannot delete; the owner can', async () => {
  const denied = await fetch(`${BASE_URL}/api/teacher/resources/${resourceId}`, {
    method: 'DELETE', headers: cookie(fx.otherTeacherSession),
  })
  assert.equal(denied.status, 403)

  const listBefore = await fetch(`${BASE_URL}/api/teacher/resources/by-class/${fx.classId}`, { headers: cookie(fx.teacherSession) })
  const bodyBefore = await listBefore.json()
  assert.ok(bodyBefore.data.resources.some((r: { id: string }) => r.id === resourceId))

  const allowed = await fetch(`${BASE_URL}/api/teacher/resources/${resourceId}`, {
    method: 'DELETE', headers: cookie(fx.teacherSession),
  })
  assert.equal(allowed.status, 200)

  const listAfter = await fetch(`${BASE_URL}/api/teacher/resources/by-class/${fx.classId}`, { headers: cookie(fx.teacherSession) })
  const bodyAfter = await listAfter.json()
  assert.ok(!bodyAfter.data.resources.some((r: { id: string }) => r.id === resourceId))
})

// ── Content Library (materials) ─────────────────────────────────────────

let materialId: string

test('POST /api/teacher/materials/by-class/[classId]: teacher publishes a note', async () => {
  const res = await fetch(`${BASE_URL}/api/teacher/materials/by-class/${fx.classId}`, {
    method: 'POST', headers: { ...cookie(fx.teacherSession), 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: 'Photosynthesis', body: 'Plants convert light to energy.' }),
  })
  assert.equal(res.status, 201)
  const body = await res.json()
  materialId = body.data.material.id
})

test('GET /api/student/materials: the enrolled student sees the note; an outsider does not', async () => {
  const studentRes = await fetch(`${BASE_URL}/api/student/materials`, { headers: cookie(fx.studentSession) })
  const studentBody = await studentRes.json()
  assert.ok(studentBody.data.materials.some((m: { id: string }) => m.id === materialId))

  const outsiderRes = await fetch(`${BASE_URL}/api/student/materials`, { headers: cookie(fx.outsiderSession) })
  const outsiderBody = await outsiderRes.json()
  assert.deepEqual(outsiderBody.data.materials, [])
})

test('DELETE /api/teacher/materials/[id]: owning teacher can delete their own note', async () => {
  const res = await fetch(`${BASE_URL}/api/teacher/materials/${materialId}`, {
    method: 'DELETE', headers: cookie(fx.teacherSession),
  })
  assert.equal(res.status, 200)

  const listAfter = await fetch(`${BASE_URL}/api/student/materials`, { headers: cookie(fx.studentSession) })
  const bodyAfter = await listAfter.json()
  assert.ok(!bodyAfter.data.materials.some((m: { id: string }) => m.id === materialId))
})

// ── Calendar (ADR-0021) ──────────────────────────────────────────────────

let calendarEventId: string

test('POST /api/teacher/calendar/by-class/[classId]: teacher adds an event', async () => {
  const res = await fetch(`${BASE_URL}/api/teacher/calendar/by-class/${fx.classId}`, {
    method: 'POST', headers: { ...cookie(fx.teacherSession), 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: 'CAT 1', eventDate: '2026-08-10' }),
  })
  assert.equal(res.status, 201)
  const body = await res.json()
  calendarEventId = body.data.event.id
})

test('POST /api/teacher/calendar/by-class/[classId]: a non-owning teacher cannot add an event to this class', async () => {
  const res = await fetch(`${BASE_URL}/api/teacher/calendar/by-class/${fx.classId}`, {
    method: 'POST', headers: { ...cookie(fx.otherTeacherSession), 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: 'Intrusion attempt', eventDate: '2026-08-11' }),
  })
  assert.equal(res.status, 403)
})

test('GET /api/teacher/calendar/by-class/[classId]: merges the teacher event with the assignment due date', async () => {
  const res = await fetch(`${BASE_URL}/api/teacher/calendar/by-class/${fx.classId}`, { headers: cookie(fx.teacherSession) })
  assert.equal(res.status, 200)
  const body = await res.json()
  const kinds = body.data.calendar.map((e: { kind: string }) => e.kind)
  assert.ok(kinds.includes('event'))
  assert.ok(kinds.includes('assignment_due'))
})

test('GET /api/student/calendar: the enrolled student sees the same merged calendar; an outsider sees an empty one', async () => {
  const studentRes = await fetch(`${BASE_URL}/api/student/calendar`, { headers: cookie(fx.studentSession) })
  const studentBody = await studentRes.json()
  assert.ok(studentBody.data.calendar.some((e: { id: string }) => e.id === calendarEventId))

  const outsiderRes = await fetch(`${BASE_URL}/api/student/calendar`, { headers: cookie(fx.outsiderSession) })
  const outsiderBody = await outsiderRes.json()
  assert.deepEqual(outsiderBody.data.calendar, [])
})

test('DELETE /api/teacher/calendar/[id]: only the owning teacher can delete an event', async () => {
  const denied = await fetch(`${BASE_URL}/api/teacher/calendar/${calendarEventId}`, {
    method: 'DELETE', headers: cookie(fx.otherTeacherSession),
  })
  assert.equal(denied.status, 403)

  const stillThere = await fetch(`${BASE_URL}/api/teacher/calendar/by-class/${fx.classId}`, { headers: cookie(fx.teacherSession) })
  const stillThereBody = await stillThere.json()
  assert.ok(stillThereBody.data.calendar.some((e: { id: string }) => e.id === calendarEventId))

  const allowed = await fetch(`${BASE_URL}/api/teacher/calendar/${calendarEventId}`, {
    method: 'DELETE', headers: cookie(fx.teacherSession),
  })
  assert.equal(allowed.status, 200)

  const gone = await fetch(`${BASE_URL}/api/teacher/calendar/by-class/${fx.classId}`, { headers: cookie(fx.teacherSession) })
  const goneBody = await gone.json()
  assert.ok(!goneBody.data.calendar.some((e: { id: string }) => e.id === calendarEventId))
})

// ── Announcements (ADR-0021) ─────────────────────────────────────────────

let announcementId: string

test('POST /api/teacher/announcements/by-class/[classId]: teacher posts an announcement', async () => {
  const res = await fetch(`${BASE_URL}/api/teacher/announcements/by-class/${fx.classId}`, {
    method: 'POST', headers: { ...cookie(fx.teacherSession), 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: 'No school tomorrow', body: 'PTA day.' }),
  })
  assert.equal(res.status, 201)
  const body = await res.json()
  announcementId = body.data.announcement.id
})

test('GET /api/student/announcements: enrolled student sees it; outsider does not', async () => {
  const studentRes = await fetch(`${BASE_URL}/api/student/announcements`, { headers: cookie(fx.studentSession) })
  const studentBody = await studentRes.json()
  assert.ok(studentBody.data.announcements.some((a: { id: string }) => a.id === announcementId))

  const outsiderRes = await fetch(`${BASE_URL}/api/student/announcements`, { headers: cookie(fx.outsiderSession) })
  const outsiderBody = await outsiderRes.json()
  assert.deepEqual(outsiderBody.data.announcements, [])
})

test('DELETE /api/teacher/announcements/[id]: owning teacher can delete their own announcement', async () => {
  const res = await fetch(`${BASE_URL}/api/teacher/announcements/${announcementId}`, {
    method: 'DELETE', headers: cookie(fx.teacherSession),
  })
  assert.equal(res.status, 200)

  const listAfter = await fetch(`${BASE_URL}/api/student/announcements`, { headers: cookie(fx.studentSession) })
  const bodyAfter = await listAfter.json()
  assert.ok(!bodyAfter.data.announcements.some((a: { id: string }) => a.id === announcementId))
})

// ── Quiz (Phase 3a — extends Assignments, no new domain) ─────────────────

let quizAssignmentId: string
let quizQuestionIds: string[] = []

test('POST /api/teacher/assignments: is_quiz=true creates a quiz-type assignment', async () => {
  const res = await fetch(`${BASE_URL}/api/teacher/assignments`, {
    method: 'POST', headers: { ...cookie(fx.teacherSession), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      class_id: fx.classId, title: 'Fractions Quiz', subject: 'Mathematics', topic: 'Fractions',
      instructions: 'Answer all questions', due_date: new Date(Date.now() + 86400_000).toISOString(),
      max_score: 20, is_quiz: true,
    }),
  })
  assert.equal(res.status, 201)
  const body = await res.json()
  assert.equal(body.data.assignment.is_quiz, true)
  quizAssignmentId = body.data.assignment.id
})

test('PUT /api/teacher/assignments/[id]/questions: teacher authors the question set', async () => {
  const res = await fetch(`${BASE_URL}/api/teacher/assignments/${quizAssignmentId}/questions`, {
    method: 'PUT', headers: { ...cookie(fx.teacherSession), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      questions: [
        { questionText: '1/2 + 1/2 = ?', choices: ['1', '2', '0'], correctIndex: 0 },
        { questionText: '3/4 - 1/4 = ?', choices: ['1/2', '1', '2'], correctIndex: 0 },
      ],
    }),
  })
  assert.equal(res.status, 200)
  const body = await res.json()
  assert.equal(body.data.questions.length, 2)
  quizQuestionIds = body.data.questions.map((q: { id: string }) => q.id)
})

test('PUT /api/teacher/assignments/[id]/questions: a non-owning teacher cannot author questions for this assignment', async () => {
  const res = await fetch(`${BASE_URL}/api/teacher/assignments/${quizAssignmentId}/questions`, {
    method: 'PUT', headers: { ...cookie(fx.otherTeacherSession), 'Content-Type': 'application/json' },
    body: JSON.stringify({ questions: [{ questionText: 'Intrusion', choices: ['A', 'B'], correctIndex: 0 }] }),
  })
  assert.equal(res.status, 403)
})

test('GET /api/student/assignments/[id]/questions: student sees questions with no correct_index field', async () => {
  const res = await fetch(`${BASE_URL}/api/student/assignments/${quizAssignmentId}/questions`, { headers: cookie(fx.studentSession) })
  assert.equal(res.status, 200)
  const body = await res.json()
  assert.equal(body.data.questions.length, 2)
  for (const q of body.data.questions) {
    assert.equal('correct_index' in q, false)
    assert.equal('correctIndex' in q, false)
  }
})

test('GET /api/student/assignments/[id]/questions: an unenrolled outsider is forbidden', async () => {
  const res = await fetch(`${BASE_URL}/api/student/assignments/${quizAssignmentId}/questions`, { headers: cookie(fx.outsiderSession) })
  assert.equal(res.status, 403)
})

test('POST /api/student/submit-quiz: grades instantly and the submission shows up in the Gradebook', async () => {
  const res = await fetch(`${BASE_URL}/api/student/submit-quiz`, {
    method: 'POST', headers: { ...cookie(fx.studentSession), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      assignmentId: quizAssignmentId, studentId: fx.studentId,
      answers: [
        { questionId: quizQuestionIds[0], selectedIndex: 0 }, // correct
        { questionId: quizQuestionIds[1], selectedIndex: 1 }, // wrong
      ],
    }),
  })
  assert.equal(res.status, 200)
  const body = await res.json()
  assert.equal(body.data.grade.correctCount, 1)
  assert.equal(body.data.grade.score, 10) // 1/2 * 20
  assert.equal(body.data.submission.status, 'marked')

  const gradebookRes = await fetch(`${BASE_URL}/api/teacher/gradebook/${fx.classId}`, { headers: cookie(fx.teacherSession) })
  const gradebookBody = await gradebookRes.json()
  const row = gradebookBody.data.gradebook.rows.find((r: { studentId: string }) => r.studentId === fx.studentId)
  assert.equal(row.scores[quizAssignmentId], 10)
})

test('POST /api/student/submit-quiz: a different student cannot submit on this student\'s behalf', async () => {
  const res = await fetch(`${BASE_URL}/api/student/submit-quiz`, {
    method: 'POST', headers: { ...cookie(fx.outsiderSession), 'Content-Type': 'application/json' },
    body: JSON.stringify({ assignmentId: quizAssignmentId, studentId: fx.studentId, answers: [] }),
  })
  assert.equal(res.status, 403)
})

// ── Adaptive Assignment Status Flow — Sprint 10 Slice A (Parts 1, 3) ─────

test('POST /api/teacher/assignments: is_adaptive=true is always created is_quiz + status=draft, regardless of is_quiz sent', async () => {
  const res = await fetch(`${BASE_URL}/api/teacher/assignments`, {
    method: 'POST', headers: { ...cookie(fx.teacherSession), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      class_id: fx.classId, title: 'Adaptive Fractions Quiz', subject: 'Mathematics', topic: 'Fractions',
      instructions: 'Answer all questions', due_date: new Date(Date.now() + 86400_000).toISOString(),
      max_score: 20, is_quiz: false, is_adaptive: true,
    }),
  })
  assert.equal(res.status, 201)
  const body = await res.json()
  assert.equal(body.data.assignment.is_adaptive, true)
  assert.equal(body.data.assignment.is_quiz, true)
  assert.equal(body.data.assignment.status, 'draft')

  // Not yet published — the existing student list route (`status=active`
  // only) must not surface it, proving the visibility gate is real, not
  // just a stored flag.
  const studentRes = await fetch(`${BASE_URL}/api/student/assignments`, { headers: cookie(fx.studentSession) })
  const studentBody = await studentRes.json()
  assert.ok(!studentBody.data.assignments.some((a: { id: string }) => a.id === body.data.assignment.id))

  // Cleanup — created mid-test, not covered by fx's teardown.
  await db.from('assignments').delete().eq('id', body.data.assignment.id)
})

test('POST /api/teacher/assignments: omitting is_adaptive (Standard/plain quiz) is unaffected — status=active immediately', async () => {
  const res = await fetch(`${BASE_URL}/api/teacher/assignments`, {
    method: 'POST', headers: { ...cookie(fx.teacherSession), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      class_id: fx.classId, title: 'Standard Quiz', subject: 'Mathematics', topic: 'Fractions',
      instructions: 'Answer all questions', due_date: new Date(Date.now() + 86400_000).toISOString(),
      max_score: 20, is_quiz: true,
    }),
  })
  assert.equal(res.status, 201)
  const body = await res.json()
  assert.equal(body.data.assignment.is_adaptive, false)
  assert.equal(body.data.assignment.status, 'active')

  await db.from('assignments').delete().eq('id', body.data.assignment.id)
})

test('PATCH /api/teacher/assignments/[id]: publishing a draft adaptive assignment (draft -> active) makes it visible to students', async () => {
  const createRes = await fetch(`${BASE_URL}/api/teacher/assignments`, {
    method: 'POST', headers: { ...cookie(fx.teacherSession), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      class_id: fx.classId, title: 'Adaptive Quiz To Publish', subject: 'Mathematics', topic: 'Fractions',
      instructions: 'Answer all questions', due_date: new Date(Date.now() + 86400_000).toISOString(),
      max_score: 20, is_adaptive: true,
    }),
  })
  const createBody = await createRes.json()
  const adaptiveAssignmentId = createBody.data.assignment.id
  assert.equal(createBody.data.assignment.status, 'draft')

  const beforePublish = await fetch(`${BASE_URL}/api/student/assignments`, { headers: cookie(fx.studentSession) })
  const beforePublishBody = await beforePublish.json()
  assert.ok(!beforePublishBody.data.assignments.some((a: { id: string }) => a.id === adaptiveAssignmentId))

  const publishRes = await fetch(`${BASE_URL}/api/teacher/assignments/${adaptiveAssignmentId}`, {
    method: 'PATCH', headers: { ...cookie(fx.teacherSession), 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'active' }),
  })
  assert.equal(publishRes.status, 200)
  const publishBody = await publishRes.json()
  assert.equal(publishBody.data.assignment.status, 'active')

  const afterPublish = await fetch(`${BASE_URL}/api/student/assignments`, { headers: cookie(fx.studentSession) })
  const afterPublishBody = await afterPublish.json()
  assert.ok(afterPublishBody.data.assignments.some((a: { id: string }) => a.id === adaptiveAssignmentId))

  await db.from('assignments').delete().eq('id', adaptiveAssignmentId)
})

test('PATCH /api/teacher/assignments/[id]: a non-owning teacher cannot publish this assignment', async () => {
  const createRes = await fetch(`${BASE_URL}/api/teacher/assignments`, {
    method: 'POST', headers: { ...cookie(fx.teacherSession), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      class_id: fx.classId, title: 'Adaptive Quiz Intrusion Test', subject: 'Mathematics', topic: 'Fractions',
      instructions: 'Answer all questions', due_date: new Date(Date.now() + 86400_000).toISOString(),
      max_score: 20, is_adaptive: true,
    }),
  })
  const createBody = await createRes.json()
  const adaptiveAssignmentId = createBody.data.assignment.id

  const res = await fetch(`${BASE_URL}/api/teacher/assignments/${adaptiveAssignmentId}`, {
    method: 'PATCH', headers: { ...cookie(fx.otherTeacherSession), 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'active' }),
  })
  assert.equal(res.status, 404) // ownership enforced via .eq('teacher_id', ...), a mismatched row looks not-found, not forbidden

  await db.from('assignments').delete().eq('id', adaptiveAssignmentId)
})

// ── Curriculum identity — ADR-0024 Sprint A, Objective 3 ──────────────────

test('POST /api/teacher/assignments: a real substrand_id from the KICD picker is persisted, not discarded', async () => {
  const { data: substrand } = await db
    .from('sow_substrands')
    .select('id, title')
    .limit(1)
    .maybeSingle()

  if (!substrand) throw new Error('No sow_substrands row available for this test')

  const res = await fetch(`${BASE_URL}/api/teacher/assignments`, {
    method: 'POST', headers: { ...cookie(fx.teacherSession), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      class_id: fx.classId, title: 'Curriculum-anchored assignment', subject: 'Mathematics',
      topic: substrand.title, substrand_id: substrand.id, instructions: 'Solve the set',
      due_date: new Date(Date.now() + 86400_000).toISOString(),
    }),
  })
  assert.equal(res.status, 201)
  const body = await res.json()
  assert.equal(body.data.assignment.substrand_id, substrand.id)
})

test('POST /api/teacher/assignments: omitting substrand_id (custom mode) still succeeds — never blocks on a missing curriculum anchor', async () => {
  const res = await fetch(`${BASE_URL}/api/teacher/assignments`, {
    method: 'POST', headers: { ...cookie(fx.teacherSession), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      class_id: fx.classId, title: 'Free-form assignment', subject: 'Mathematics', topic: 'Custom',
      instructions: 'Write a reflection', due_date: new Date(Date.now() + 86400_000).toISOString(),
    }),
  })
  assert.equal(res.status, 201)
  const body = await res.json()
  assert.equal(body.data.assignment.substrand_id, null)
})

// ── Quiz Evidence — ADR-0024 Sprint C ─────────────────────────────────────

test('POST /api/student/submit-quiz: submitting produces a real quiz_auto_grade learner_evidence row', async () => {
  const { data: substrand } = await db
    .from('sow_substrands')
    .select('id, title')
    .limit(1)
    .maybeSingle()
  if (!substrand) throw new Error('No sow_substrands row available for this test')

  const createRes = await fetch(`${BASE_URL}/api/teacher/assignments`, {
    method: 'POST', headers: { ...cookie(fx.teacherSession), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      class_id: fx.classId, title: 'Evidence Quiz', subject: 'Mathematics', topic: substrand.title,
      substrand_id: substrand.id, instructions: 'Answer all', max_score: 10,
      due_date: new Date(Date.now() + 86400_000).toISOString(), is_quiz: true,
    }),
  })
  const createBody = await createRes.json()
  const evidenceQuizAssignmentId = createBody.data.assignment.id

  const questionsRes = await fetch(`${BASE_URL}/api/teacher/assignments/${evidenceQuizAssignmentId}/questions`, {
    method: 'PUT', headers: { ...cookie(fx.teacherSession), 'Content-Type': 'application/json' },
    body: JSON.stringify({ questions: [{ questionText: 'Q1', choices: ['A', 'B'], correctIndex: 0 }] }),
  })
  const questionsBody = await questionsRes.json()
  const questionId = questionsBody.data.questions[0].id

  const submitRes = await fetch(`${BASE_URL}/api/student/submit-quiz`, {
    method: 'POST', headers: { ...cookie(fx.studentSession), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      assignmentId: evidenceQuizAssignmentId, studentId: fx.studentId,
      answers: [{ questionId, selectedIndex: 0 }],
    }),
  })
  assert.equal(submitRes.status, 200)

  // Evidence emission is fire-and-forget — poll briefly rather than assume
  // instant availability, matching how a real client would observe this.
  let evidenceRow: { evidence_source: string; sub_strand_id: string; trust_tier: number } | null = null
  for (let i = 0; i < 10 && !evidenceRow; i++) {
    const { data } = await db
      .from('learner_evidence')
      .select('evidence_source, sub_strand_id, trust_tier')
      .eq('learner_id', fx.studentId)
      .like('raw_input_ref', `assignment:${evidenceQuizAssignmentId}%`)
      .maybeSingle()
    evidenceRow = data
    if (!evidenceRow) await new Promise(r => setTimeout(r, 300))
  }

  assert.ok(evidenceRow, 'expected a learner_evidence row to appear for the quiz submission')
  assert.equal(evidenceRow!.evidence_source, 'quiz_auto_grade')
  assert.equal(evidenceRow!.sub_strand_id, substrand.id)
  assert.equal(evidenceRow!.trust_tier, 2)

  // Cleanup — this assignment/evidence isn't covered by fx's teardown since
  // it was created mid-test, not in before(). Same non-cascading child
  // tables as evidence.substrand.integration.test.ts / quizEvidence.integration.test.ts.
  const { data: evRow } = await db
    .from('learner_evidence')
    .select('id')
    .eq('learner_id', fx.studentId)
    .like('raw_input_ref', `assignment:${evidenceQuizAssignmentId}%`)
    .maybeSingle()
  if (evRow) {
    await db.from('evidence_projection_events').delete().eq('evidence_id', evRow.id)
    await db.from('evidence_audit_log').delete().eq('evidence_id', evRow.id)
    await db.from('learner_evidence').delete().eq('id', evRow.id)
  }
})
