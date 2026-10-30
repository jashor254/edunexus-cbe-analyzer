// lib/alerts/teacherAlertsOwnership.test.ts
//
// Security audit 2026-10-30, F-05, against a real database with the real
// canonical ownership check (resolveTeacherOwnership): a teacher who does
// not teach a learner cannot raise an alert on them — no student_alerts row
// is written — while the learner's own class teacher still can.
//
// The learner fixture has no parent email/phone, so the (fire-and-forget)
// notification step finds nothing to send and never reaches a provider.
//
// Run with: npm run test:deep (TEST_SUPABASE_* pointed at a disposable stack)
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { createTestServiceClient } from '@/utils/supabase/test-service'
import { createTeacherAlert } from '@/lib/alerts/teacherAlerts'
import { deleteAuthUserOrThrow } from '@/lib/testing/deleteAuthUserOrThrow'

const MARKER = 'SYNTHETIC_TEACHER_ALERTS'
const db = createTestServiceClient()

const createdUsers: string[] = []
let classTeacher: { userId: string; teacherId: string }
let unrelatedTeacher: { userId: string; teacherId: string }
let studentId: string
let classId: string

async function mkTeacher(label: string): Promise<{ userId: string; teacherId: string }> {
  const email = `teacher-alerts-${label}-${Date.now()}-${randomBytes(3).toString('hex')}-synthetic@example.com`
  const { data, error } = await db.auth.admin.createUser({ email, password: `Test!${randomBytes(8).toString('hex')}`, email_confirm: true })
  if (error || !data?.user) throw new Error(`mkTeacher user: ${error?.message}`)
  createdUsers.push(data.user.id)
  const { data: teacher, error: tErr } = await db.from('teachers')
    .insert({ user_id: data.user.id, full_name: `${MARKER} ${label}`, school: MARKER })
    .select('id').single()
  if (tErr || !teacher) throw new Error(`mkTeacher row: ${tErr?.message}`)
  return { userId: data.user.id, teacherId: teacher.id }
}

async function alertCount(): Promise<number> {
  const { data, error } = await db.from('student_alerts').select('id').eq('student_id', studentId)
  if (error) throw new Error(`alertCount: ${error.message}`)
  return data.length
}

before(async () => {
  classTeacher     = await mkTeacher('class')
  unrelatedTeacher = await mkTeacher('unrelated')

  const { data: cls, error: cErr } = await db.from('teacher_classes')
    .insert({ teacher_id: classTeacher.teacherId, name: `${MARKER} 8A`, grade: 8, subject: 'Mathematics', class_code: `SYN${randomBytes(4).toString('hex').toUpperCase()}` })
    .select('id').single()
  if (cErr || !cls) throw new Error(`class fixture: ${cErr?.message}`)
  classId = cls.id

  const { data: student, error: sErr } = await db.from('students')
    .insert({ name: `${MARKER} Learner`, grade: 8, school: MARKER, added_by: 'teacher' })
    .select('id').single()
  if (sErr || !student) throw new Error(`student fixture: ${sErr?.message}`)
  studentId = student.id

  const { error: rErr } = await db.from('class_students').insert({ class_id: classId, student_id: studentId })
  if (rErr) throw new Error(`roster fixture: ${rErr.message}`)
})

after(async () => {
  if (studentId) {
    for (const [table, column] of [['student_alerts', 'student_id'], ['class_students', 'student_id'], ['students', 'id']] as const) {
      const { error } = await db.from(table).delete().eq(column, studentId)
      if (error) throw new Error(`cleanup ${table}: ${error.message}`)
    }
  }
  if (classId) {
    const { error } = await db.from('teacher_classes').delete().eq('id', classId)
    if (error) throw new Error(`cleanup teacher_classes: ${error.message}`)
  }
  for (const id of createdUsers) await deleteAuthUserOrThrow(db, id)
})

test('a teacher who does not teach the learner is forbidden and no alert row is written', async () => {
  const result = await createTeacherAlert({
    userId: unrelatedTeacher.userId, teacherId: unrelatedTeacher.teacherId,
    studentId, alertType: 'inactive', message: `${MARKER} unsolicited message`,
  }, { db })
  assert.deepEqual(result, { status: 'forbidden' })
  assert.equal(await alertCount(), 0)
})

test("an unrelated teacher cannot borrow the class teacher's teacher id", async () => {
  const result = await createTeacherAlert({
    userId: unrelatedTeacher.userId, teacherId: classTeacher.teacherId,
    studentId, alertType: 'inactive', message: `${MARKER} spoofed teacher id`,
  }, { db })
  assert.deepEqual(result, { status: 'forbidden' })
  assert.equal(await alertCount(), 0)
})

test('the class teacher can still raise an alert on their own learner', async () => {
  const result = await createTeacherAlert({
    userId: classTeacher.userId, teacherId: classTeacher.teacherId,
    studentId, alertType: 'inactive', message: `${MARKER} legitimate alert`,
  }, { db })
  assert.equal(result.status, 'created')
  assert.equal(await alertCount(), 1)
})
