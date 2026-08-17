// lib/promotions/promote.integration.test.ts
//
// Phase A integration proof against real (synthetic, cleaned up) data —
// verifying archival-not-deletion, append-only promotion history, and that
// a promotion never touches the old class_students row, per
// docs/architecture/academic-evidence-layer.md §2.
//
// ⚠️ Creates one real (throwaway) auth.users account and legacy
// teachers/students/teacher_classes rows, all deleted in `after()`,
// including on failure.
//
// Run: npx tsx --env-file=.env.local --test lib/promotions/promote.integration.test.ts
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createTestServiceClient as createServiceClient } from '@/utils/supabase/test-service'
import { promoteStudent, archiveClassForYearEnd, getPromotionHistory } from './promote'
import { deleteAuthUserOrThrow } from '@/lib/testing/deleteAuthUserOrThrow'

const SYNTHETIC_MARKER = 'SYNTHETIC_PROMOTION_TEST'
const db = createServiceClient()

let authUserId: string
let teacherId: string
let studentId: string
let oldClassId: string
let newClassId: string

before(async () => {
  const { data: authUser, error: authErr } = await db.auth.admin.createUser({
    email: `promotion-test-${Date.now()}@example.com`,
    password: `Test!${Math.random().toString(36).slice(2, 10)}`,
    email_confirm: true,
  })
  if (authErr) throw authErr
  authUserId = authUser.user.id

  const { data: teacher, error: teacherErr } = await db
    .from('teachers')
    .insert({ user_id: authUserId, full_name: SYNTHETIC_MARKER, school: SYNTHETIC_MARKER })
    .select('id')
    .single()
  if (teacherErr) throw teacherErr
  teacherId = teacher.id

  const { data: student, error: studentErr } = await db
    .from('students')
    .insert({ teacher_id: teacherId, name: SYNTHETIC_MARKER, grade: 7, level: 'Junior', school: SYNTHETIC_MARKER, added_by: 'teacher' })
    .select('id')
    .single()
  if (studentErr) throw studentErr
  studentId = student.id

  const { data: oldClass, error: oldClassErr } = await db
    .from('teacher_classes')
    .insert({ teacher_id: teacherId, name: SYNTHETIC_MARKER, grade: 7, subject: 'Mathematics', academic_year: '2026', class_code: `PROMO-OLD-${Date.now()}` })
    .select('id')
    .single()
  if (oldClassErr) throw oldClassErr
  oldClassId = oldClass.id

  const { data: newClass, error: newClassErr } = await db
    .from('teacher_classes')
    .insert({ teacher_id: teacherId, name: SYNTHETIC_MARKER, grade: 8, subject: 'Mathematics', academic_year: '2027', class_code: `PROMO-NEW-${Date.now()}` })
    .select('id')
    .single()
  if (newClassErr) throw newClassErr
  newClassId = newClass.id

  const { error: membershipErr } = await db.from('class_students').insert({ class_id: oldClassId, student_id: studentId })
  if (membershipErr) throw membershipErr
})

after(async () => {
  await db.from('student_promotions').delete().eq('student_id', studentId)
  await db.from('class_students').delete().in('class_id', [oldClassId, newClassId])
  await db.from('teacher_classes').delete().in('id', [oldClassId, newClassId])
  await db.from('students').delete().eq('id', studentId)
  await db.from('teachers').delete().eq('id', teacherId)
  await deleteAuthUserOrThrow(db, authUserId)
  console.log('[cleanup] synthetic promotion fixtures removed')
})

test('archiving a class sets status/archived_at and does not delete the row or its membership', async () => {
  await archiveClassForYearEnd(oldClassId, teacherId)

  const { data: cls, error } = await db.from('teacher_classes').select('status, archived_at').eq('id', oldClassId).single()
  if (error) throw error
  assert.equal(cls.status, 'archived')
  assert.ok(cls.archived_at !== null)

  const { data: membership, error: membershipErr } = await db
    .from('class_students')
    .select('id')
    .eq('class_id', oldClassId)
    .eq('student_id', studentId)
  if (membershipErr) throw membershipErr
  assert.equal(membership!.length, 1, 'membership in the archived class must survive — it is history, not deleted')
})

test('promoting a student records an append-only event, bumps grade, and enrolls in the new class without removing the old membership', async () => {
  const promotion = await promoteStudent({
    studentId,
    toGrade: 8,
    fromClassId: oldClassId,
    toClassId: newClassId,
    academicYear: '2027',
    promotedBy: authUserId,
    notes: 'Promoted at year-end',
  })

  assert.equal(promotion.from_grade, 7)
  assert.equal(promotion.to_grade, 8)
  assert.equal(promotion.from_class_id, oldClassId)
  assert.equal(promotion.to_class_id, newClassId)
  assert.equal(promotion.promoted_by, authUserId)

  const { data: student, error } = await db.from('students').select('grade').eq('id', studentId).single()
  if (error) throw error
  assert.equal(student.grade, 8, 'students.grade must reflect the new grade')

  const { data: newMembership, error: newMembershipErr } = await db
    .from('class_students')
    .select('id')
    .eq('class_id', newClassId)
    .eq('student_id', studentId)
  if (newMembershipErr) throw newMembershipErr
  assert.equal(newMembership!.length, 1, 'student must be enrolled in the new class')

  const { data: oldMembership, error: oldMembershipErr } = await db
    .from('class_students')
    .select('id')
    .eq('class_id', oldClassId)
    .eq('student_id', studentId)
  if (oldMembershipErr) throw oldMembershipErr
  assert.equal(oldMembership!.length, 1, 'old class membership must NOT be removed by promotion — it is permanent history (Rule 2)')

  const history = await getPromotionHistory(studentId)
  assert.equal(history.length, 1)
  assert.equal(history[0].id, promotion.id)
})

test('a promotion with no class context (toClassId null) still records the grade change', async () => {
  const promotion = await promoteStudent({
    studentId,
    toGrade: 9,
    academicYear: '2028',
    promotedBy: authUserId,
  })
  assert.equal(promotion.to_class_id, null)
  assert.equal(promotion.from_grade, 8, 'from_grade must reflect the grade set by the PREVIOUS promotion test, not the original fixture value — history is cumulative')

  const { data: student, error } = await db.from('students').select('grade').eq('id', studentId).single()
  if (error) throw error
  assert.equal(student.grade, 9)

  const history = await getPromotionHistory(studentId)
  assert.equal(history.length, 2, 'both promotions must be queryable — nothing overwrites the earlier one')
})
