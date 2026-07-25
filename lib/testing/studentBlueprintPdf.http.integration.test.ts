// lib/testing/studentBlueprintPdf.http.integration.test.ts
//
// Canonical Learner Blueprint PDF export — proves the authenticated export
// route renders the live Blueprint page, returns a real PDF, and preserves
// the same learner-access boundary as the canonical UI route.
//
// Run:
// LMS_TEST_BASE_URL=http://localhost:3939 npx tsx --env-file=.env.local --test lib/testing/studentBlueprintPdf.http.integration.test.ts
// (requires `next dev -p 3939 &` already running)

import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createServiceClient } from '@/utils/supabase/service'
import { signInForHttpTest, type SyntheticSession } from './httpAuthTestHelper'

const BASE_URL = process.env.LMS_TEST_BASE_URL ?? 'http://localhost:3939'
const SYNTHETIC_MARKER = 'SYNTHETIC_BLUEPRINT_PDF_HTTP_TEST'
const db = createServiceClient()
const PASSWORD = `Test!${Math.random().toString(36).slice(2, 10)}`

const authUserIds: string[] = []
const schoolIds: string[] = []
const learnerIds: string[] = []
const studentIds: string[] = []
const teacherRowIds: string[] = []

let studentSession: SyntheticSession
let otherStudentSession: SyntheticSession
let coreLearnerId: string

async function createUser(label: string, profileRole?: 'student' | 'teacher'): Promise<{ authId: string; session: SyntheticSession }> {
  const email = `${SYNTHETIC_MARKER.toLowerCase()}-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.com`
  const { data, error } = await db.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true })
  if (error) throw error
  authUserIds.push(data.user.id)
  if (profileRole) {
    const { error: profileErr } = await db.from('profiles').upsert({ id: data.user.id, role: profileRole })
    if (profileErr) throw profileErr
  }
  const session = await signInForHttpTest(email, PASSWORD)
  return { authId: data.user.id, session }
}

before(async () => {
  const student = await createUser('student', 'student')
  const otherStudent = await createUser('other-student', 'student')
  const teacher = await createUser('teacher')
  studentSession = student.session
  otherStudentSession = otherStudent.session

  const { data: school, error: schoolErr } = await db
    .from('schools').insert({ school_name: SYNTHETIC_MARKER, created_by: teacher.authId }).select('id').single()
  if (schoolErr) throw schoolErr
  schoolIds.push(school.id)

  const { data: learner, error: learnerErr } = await db
    .from('learners')
    .insert({
      school_id: school.id,
      admission_number: `${SYNTHETIC_MARKER}-001`,
      first_name: 'Brian',
      last_name: 'Matthias',
    })
    .select('id')
    .single()
  if (learnerErr) throw learnerErr
  coreLearnerId = learner.id
  learnerIds.push(learner.id)

  const { data: teacherRow, error: teacherErr } = await db
    .from('teachers')
    .insert({ user_id: teacher.authId, full_name: SYNTHETIC_MARKER, school: SYNTHETIC_MARKER })
    .select('id')
    .single()
  if (teacherErr) throw teacherErr
  teacherRowIds.push(teacherRow.id)

  const { data: studentRow, error: studentErr } = await db
    .from('students')
    .insert({
      teacher_id: teacherRow.id,
      name: 'Brian Matthias',
      grade: 8,
      level: 'Junior School',
      school: SYNTHETIC_MARKER,
      added_by: 'teacher',
      external_id: coreLearnerId,
      user_id: student.authId,
    })
    .select('id')
    .single()
  if (studentErr) throw studentErr
  studentIds.push(studentRow.id)
})

after(async () => {
  await db.from('students').delete().in('id', studentIds)
  await db.from('teachers').delete().in('id', teacherRowIds)
  await db.from('learners').delete().in('id', learnerIds)
  await db.from('schools').delete().in('id', schoolIds)
  for (const id of authUserIds) {
    await db.from('profiles').delete().eq('id', id)
    await db.auth.admin.deleteUser(id)
  }
  console.log('[cleanup] synthetic blueprint-pdf fixtures removed')
})

function cookie(session: SyntheticSession) {
  return { Cookie: session.cookieHeader }
}

test('GET /api/student/blueprint/[learnerId]/pdf rejects unauthenticated requests', async () => {
  const res = await fetch(`${BASE_URL}/api/student/blueprint/${coreLearnerId}/pdf`)
  assert.equal(res.status, 401)
})

test('GET /api/student/blueprint/[learnerId]/pdf rejects unrelated learner access', async () => {
  const res = await fetch(`${BASE_URL}/api/student/blueprint/${coreLearnerId}/pdf`, {
    headers: cookie(otherStudentSession),
  })
  assert.equal(res.status, 403)
})

test('GET /api/student/blueprint/[learnerId]/pdf returns a real PDF for the learner who owns the Blueprint', async () => {
  const res = await fetch(`${BASE_URL}/api/student/blueprint/${coreLearnerId}/pdf`, {
    headers: cookie(studentSession),
  })

  assert.equal(res.status, 200)
  assert.equal(res.headers.get('content-type'), 'application/pdf')
  assert.equal(res.headers.get('cache-control'), 'private, no-store, max-age=0')
  assert.equal(res.headers.get('x-blueprint-headings-verified'), '5')
  assert.equal(res.headers.get('x-blueprint-export-source'), `/student/blueprint/${coreLearnerId}`)
  assert.match(res.headers.get('content-disposition') ?? '', /^attachment; filename="Learner_Blueprint_[A-Z_]+\.pdf"$/)

  const pdfBuffer = Buffer.from(await res.arrayBuffer())
  assert.ok(pdfBuffer.length > 5000, 'expected a non-empty PDF body')
  assert.equal(pdfBuffer.subarray(0, 4).toString('latin1'), '%PDF')
})
