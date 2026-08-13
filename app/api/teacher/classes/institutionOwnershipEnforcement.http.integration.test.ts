// app/api/teacher/classes/institutionOwnershipEnforcement.http.integration.test.ts
//
// Institution Ownership, route-level proof — REWRITTEN by the auto-provision
// cleanup phase.
//
// This suite previously asserted that POST /api/teacher/classes "always
// stamps a real school_id". That assertion encoded the anti-pattern as a
// requirement: the only way to guarantee a non-null school_id for a teacher
// with no membership was to MINT a school named "{teacher}'s School (pending
// setup)" and make them its school_admin. Six such synthetic schools in the
// live database were created by this very suite.
//
// The corrected contract, proven below:
//   * a teacher WITH an active membership  -> class carries that school_id
//   * a teacher WITHOUT one                -> class carries NULL, and NO
//                                             school is created
// Both `teacher_classes.school_id` and `students.school_id` are nullable
// precisely because a private class need not belong to an institution.
//
// Requires a server already running at LMS_TEST_BASE_URL (default
// http://localhost:3939).
//
// Run: LMS_TEST_BASE_URL=http://localhost:3939 npx tsx --env-file=.env.local --test app/api/teacher/classes/institutionOwnershipEnforcement.http.integration.test.ts
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createServiceClient } from '@/utils/supabase/service'
import { signInForHttpTest, type SyntheticSession } from '@/lib/testing/httpAuthTestHelper'

const BASE_URL = process.env.LMS_TEST_BASE_URL ?? 'http://localhost:3939'
const SYNTHETIC_MARKER = 'SYNTHETIC_INSTOWNERSHIP_ROUTE_TEST'
const db = createServiceClient()

async function retryAsync<T>(fn: () => Promise<T>, attempts = 6): Promise<T> {
  let lastError: unknown
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try { return await fn() } catch (err) { lastError = err }
    await new Promise(resolve => setTimeout(resolve, 500 * attempt))
  }
  throw lastError
}

async function createSyntheticTeacher(label: string): Promise<{ authId: string; teacherId: string; session: SyntheticSession }> {
  const email = `${SYNTHETIC_MARKER.toLowerCase()}-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.com`
  const password = `Test!${Math.random().toString(36).slice(2, 10)}`
  const { data } = await retryAsync(async () => {
    const res = await db.auth.admin.createUser({ email, password, email_confirm: true })
    if (res.error) throw res.error
    return res
  })
  const session = await retryAsync(() => signInForHttpTest(email, password))
  const { data: teacherRow, error } = await db
    .from('teachers')
    .insert({ user_id: data.user.id, full_name: SYNTHETIC_MARKER, school: SYNTHETIC_MARKER })
    .select('id')
    .single()
  if (error || !teacherRow) throw new Error(`teacher insert failed: ${error?.message}`)
  return { authId: data.user.id, teacherId: teacherRow.id, session }
}

const createdUserIds: string[] = []
const createdTeacherIds: string[] = []
const createdClassIds: string[] = []
const createdSchoolIds: string[] = []
const createdStudentIds: string[] = []

after(async () => {
  if (createdStudentIds.length) await db.from('class_students').delete().in('student_id', createdStudentIds)
  if (createdStudentIds.length) await db.from('students').delete().in('id', createdStudentIds)
  if (createdClassIds.length) await db.from('teacher_classes').delete().in('id', createdClassIds)
  if (createdSchoolIds.length) await db.from('school_users').delete().in('school_id', createdSchoolIds)
  if (createdSchoolIds.length) await db.from('schools').delete().in('id', createdSchoolIds)
  if (createdTeacherIds.length) await db.from('teachers').delete().in('id', createdTeacherIds)
  for (const id of createdUserIds) await db.auth.admin.deleteUser(id)
})

/** Gives a synthetic teacher a real school + active teacher membership. */
async function attachToSchool(authId: string, label: string): Promise<string> {
  const { data: school, error } = await db
    .from('schools')
    .insert({ school_name: `${SYNTHETIC_MARKER}_${label}_${Date.now()}` })
    .select('id')
    .single()
  if (error || !school) throw new Error(`school insert failed: ${error?.message}`)
  createdSchoolIds.push(school.id)
  const { error: memberErr } = await db
    .from('school_users')
    .insert({ school_id: school.id, user_id: authId, role: 'teacher', is_active: true })
  if (memberErr) throw new Error(`membership insert failed: ${memberErr.message}`)
  return school.id
}

test('POST /api/teacher/classes creates NO school for a teacher with no membership', async () => {
  const teacher = await createSyntheticTeacher('class-create')
  createdUserIds.push(teacher.authId)
  createdTeacherIds.push(teacher.teacherId)

  const { count: schoolsBefore } = await db.from('schools').select('id', { count: 'exact', head: true })

  const res = await fetch(`${BASE_URL}/api/teacher/classes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: teacher.session.cookieHeader },
    body: JSON.stringify({ name: SYNTHETIC_MARKER, grade: 8, subject: 'Mathematics', academic_year: '2026' }),
  })
  assert.equal(res.status, 201, 'a Solo Teacher can still create their private class')
  const body = await res.json()
  createdClassIds.push(body.data.class.id)

  assert.equal(body.data.class.school_id, null, 'a private class with no institution behind it is school-less')

  const { count: schoolsAfter } = await db.from('schools').select('id', { count: 'exact', head: true })
  assert.equal(schoolsAfter, schoolsBefore, 'no school was manufactured')

  // And no school_admin membership was conjured for them anywhere.
  const { data: memberships } = await db.from('school_users').select('id').eq('user_id', teacher.authId)
  assert.equal(memberships!.length, 0, 'no membership — least of all school_admin — was created')
})

test('POST /api/teacher/classes stamps the REAL school for a teacher who has one', async () => {
  const teacher = await createSyntheticTeacher('class-create-member')
  createdUserIds.push(teacher.authId)
  createdTeacherIds.push(teacher.teacherId)
  const schoolId = await attachToSchool(teacher.authId, 'member')

  const { count: schoolsBefore } = await db.from('schools').select('id', { count: 'exact', head: true })

  const res = await fetch(`${BASE_URL}/api/teacher/classes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: teacher.session.cookieHeader },
    body: JSON.stringify({ name: SYNTHETIC_MARKER, grade: 8, subject: 'Mathematics', academic_year: '2026' }),
  })
  assert.equal(res.status, 201)
  const body = await res.json()
  createdClassIds.push(body.data.class.id)

  assert.equal(body.data.class.school_id, schoolId, 'the class adopts the school that actually employs them')

  const { count: schoolsAfter } = await db.from('schools').select('id', { count: 'exact', head: true })
  assert.equal(schoolsAfter, schoolsBefore, 'and still creates nothing new')
})

test('a second class from the same teacher reuses the same resolved school', async () => {
  const teacher = await createSyntheticTeacher('second-class')
  createdUserIds.push(teacher.authId)
  createdTeacherIds.push(teacher.teacherId)
  const schoolId = await attachToSchool(teacher.authId, 'second')

  const create = () => fetch(`${BASE_URL}/api/teacher/classes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: teacher.session.cookieHeader },
    body: JSON.stringify({ name: SYNTHETIC_MARKER, grade: 9, subject: 'English', academic_year: '2026' }),
  })

  const first = await (await create()).json()
  const second = await (await create()).json()
  createdClassIds.push(first.data.class.id, second.data.class.id)

  assert.equal(first.data.class.school_id, schoolId)
  assert.equal(second.data.class.school_id, first.data.class.school_id, 'second class must reuse the same school, not provision a new one')
})

test('a teacher-enrolled learner receives the class school_id', async () => {
  const teacher = await createSyntheticTeacher('enroll-learner')
  createdUserIds.push(teacher.authId)
  createdTeacherIds.push(teacher.teacherId)
  await attachToSchool(teacher.authId, 'enroll')

  const classRes = await fetch(`${BASE_URL}/api/teacher/classes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: teacher.session.cookieHeader },
    body: JSON.stringify({ name: SYNTHETIC_MARKER, grade: 7, subject: 'Science', academic_year: '2026' }),
  })
  const cls = (await classRes.json()).data.class
  createdClassIds.push(cls.id)
  assert.ok(cls.school_id, 'fixture: this teacher genuinely has a school')

  const studentRes = await fetch(`${BASE_URL}/api/teacher/classes/${cls.id}/students`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: teacher.session.cookieHeader },
    body: JSON.stringify({ students: [{ name: `${SYNTHETIC_MARKER} Learner`, grade: 7 }] }),
  })
  assert.equal(studentRes.status, 201)
  const studentBody = (await studentRes.json()).data
  assert.equal(studentBody.created, 1)
  const studentId = studentBody.results[0].studentId
  createdStudentIds.push(studentId)

  const { data: studentRow } = await db.from('students').select('school_id').eq('id', studentId).single()
  assert.equal(studentRow?.school_id, cls.school_id, 'the new learner must carry the exact same school_id as its class')
})

test('adding a learner to an historical school-less class repairs the class and stamps the learner consistently', async () => {
  const teacher = await createSyntheticTeacher('historical-repair')
  createdUserIds.push(teacher.authId)
  createdTeacherIds.push(teacher.teacherId)
  const schoolId = await attachToSchool(teacher.authId, 'historical')

  // Simulate a class created before Phase 0 shipped — school_id explicitly NULL.
  const { data: historicalClass } = await db
    .from('teacher_classes')
    .insert({ teacher_id: teacher.teacherId, name: SYNTHETIC_MARKER, grade: 8, subject: 'Kiswahili', class_code: `SYNTH-HIST-${Date.now()}`, school_id: null })
    .select('id')
    .single()
  createdClassIds.push(historicalClass!.id)

  const studentRes = await fetch(`${BASE_URL}/api/teacher/classes/${historicalClass!.id}/students`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: teacher.session.cookieHeader },
    body: JSON.stringify({ students: [{ name: `${SYNTHETIC_MARKER} Historical Learner`, grade: 8 }] }),
  })
  assert.equal(studentRes.status, 201)
  const studentId = (await studentRes.json()).data.results[0].studentId
  createdStudentIds.push(studentId)

  const { data: repairedClass } = await db.from('teacher_classes').select('school_id').eq('id', historicalClass!.id).single()
  assert.equal(repairedClass?.school_id, schoolId, 'the historical class is repaired with the teacher\'s REAL school')

  const { data: studentRow } = await db.from('students').select('school_id').eq('id', studentId).single()
  assert.equal(studentRow?.school_id, repairedClass?.school_id, 'the learner must match the repaired class exactly')

  const { count } = await db.from('schools').select('id', { count: 'exact', head: true }).eq('created_by', teacher.authId)
  assert.equal(count, 0, 'the repair adopts an existing school — it never creates one')
})

test('adding a learner to an historical class leaves it school-less when the teacher has no school', async () => {
  // The corrected boundary. Previously this path invented a school so the
  // column could be filled; now an honest NULL survives, because a Solo
  // Teacher's private roster has no institution behind it.
  const teacher = await createSyntheticTeacher('historical-no-school')
  createdUserIds.push(teacher.authId)
  createdTeacherIds.push(teacher.teacherId)

  const { data: historicalClass } = await db
    .from('teacher_classes')
    .insert({ teacher_id: teacher.teacherId, name: SYNTHETIC_MARKER, grade: 8, subject: 'Kiswahili', class_code: `SYNTH-HIST2-${Date.now()}`, school_id: null })
    .select('id')
    .single()
  createdClassIds.push(historicalClass!.id)

  const { count: schoolsBefore } = await db.from('schools').select('id', { count: 'exact', head: true })

  const studentRes = await fetch(`${BASE_URL}/api/teacher/classes/${historicalClass!.id}/students`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: teacher.session.cookieHeader },
    body: JSON.stringify({ students: [{ name: `${SYNTHETIC_MARKER} Solo Learner`, grade: 8 }] }),
  })
  assert.equal(studentRes.status, 201, 'the operation still succeeds — it is not blocked, just not inflated')
  const studentId = (await studentRes.json()).data.results[0].studentId
  createdStudentIds.push(studentId)

  const { count: schoolsAfter } = await db.from('schools').select('id', { count: 'exact', head: true })
  assert.equal(schoolsAfter, schoolsBefore, 'no school was manufactured to fill the column')

  const { data: cls } = await db.from('teacher_classes').select('school_id').eq('id', historicalClass!.id).single()
  assert.equal(cls?.school_id, null)
  const { data: studentRow } = await db.from('students').select('school_id').eq('id', studentId).single()
  assert.equal(studentRow?.school_id, null, 'learner and class agree: both school-less')
})

test('consumer/self-serve student creation (app/api/students/create) remains unchanged and school-less', async () => {
  const teacher = await createSyntheticTeacher('consumer-unaffected')
  createdUserIds.push(teacher.authId)
  createdTeacherIds.push(teacher.teacherId)

  const res = await fetch(`${BASE_URL}/api/students/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: teacher.session.cookieHeader },
    body: JSON.stringify({ name: `${SYNTHETIC_MARKER} Consumer`, grade: 9 }),
  })
  assert.equal(res.status, 201)
  const student = (await res.json()).data.student
  createdStudentIds.push(student.id)
  assert.equal(student.school_id, null, 'consumer/self-serve students must remain school-less by design — out of Phase 0 scope')
})
