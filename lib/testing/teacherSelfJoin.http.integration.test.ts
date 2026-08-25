// lib/testing/teacherSelfJoin.http.integration.test.ts
//
// Teacher self-join institutional boundary. Proves a teacher cannot obtain a
// `school_users` membership — and therefore cannot obtain school-covered
// access — by typing a school's name into their own profile.
//
// THE BEHAVIOR THIS CLOSES
// `POST /api/teacher/profile` called `ensureSchoolMembership(userId, school)`,
// which looked the free-text school name up case-insensitively and, on a
// match, inserted a `school_users` row directly:
//
//     repos.schools.addSchoolUser(existingSchool.id, userId, 'teacher')
//       -> is_active defaults to TRUE, invited_by NULL, joined_at set
//
// There was no invitation, no acceptance step, and no administrator consent.
// Because `resolveSchoolCoverage()` grants coverage on any active
// role='teacher' membership at an entitled school, that made a self-typed
// string sufficient to inherit an institution's paid entitlement. That is an
// authorization boundary, not an onboarding nicety.
//
// Requires a server at LMS_TEST_BASE_URL (default http://localhost:3000).
//
// Run: TEST_BASE_URL=http://localhost:3100 npx tsx --test lib/testing/teacherSelfJoin.http.integration.test.ts
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createTestServiceClient as createServiceClient } from '@/utils/supabase/test-service'
import { signInForHttpTest, type SyntheticSession } from '@/lib/testing/httpAuthTestHelper'
import { resolveSchoolCoverage } from '@/lib/core/schoolEntitlement'
import { inviteTeacher, acceptTeacherInvitation } from '@/lib/core/teacherOnboarding'
import { deactivateSchoolMembership } from '@/lib/core/school-users'

const BASE_URL = process.env.TEST_BASE_URL ?? process.env.LMS_TEST_BASE_URL ?? 'http://localhost:3100'
const SYNTHETIC_MARKER = 'SYNTHETIC_SELFJOIN_TEST'
const db = createServiceClient()
const PASSWORD = `Test!${Math.random().toString(36).slice(2, 12)}`

const createdAuthUserIds: string[] = []
const createdSchoolIds: string[] = []

async function mkUser(label: string): Promise<{ id: string; email: string; session: SyntheticSession }> {
  const email = `selfjoin-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.com`
  const { data, error } = await db.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true })
  if (error) throw error
  createdAuthUserIds.push(data.user.id)
  const session = await signInForHttpTest(email, PASSWORD)
  return { id: data.user.id, email, session }
}

async function postProfile(session: SyntheticSession, school: string, fullName = `${SYNTHETIC_MARKER} Teacher`) {
  return fetch(`${BASE_URL}/api/teacher/profile`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: session.cookieHeader },
    body: JSON.stringify({ full_name: fullName, school }),
  })
}

async function membershipsOf(userId: string) {
  const { data } = await db
    .from('school_users')
    .select('id, school_id, role, is_active, invited_by')
    .eq('user_id', userId)
  return data ?? []
}

let entitledSchoolId: string
let entitledSchoolName: string
let otherSchoolId: string
let otherSchoolName: string
let adminId: string

before(async () => {
  const admin = await mkUser('admin')
  adminId = admin.id

  // School A — a real, ENTITLED institution. The prize a self-join would win.
  entitledSchoolName = `${SYNTHETIC_MARKER} Kangai School ${Date.now()}`
  const { data: schoolA, error: aErr } = await db
    .from('schools')
    .insert({ school_name: entitledSchoolName, created_by: admin.id, school_entitlement_status: 'active' })
    .select('id')
    .single()
  if (aErr || !schoolA) throw new Error(`school A insert failed: ${aErr?.message}`)
  entitledSchoolId = schoolA.id
  createdSchoolIds.push(entitledSchoolId)
  await db.from('school_users').insert({ school_id: entitledSchoolId, user_id: admin.id, role: 'school_admin', is_active: true })

  // School B — unrelated, for the "join someone else's school" case.
  otherSchoolName = `${SYNTHETIC_MARKER} Other School ${Date.now()}`
  const { data: schoolB, error: bErr } = await db
    .from('schools')
    .insert({ school_name: otherSchoolName, created_by: admin.id })
    .select('id')
    .single()
  if (bErr || !schoolB) throw new Error(`school B insert failed: ${bErr?.message}`)
  otherSchoolId = schoolB.id
  createdSchoolIds.push(otherSchoolId)
})

after(async () => {
  for (const id of createdSchoolIds) await db.from('class_subjects').delete().eq('school_id', id)
  for (const id of createdSchoolIds) await db.from('teacher_classes').delete().eq('school_id', id)
  for (const id of createdSchoolIds) {
    const { error } = await db.from('schools').delete().eq('id', id)
    if (error) console.error(`[cleanup] school ${id} not deleted: ${error.message}`)
  }
  for (const id of createdAuthUserIds) {
    await db.from('teachers').delete().eq('user_id', id)
    await db.from('profiles').delete().eq('id', id)
    await db.auth.admin.deleteUser(id)
  }
})

// ── 1/2/12. Self-join by name, exact and case-varied ────────────────────────

test('1. an ordinary teacher cannot self-join an existing school by typing its exact name', async () => {
  const peter = await mkUser('peter-exact')

  const res = await postProfile(peter.session, entitledSchoolName)
  assert.equal(res.status, 200, 'the profile still saves — this is not a block, it is a removal of authority')

  assert.deepEqual(await membershipsOf(peter.id), [], 'no school_users row was created')
})

test('2. case and whitespace variations cannot self-join either', async () => {
  for (const [i, variant] of [
    entitledSchoolName.toUpperCase(),
    entitledSchoolName.toLowerCase(),
    `  ${entitledSchoolName}  `,
  ].entries()) {
    const teacher = await mkUser(`case-${i}`)
    const res = await postProfile(teacher.session, variant)
    assert.equal(res.status, 200)
    assert.deepEqual(await membershipsOf(teacher.id), [], `variant "${variant}" must not create a membership`)
  }
})

test('12. teacher profile submission creates no school_users row at all', async () => {
  const teacher = await mkUser('no-row')
  const { count: before } = await db.from('school_users').select('id', { count: 'exact', head: true })

  await postProfile(teacher.session, entitledSchoolName)
  await postProfile(teacher.session, otherSchoolName)
  await postProfile(teacher.session, 'A School That Does Not Exist At All')

  const { count: after } = await db.from('school_users').select('id', { count: 'exact', head: true })
  assert.equal(after, before, 'three profile submissions, zero membership rows')
})

// ── 14. The entitlement consequence ─────────────────────────────────────────

test('14a. a self-typed school name grants NO school-covered access', async () => {
  const peter = await mkUser('coverage')
  await postProfile(peter.session, entitledSchoolName)

  const coverage = await resolveSchoolCoverage(peter.id)
  assert.equal(coverage.outcome, 'not_covered')
  if (coverage.outcome === 'not_covered') {
    assert.equal(coverage.reason, 'no_active_membership')
  }
})

test('14b. an ADMIN-provisioned teacher at the same school IS covered', async () => {
  // The control case: entitlement still flows through trusted membership.
  // If this failed, the fix would have broken the product rather than the hole.
  const mary = await mkUser('provisioned')
  await inviteTeacher(entitledSchoolId, mary.email, adminId)
  await acceptTeacherInvitation(mary.id, entitledSchoolId, { full_name: `${SYNTHETIC_MARKER} Mary` })

  const coverage = await resolveSchoolCoverage(mary.id)
  assert.equal(coverage.outcome, 'covered')
  if (coverage.outcome === 'covered') assert.equal(coverage.schoolId, entitledSchoolId)
})

// ── 3/4. Departed teacher, and joining someone else's school ────────────────

test('3. a departed teacher cannot re-attach to their former school via a profile edit', async () => {
  const peter = await mkUser('departed')
  await inviteTeacher(entitledSchoolId, peter.email, adminId)
  await acceptTeacherInvitation(peter.id, entitledSchoolId, { full_name: `${SYNTHETIC_MARKER} Departed` })
  await deactivateSchoolMembership(peter.id, entitledSchoolId)

  const before = await membershipsOf(peter.id)
  assert.equal(before.length, 1)
  assert.equal(before[0].is_active, false, 'fixture: membership is inactive')

  const res = await postProfile(peter.session, entitledSchoolName, `${SYNTHETIC_MARKER} Departed`)
  assert.equal(res.status, 200)

  const after = await membershipsOf(peter.id)
  assert.equal(after.length, 1, 'no second membership was created')
  assert.equal(after[0].is_active, false, 'the historical membership was NOT reactivated')

  const coverage = await resolveSchoolCoverage(peter.id)
  assert.equal(coverage.outcome, 'not_covered')
})

test('4. a teacher cannot attach themselves to a DIFFERENT school via a profile edit', async () => {
  const peter = await mkUser('cross-school')
  await inviteTeacher(otherSchoolId, peter.email, adminId)
  await acceptTeacherInvitation(peter.id, otherSchoolId, { full_name: `${SYNTHETIC_MARKER} Cross` })

  // Employed at School B, types School A's name.
  const res = await postProfile(peter.session, entitledSchoolName, `${SYNTHETIC_MARKER} Cross`)
  assert.equal(res.status, 200)

  const memberships = await membershipsOf(peter.id)
  assert.equal(memberships.length, 1, 'still exactly one membership')
  assert.equal(memberships[0].school_id, otherSchoolId, 'and it is still School B')
  assert.ok(!memberships.some(m => m.school_id === entitledSchoolId), 'never reached the entitled school')
})

// ── 8/10. Role choice, and existing membership integrity ────────────────────

test('8. a teacher cannot choose their own institutional role through their profile', async () => {
  const teacher = await mkUser('role-choice')
  // The profile schema accepts no role field; even smuggling one changes nothing,
  // because the route never writes school_users at all any more.
  const res = await fetch(`${BASE_URL}/api/teacher/profile`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: teacher.session.cookieHeader },
    body: JSON.stringify({
      full_name: `${SYNTHETIC_MARKER} Role`, school: entitledSchoolName,
      role: 'school_admin', school_role: 'school_admin', is_active: true,
    }),
  })
  assert.equal(res.status, 200)
  assert.deepEqual(await membershipsOf(teacher.id), [], 'no membership, least of all an admin one')
})

test('10. an existing active membership survives a profile edit untouched', async () => {
  const grace = await mkUser('existing')
  await inviteTeacher(entitledSchoolId, grace.email, adminId)
  await acceptTeacherInvitation(grace.id, entitledSchoolId, { full_name: `${SYNTHETIC_MARKER} Grace` })

  const before = await membershipsOf(grace.id)
  assert.equal(before.length, 1)
  assert.equal(before[0].is_active, true)

  const res = await postProfile(grace.session, 'Somewhere Else Entirely', `${SYNTHETIC_MARKER} Grace Renamed`)
  assert.equal(res.status, 200)

  const after = await membershipsOf(grace.id)
  assert.equal(after.length, 1)
  assert.equal(after[0].id, before[0].id, 'same row')
  assert.equal(after[0].school_id, before[0].school_id, 'same school')
  assert.equal(after[0].role, before[0].role, 'same role')
  assert.equal(after[0].is_active, true, 'still active')

  // And the descriptive profile text did change — the field still works,
  // it simply carries no institutional authority.
  const { data: teacherRow } = await db.from('teachers').select('school, full_name').eq('user_id', grace.id).single()
  assert.equal(teacherRow!.school, 'Somewhere Else Entirely')
  assert.equal(teacherRow!.full_name, `${SYNTHETIC_MARKER} Grace Renamed`)
})

// ── 5. Solo Teacher ─────────────────────────────────────────────────────────

test('5. a Solo Teacher completes their profile with no membership and no school', async () => {
  const solo = await mkUser('solo')
  const { count: schoolsBefore } = await db.from('schools').select('id', { count: 'exact', head: true })

  const res = await postProfile(solo.session, 'My Private Tuition Centre', `${SYNTHETIC_MARKER} Solo`)
  assert.equal(res.status, 200, 'profile completion still works')

  const { data: teacherRow } = await db.from('teachers').select('school').eq('user_id', solo.id).single()
  assert.equal(teacherRow!.school, 'My Private Tuition Centre', 'descriptive text is preserved')

  assert.deepEqual(await membershipsOf(solo.id), [])
  const { count: schoolsAfter } = await db.from('schools').select('id', { count: 'exact', head: true })
  assert.equal(schoolsAfter, schoolsBefore, 'and no school was created')

  const coverage = await resolveSchoolCoverage(solo.id)
  assert.equal(coverage.outcome, 'not_covered')
})

// ── 11. Teacher + Parent ────────────────────────────────────────────────────

test('11. a teacher who is also a parent keeps their parent context intact', async () => {
  const dual = await mkUser('teacher-parent')

  // A parent membership at the school (a real school_users role), plus a
  // Family-style personal profile role.
  await db.from('school_users').insert({
    school_id: entitledSchoolId, user_id: dual.id, role: 'parent', is_active: true,
  })
  await db.from('profiles').upsert({ id: dual.id, role: 'parent', secondary_role: 'teacher' })

  const res = await postProfile(dual.session, entitledSchoolName, `${SYNTHETIC_MARKER} Dual`)
  assert.equal(res.status, 200)

  const memberships = await membershipsOf(dual.id)
  assert.equal(memberships.length, 1, 'no teacher membership was added alongside the parent one')
  assert.equal(memberships[0].role, 'parent', 'the parent context is untouched')
  assert.equal(memberships[0].is_active, true)

  const { data: profile } = await db.from('profiles').select('role, secondary_role').eq('id', dual.id).single()
  assert.equal(profile!.role, 'parent', 'platform role unchanged')
  assert.equal(profile!.secondary_role, 'teacher')

  // A parent membership is not teacher coverage — the entitlement chain
  // requires role='teacher', so this person pays personally for teacher tools.
  const coverage = await resolveSchoolCoverage(dual.id)
  assert.equal(coverage.outcome, 'not_covered')
})
