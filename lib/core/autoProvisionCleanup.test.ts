// lib/core/autoProvisionCleanup.test.ts
//
// Teacher auto-provision cleanup. Proves that performing ordinary teacher
// work can no longer manufacture an institution.
//
// Before this phase, a teacher with no active school membership who created a
// class (or added a learner) silently got a school named "{their name}'s
// School (pending setup)" AND a `school_users` row with role='school_admin'
// over it. School structure is provisioned by administrators; teachers do not
// found institutions, and school-admin authority is never a side effect of a
// teacher-side write.
//
// The central assertion in almost every test below is a SCHOOL COUNT DELTA of
// zero. Counting rows is what actually proves "no institution was
// manufactured" — asserting a return value only proves what the function
// chose to tell us.
//
// Run: npx tsx --env-file=.env.local --test lib/core/autoProvisionCleanup.test.ts
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createTestServiceClient as createServiceClient } from '@/utils/supabase/test-service'
import { repos } from '@/lib/repositories'
import { activateSchool } from '@/lib/core/schoolActivation'
import { inviteTeacher, acceptTeacherInvitation } from '@/lib/core/teacherOnboarding'
import { createClass, assignSubjectTeacher } from '@/lib/core/classes'
import { listSubjects } from '@/lib/core/subjects'
import { deactivateSchoolMembership } from '@/lib/core/school-users'
import { resolveExistingOwningSchool } from '@/lib/core/institutionOwnership'
import { resolveTeachingContext, listTeachingAssignmentsForUser } from '@/lib/core/teachingAssignments'

const SYNTHETIC_MARKER = 'SYNTHETIC_APCLEAN_TEST'
const db = createServiceClient()
const PASSWORD = `Test!${Math.random().toString(36).slice(2, 12)}`

const createdAuthUserIds: string[] = []
const createdSchoolIds: string[] = []

async function mkAuthUser(label: string): Promise<{ id: string; email: string }> {
  const email = `apclean-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.com`
  const { data, error } = await db.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true })
  if (error) throw error
  createdAuthUserIds.push(data.user.id)
  return { id: data.user.id, email }
}

/** The measurement that matters: how many schools exist right now. */
async function schoolCount(): Promise<number> {
  const { count, error } = await db.from('schools').select('id', { count: 'exact', head: true })
  if (error) throw error
  return count ?? 0
}

async function autoProvisionedCount(): Promise<number> {
  const { count, error } = await db
    .from('schools')
    .select('id', { count: 'exact', head: true })
    .eq('provisioning_source', 'teacher_first_write_auto_provision')
  if (error) throw error
  return count ?? 0
}

let schoolAId: string
let adminId: string
let peterUserId: string
let peterMembershipId: string
let sevenEastId: string
let mathsId: string

let departedUserId: string
let unassignedUserId: string
let soloUserId: string

before(async () => {
  const admin = await mkAuthUser('admin')
  adminId = admin.id
  const school = await repos.schools.create({ school_name: `${SYNTHETIC_MARKER}_${Date.now()}` }, admin.id)
  schoolAId = school.id
  createdSchoolIds.push(schoolAId)
  await repos.schools.addSchoolUser(schoolAId, admin.id, 'school_admin')

  const activation = await activateSchool(schoolAId, { gradeCodes: ['G7'] })
  if (activation.status !== 'complete') throw new Error(`fixture activation failed: ${activation.error}`)

  const { data: classes } = await db
    .from('classes').select('id, grade_id, academic_year_id').eq('school_id', schoolAId).limit(1)

  const subjects = await listSubjects('junior_secondary')
  mathsId = subjects.find(s => s.name === 'Mathematics')!.id

  const sevenEast = await createClass(schoolAId, {
    grade_id: classes![0].grade_id,
    academic_year_id: classes![0].academic_year_id,
    display_name: `${SYNTHETIC_MARKER} Grade 7 East`,
  })
  sevenEastId = sevenEast.id

  // Peter — employed, assigned.
  const peter = await mkAuthUser('peter')
  peterUserId = peter.id
  await inviteTeacher(schoolAId, peter.email, adminId)
  const accepted = await acceptTeacherInvitation(peter.id, schoolAId, { full_name: `${SYNTHETIC_MARKER} Peter` })
  peterMembershipId = accepted.schoolUser.id
  await assignSubjectTeacher(schoolAId, sevenEastId, mathsId, peterMembershipId)

  // A school teacher with a membership but no assignment.
  const unassigned = await mkAuthUser('unassigned')
  unassignedUserId = unassigned.id
  await inviteTeacher(schoolAId, unassigned.email, adminId)
  await acceptTeacherInvitation(unassigned.id, schoolAId, { full_name: `${SYNTHETIC_MARKER} Unassigned` })

  // A departed teacher — membership deactivated.
  const departed = await mkAuthUser('departed')
  departedUserId = departed.id
  await inviteTeacher(schoolAId, departed.email, adminId)
  await acceptTeacherInvitation(departed.id, schoolAId, { full_name: `${SYNTHETIC_MARKER} Departed` })
  await deactivateSchoolMembership(departed.id, schoolAId)

  // A genuine Solo Teacher — identity, no membership anywhere, no entitlement.
  const solo = await mkAuthUser('solo')
  soloUserId = solo.id
  await db.from('teachers').insert({
    user_id: solo.id, full_name: `${SYNTHETIC_MARKER} Solo`, school: 'Some Private Tuition',
  })
})

after(async () => {
  // class_subjects.teacher_id -> school_users(id) is ON DELETE NO ACTION, so
  // a school delete cascades to school_users and is then BLOCKED by any
  // surviving assignment row. Clear assignments first or the delete fails
  // silently and leaks fixture schools.
  for (const id of createdSchoolIds) await db.from('class_subjects').delete().eq('school_id', id)
  for (const id of createdSchoolIds) {
    const { error } = await db.from('schools').delete().eq('id', id)
    // Surfaced, not swallowed: a silently-failing cleanup is how synthetic
    // fixture schools accumulate in the live database unnoticed.
    if (error) console.error(`[cleanup] school ${id} not deleted: ${error.message}`)
  }
  for (const id of createdAuthUserIds) {
    await db.from('teachers').delete().eq('user_id', id)
    await db.from('profiles').delete().eq('id', id)
    await db.auth.admin.deleteUser(id)
  }
})

// ── 1/2/3. The school-linked teacher ────────────────────────────────────────

test('1. a school-linked teacher reads assignments with no provisioning', async () => {
  const before = await schoolCount()

  const context = await resolveTeachingContext(peterUserId)
  assert.equal(context.kind, 'school')
  if (context.kind === 'school') {
    assert.ok(context.assignments.some(a => a.classId === sevenEastId && a.subjectId === mathsId))
  }

  assert.equal(await schoolCount(), before, 'reading My Teaching created no school')
})

test('2. a school-linked teacher resolves to their OWN school and never manufactures another', async () => {
  const before = await schoolCount()

  const { schoolId } = await resolveExistingOwningSchool(peterUserId)
  assert.equal(schoolId, schoolAId, 'resolves to School A, the school that employs him')

  assert.equal(await schoolCount(), before, 'no second school was created')
})

test('3. no teacher-side path can self-promote to school_admin', async () => {
  // Peter's only membership is the teacher one the admin created.
  const { data: memberships } = await db
    .from('school_users').select('role, school_id, is_active').eq('user_id', peterUserId)
  assert.equal(memberships!.length, 1)
  assert.equal(memberships![0].role, 'teacher')
  assert.equal(memberships![0].school_id, schoolAId)

  // And the resolver that used to grant school_admin is no longer reachable
  // from any production route — proven by grep in the phase report, and
  // structurally here: the resolver teacher routes now use cannot write.
  const before = await autoProvisionedCount()
  await resolveExistingOwningSchool(peterUserId)
  await resolveExistingOwningSchool(unassignedUserId)
  await resolveExistingOwningSchool(soloUserId)
  assert.equal(await autoProvisionedCount(), before, 'no auto-provisioned school row was created')
})

// ── 4. Zero assignments ─────────────────────────────────────────────────────

test('4. school teacher with zero assignments gets a clean empty state, not a new school', async () => {
  const before = await schoolCount()

  const context = await resolveTeachingContext(unassignedUserId)
  assert.equal(context.kind, 'school_unassigned')

  // Their membership still resolves — they belong to School A, they simply
  // have nothing assigned.
  const { schoolId } = await resolveExistingOwningSchool(unassignedUserId)
  assert.equal(schoolId, schoolAId)

  assert.equal(await schoolCount(), before)
})

// ── 5. Departed teacher (Phase 15 — characterize, do not implement transfer) ─

test('5. a departed teacher inherits nothing and is handed no replacement school', async () => {
  const before = await schoolCount()

  // Does NOT inherit the former school: findSchoolUserByUserId filters
  // is_active, so an inactive membership resolves to nothing.
  const { schoolId } = await resolveExistingOwningSchool(departedUserId)
  assert.equal(schoolId, null, 'no inherited school')

  // And critically, no school is invented to replace it. Before this phase
  // this exact path produced a brand-new "{name}'s School (pending setup)"
  // with the departed teacher as its school_admin.
  assert.equal(await schoolCount(), before, 'no replacement school was manufactured')

  // Their workspace resolves as solo — an inactive membership is not a
  // school relationship. Transfer/reinstatement workflow is NOT implemented
  // here; this only characterizes the safe resolution.
  const context = await resolveTeachingContext(departedUserId)
  assert.equal(context.kind, 'solo')
  assert.equal((await listTeachingAssignmentsForUser(departedUserId)).length, 0)
})

// ── 6/7. Solo Teacher compatibility ─────────────────────────────────────────

test('6. a genuine Solo Teacher resolves to no school, and none is created', async () => {
  const before = await schoolCount()
  const beforeAuto = await autoProvisionedCount()

  const { schoolId } = await resolveExistingOwningSchool(soloUserId)
  assert.equal(schoolId, null)

  assert.equal(await schoolCount(), before, 'a Solo Teacher does not found an institution')
  assert.equal(await autoProvisionedCount(), beforeAuto)
})

test('7. a Solo Teacher\'s private class is school-less, and that is the honest value', async () => {
  const before = await schoolCount()

  // This is exactly what POST /api/teacher/classes now writes for a teacher
  // with no membership: school_id NULL. Both teacher_classes.school_id and
  // students.school_id are nullable precisely so a private class need not
  // belong to an institution.
  const teacher = await repos.teachers.findTeacherByUserId(soloUserId)
  assert.ok(teacher)
  const { schoolId } = await resolveExistingOwningSchool(soloUserId)

  const { data: cls, error } = await db.from('teacher_classes').insert({
    teacher_id: teacher.id,
    school_id: schoolId, // null — no invention
    name: `${SYNTHETIC_MARKER} Solo Private Class`,
    grade: 7,
    subject: 'Mathematics',
    academic_year: '2026',
    class_code: `APC${Date.now().toString().slice(-7)}`,
  }).select('id, school_id').single()

  assert.equal(error, null, 'a school-less private class is accepted by the schema')
  assert.equal(cls!.school_id, null)
  assert.equal(await schoolCount(), before, 'creating a private class created no school')

  await db.from('teacher_classes').delete().eq('id', cls!.id)
})

test('8. a school teacher\'s private class still adopts their real school', async () => {
  // The membership branch is unchanged — only the invention branch was
  // removed. A teacher who genuinely has a school still gets it attached.
  const { schoolId } = await resolveExistingOwningSchool(peterUserId)
  assert.equal(schoolId, schoolAId)
})

// ── 9. The anti-pattern itself ──────────────────────────────────────────────

test('9. no "pending setup" school is created by any teacher-side resolution', async () => {
  const { count: before } = await db
    .from('schools').select('id', { count: 'exact', head: true }).ilike('school_name', '%pending setup%')

  // Every teacher persona, through the resolver the routes now use.
  for (const uid of [peterUserId, unassignedUserId, departedUserId, soloUserId]) {
    await resolveExistingOwningSchool(uid)
  }

  const { count: after } = await db
    .from('schools').select('id', { count: 'exact', head: true }).ilike('school_name', '%pending setup%')

  assert.equal(after, before, 'no "(pending setup)" school was minted')
})

// ── 10. Cross-school isolation is unchanged ─────────────────────────────────

test('10. the cleanup narrowed authority and broadened none', async () => {
  // A second school, entirely unrelated.
  const otherAdmin = await mkAuthUser('other-admin')
  const otherSchool = await repos.schools.create(
    { school_name: `${SYNTHETIC_MARKER}_OTHER_${Date.now()}` }, otherAdmin.id,
  )
  createdSchoolIds.push(otherSchool.id)
  await repos.schools.addSchoolUser(otherSchool.id, otherAdmin.id, 'school_admin')

  // Peter still resolves only to his own school, and holds no membership at
  // the other one.
  const { schoolId } = await resolveExistingOwningSchool(peterUserId)
  assert.equal(schoolId, schoolAId)

  const { data: strayMembership } = await db
    .from('school_users').select('id').eq('user_id', peterUserId).eq('school_id', otherSchool.id)
  assert.equal(strayMembership!.length, 0)

  // And the other school is untouched by anything Peter did.
  const { data: otherMembers } = await db.from('school_users').select('user_id').eq('school_id', otherSchool.id)
  assert.equal(otherMembers!.length, 1)
  assert.equal(otherMembers![0].user_id, otherAdmin.id)
})

// ── 11. Admin-side institutional creation still works ───────────────────────

test('11. the school administrator can still create institutional classes', async () => {
  const { data: yr } = await db
    .from('classes').select('grade_id, academic_year_id').eq('school_id', schoolAId).limit(1)

  const cls = await createClass(schoolAId, {
    grade_id: yr![0].grade_id,
    academic_year_id: yr![0].academic_year_id,
    display_name: `${SYNTHETIC_MARKER} Grade 7 West`,
  })
  assert.equal(cls.school_id, schoolAId)

  // And assignment through the canonical admin path still lands.
  await assignSubjectTeacher(schoolAId, cls.id, mathsId, peterMembershipId)
  const assignments = await listTeachingAssignmentsForUser(peterUserId)
  assert.ok(assignments.some(a => a.classId === cls.id))
})
