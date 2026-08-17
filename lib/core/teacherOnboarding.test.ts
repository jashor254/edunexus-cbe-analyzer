// lib/core/teacherOnboarding.test.ts
//
// Sprint 9C — integration tests against real (synthetic, cleaned-up) rows,
// following the convention established in lib/core/permissions.test.ts and
// lib/core/schoolActivation.test.ts.
//
// Run: npx tsx --env-file=.env.local --test lib/core/teacherOnboarding.test.ts
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createTestServiceClient as createServiceClient } from '@/utils/supabase/test-service'
import { repos } from '@/lib/repositories'
import { activateSchool } from '@/lib/core/schoolActivation'
import { createAcademicYear } from '@/lib/core/school'
import { deleteAuthUserOrThrow } from '@/lib/testing/deleteAuthUserOrThrow'
import {
  inviteTeacher,
  acceptTeacherInvitation,
  getTeacherReadiness,
} from '@/lib/core/teacherOnboarding'

const SYNTHETIC_MARKER = 'SYNTHETIC_9C_ONBOARDING_TEST'
const db = createServiceClient()

let adminUserId: string
let schoolId: string
let teacherAUserId: string
let teacherAEmail: string
let teacherBUserId: string
let teacherBEmail: string
let uninvitedUserId: string

const createdAuthUserIds: string[] = []
const createdSchoolIds: string[] = []

async function mkAuthUser(label: string): Promise<{ id: string; email: string }> {
  const email = `sprint9c-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.com`
  const { data, error } = await db.auth.admin.createUser({
    email,
    password: `Test!${Math.random().toString(36).slice(2, 10)}`,
    email_confirm: true,
  })
  if (error) throw error
  createdAuthUserIds.push(data.user.id)
  return { id: data.user.id, email }
}

before(async () => {
  const admin = await mkAuthUser('admin')
  adminUserId = admin.id

  const school = await repos.schools.create({ school_name: `${SYNTHETIC_MARKER}_${Date.now()}` }, adminUserId)
  schoolId = school.id
  createdSchoolIds.push(schoolId)
  await repos.schools.addSchoolUser(schoolId, adminUserId, 'school_admin')

  const teacherA = await mkAuthUser('teacherA')
  teacherAUserId = teacherA.id
  teacherAEmail = teacherA.email

  const teacherB = await mkAuthUser('teacherB')
  teacherBUserId = teacherB.id
  teacherBEmail = teacherB.email

  const uninvited = await mkAuthUser('uninvited')
  uninvitedUserId = uninvited.id
})

after(async () => {
  for (const id of createdAuthUserIds) {
    await db.from('teachers').delete().eq('user_id', id)
    await db.from('profiles').delete().eq('id', id)
    // inviteTeacher/acceptTeacherInvitation publish notification_log rows
    // (invite email) and platform_events (actor_id) — real business-logic
    // side effects of the flow under test, not the universal trigger
    // side effect deleteAuthUserOrThrow already absorbs.
    await db.from('notification_log').delete().eq('user_id', id)
    await db.from('platform_events').delete().eq('actor_id', id)
  }
  for (const id of createdSchoolIds) {
    await db.from('schools').delete().eq('id', id) // cascades school_users/academic_years/classes/etc
  }
  for (const id of createdAuthUserIds) {
    await deleteAuthUserOrThrow(db, id)
  }
})

// ── Invite ───────────────────────────────────────────────────────────────────

test('inviteTeacher: invites an existing platform user, creating a pending (inactive) school_users row', async () => {
  const result = await inviteTeacher(schoolId, teacherAEmail, adminUserId)
  assert.equal(result.status, 'invited')
  assert.equal(result.schoolUser.is_active, false)
  assert.equal(result.schoolUser.role, 'teacher')

  const readiness = await getTeacherReadiness(teacherAUserId, schoolId)
  assert.equal(readiness.isSchoolMember, false) // pending ≠ member (resolveMembership only sees active rows)
  assert.equal(readiness.hasActiveMembership, false)
  assert.equal(readiness.hasTeacherRecord, false)
  assert.equal(readiness.readyForClassAssignment, false)
  assert.equal(readiness.readyForAssessmentOwnership, false)
})

test('inviteTeacher: repeated invitation is idempotent — returns already_pending, no duplicate row', async () => {
  const second = await inviteTeacher(schoolId, teacherAEmail, adminUserId)
  assert.equal(second.status, 'already_pending')

  const { data: rows } = await db
    .from('school_users')
    .select('id')
    .eq('school_id', schoolId)
    .eq('user_id', teacherAUserId)
    .eq('role', 'teacher')
  assert.equal(rows?.length, 1)
})

// Phase 2 (admin-provisioned teacher activation) — was "returns no_account
// rather than throwing." An email with no account no longer dead-ends:
// inviteSchoolMember now creates the auth.users account itself via
// Supabase's own invite-link primitive (lib/repositories/teacher.repository.ts
// createInvitedAuthAccount), so a school admin can provision a teacher who
// has genuinely never used EduNexus. `no_account` is now reserved for the
// (untested-here) case where account creation itself fails. See
// lib/core/teacherActivation.integration.test.ts for the full new-teacher
// lifecycle proof.
test('inviteTeacher: an email with no platform account now gets one created, rather than dead-ending at no_account', async () => {
  const email = `nobody-${Date.now()}@example.com`
  const result = await inviteTeacher(schoolId, email, adminUserId)
  assert.equal(result.status, 'invited')
  if (result.status !== 'invited') throw new Error('unreachable')
  assert.equal(result.schoolUser.is_active, false)

  const created = await repos.teachers.findAuthUserByEmail(email)
  assert.ok(created, 'an auth.users account must now exist')

  // Cleanup — this account isn't tracked by the fixture's own createdAuthUserIds.
  await db.from('school_users').delete().eq('id', result.schoolUser.id)
  await deleteAuthUserOrThrow(db, created!.id)
})

// ── Accept ───────────────────────────────────────────────────────────────────

test('acceptTeacherInvitation: throws a clear error when there is no invitation at all', async () => {
  await assert.rejects(
    () => acceptTeacherInvitation(teacherBUserId, schoolId, { full_name: 'Never Invited' }),
    /no invitation found/
  )
})

test('acceptTeacherInvitation: accepts a pending invitation and creates teachers + profiles + active school_users, all correctly linked (ADR-0002)', async () => {
  await inviteTeacher(schoolId, teacherAEmail, adminUserId)
  const result = await acceptTeacherInvitation(teacherAUserId, schoolId, { full_name: 'Teacher A' })

  assert.equal(result.status, 'accepted')
  assert.equal(result.schoolUser.is_active, true)
  assert.ok(result.teacherId)
  // ADR-0002: the two identities are never the same id, never conflated.
  assert.notEqual(result.teacherId, result.schoolUser.id)

  const readiness = await getTeacherReadiness(teacherAUserId, schoolId)
  assert.equal(readiness.isSchoolMember, true)
  assert.equal(readiness.hasActiveMembership, true)
  assert.equal(readiness.hasTeacherRecord, true)
  assert.equal(readiness.teacherId, result.teacherId)
  assert.equal(readiness.readyForClassAssignment, true)
  assert.equal(readiness.readyForAssessmentOwnership, true)

  const { data: teacherRow } = await db.from('teachers').select('id, user_id, full_name, school').eq('id', result.teacherId).single()
  assert.equal(teacherRow?.user_id, teacherAUserId)
  assert.equal(teacherRow?.full_name, 'Teacher A')

  const school = await repos.schools.findById(schoolId)
  assert.equal(teacherRow?.school, school.school_name) // canonical school name, not a free-text guess

  const { data: profileRow } = await db.from('profiles').select('id, role').eq('id', teacherAUserId).single()
  assert.equal(profileRow?.role, 'teacher')
})

test('acceptTeacherInvitation: repeated acceptance is idempotent — status already_member, no duplicate teachers/profiles rows', async () => {
  const second = await acceptTeacherInvitation(teacherAUserId, schoolId, { full_name: 'Teacher A Renamed' })
  assert.equal(second.status, 'already_member')

  const { data: teacherRows } = await db.from('teachers').select('id').eq('user_id', teacherAUserId)
  assert.equal(teacherRows?.length, 1)

  const { data: profileRows } = await db.from('profiles').select('id').eq('id', teacherAUserId)
  assert.equal(profileRows?.length, 1)

  const { data: schoolUserRows } = await db
    .from('school_users')
    .select('id')
    .eq('school_id', schoolId)
    .eq('user_id', teacherAUserId)
    .eq('role', 'teacher')
  assert.equal(schoolUserRows?.length, 1)
})

// ── First teacher / second teacher ───────────────────────────────────────────

test('a second, independent teacher can onboard into the same school without interfering with the first', async () => {
  await inviteTeacher(schoolId, teacherBEmail, adminUserId)
  const result = await acceptTeacherInvitation(teacherBUserId, schoolId, { full_name: 'Teacher B' })
  assert.equal(result.status, 'accepted')
  assert.notEqual(result.teacherId, undefined)

  const { data: schoolTeachers } = await db.from('school_users').select('user_id').eq('school_id', schoolId).eq('role', 'teacher').eq('is_active', true)
  const userIds = (schoolTeachers ?? []).map(r => r.user_id)
  assert.ok(userIds.includes(teacherAUserId))
  assert.ok(userIds.includes(teacherBUserId))
})

// ── Readiness for a never-touched user ───────────────────────────────────────

test('getTeacherReadiness: a user with no membership at all reports fully unready, not an error', async () => {
  const readiness = await getTeacherReadiness(uninvitedUserId, schoolId)
  assert.deepEqual(readiness, {
    isSchoolMember: false,
    hasActiveMembership: false,
    hasTeacherRecord: false,
    teacherId: null,
    readyForClassAssignment: false,
    readyForAssessmentOwnership: false,
  })
})

// ── Activation + onboarding together (Part 6: freshly activated) ────────────

test('a teacher can onboard into a freshly activated school (activation + onboarding together)', async () => {
  const admin2 = await mkAuthUser('admin2')
  // school_type omitted — DB default is 'secondary' (see docs/engineering/
  // implementation-log.md's Sprint 9B entry for the known SchoolType/DB
  // CHECK-constraint mismatch this sidesteps rather than fights).
  const school2 = await repos.schools.create({ school_name: `${SYNTHETIC_MARKER}_fresh_${Date.now()}` }, admin2.id)
  createdSchoolIds.push(school2.id)
  await repos.schools.addSchoolUser(school2.id, admin2.id, 'school_admin')

  const activation = await activateSchool(school2.id, { gradeCodes: ['G7'] })
  assert.equal(activation.status, 'complete')

  const teacher2 = await mkAuthUser('teacher-fresh')
  const invite = await inviteTeacher(school2.id, teacher2.email, admin2.id)
  assert.equal(invite.status, 'invited')

  const accept = await acceptTeacherInvitation(teacher2.id, school2.id, { full_name: 'Fresh School Teacher' })
  assert.equal(accept.status, 'accepted')

  const readiness = await getTeacherReadiness(teacher2.id, school2.id)
  assert.equal(readiness.readyForClassAssignment, true)
  assert.equal(readiness.readyForAssessmentOwnership, true)
})

// ── Onboarding into a partially configured school (Part 6) ──────────────────

test('onboarding works identically for a partially configured school (no activation run at all)', async () => {
  const admin3 = await mkAuthUser('admin3')
  const school3 = await repos.schools.create({ school_name: `${SYNTHETIC_MARKER}_partial_${Date.now()}` }, admin3.id)
  createdSchoolIds.push(school3.id)
  await repos.schools.addSchoolUser(school3.id, admin3.id, 'school_admin')
  // Deliberately only a bare academic year — no terms/classes/settings —
  // proving onboarding doesn't secretly depend on activation state.
  await createAcademicYear(school3.id, { name: '2026', start_date: '2026-01-01', end_date: '2026-12-31' })

  const teacher3 = await mkAuthUser('teacher-partial')
  const invite = await inviteTeacher(school3.id, teacher3.email, admin3.id)
  assert.equal(invite.status, 'invited')
  const accept = await acceptTeacherInvitation(teacher3.id, school3.id, { full_name: 'Partial School Teacher' })
  assert.equal(accept.status, 'accepted')
})

// ── Failure + retry (Part 7) ─────────────────────────────────────────────────

// Phase 2 rewrite — was "inviting an unregistered email, then retrying
// after they sign up, succeeds," which tested the pre-Phase-2 no_account
// dead end. inviteTeacher no longer has a no_account state to retry past
// (it creates the account itself on the first call); what's still worth
// proving is the adjacent idempotency question: a SECOND invite call for
// that same, now-existing (auto-created) account must not create a
// duplicate account or a duplicate school_users row.
test('failure + retry: inviting the same unregistered email twice creates exactly one account and one pending membership', async () => {
  const admin4 = await mkAuthUser('admin4')
  const school4 = await repos.schools.create({ school_name: `${SYNTHETIC_MARKER}_retry_${Date.now()}` }, admin4.id)
  createdSchoolIds.push(school4.id)
  await repos.schools.addSchoolUser(school4.id, admin4.id, 'school_admin')

  const notYetRegisteredEmail = `not-yet-registered-${Date.now()}@example.com`
  const firstAttempt = await inviteTeacher(school4.id, notYetRegisteredEmail, admin4.id)
  assert.equal(firstAttempt.status, 'invited')
  if (firstAttempt.status !== 'invited') throw new Error('unreachable')

  const created = await repos.teachers.findAuthUserByEmail(notYetRegisteredEmail)
  assert.ok(created)
  createdAuthUserIds.push(created!.id)

  const secondAttempt = await inviteTeacher(school4.id, notYetRegisteredEmail, admin4.id)
  assert.equal(secondAttempt.status, 'already_pending')
  if (secondAttempt.status !== 'already_pending') throw new Error('unreachable')
  assert.equal(secondAttempt.schoolUser.id, firstAttempt.schoolUser.id, 'must be the SAME pending row, not a duplicate')

  const { data: schoolUserRows } = await db.from('school_users').select('id').eq('school_id', school4.id).eq('user_id', created!.id)
  assert.equal(schoolUserRows?.length, 1, 'must not duplicate the school_users row')

  const accept = await acceptTeacherInvitation(created!.id, school4.id, { full_name: 'Retried Teacher' })
  assert.equal(accept.status, 'accepted')
})

test('failure + retry: a repeated full invite→accept→invite→accept sequence never creates duplicates', async () => {
  await inviteTeacher(schoolId, teacherAEmail, adminUserId)   // already accepted earlier — idempotent no-op
  await acceptTeacherInvitation(teacherAUserId, schoolId, { full_name: 'Teacher A' })

  const { data: teacherRows } = await db.from('teachers').select('id').eq('user_id', teacherAUserId)
  assert.equal(teacherRows?.length, 1)
  const { data: schoolUserRows } = await db
    .from('school_users')
    .select('id')
    .eq('school_id', schoolId)
    .eq('user_id', teacherAUserId)
    .eq('role', 'teacher')
  assert.equal(schoolUserRows?.length, 1)
})
