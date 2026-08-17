// lib/core/permissions.test.ts
// Integration tests against real (synthetic, cleaned-up) rows and real
// authenticated sessions (needed to exercise `requireAuthentication` and
// friends, which take a session-bound SupabaseClient, not a bare userId).
// Run with: npx tsx --env-file=.env.local --test lib/core/permissions.test.ts
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { createTestServiceClient as createServiceClient } from '@/utils/supabase/test-service'
import { repos } from '@/lib/repositories'
import {
  requireAuthentication,
  requireSchoolMembership,
  requireSchoolAdmin,
  requireSchoolStaff,
  requireClassTeacher,
  canManageAssessment,
  canEditReport,
} from '@/lib/core/permissions'
import { UnauthorizedError, MembershipRequiredError, PermissionDeniedError, ResourceOwnershipError } from '@/lib/core/errors'
import { deleteAuthUserOrThrow } from '@/lib/testing/deleteAuthUserOrThrow'

const SYNTHETIC_MARKER = 'SYNTHETIC_PERMISSIONS_TEST'
const db = createServiceClient()

const PASSWORD = `Test!${Math.random().toString(36).slice(2, 12)}`

async function signInAs(email: string): Promise<SupabaseClient> {
  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
  const { error } = await client.auth.signInWithPassword({ email, password: PASSWORD })
  if (error) throw error
  return client
}

let schoolId: string
let adminUserId: string
let adminEmail: string
let teacherAUserId: string
let teacherAEmail: string
let teacherAId: string
let teacherBUserId: string
let teacherBEmail: string
let outsiderUserId: string
let outsiderEmail: string
let classId: string
let otherSchoolId: string
let otherSchoolAdminUserId: string
let otherSchoolAdminEmail: string

before(async () => {
  // db.auth.admin.createUser is observed in this environment to
  // intermittently fail (a transient Supabase auth-layer flake, reproduced
  // with a minimal standalone script containing zero application code —
  // see lib/core/schoolUsersRlsRegression.integration.test.ts's header)
  // — retried rather than allowed to crash fixture setup.
  const mkUser = async (label: string) => {
    const email = `perm-test-${label}-${Date.now()}@example.com`
    let lastError: unknown
    for (let attempt = 1; attempt <= 6; attempt++) {
      try {
        const { data, error } = await db.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true })
        if (!error) return { id: data.user.id, email }
        lastError = error
      } catch (err) {
        lastError = err
      }
      await new Promise(resolve => setTimeout(resolve, 500 * attempt))
    }
    throw lastError
  }

  const admin = await mkUser('admin')
  adminUserId = admin.id; adminEmail = admin.email

  const teacherA = await mkUser('teacher-a')
  teacherAUserId = teacherA.id; teacherAEmail = teacherA.email

  const teacherB = await mkUser('teacher-b')
  teacherBUserId = teacherB.id; teacherBEmail = teacherB.email

  const outsider = await mkUser('outsider')
  outsiderUserId = outsider.id; outsiderEmail = outsider.email

  const otherAdmin = await mkUser('other-school-admin')
  otherSchoolAdminUserId = otherAdmin.id; otherSchoolAdminEmail = otherAdmin.email

  const school = await repos.schools.create({ school_name: `${SYNTHETIC_MARKER}-school` }, adminUserId)
  schoolId = school.id
  await db.from('school_users').insert([
    { school_id: schoolId, user_id: adminUserId, role: 'school_admin', is_active: true },
    { school_id: schoolId, user_id: teacherAUserId, role: 'teacher', is_active: true },
  ])

  const otherSchool = await repos.schools.create({ school_name: `${SYNTHETIC_MARKER}-other-school` }, otherSchoolAdminUserId)
  otherSchoolId = otherSchool.id
  await db.from('school_users').insert([
    { school_id: otherSchoolId, user_id: otherSchoolAdminUserId, role: 'school_admin', is_active: true },
  ])

  const { data: teacherARow } = await db
    .from('teachers')
    .insert({ user_id: teacherAUserId, full_name: SYNTHETIC_MARKER, school: SYNTHETIC_MARKER })
    .select('id')
    .single()
  teacherAId = teacherARow!.id

  await db.from('teachers').insert({ user_id: teacherBUserId, full_name: SYNTHETIC_MARKER, school: SYNTHETIC_MARKER })

  const { data: classRow, error: classError } = await db
    .from('teacher_classes')
    .insert({
      teacher_id: teacherAId,
      name: SYNTHETIC_MARKER,
      grade: 8,
      subject: 'Mathematics',
      class_code: `SYNTH-${Date.now()}`,
    })
    .select('id')
    .single()
  if (classError) throw new Error(`seed teacher_classes failed: ${classError.message}`)
  classId = classRow!.id
})

after(async () => {
  await db.from('teacher_classes').delete().eq('id', classId)
  await db.from('teachers').delete().eq('user_id', teacherAUserId)
  await db.from('teachers').delete().eq('user_id', teacherBUserId)
  await db.from('school_users').delete().eq('school_id', schoolId)
  await db.from('schools').delete().eq('id', schoolId)
  await db.from('school_users').delete().eq('school_id', otherSchoolId)
  await db.from('schools').delete().eq('id', otherSchoolId)
  for (const id of [adminUserId, teacherAUserId, teacherBUserId, outsiderUserId, otherSchoolAdminUserId]) {
    await deleteAuthUserOrThrow(db, id)
  }
})

test('requireAuthentication throws UnauthorizedError for an unauthenticated client', async () => {
  const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
  await assert.rejects(() => requireAuthentication(anon), UnauthorizedError)
})

test('requireAuthentication resolves for an authenticated client', async () => {
  const client = await signInAs(adminEmail)
  const user = await requireAuthentication(client)
  assert.equal(user.id, adminUserId)
})

test('requireSchoolMembership throws MembershipRequiredError for a non-member', async () => {
  const client = await signInAs(outsiderEmail)
  await assert.rejects(() => requireSchoolMembership(client, schoolId), MembershipRequiredError)
})

test('requireSchoolMembership resolves for an active member', async () => {
  const client = await signInAs(teacherAEmail)
  const membership = await requireSchoolMembership(client, schoolId)
  assert.equal(membership.role, 'teacher')
})

test('requireSchoolAdmin throws PermissionDeniedError for a teacher-tier member', async () => {
  const client = await signInAs(teacherAEmail)
  await assert.rejects(() => requireSchoolAdmin(client, schoolId), PermissionDeniedError)
})

test('requireSchoolAdmin resolves for a school_admin member', async () => {
  const client = await signInAs(adminEmail)
  const membership = await requireSchoolAdmin(client, schoolId)
  assert.equal(membership.role, 'school_admin')
})

test('requireClassTeacher resolves for the class\'s own teacher', async () => {
  const client = await signInAs(teacherAEmail)
  const user = await requireClassTeacher(client, classId)
  assert.equal(user.id, teacherAUserId)
})

test('requireClassTeacher throws ResourceOwnershipError for a different teacher', async () => {
  const client = await signInAs(teacherBEmail)
  await assert.rejects(() => requireClassTeacher(client, classId), ResourceOwnershipError)
})

test('canManageAssessment is true for a school admin regardless of class ownership', async () => {
  const client = await signInAs(adminEmail)
  assert.equal(await canManageAssessment(client, schoolId, classId), true)
})

test('canManageAssessment is true for the class\'s own teacher', async () => {
  const client = await signInAs(teacherAEmail)
  assert.equal(await canManageAssessment(client, schoolId, classId), true)
})

test('canManageAssessment is false for an unrelated teacher', async () => {
  const client = await signInAs(teacherBEmail)
  assert.equal(await canManageAssessment(client, schoolId, classId), false)
})

// Sprint 1B additions — exercised by app/api/core/reports (canEditReport)
// and app/api/core/learners/[id] (requireSchoolStaff).

test('canEditReport is true for a school admin', async () => {
  const client = await signInAs(adminEmail)
  assert.equal(await canEditReport(client, schoolId), true)
})

test('canEditReport is false for a teacher-tier member (conservative default — see permissions.ts doc comment)', async () => {
  const client = await signInAs(teacherAEmail)
  assert.equal(await canEditReport(client, schoolId), false)
})

test('canEditReport is false for a non-member', async () => {
  const client = await signInAs(outsiderEmail)
  assert.equal(await canEditReport(client, schoolId), false)
})

test('requireSchoolStaff resolves for a teacher-tier member', async () => {
  const client = await signInAs(teacherAEmail)
  const membership = await requireSchoolStaff(client, schoolId)
  assert.equal(membership.role, 'teacher')
})

test('requireSchoolStaff resolves for a school_admin member', async () => {
  const client = await signInAs(adminEmail)
  const membership = await requireSchoolStaff(client, schoolId)
  assert.equal(membership.role, 'school_admin')
})

test('requireSchoolStaff throws MembershipRequiredError for a non-member (cross-school isolation)', async () => {
  const client = await signInAs(outsiderEmail)
  await assert.rejects(() => requireSchoolStaff(client, schoolId), MembershipRequiredError)
})

// True cross-school isolation: a school_admin of a DIFFERENT school (not merely
// a user with no membership anywhere) must be denied access to this school's
// resources — the specific case Batch A's migrated routes must get right.

test('requireSchoolMembership denies a school_admin of a different school (cross-school isolation)', async () => {
  const client = await signInAs(otherSchoolAdminEmail)
  await assert.rejects(() => requireSchoolMembership(client, schoolId), MembershipRequiredError)
})

test('requireSchoolAdmin denies a school_admin of a different school (cross-school isolation)', async () => {
  const client = await signInAs(otherSchoolAdminEmail)
  await assert.rejects(() => requireSchoolAdmin(client, schoolId), MembershipRequiredError)
})

test('canManageAssessment is false for a school_admin of a different school (cross-school isolation)', async () => {
  const client = await signInAs(otherSchoolAdminEmail)
  assert.equal(await canManageAssessment(client, schoolId, classId), false)
})

test('the other school\'s admin CAN manage their own school (sanity check the isolation test isn\'t just "always false")', async () => {
  const client = await signInAs(otherSchoolAdminEmail)
  const membership = await requireSchoolAdmin(client, otherSchoolId)
  assert.equal(membership.role, 'school_admin')
})
