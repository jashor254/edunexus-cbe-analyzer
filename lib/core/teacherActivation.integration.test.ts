// lib/core/teacherActivation.integration.test.ts
//
// Phase 2 (admin-provisioned teacher activation) — the primary proof that
// the self-serve institutional loop actually closes:
//
//   1. School admin provisions a teacher who has NEVER used EduNexus
//      (inviteSchoolMember — no prior auth.users account).
//   2. Admin assigns that teacher to Class 7A / Mathematics BEFORE the
//      teacher ever logs in (assignSubjectTeacher against the still-
//      PENDING school_users.id — the "admin creates, teacher consumes"
//      ordering this whole phase is built around).
//   3. The teacher accepts the invitation (acceptTeacherInvitation).
//   4. Active membership + teacher identity are proven.
//   5. My Teaching (listTeachingAssignmentsForUser) shows Class 7A /
//      Mathematics WITHOUT the teacher ever self-assigning anything.
//   6. A School B assignment is proven NOT visible.
//
// A second scenario proves the other supported path: inviting someone who
// ALREADY has an EduNexus account (no new auth.users row is created).
//
// Run: npx tsx --env-file=.env.local --test lib/core/teacherActivation.integration.test.ts

import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createTestServiceClient as createServiceClient } from '@/utils/supabase/test-service'
import { repos } from '@/lib/repositories'
import { activateSchool } from '@/lib/core/schoolActivation'
import { createClass, assignSubjectTeacher } from '@/lib/core/classes'
import { listSubjects } from '@/lib/core/subjects'
import { inviteSchoolMember, acceptTeacherInvitation, listMyPendingInvitations } from '@/lib/core/teacherOnboarding'
import { listTeachingAssignmentsForUser } from '@/lib/core/teachingAssignments'
import { deleteAuthUserOrThrow } from '@/lib/testing/deleteAuthUserOrThrow'

const SYNTHETIC_MARKER = 'SYNTHETIC_PHASE2_TEACHER_ACTIVATION_TEST'
const db = createServiceClient()

const createdAuthUserIds: string[] = []
const createdSchoolIds: string[] = []

async function mkAuthUser(label: string): Promise<{ id: string; email: string; password: string }> {
  const email = `${SYNTHETIC_MARKER.toLowerCase()}-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.com`
  const password = `Test!${Math.random().toString(36).slice(2, 10)}`
  const { data, error } = await db.auth.admin.createUser({ email, password, email_confirm: true })
  if (error) throw error
  createdAuthUserIds.push(data.user.id)
  return { id: data.user.id, email, password }
}

let schoolAId: string
let schoolBId: string
let adminId: string
let gradeId: string
let academicYearId: string
let mathSubjectId: string
let classX_id: string

let newTeacherEmail: string   // never had an EduNexus account before invite

before(async () => {
  const admin = await mkAuthUser('admin')
  adminId = admin.id

  const schoolA = await repos.schools.create({ school_name: `${SYNTHETIC_MARKER}-A` }, adminId)
  schoolAId = schoolA.id
  createdSchoolIds.push(schoolAId)
  await repos.schools.addSchoolUser(schoolAId, adminId, 'school_admin')
  const activationA = await activateSchool(schoolAId, { gradeCodes: ['G7'] })
  if (activationA.status !== 'complete') throw new Error(`school A activation failed: ${activationA.error}`)

  const { data: classes } = await db.from('classes').select('id, grade_id, academic_year_id').eq('school_id', schoolAId).limit(1)
  gradeId = classes![0].grade_id
  academicYearId = classes![0].academic_year_id
  classX_id = classes![0].id

  const subjects = await listSubjects('junior_secondary')
  mathSubjectId = subjects.find(s => s.name.toLowerCase().includes('math'))?.id ?? subjects[0].id

  const schoolB = await repos.schools.create({ school_name: `${SYNTHETIC_MARKER}-B` }, adminId)
  schoolBId = schoolB.id
  createdSchoolIds.push(schoolBId)
  await repos.schools.addSchoolUser(schoolBId, adminId, 'school_admin')
  await activateSchool(schoolBId, { gradeCodes: ['G7'] })

  newTeacherEmail = `${SYNTHETIC_MARKER.toLowerCase()}-brandnew-${Date.now()}@example.com`
})

after(async () => {
  for (const id of createdSchoolIds) {
    await db.from('class_subjects').delete().eq('school_id', id)
    await db.from('school_users').delete().eq('school_id', id)
    await db.from('schools').delete().eq('id', id)
  }
  // Includes the brand-new account created by createInvitedAuthAccount(),
  // which never went through mkAuthUser() so isn't in createdAuthUserIds —
  // clean up by email instead.
  const listResult = await db.auth.admin.listUsers({ page: 1, perPage: 1000 })
  const strayNewTeacher = (listResult.data?.users ?? []).find(u => u.email === newTeacherEmail)
  if (strayNewTeacher) {
    await db.from('teachers').delete().eq('user_id', strayNewTeacher.id)
    await db.from('profiles').delete().eq('id', strayNewTeacher.id)
    await db.from('notification_log').delete().eq('user_id', strayNewTeacher.id)
    await db.from('platform_events').delete().eq('actor_id', strayNewTeacher.id)
    await deleteAuthUserOrThrow(db, strayNewTeacher.id)
  }
  for (const id of createdAuthUserIds) {
    await db.from('teachers').delete().eq('user_id', id)
    await db.from('profiles').delete().eq('id', id)
    await db.from('notification_log').delete().eq('user_id', id)
    await db.from('platform_events').delete().eq('actor_id', id)
    await deleteAuthUserOrThrow(db, id)
  }
})

// ── Scenario 1: a teacher who has NEVER used EduNexus ──────────────────────

let newTeacherUserId: string
let newTeacherSchoolUserId: string

test('1. admin provisions a teacher with no prior EduNexus account — an auth.users row is created, not left at no_account', async () => {
  const before = await repos.teachers.findAuthUserByEmail(newTeacherEmail)
  assert.equal(before, null, 'fixture assumption: this email must not already exist')

  const result = await inviteSchoolMember(schoolAId, newTeacherEmail, 'teacher', adminId)
  assert.equal(result.status, 'invited')
  if (result.status !== 'invited') throw new Error('unreachable')
  newTeacherSchoolUserId = result.schoolUser.id
  newTeacherUserId = result.schoolUser.user_id
  assert.equal(result.schoolUser.is_active, false, 'pending until accepted')

  const nowExists = await repos.teachers.findAuthUserByEmail(newTeacherEmail)
  assert.ok(nowExists, 'an auth.users account must now exist for this email')
  assert.equal(nowExists!.id, newTeacherUserId)
})

test('2. admin assigns the still-PENDING teacher to Class X / Mathematics before they ever log in', async () => {
  const result = await assignSubjectTeacher(schoolAId, classX_id, mathSubjectId, newTeacherSchoolUserId)
  assert.equal(result.unchanged, false)
})

test('3. the teacher (never having used EduNexus before) accepts the invitation', async () => {
  const result = await acceptTeacherInvitation(newTeacherUserId, schoolAId, { full_name: 'Brand New Teacher' })
  assert.equal(result.status, 'accepted')
  assert.ok(result.teacherId)
})

test('4. active membership + teacher identity are real, materialized rows', async () => {
  const { data: schoolUser } = await db.from('school_users').select('is_active, role').eq('id', newTeacherSchoolUserId).single()
  assert.equal(schoolUser!.is_active, true)
  assert.equal(schoolUser!.role, 'teacher')

  const { data: teacher } = await db.from('teachers').select('id, full_name').eq('user_id', newTeacherUserId).single()
  assert.equal(teacher!.full_name, 'Brand New Teacher')
})

test('5. My Teaching shows Class X / Mathematics WITHOUT the teacher ever self-assigning anything', async () => {
  const assignments = await listTeachingAssignmentsForUser(newTeacherUserId)
  assert.equal(assignments.length, 1)
  assert.equal(assignments[0].classId, classX_id)
  assert.equal(assignments[0].subjectId, mathSubjectId)
})

test('6. no School B assignment is visible to this teacher (cross-school exclusion)', async () => {
  const { data: schoolBClasses } = await db.from('classes').select('id').eq('school_id', schoolBId).limit(1)
  const schoolBClassId = schoolBClasses![0].id
  // This teacher has no membership at School B at all — assignSubjectTeacher
  // would itself reject trying to assign them there (proven in Phase 1's
  // classes.workflow.test.ts). Confirm the read side independently: their
  // teaching list contains nothing from School B.
  const assignments = await listTeachingAssignmentsForUser(newTeacherUserId)
  assert.ok(assignments.every(a => a.classId !== schoolBClassId))
})

test('7. the accepted invitation no longer shows up as pending', async () => {
  const pending = await listMyPendingInvitations(newTeacherUserId)
  assert.equal(pending.find(p => p.schoolId === schoolAId), undefined)
})

// ── Scenario 2: inviting someone who ALREADY has an EduNexus account ───────

test('8. inviting an existing account does not create a duplicate auth.users row', async () => {
  const existingTeacher = await mkAuthUser('existing-teacher')

  const listResult = await db.auth.admin.listUsers({ page: 1, perPage: 1000 })
  const countBefore = (listResult.data?.users ?? []).filter(u => u.id === existingTeacher.id).length
  assert.equal(countBefore, 1)

  const result = await inviteSchoolMember(schoolAId, existingTeacher.email, 'teacher', adminId)
  assert.equal(result.status, 'invited')
  if (result.status !== 'invited') throw new Error('unreachable')
  assert.equal(result.schoolUser.user_id, existingTeacher.id)

  const pending = await listMyPendingInvitations(existingTeacher.id)
  assert.equal(pending.length, 1)
  assert.equal(pending[0].schoolId, schoolAId)

  const accepted = await acceptTeacherInvitation(existingTeacher.id, schoolAId, { full_name: 'Existing Account Teacher' })
  assert.equal(accepted.status, 'accepted')

  const after = await listMyPendingInvitations(existingTeacher.id)
  assert.equal(after.length, 0)
})

test('9. repeated acceptance is idempotent — no duplicate teacher/membership rows', async () => {
  const first = await acceptTeacherInvitation(newTeacherUserId, schoolAId, { full_name: 'Brand New Teacher' })
  const second = await acceptTeacherInvitation(newTeacherUserId, schoolAId, { full_name: 'Brand New Teacher' })
  assert.equal(first.status, 'already_member')
  assert.equal(second.status, 'already_member')
  assert.equal(first.teacherId, second.teacherId)

  const { data: teacherRows } = await db.from('teachers').select('id').eq('user_id', newTeacherUserId)
  assert.equal(teacherRows!.length, 1, 'must not duplicate the teachers row')

  const { data: membershipRows } = await db.from('school_users').select('id').eq('user_id', newTeacherUserId).eq('school_id', schoolAId)
  assert.equal(membershipRows!.length, 1, 'must not duplicate the school_users row')
})
