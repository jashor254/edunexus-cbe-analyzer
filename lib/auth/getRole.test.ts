// lib/auth/getRole.test.ts
// Sprint 10G — integration tests for getSchoolAdminMembership() against real
// (synthetic, cleaned-up) rows, following the convention established in
// lib/core/permissions.test.ts.
// Run: npx tsx --env-file=.env.local --test lib/auth/getRole.test.ts
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createTestServiceClient as createServiceClient } from '@/utils/supabase/test-service'
import { repos } from '@/lib/repositories'
import { getSchoolAdminMembership } from '@/lib/auth/getRole'
import { deleteAuthUserOrThrow } from '@/lib/testing/deleteAuthUserOrThrow'

const SYNTHETIC_MARKER = 'SYNTHETIC_10G_GETROLE_TEST'
const db = createServiceClient()

let schoolId: string
let headteacherUserId: string
let teacherUserId: string
let inactiveAdminUserId: string
let outsiderUserId: string

before(async () => {
  const mkUser = async (label: string) => {
    const email = `getrole-test-${label}-${Date.now()}@example.com`
    const { data } = await db.auth.admin.createUser({ email, password: 'Test!12345678', email_confirm: true })
    return data!.user.id
  }

  headteacherUserId = await mkUser('headteacher')
  teacherUserId = await mkUser('teacher')
  inactiveAdminUserId = await mkUser('inactive-admin')
  outsiderUserId = await mkUser('outsider')

  const school = await repos.schools.create({ school_name: `${SYNTHETIC_MARKER}-school` }, headteacherUserId)
  schoolId = school.id

  await db.from('school_users').insert([
    { school_id: schoolId, user_id: headteacherUserId, role: 'headteacher', is_active: true },
    { school_id: schoolId, user_id: teacherUserId, role: 'teacher', is_active: true },
    { school_id: schoolId, user_id: inactiveAdminUserId, role: 'school_admin', is_active: false },
  ])
})

after(async () => {
  await db.from('school_users').delete().eq('school_id', schoolId)
  await db.from('schools').delete().eq('id', schoolId)
  for (const id of [headteacherUserId, teacherUserId, inactiveAdminUserId, outsiderUserId]) {
    await deleteAuthUserOrThrow(db, id)
  }
})

test('getSchoolAdminMembership resolves for an active admin-tier member', async () => {
  const membership = await getSchoolAdminMembership(headteacherUserId, db)
  assert.ok(membership)
  assert.equal(membership!.schoolId, schoolId)
  assert.equal(membership!.role, 'headteacher')
})

test('getSchoolAdminMembership returns null for a teacher-tier member', async () => {
  const membership = await getSchoolAdminMembership(teacherUserId, db)
  assert.equal(membership, null)
})

test('getSchoolAdminMembership returns null for a deactivated admin-tier membership', async () => {
  const membership = await getSchoolAdminMembership(inactiveAdminUserId, db)
  assert.equal(membership, null)
})

test('getSchoolAdminMembership returns null for a user with no school membership', async () => {
  const membership = await getSchoolAdminMembership(outsiderUserId, db)
  assert.equal(membership, null)
})
