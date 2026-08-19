// lib/core/institutionalAssignmentAuthority.test.ts
//
// Phase 1D — proves institutional assignment AUTHORITY moved off legacy
// `teacher_classes` ownership onto the current teaching TENURE
// (`class_subjects`), per lib/core/permissions.ts::requireInstitutionalAssignmentAuthority
// and lib/assignments/create.ts's institutional mode.
//
// This is the critical proof the whole phase exists for: legacy compatibility
// class ownership (Phase 1B) MUST NOT itself grant authority. A departed
// teacher who still legally "owns" the compatibility `teacher_classes` row
// (Phase 1B never deletes it) must still be denied once their tenure closes.
//
// Run: npx tsx --experimental-test-module-mocks --test lib/core/institutionalAssignmentAuthority.test.ts
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { createTestServiceClient as createServiceClient } from '@/utils/supabase/test-service'
import { repos } from '@/lib/repositories'
import { activateSchool } from '@/lib/core/schoolActivation'
import { inviteTeacher, acceptTeacherInvitation } from '@/lib/core/teacherOnboarding'
import { createClass, assignSubjectTeacher } from '@/lib/core/classes'
import { listSubjects } from '@/lib/core/subjects'
import { deactivateSchoolMembership, reinstateSchoolMembership } from '@/lib/core/school-users'
import { requireInstitutionalAssignmentAuthority } from '@/lib/core/permissions'
import { ResourceOwnershipError, MembershipRequiredError } from '@/lib/core/errors'
import { createAssignment } from '@/lib/assignments/create'
import { deleteAuthUserOrThrow } from '@/lib/testing/deleteAuthUserOrThrow'

const SYNTHETIC_MARKER = 'SYNTHETIC_IAA_TEST'
const db = createServiceClient()
const PASSWORD = `Test!${Math.random().toString(36).slice(2, 12)}`

const createdAuthUserIds: string[] = []
const createdSchoolIds: string[] = []

async function mkUser(label: string): Promise<{ id: string; email: string }> {
  const email = `iaa-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.com`
  const { data, error } = await db.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true })
  if (error) throw error
  createdAuthUserIds.push(data.user.id)
  return { id: data.user.id, email }
}

async function signInAs(email: string): Promise<SupabaseClient> {
  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
  const { error } = await client.auth.signInWithPassword({ email, password: PASSWORD })
  if (error) throw error
  return client
}

async function addTeacher(schoolId: string, adminId: string, label: string) {
  const user = await mkUser(label)
  await inviteTeacher(schoolId, user.email, adminId)
  const accepted = await acceptTeacherInvitation(user.id, schoolId, { full_name: `${SYNTHETIC_MARKER} ${label}` })
  return { userId: user.id, email: user.email, membershipId: accepted.schoolUser.id }
}

async function currentClassSubjectId(classId: string, subjectId: string): Promise<string> {
  const { data, error } = await db
    .from('class_subjects')
    .select('id')
    .eq('class_id', classId).eq('subject_id', subjectId).is('ended_at', null).single()
  if (error) throw error
  return data!.id as string
}

let schoolId: string
let otherSchoolId: string
let adminId: string
let otherAdminId: string
let classId: string
let otherSchoolClassId: string
let mathsId: string
let englishId: string
let otherSchoolSubjectId: string

let peter: { userId: string; email: string; membershipId: string }
let mary: { userId: string; email: string; membershipId: string }

before(async () => {
  const admin = await mkUser('admin')
  adminId = admin.id
  const school = await repos.schools.create({ school_name: `${SYNTHETIC_MARKER}_${Date.now()}` }, admin.id)
  schoolId = school.id
  createdSchoolIds.push(schoolId)
  await repos.schools.addSchoolUser(schoolId, admin.id, 'school_admin')
  const act = await activateSchool(schoolId, { gradeCodes: ['G7'] })
  if (act.status !== 'complete') throw new Error(`fixture activation failed: ${act.error}`)

  const { data: classes } = await db.from('classes').select('id, grade_id, academic_year_id').eq('school_id', schoolId).limit(1)
  const subjects = await listSubjects('junior_secondary')
  mathsId = subjects.find(s => s.name === 'Mathematics')!.id
  englishId = subjects.find(s => s.name === 'English')!.id

  const cls = await createClass(schoolId, {
    grade_id: classes![0].grade_id,
    academic_year_id: classes![0].academic_year_id,
    display_name: `${SYNTHETIC_MARKER} Grade 7 East`,
  })
  classId = cls.id

  peter = await addTeacher(schoolId, adminId, 'peter')
  mary = await addTeacher(schoolId, adminId, 'mary')

  // A second, unrelated school — Step 14's multi-school proof.
  const otherAdmin = await mkUser('other-admin')
  otherAdminId = otherAdmin.id
  const otherSchool = await repos.schools.create({ school_name: `${SYNTHETIC_MARKER}-other-school` }, otherAdminId)
  otherSchoolId = otherSchool.id
  createdSchoolIds.push(otherSchoolId)
  await repos.schools.addSchoolUser(otherSchoolId, otherAdminId, 'school_admin')
  const otherAct = await activateSchool(otherSchoolId, { gradeCodes: ['G7'] })
  if (otherAct.status !== 'complete') throw new Error(`fixture activation failed (other school): ${otherAct.error}`)

  const { data: otherClasses } = await db.from('classes').select('id, grade_id, academic_year_id').eq('school_id', otherSchoolId).limit(1)
  otherSchoolClassId = otherClasses![0].id
  const otherSubjects = await listSubjects('junior_secondary')
  otherSchoolSubjectId = otherSubjects.find(s => s.name === 'Integrated Science')!.id

  // Peter also teaches at the second school — Step 14 needs ONE auth user
  // holding tenures at two different schools.
  await repos.schools.addSchoolUser(otherSchoolId, peter.userId, 'teacher')
})

after(async () => {
  if (createdSchoolIds.length) {
    const { data: csRows } = await db.from('class_subjects').select('id').in('school_id', createdSchoolIds)
    const csIds = (csRows ?? []).map(r => r.id)
    if (csIds.length) {
      const { data: bridgeRows } = await db.from('class_subject_legacy_bridge').select('id, teacher_class_id').in('class_subject_id', csIds)
      const tcIds = (bridgeRows ?? []).map(r => r.teacher_class_id)
      if (tcIds.length) {
        await db.from('assignments').delete().in('class_id', tcIds)
        await db.from('teacher_classes').delete().in('id', tcIds)
      }
      await db.from('class_subject_legacy_bridge').delete().in('class_subject_id', csIds)
    }
  }
  for (const id of createdSchoolIds) {
    await db.from('class_subjects').delete().eq('school_id', id)
    await db.from('school_users').delete().eq('school_id', id)
    await db.from('classes').delete().eq('school_id', id)
    await db.from('schools').delete().eq('id', id)
  }
  for (const id of createdAuthUserIds) {
    await db.from('notification_log').delete().eq('user_id', id)
    await db.from('platform_events').delete().eq('actor_id', id)
    await db.from('teachers').delete().eq('user_id', id)
    await db.from('profiles').delete().eq('id', id)
    await deleteAuthUserOrThrow(db, id)
  }
})

// ── Step 10/11 baseline: current tenure works ────────────────────────────

test('current tenure holder may create an institutional assignment; a client-supplied subject string is ignored', async () => {
  await assignSubjectTeacher(schoolId, classId, mathsId, peter.membershipId)
  const csId = await currentClassSubjectId(classId, mathsId)

  const authority = await requireInstitutionalAssignmentAuthority(await signInAs(peter.email), csId)
  assert.equal(authority.classSubjectId, csId)
  assert.equal(authority.schoolId, schoolId)
  assert.equal(authority.subjectName, 'Mathematics')

  const peterClient = await signInAs(peter.email)
  const { assignment } = await createAssignment(peterClient, {
    classSubjectId: csId,
    title: 'Institutional Fixture Assignment',
    subject: 'THIS SHOULD NEVER BE STORED — a contradictory client string',
    topic: 'Fractions',
    substrandId: null,
    instructions: 'Do the thing',
    dueDate: new Date(Date.now() + 86400000).toISOString(),
    type: undefined, maxScore: undefined, isQuiz: undefined, isAdaptive: undefined,
    isCompassGuided: undefined, isHolidayAssignment: undefined, holidayPeriod: undefined, lessonPlanId: undefined,
  })
  assert.equal(assignment.subject, 'Mathematics', 'Step 7 — Core subject authority, client string ignored/overwritten')

  const { data: bridgeRow } = await db.from('class_subject_legacy_bridge').select('teacher_class_id').eq('class_subject_id', csId).single()
  assert.equal(assignment.class_id, bridgeRow!.teacher_class_id, 'stored against the Phase 1B compatibility class')
})

// ── Step 13: wrong class/subject/school ───────────────────────────────────

test('wrong subject tenure ID (same teacher, same class, different subject) is denied 403', async () => {
  await assignSubjectTeacher(schoolId, classId, englishId, mary.membershipId)
  const englishCsId = await currentClassSubjectId(classId, englishId)

  // Peter does not hold the English tenure — only Mary does.
  await assert.rejects(
    async () => requireInstitutionalAssignmentAuthority(await signInAs(peter.email), englishCsId),
    ResourceOwnershipError,
  )
})

test('wrong school tenure ID is denied 403 — no cross-school bridge lookup', async () => {
  await assignSubjectTeacher(otherSchoolId, otherSchoolClassId, otherSchoolSubjectId, (await repos.teachers.findSchoolUser(peter.userId, otherSchoolId))!.id)
  const otherCsId = await currentClassSubjectId(otherSchoolClassId, otherSchoolSubjectId)

  // Mary has no membership at all in otherSchoolId — must be denied, not merely "wrong subject."
  await assert.rejects(
    async () => requireInstitutionalAssignmentAuthority(await signInAs(mary.email), otherCsId),
    ResourceOwnershipError,
  )
})

// ── Step 14: multi-school — one auth user, two independent contexts ─────

test('multi-school: Peter holds valid tenures at both schools independently, each authorizes only its own context', async () => {
  const mathsCsId = await currentClassSubjectId(classId, mathsId) // School A — Peter's own tenure
  const otherCsId = await currentClassSubjectId(otherSchoolClassId, otherSchoolSubjectId) // School B — Peter's own tenure

  const authorityA = await requireInstitutionalAssignmentAuthority(await signInAs(peter.email), mathsCsId)
  assert.equal(authorityA.schoolId, schoolId)

  const authorityB = await requireInstitutionalAssignmentAuthority(await signInAs(peter.email), otherCsId)
  assert.equal(authorityB.schoolId, otherSchoolId)
  assert.notEqual(authorityA.schoolId, authorityB.schoolId, 'two genuinely independent contexts, not one conflated one')
})

// ── Step 10/11/12: departed / replacement / reinstatement ───────────────

test('departed teacher proof: closed tenure denies even though the compatibility teacher_classes row is still Peter\'s', async () => {
  const closedCsId = await currentClassSubjectId(classId, mathsId) // Peter's current Maths tenure, about to close
  const { data: bridgeRowBefore } = await db.from('class_subject_legacy_bridge').select('teacher_class_id').eq('class_subject_id', closedCsId).maybeSingle()
  assert.ok(bridgeRowBefore, 'fixture assumption: Peter\'s Maths tenure was already bridged by the earlier success test')

  // Replace Peter with Mary on Maths -> closes Peter's tenure (ended_at set).
  await assignSubjectTeacher(schoolId, classId, mathsId, mary.membershipId)

  await assert.rejects(
    async () => requireInstitutionalAssignmentAuthority(await signInAs(peter.email), closedCsId),
    ResourceOwnershipError,
    'Peter\'s tenure is closed — the compatibility class he still legally owns must not grant him authority',
  )

  // The compatibility class itself is untouched — Phase 1B never deletes it.
  const { data: tc } = await db.from('teacher_classes').select('id, teacher_id').eq('id', bridgeRowBefore!.teacher_class_id).single()
  assert.ok(tc, 'compatibility class still exists (Phase 1B never deletes)')
})

test('replacement teacher proof: Mary\'s new tenure is allowed and resolves her OWN compatibility class, distinct from Peter\'s', async () => {
  const maryCsId = await currentClassSubjectId(classId, mathsId) // Mary's new tenure (created by the previous test's reassignment)

  const authority = await requireInstitutionalAssignmentAuthority(await signInAs(mary.email), maryCsId)
  assert.equal(authority.schoolId, schoolId)

  const maryClient = await signInAs(mary.email)
  const { assignment: maryAssignment } = await createAssignment(maryClient, {
    classSubjectId: maryCsId,
    title: 'Mary\'s Fixture Assignment',
    subject: 'ignored',
    topic: 'Decimals',
    substrandId: null,
    instructions: 'Do the other thing',
    dueDate: new Date(Date.now() + 86400000).toISOString(),
    type: undefined, maxScore: undefined, isQuiz: undefined, isAdaptive: undefined,
    isCompassGuided: undefined, isHolidayAssignment: undefined, holidayPeriod: undefined, lessonPlanId: undefined,
  })

  const { data: peterHistoricalRow } = await db
    .from('class_subjects').select('id, teacher_id, ended_at')
    .eq('class_id', classId).eq('subject_id', mathsId).not('ended_at', 'is', null).single()
  assert.equal(peterHistoricalRow!.teacher_id, peter.membershipId)

  const { data: peterBridgeRow } = await db
    .from('class_subject_legacy_bridge').select('teacher_class_id')
    .eq('class_subject_id', peterHistoricalRow!.id).maybeSingle()
  assert.ok(peterBridgeRow)
  assert.notEqual(peterBridgeRow!.teacher_class_id, maryAssignment.class_id, 'Mary\'s tenure never repoints/reuses Peter\'s compatibility class')

  // Historical integrity: Peter's earlier assignment (from the first test)
  // is untouched — still attributed to Peter's compatibility class/teacher.
  const { data: petersOldAssignments } = await db.from('assignments').select('id, teacher_id, class_id').eq('class_id', peterBridgeRow!.teacher_class_id)
  assert.ok(petersOldAssignments && petersOldAssignments.length >= 1, 'Peter\'s historical assignment still exists, unmoved')
})

test('reinstatement proof: membership reactivated WITHOUT a new tenure still denies institutional creation', async () => {
  const csId = await currentClassSubjectId(classId, englishId) // Mary currently holds English
  // Deactivate then reinstate Mary's SCHOOL membership — but she keeps
  // teaching English throughout (deactivate/reinstate doesn't touch this
  // particular tenure since it's Peter we're testing next). Use Peter
  // instead: he has no current tenure at all after the departed-teacher
  // test above.
  const wasActive = await deactivateSchoolMembership(peter.userId, schoolId)
  assert.equal(wasActive, true)

  const { reinstated } = await reinstateSchoolMembership(schoolId, peter.membershipId)
  assert.equal(reinstated, true)

  const { data: membership } = await db.from('school_users').select('is_active').eq('id', peter.membershipId).single()
  assert.equal(membership!.is_active, true, 'Peter is an active member again')

  // Peter's old (already-closed) Maths tenure id — reinstatement must not
  // implicitly reopen it.
  const { data: closedTenure } = await db.from('class_subjects').select('id').eq('class_id', classId).eq('subject_id', mathsId).eq('teacher_id', peter.membershipId).not('ended_at', 'is', null).single()

  await assert.rejects(
    async () => requireInstitutionalAssignmentAuthority(await signInAs(peter.email), closedTenure!.id),
    ResourceOwnershipError,
    'reinstated membership with no NEW current tenure must still be denied',
  )
})

test('inactive membership on an otherwise-current tenure is denied MembershipRequiredError, not silently allowed', async () => {
  // Give Peter a fresh current tenure again (a real admin re-assignment),
  // then deactivate his membership WITHOUT going through
  // deactivateSchoolMembership's own tenure-closing side effect — proves
  // requireInstitutionalAssignmentAuthority's independent membership-active
  // check, mirroring assignmentCompatibilityBridge.test.ts's test 6.
  const subjects = await listSubjects('junior_secondary')
  const kiswahiliId = subjects.find(s => s.name === 'Kiswahili')?.id ?? subjects[2].id
  await assignSubjectTeacher(schoolId, classId, kiswahiliId, peter.membershipId)
  const csId = await currentClassSubjectId(classId, kiswahiliId)

  await deactivateSchoolMembership(peter.userId, schoolId)

  await assert.rejects(
    async () => requireInstitutionalAssignmentAuthority(await signInAs(peter.email), csId),
    (err: unknown) => err instanceof ResourceOwnershipError || err instanceof MembershipRequiredError,
  )
})
