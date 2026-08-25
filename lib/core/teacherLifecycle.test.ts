// lib/core/teacherLifecycle.test.ts
//
// Teacher lifecycle + assignment history.
//
// Proves the institution outlives its staff: Peter can leave and Mary can
// replace him without deleting the person, recreating the class, re-importing
// learners, rewriting history, or costing the school another payment.
//
// The model under test (migration 20260813120000):
//   class_subjects.started_at  — when this tenure began
//   class_subjects.ended_at    — NULL = CURRENT, non-null = historical
//   partial UNIQUE (class_id, subject_id) WHERE ended_at IS NULL
//
// Run: npx tsx --env-file=.env.local --test lib/core/teacherLifecycle.test.ts
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createTestServiceClient as createServiceClient } from '@/utils/supabase/test-service'
import { repos } from '@/lib/repositories'
import { activateSchool } from '@/lib/core/schoolActivation'
import { inviteTeacher, acceptTeacherInvitation } from '@/lib/core/teacherOnboarding'
import { createClass, assignSubjectTeacher, listClassSubjects, getClassSubjectHistory } from '@/lib/core/classes'
import { listSubjects } from '@/lib/core/subjects'
import { deactivateSchoolMembership, reinstateSchoolMembership } from '@/lib/core/school-users'
import { listTeacherMemberships } from '@/lib/core/teacherOnboarding'
import { resolveSchoolCoverage } from '@/lib/core/schoolEntitlement'
import { listTeachingAssignmentsForUser, resolveTeachingContext } from '@/lib/core/teachingAssignments'

const SYNTHETIC_MARKER = 'SYNTHETIC_LIFECYCLE_TEST'
const db = createServiceClient()
const PASSWORD = `Test!${Math.random().toString(36).slice(2, 12)}`

const createdAuthUserIds: string[] = []
const createdSchoolIds: string[] = []

async function mkUser(label: string): Promise<{ id: string; email: string }> {
  const email = `lifecycle-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.com`
  const { data, error } = await db.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true })
  if (error) throw error
  createdAuthUserIds.push(data.user.id)
  return { id: data.user.id, email }
}

async function addTeacher(schoolId: string, adminId: string, label: string) {
  const user = await mkUser(label)
  await inviteTeacher(schoolId, user.email, adminId)
  const accepted = await acceptTeacherInvitation(user.id, schoolId, { full_name: `${SYNTHETIC_MARKER} ${label}` })
  return { userId: user.id, membershipId: accepted.schoolUser.id }
}

let schoolAId: string
let schoolAAdminId: string
let schoolBId: string
let schoolBAdminId: string
let sevenEastId: string
let mathsId: string
let englishId: string

let peterUserId: string
let peterMembershipId: string
let maryUserId: string
let maryMembershipId: string
let graceUserId: string
let graceMembershipId: string

let learnerId: string
let entitlementExpiryBefore: string | null

before(async () => {
  const adminA = await mkUser('adminA')
  schoolAAdminId = adminA.id
  const schoolA = await repos.schools.create({ school_name: `${SYNTHETIC_MARKER}_A_${Date.now()}` }, adminA.id)
  schoolAId = schoolA.id
  createdSchoolIds.push(schoolAId)
  await repos.schools.addSchoolUser(schoolAId, adminA.id, 'school_admin')
  const act = await activateSchool(schoolAId, { gradeCodes: ['G7'] })
  if (act.status !== 'complete') throw new Error(`fixture activation failed: ${act.error}`)

  // School A is an ENTITLED, paying institution.
  await db.from('schools').update({ school_entitlement_status: 'active' }).eq('id', schoolAId)
  const { data: schoolRow } = await db
    .from('schools').select('school_entitlement_expires_at').eq('id', schoolAId).single()
  entitlementExpiryBefore = (schoolRow?.school_entitlement_expires_at as string | null) ?? null

  const { data: classes } = await db
    .from('classes').select('id, grade_id, academic_year_id').eq('school_id', schoolAId).limit(1)
  const subjects = await listSubjects('junior_secondary')
  mathsId   = subjects.find(s => s.name === 'Mathematics')!.id
  englishId = subjects.find(s => s.name === 'English')!.id

  const sevenEast = await createClass(schoolAId, {
    grade_id: classes![0].grade_id,
    academic_year_id: classes![0].academic_year_id,
    display_name: `${SYNTHETIC_MARKER} Grade 7 East`,
  })
  sevenEastId = sevenEast.id

  // A learner enrolled in that class — the roster that must survive turnover.
  const { data: learner } = await db.from('learners').insert({
    school_id: schoolAId, admission_number: `LC${Date.now().toString().slice(-7)}`,
    first_name: 'Jane', last_name: 'Wanjiku',
  }).select('id').single()
  learnerId = learner!.id
  const { data: term } = await db.from('terms').select('id, academic_year_id').eq('school_id', schoolAId).limit(1).single()
  await db.from('learner_enrollments').insert({
    school_id: schoolAId, learner_id: learnerId, class_id: sevenEastId,
    term_id: term!.id, academic_year_id: term!.academic_year_id,
  })

  const peter = await addTeacher(schoolAId, adminA.id, 'peter')
  peterUserId = peter.userId
  peterMembershipId = peter.membershipId
  const mary = await addTeacher(schoolAId, adminA.id, 'mary')
  maryUserId = mary.userId
  maryMembershipId = mary.membershipId
  const grace = await addTeacher(schoolAId, adminA.id, 'grace')
  graceUserId = grace.userId
  graceMembershipId = grace.membershipId

  // Peter teaches Mathematics; Grace teaches English in the same class.
  await assignSubjectTeacher(schoolAId, sevenEastId, mathsId, peterMembershipId)
  await assignSubjectTeacher(schoolAId, sevenEastId, englishId, graceMembershipId)

  // School B — for the transfer case.
  const adminB = await mkUser('adminB')
  schoolBAdminId = adminB.id
  const schoolB = await repos.schools.create({ school_name: `${SYNTHETIC_MARKER}_B_${Date.now()}` }, adminB.id)
  schoolBId = schoolB.id
  createdSchoolIds.push(schoolBId)
  await repos.schools.addSchoolUser(schoolBId, adminB.id, 'school_admin')
  const actB = await activateSchool(schoolBId, { gradeCodes: ['G7'] })
  if (actB.status !== 'complete') throw new Error(`fixture B activation failed: ${actB.error}`)
})

after(async () => {
  for (const id of createdSchoolIds) await db.from('class_subjects').delete().eq('school_id', id)
  for (const id of createdSchoolIds) await db.from('teacher_classes').delete().eq('school_id', id)
  for (const id of createdSchoolIds) {
    const { error } = await db.from('schools').delete().eq('id', id)
    if (error) console.error(`[cleanup] school ${id} not deleted: ${error.message}`)
  }
  for (const id of createdAuthUserIds) {
    // H1E-A: inviteTeacher's notification side effect leaves a
    // notification_log row referencing this user; deleteUser silently
    // fails against that FK (its error return isn't surfaced here) unless
    // cleared first — confirmed as a real, reproducible leak, not an
    // environment fluke, by the DEEP_PR cleanup gate.
    await db.from('notification_log').delete().eq('user_id', id)
    await db.from('teachers').delete().eq('user_id', id)
    await db.from('profiles').delete().eq('id', id)
    const { error } = await db.auth.admin.deleteUser(id)
    if (error) console.error(`[cleanup] auth user ${id} not deleted: ${error.message}`)
  }
})

// ── 1/2. Migration preserved current assignments ────────────────────────────

test('1. a newly-created assignment is CURRENT (ended_at null, started_at set)', async () => {
  const { data: row } = await db
    .from('class_subjects')
    .select('teacher_id, started_at, ended_at')
    .eq('class_id', sevenEastId).eq('subject_id', mathsId).is('ended_at', null).single()
  assert.equal(row!.teacher_id, peterMembershipId)
  assert.equal(row!.ended_at, null)
  assert.ok(row!.started_at, 'started_at is populated')
})

test('2. Peter sees his current assignment in My Teaching', async () => {
  const assignments = await listTeachingAssignmentsForUser(peterUserId)
  assert.ok(assignments.some(a => a.classId === sevenEastId && a.subjectId === mathsId))
})

// ── 3-10. Peter leaves ──────────────────────────────────────────────────────

test('3+4. deactivating Peter makes the membership inactive AND closes his current assignment', async () => {
  const removed = await deactivateSchoolMembership(peterUserId, schoolAId)
  assert.equal(removed, true)

  const { data: membership } = await db
    .from('school_users').select('is_active').eq('id', peterMembershipId).single()
  assert.equal(membership!.is_active, false, 'membership inactive')

  const { data: current } = await db
    .from('class_subjects').select('id')
    .eq('class_id', sevenEastId).eq('subject_id', mathsId).is('ended_at', null)
  assert.equal(current!.length, 0, 'the post is now vacant — no current assignment')
})

test('5. Peter\'s historical assignment survives, closed but intact', async () => {
  const { data: historical } = await db
    .from('class_subjects')
    .select('teacher_id, class_id, subject_id, started_at, ended_at')
    .eq('teacher_id', peterMembershipId)
  assert.equal(historical!.length, 1, 'the row was closed, never deleted')
  assert.equal(historical![0].class_id, sevenEastId, 'still the same class')
  assert.equal(historical![0].subject_id, mathsId, 'still the same subject')
  assert.ok(historical![0].ended_at, 'now has an end date')
  assert.ok(
    new Date(historical![0].ended_at as string) >= new Date(historical![0].started_at as string),
    'ended after it started',
  )
})

test('6+7. Peter\'s identity and personal context survive entirely', async () => {
  const { data: authUser } = await db.auth.admin.getUserById(peterUserId)
  assert.ok(authUser.user, 'auth account intact')

  const teacher = await repos.teachers.findTeacherByUserId(peterUserId)
  assert.ok(teacher, 'teachers row intact')

  const { data: profile } = await db.from('profiles').select('id, role').eq('id', peterUserId).maybeSingle()
  assert.ok(profile, 'profile intact')

  // No longer school-covered — coverage was the school's, inherited through an
  // active membership, never his personal property.
  const coverage = await resolveSchoolCoverage(peterUserId)
  assert.equal(coverage.outcome, 'not_covered')
})

test('8. the school\'s entitlement is completely untouched by staff departure', async () => {
  const { data: school } = await db
    .from('schools').select('school_entitlement_status, school_entitlement_expires_at').eq('id', schoolAId).single()
  assert.equal(school!.school_entitlement_status, 'active', 'school still entitled')
  assert.equal(school!.school_entitlement_expires_at ?? null, entitlementExpiryBefore, 'expiry unchanged')
})

test('9+10. learners and the class itself are unchanged', async () => {
  const { data: enrollment } = await db
    .from('learner_enrollments').select('class_id, status').eq('learner_id', learnerId).single()
  assert.equal(enrollment!.class_id, sevenEastId, 'Jane is still in Grade 7 East')
  assert.equal(enrollment!.status, 'active')

  const { data: cls } = await db.from('classes').select('id, school_id, display_name').eq('id', sevenEastId).single()
  assert.equal(cls!.school_id, schoolAId, 'the class still belongs to the school')
  assert.equal(cls!.display_name, `${SYNTHETIC_MARKER} Grade 7 East`, 'not recreated, not renamed')
})

test('19a. Peter\'s My Teaching no longer shows the School A assignment', async () => {
  const assignments = await listTeachingAssignmentsForUser(peterUserId)
  assert.ok(!assignments.some(a => a.classId === sevenEastId), 'a closed post is not current work')
  const context = await resolveTeachingContext(peterUserId)
  assert.equal(context.kind, 'solo', 'inactive membership is not a school relationship')
})

test('22. a vacant post is simply the absence of a current assignment', async () => {
  const currentSubjects = await listClassSubjects(sevenEastId)
  assert.ok(!currentSubjects.some(cs => cs.subject_id === mathsId), 'Mathematics is vacant')
  assert.ok(currentSubjects.some(cs => cs.subject_id === englishId), 'English is still staffed by Grace')
  // No placeholder teacher, no "vacant" account, no sentinel id.
  const { data: rows } = await db
    .from('class_subjects').select('teacher_id')
    .eq('class_id', sevenEastId).eq('subject_id', mathsId).is('ended_at', null)
  assert.equal(rows!.length, 0)
})

// ── 11-14. Mary replaces Peter ──────────────────────────────────────────────

test('11+12. Mary is assigned the vacant post and it becomes her current assignment', async () => {
  await assignSubjectTeacher(schoolAId, sevenEastId, mathsId, maryMembershipId)

  const assignments = await listTeachingAssignmentsForUser(maryUserId)
  const maths = assignments.find(a => a.classId === sevenEastId && a.subjectId === mathsId)
  assert.ok(maths, 'Mary sees Grade 7 East Mathematics')
  assert.equal(maths.className, `${SYNTHETIC_MARKER} Grade 7 East`, 'the SAME class — not a recreated one')
})

test('13. Peter\'s historical row is untouched by Mary\'s arrival', async () => {
  const { data: peterRow } = await db
    .from('class_subjects').select('teacher_id, ended_at').eq('teacher_id', peterMembershipId).single()
  assert.equal(peterRow!.teacher_id, peterMembershipId, 'still attributed to Peter, not rewritten as Mary')
  assert.ok(peterRow!.ended_at)
})

test('14. exactly one CURRENT teacher exists for that class+subject', async () => {
  const { data: current } = await db
    .from('class_subjects').select('teacher_id')
    .eq('class_id', sevenEastId).eq('subject_id', mathsId).is('ended_at', null)
  assert.equal(current!.length, 1)
  assert.equal(current![0].teacher_id, maryMembershipId)

  // And the full tenure record reads as a succession.
  const history = await getClassSubjectHistory(schoolAId, sevenEastId, mathsId)
  assert.equal(history.length, 2, 'two tenures: Peter then Mary')
  assert.equal(history[0].teacherId, maryMembershipId, 'newest first')
  assert.equal(history[0].endedAt, null, 'Mary is current')
  assert.equal(history[1].teacherId, peterMembershipId)
  assert.ok(history[1].endedAt, 'Peter is historical')
})

test('19b. My Teaching switched from Peter to Mary', async () => {
  const peterNow = await listTeachingAssignmentsForUser(peterUserId)
  const maryNow  = await listTeachingAssignmentsForUser(maryUserId)
  assert.ok(!peterNow.some(a => a.classId === sevenEastId && a.subjectId === mathsId))
  assert.ok(maryNow.some(a => a.classId === sevenEastId && a.subjectId === mathsId))
})

// ── 15/16/23. Idempotency and the invariant under repetition ────────────────

test('15. repeat deactivation is idempotent and does not rewrite the first closure', async () => {
  const { data: before } = await db
    .from('class_subjects').select('ended_at').eq('teacher_id', peterMembershipId).single()

  const secondCall = await deactivateSchoolMembership(peterUserId, schoolAId)
  assert.equal(secondCall, false, 'no active membership left to deactivate')

  const { data: after } = await db
    .from('class_subjects').select('ended_at').eq('teacher_id', peterMembershipId).single()
  assert.equal(after!.ended_at, before!.ended_at, 'the original end timestamp is preserved')
})

test('16. re-assigning the SAME teacher is a no-op that does not reset their tenure', async () => {
  const { data: before } = await db
    .from('class_subjects').select('id, started_at')
    .eq('class_id', sevenEastId).eq('subject_id', mathsId).is('ended_at', null).single()

  const result = await assignSubjectTeacher(schoolAId, sevenEastId, mathsId, maryMembershipId)
  assert.equal(result.unchanged, true)
  assert.equal(result.replaced, false)

  const { data: rows } = await db
    .from('class_subjects').select('id, started_at')
    .eq('class_id', sevenEastId).eq('subject_id', mathsId).is('ended_at', null)
  assert.equal(rows!.length, 1, 'no duplicate current assignment')
  assert.equal(rows![0].id, before!.id, 'same row')
  assert.equal(rows![0].started_at, before!.started_at, 'started_at not reset by a repeat click')
})

test('23. the database itself refuses two current assignments for one class+subject', async () => {
  // Not application logic — the partial unique index. This is what makes the
  // invariant hold under concurrent admins, not just careful callers.
  const { error } = await db.from('class_subjects').insert({
    school_id: schoolAId, class_id: sevenEastId, subject_id: mathsId,
    teacher_id: graceMembershipId, started_at: new Date().toISOString(),
  })
  assert.ok(error, 'insert rejected')
  assert.match(error!.message, /duplicate key|unique/i)
})

test('23b. a historical row can never be mistaken for a current one', async () => {
  const current = await listClassSubjects(sevenEastId)
  assert.ok(!current.some(cs => cs.teacher_id === peterMembershipId), 'Peter absent from current listing')
  const history = await getClassSubjectHistory(schoolAId, sevenEastId, mathsId)
  assert.ok(history.some(h => h.teacherId === peterMembershipId), 'but present in history')
})

// ── 17/18. Authorization ────────────────────────────────────────────────────

test('17+18. only an admin of THIS school may end employment here', async () => {
  const { requireSchoolAdmin } = await import('@/lib/core/permissions')
  const { createClient } = await import('@supabase/supabase-js')
  const signIn = async (email: string) => {
    const c = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
    const { error } = await c.auth.signInWithPassword({ email, password: PASSWORD })
    if (error) throw error
    return c
  }

  // A teacher at School A cannot pass the admin gate the deactivate action uses.
  const { data: graceAuth } = await db.auth.admin.getUserById(graceUserId)
  const graceClient = await signIn(graceAuth.user!.email!)
  await assert.rejects(() => requireSchoolAdmin(graceClient, schoolAId), /admin|permission/i)

  // School B's admin has no authority at School A.
  const { data: adminBAuth } = await db.auth.admin.getUserById(schoolBAdminId)
  const adminBClient = await signIn(adminBAuth.user!.email!)
  await assert.rejects(() => requireSchoolAdmin(adminBClient, schoolAId), /membership|admin|permission/i)
})

// ── Transfer to School B ────────────────────────────────────────────────────

test('Peter transfers to School B: new membership and assignments, School A history intact', async () => {
  const { data: peterAuth } = await db.auth.admin.getUserById(peterUserId)
  await inviteTeacher(schoolBId, peterAuth.user!.email!, schoolBAdminId)
  const accepted = await acceptTeacherInvitation(peterUserId, schoolBId, { full_name: `${SYNTHETIC_MARKER} peter` })
  const peterBMembership = accepted.schoolUser.id

  const { data: bClasses } = await db
    .from('classes').select('id, grade_id, academic_year_id').eq('school_id', schoolBId).limit(1)
  const bClass = await createClass(schoolBId, {
    grade_id: bClasses![0].grade_id,
    academic_year_id: bClasses![0].academic_year_id,
    display_name: `${SYNTHETIC_MARKER} School B Grade 7`,
  })
  await assignSubjectTeacher(schoolBId, bClass.id, mathsId, peterBMembership)

  const assignments = await listTeachingAssignmentsForUser(peterUserId)
  assert.equal(assignments.length, 1, 'only the School B assignment is current')
  assert.equal(assignments[0].schoolId, schoolBId)

  // School A history survives, and did not follow him.
  const { data: schoolAHistory } = await db
    .from('class_subjects').select('id, ended_at').eq('teacher_id', peterMembershipId)
  assert.equal(schoolAHistory!.length, 1)
  assert.ok(schoolAHistory![0].ended_at, 'still closed')

  // School A's entitlement did not travel with him: School B is not entitled,
  // so he is not school-covered there.
  const coverage = await resolveSchoolCoverage(peterUserId)
  assert.equal(coverage.outcome, 'not_covered')
})

// ── 20/21. No commercial or learner side effects ────────────────────────────

test('20+21. the whole lifecycle created no payment records and changed no learner data', async () => {
  const { count: payments } = await db
    .from('school_payments').select('id', { count: 'exact', head: true }).eq('school_id', schoolAId)
  assert.equal(payments, 0, 'staff turnover cost the school nothing')

  const { data: enrollment } = await db
    .from('learner_enrollments').select('class_id, status').eq('learner_id', learnerId).single()
  assert.equal(enrollment!.class_id, sevenEastId)
  assert.equal(enrollment!.status, 'active')

  const { count: evidence } = await db
    .from('learner_evidence').select('id', { count: 'exact', head: true }).eq('learner_id', learnerId)
  assert.equal(evidence, 0, 'no evidence was fabricated or destroyed by staff changes')

  const { data: school } = await db
    .from('schools').select('school_entitlement_status').eq('id', schoolAId).single()
  assert.equal(school!.school_entitlement_status, 'active')
})

// ── 20b. Historical educational work survives departure ─────────────────────

test('20b. Peter\'s scheme of work and record of work survive his departure intact', async () => {
  // Written while employed, checked after departure. Deactivation is an UPDATE
  // on school_users.is_active — it deletes nothing, and no FK from
  // schemes_of_work/records_of_work reaches school_users or schools at all
  // (both hang off teachers.id), so there is no cascade path to fire.
  const teacher = await repos.teachers.findTeacherByUserId(peterUserId)
  assert.ok(teacher)

  const { data: sow, error: sowErr } = await db.from('schemes_of_work').insert({
    teacher_id: teacher.id, learning_area: 'Mathematics', grade: 'Grade 7',
    term: 1, year: 2026, school: `${SYNTHETIC_MARKER}_A`, curriculum_mode: 'cbc_junior',
    lessons: [], timeline: [], lessons_per_week: 5,
  }).select('id').single()
  assert.equal(sowErr, null, 'fixture: SOW created')

  const { data: row, error: rowErr } = await db.from('records_of_work').insert({
    teacher_id: teacher.id, scheme_id: sow!.id, learning_area: 'Mathematics',
    grade: 'Grade 7', term: '1', year: 2026, school: `${SYNTHETIC_MARKER}_A`,
  }).select('id').single()
  assert.equal(rowErr, null, 'fixture: RoW created')

  // Peter is already deactivated at School A by this point in the suite; run
  // it again to be certain a repeat departure does not reach them either.
  await deactivateSchoolMembership(peterUserId, schoolAId)

  const { data: sowAfter } = await db.from('schemes_of_work').select('id, teacher_id').eq('id', sow!.id).maybeSingle()
  assert.ok(sowAfter, 'the scheme of work still exists')
  assert.equal(sowAfter!.teacher_id, teacher.id, 'still attributed to Peter, not rewritten')

  const { data: rowAfter } = await db.from('records_of_work').select('id').eq('id', row!.id).maybeSingle()
  assert.ok(rowAfter, 'the record of work still exists')

  await db.from('records_of_work').delete().eq('id', row!.id)
  await db.from('schemes_of_work').delete().eq('id', sow!.id)
})

// ── Reinstatement (Phase 9 — the gap this phase closes) ─────────────────────
//
// Peter was deactivated at School A earlier in this suite (tests 3+4, 15).
// These tests pick up from that state: he is currently a departed
// (is_active=false, joined_at NOT null) membership at School A.

test('25. reinstating a pending (never-accepted) invite is rejected, not treated as a departure', async () => {
  const pendingUser = await mkUser('pending-not-departed')
  const { inviteTeacher } = await import('@/lib/core/teacherOnboarding')
  const invited = await inviteTeacher(schoolAId, pendingUser.email, schoolAAdminId)
  assert.equal(invited.status, 'invited')
  await assert.rejects(
    () => reinstateSchoolMembership(schoolAId, invited.schoolUser.id),
    /activated|pending/i,
  )
})

test('26. reinstating Peter restores the SAME membership row, no duplicate', async () => {
  const before = await db.from('school_users').select('id, user_id, school_id, is_active').eq('id', peterMembershipId).single()
  assert.equal(before.data!.is_active, false, 'fixture: Peter is departed going into this test')

  const result = await reinstateSchoolMembership(schoolAId, peterMembershipId)
  assert.equal(result.reinstated, true)

  const after = await db.from('school_users').select('id, user_id, school_id, is_active').eq('id', peterMembershipId).single()
  assert.equal(after.data!.id, before.data!.id, 'same school_users row, not a new one')
  assert.equal(after.data!.user_id, before.data!.user_id, 'same person identity')
  assert.equal(after.data!.is_active, true, 'membership active again')

  const { count } = await db.from('school_users').select('id', { count: 'exact', head: true })
    .eq('school_id', schoolAId).eq('user_id', peterUserId)
  assert.equal(count, 1, 'still exactly one school_users row for Peter at School A')
})

test('27. reinstatement does not resurrect Peter\'s old Mathematics tenure', async () => {
  const { data: current } = await db
    .from('class_subjects').select('teacher_id')
    .eq('class_id', sevenEastId).eq('subject_id', mathsId).is('ended_at', null)
  assert.equal(current!.length, 1, 'still exactly one current teacher for 7A Mathematics')
  assert.equal(current![0].teacher_id, maryMembershipId, 'Mary — not resurrected back to Peter')

  // Scoped to School A: Peter also legitimately holds an active, assigned
  // membership at School B from the earlier transfer test in this suite —
  // multi-school membership is independent per school (§21-22), not a leak.
  const assignments = await listTeachingAssignmentsForUser(peterUserId)
  const atSchoolA = assignments.filter(a => a.schoolId === schoolAId)
  assert.equal(atSchoolA.length, 0, 'reinstated Peter has zero current School A teaching load until assigned')
})

test('28. reinstated Peter appears as active, not pending or departed, on the Team roster', async () => {
  const roster = await listTeacherMemberships(schoolAId)
  const peterRow = roster.find(r => r.schoolUserId === peterMembershipId)
  assert.ok(peterRow)
  assert.equal(peterRow!.status, 'active')
})

test('29. admin can assign Peter new current teaching load after reinstatement, independent of his old history', async () => {
  const { data: classes } = await db
    .from('classes').select('grade_id, academic_year_id').eq('id', sevenEastId).single()
  const eightEast = await createClass(schoolAId, {
    grade_id: classes!.grade_id, academic_year_id: classes!.academic_year_id,
    display_name: `${SYNTHETIC_MARKER} Grade 8 East (post-reinstatement)`,
  })

  await assignSubjectTeacher(schoolAId, eightEast.id, mathsId, peterMembershipId)

  const assignments = await listTeachingAssignmentsForUser(peterUserId)
  const atSchoolA = assignments.filter(a => a.schoolId === schoolAId)
  assert.equal(atSchoolA.length, 1, 'exactly one current School A assignment (School B\'s is separate)')
  assert.equal(atSchoolA[0].classId, eightEast.id, 'new current tenure, a different class from his old one')

  // Old 7A/7B history is completely unchanged by this new assignment.
  const { data: oldHistory } = await db
    .from('class_subjects').select('id, ended_at').eq('teacher_id', peterMembershipId).eq('class_id', sevenEastId)
  assert.equal(oldHistory!.length, 1)
  assert.ok(oldHistory![0].ended_at, 'the old 7A Mathematics tenure is still closed/historical')
})

test('30. reinstating an already-active membership is a safe idempotent no-op', async () => {
  const result = await reinstateSchoolMembership(schoolAId, peterMembershipId)
  assert.equal(result.reinstated, false, 'already active — nothing to do')
})

test('31. School B admin cannot reinstate a School A membership', async () => {
  await assert.rejects(
    () => reinstateSchoolMembership(schoolBId, peterMembershipId),
    /school|belong/i,
  )
})

// ── 24. The 144 live rows ───────────────────────────────────────────────────

test('24. every pre-existing production assignment survived the migration as CURRENT', async () => {
  // Rows created before this phase have started_at backfilled from created_at
  // and ended_at NULL. None was closed, deleted, or re-pointed.
  const { count: nullStarted } = await db
    .from('class_subjects').select('id', { count: 'exact', head: true }).is('started_at', null)
  assert.equal(nullStarted, 0, 'every row has a start date')

  // Outside this test's own fixtures, no row was closed by the migration.
  const { data: closedElsewhere } = await db
    .from('class_subjects').select('school_id').not('ended_at', 'is', null)
  const foreignClosed = (closedElsewhere ?? []).filter(r => !createdSchoolIds.includes(r.school_id as string))
  assert.equal(foreignClosed.length, 0, 'the migration closed nothing; only this test did')
})
