// app/api/teacher/classes/teacherAddStudentPathway.http.integration.test.ts
//
// Learner Pathway Contract Fix — proves the teacher-add-student route
// (app/api/teacher/classes/[classId]/students/route.ts — the second, and
// only other, live write path to students.current_pathway) accepts every
// canonical SENIOR_PATHWAYS value end-to-end, now that both this route's Zod
// schema and the live students_current_pathway_check constraint are wired to
// the same lib/curriculum/subjects.ts source of truth. Lives outside the
// bracketed `[classId]` directory because Node's test runner silently
// registers 0 tests for bracket-path files (same issue hit and worked around
// in the Error-Handling Trust Fix's schemes/[id] test).
//
// Requires a server already running at LMS_TEST_BASE_URL (default
// http://localhost:3939).
//
// Run: LMS_TEST_BASE_URL=http://localhost:3939 npx tsx --env-file=.env.local --test app/api/teacher/classes/teacherAddStudentPathway.http.integration.test.ts
import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { createServiceClient } from '@/utils/supabase/service'
import { signInForHttpTest, type SyntheticSession } from '@/lib/testing/httpAuthTestHelper'
import { SENIOR_PATHWAYS } from '@/lib/curriculum/subjects'

const BASE_URL = process.env.LMS_TEST_BASE_URL ?? 'http://localhost:3939'
const SYNTHETIC_MARKER = 'SYNTHETIC_TEACHER_ADD_STUDENT_PATHWAY_TEST'
const db = createServiceClient()

async function retryAsync<T>(fn: () => Promise<T>, attempts = 6): Promise<T> {
  let lastError: unknown
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try { return await fn() } catch (err) { lastError = err }
    await new Promise(resolve => setTimeout(resolve, 500 * attempt))
  }
  throw lastError
}

async function createSyntheticTeacherWithClass(): Promise<{ authId: string; teacherId: string; classId: string; session: SyntheticSession }> {
  const email = `${SYNTHETIC_MARKER.toLowerCase()}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.com`
  const password = `Test!${Math.random().toString(36).slice(2, 10)}`
  const { data } = await retryAsync(async () => {
    const res = await db.auth.admin.createUser({ email, password, email_confirm: true })
    if (res.error) throw res.error
    return res
  })
  const session = await retryAsync(() => signInForHttpTest(email, password))
  const { data: teacherRow } = await db
    .from('teachers')
    .insert({ user_id: data.user.id, full_name: SYNTHETIC_MARKER, school: SYNTHETIC_MARKER })
    .select('id')
    .single()
  const { data: classRow } = await db
    .from('teacher_classes')
    .insert({ teacher_id: teacherRow!.id, name: SYNTHETIC_MARKER, grade: 11, subject: 'Mathematics', class_code: `SYNTH-PATH-${Date.now()}` })
    .select('id')
    .single()
  return { authId: data.user.id, teacherId: teacherRow!.id, classId: classRow!.id, session }
}

const createdUserIds: string[] = []
const createdTeacherIds: string[] = []
const createdClassIds: string[] = []
const createdStudentIds: string[] = []

after(async () => {
  if (createdStudentIds.length) await db.from('class_students').delete().in('student_id', createdStudentIds)
  if (createdStudentIds.length) await db.from('students').delete().in('id', createdStudentIds)
  if (createdClassIds.length) await db.from('teacher_classes').delete().in('id', createdClassIds)
  if (createdTeacherIds.length) await db.from('teachers').delete().in('id', createdTeacherIds)
  for (const id of createdUserIds) await db.auth.admin.deleteUser(id)
})

test('the teacher-add-student route accepts every canonical pathway value, including "Arts & Sports Science"', async () => {
  const teacher = await createSyntheticTeacherWithClass()
  createdUserIds.push(teacher.authId)
  createdTeacherIds.push(teacher.teacherId)
  createdClassIds.push(teacher.classId)

  for (const pathway of SENIOR_PATHWAYS) {
    const res = await fetch(`${BASE_URL}/api/teacher/classes/${teacher.classId}/students`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: teacher.session.cookieHeader },
      body: JSON.stringify({
        students: [{ name: `${SYNTHETIC_MARKER} ${pathway}`, grade: 11, current_pathway: pathway }],
      }),
    })
    assert.equal(res.status, 201, `pathway "${pathway}" must succeed end-to-end via the teacher-add-student route`)
    const body = await res.json()
    const studentId = body.data.results[0].studentId
    createdStudentIds.push(studentId)

    const { data: row } = await db.from('students').select('current_pathway').eq('id', studentId).single()
    assert.equal(row?.current_pathway, pathway)
  }
})
