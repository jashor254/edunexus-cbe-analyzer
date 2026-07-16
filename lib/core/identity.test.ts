// lib/core/identity.test.ts
// Integration tests against real (synthetic, cleaned-up) rows, following the
// convention established in lib/holiday/notify.test.ts.
// Run with: npx tsx --env-file=.env.local --test lib/core/identity.test.ts
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createServiceClient } from '@/utils/supabase/service'
import { repos } from '@/lib/repositories'
import {
  resolveTeacher,
  resolveStudent,
  resolveParent,
  resolveMembership,
  resolveSchool,
} from '@/lib/core/identity'
import { IdentityResolutionError } from '@/lib/core/errors'

const SYNTHETIC_MARKER = 'SYNTHETIC_IDENTITY_TEST'
const db = createServiceClient()

let teacherUserId: string
let teacherId: string
let studentUserId: string
let studentId: string
let parentUserId: string
let schoolId: string
let adminUserId: string

before(async () => {
  const mkUser = async (label: string) => {
    const { data } = await db.auth.admin.createUser({
      email: `identity-test-${label}-${Date.now()}@example.com`,
      password: `Test!${Math.random().toString(36).slice(2, 10)}`,
      email_confirm: true,
    })
    return data!.user.id
  }

  teacherUserId = await mkUser('teacher')
  studentUserId = await mkUser('student')
  parentUserId = await mkUser('parent')
  adminUserId = await mkUser('admin')

  const { data: teacher } = await db
    .from('teachers')
    .insert({ user_id: teacherUserId, full_name: SYNTHETIC_MARKER, school: SYNTHETIC_MARKER })
    .select('id')
    .single()
  teacherId = teacher!.id

  const { data: student } = await db
    .from('students')
    .insert({
      user_id: studentUserId,
      parent_user_id: parentUserId,
      teacher_id: teacherId,
      name: SYNTHETIC_MARKER,
      grade: 8,
      level: 'Junior',
      school: SYNTHETIC_MARKER,
      added_by: 'teacher',
    })
    .select('id')
    .single()
  studentId = student!.id

  const school = await repos.schools.create({ school_name: `${SYNTHETIC_MARKER}-school` }, adminUserId)
  schoolId = school.id
  await db.from('school_users').insert({ school_id: schoolId, user_id: adminUserId, role: 'school_admin', is_active: true })
})

after(async () => {
  await db.from('school_users').delete().eq('school_id', schoolId)
  await db.from('schools').delete().eq('id', schoolId)
  await db.from('students').delete().eq('id', studentId)
  await db.from('teachers').delete().eq('id', teacherId)
  for (const id of [teacherUserId, studentUserId, parentUserId, adminUserId]) {
    await db.auth.admin.deleteUser(id)
  }
})

test('resolveTeacher returns the teacher row for a known teacher user', async () => {
  const teacher = await resolveTeacher(teacherUserId)
  assert.ok(teacher)
  assert.equal(teacher!.id, teacherId)
  assert.equal(teacher!.fullName, SYNTHETIC_MARKER)
})

test('resolveTeacher returns null for a user with no teacher row', async () => {
  const teacher = await resolveTeacher(studentUserId)
  assert.equal(teacher, null)
})

test('resolveStudent returns the student row for a known student user', async () => {
  const student = await resolveStudent(studentUserId)
  assert.ok(student)
  assert.equal(student!.id, studentId)
})

test('resolveStudent returns null for a user with no student row', async () => {
  const student = await resolveStudent(teacherUserId)
  assert.equal(student, null)
})

test('resolveParent finds the legacy students.parent_user_id link', async () => {
  const parent = await resolveParent(parentUserId)
  assert.ok(parent.studentIds.includes(studentId))
})

test('resolveParent returns empty arrays for a user who is not a parent of anyone', async () => {
  const parent = await resolveParent(teacherUserId)
  assert.equal(parent.studentIds.length, 0)
  assert.equal(parent.coreLearnerIds.length, 0)
})

test('resolveMembership returns the active school_users row for an admin', async () => {
  const membership = await resolveMembership(adminUserId, schoolId)
  assert.ok(membership)
  assert.equal(membership!.role, 'school_admin')
  assert.equal(membership!.isActive, true)
})

test('resolveMembership returns null for a user with no membership in the school', async () => {
  const membership = await resolveMembership(teacherUserId, schoolId)
  assert.equal(membership, null)
})

test('resolveSchool resolves a known school', async () => {
  const school = await resolveSchool(schoolId)
  assert.equal(school.id, schoolId)
  assert.equal(school.isActive, true)
})

test('resolveSchool throws IdentityResolutionError for an unknown school', async () => {
  await assert.rejects(
    () => resolveSchool('00000000-0000-0000-0000-000000000000'),
    IdentityResolutionError
  )
})
