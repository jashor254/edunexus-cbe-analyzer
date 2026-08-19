// lib/core/assignmentCompatibilityBridge.test.ts
//
// Phase 1B — proves the class-level compatibility bridge
// (`ensureAssignmentCompatibilityClass`) resolves one teaching TENURE to
// exactly one legacy compatibility class, is idempotent, is race-safe under
// concurrent creation, denies a non-current or inactive-membership tenure,
// and gives a replacement teacher's new tenure its OWN bridge rather than
// repointing the departed teacher's.
//
// Deliberately does not exercise `class_students` roster population — this
// module does not populate it (see lib/core/assignmentCompatibilityBridge.ts
// module header; Phase 1B Step 12 blocker).
//
// Run: npx tsx --experimental-test-module-mocks --test lib/core/assignmentCompatibilityBridge.test.ts
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createTestServiceClient as createServiceClient } from '@/utils/supabase/test-service'
import { repos } from '@/lib/repositories'
import { activateSchool } from '@/lib/core/schoolActivation'
import { inviteTeacher, acceptTeacherInvitation } from '@/lib/core/teacherOnboarding'
import { createClass, assignSubjectTeacher } from '@/lib/core/classes'
import { listSubjects } from '@/lib/core/subjects'
import { deactivateSchoolMembership } from '@/lib/core/school-users'
import { ensureAssignmentCompatibilityClass } from '@/lib/core/assignmentCompatibilityBridge'

const SYNTHETIC_MARKER = 'SYNTHETIC_ACB_TEST'
const db = createServiceClient()
const PASSWORD = `Test!${Math.random().toString(36).slice(2, 12)}`

const createdAuthUserIds: string[] = []
const createdSchoolIds: string[] = []

async function mkUser(label: string): Promise<{ id: string; email: string }> {
  const email = `acb-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.com`
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

async function currentClassSubjectId(classId: string, subjectId: string): Promise<string> {
  const { data, error } = await db
    .from('class_subjects')
    .select('id')
    .eq('class_id', classId).eq('subject_id', subjectId).is('ended_at', null).single()
  if (error) throw error
  return data!.id as string
}

let schoolId: string
let adminId: string
let classId: string
let mathsId: string

let peterUserId: string
let peterMembershipId: string
let maryUserId: string
let maryMembershipId: string

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

  const cls = await createClass(schoolId, {
    grade_id: classes![0].grade_id,
    academic_year_id: classes![0].academic_year_id,
    display_name: `${SYNTHETIC_MARKER} Grade 7 East`,
  })
  classId = cls.id

  const peter = await addTeacher(schoolId, adminId, 'peter')
  peterUserId = peter.userId
  peterMembershipId = peter.membershipId
  const mary = await addTeacher(schoolId, adminId, 'mary')
  maryUserId = mary.userId
  maryMembershipId = mary.membershipId
})

after(async () => {
  await db.from('class_subject_legacy_bridge').delete().in(
    'teacher_class_id',
    (await db.from('teacher_classes').select('id').eq('school_id', schoolId)).data?.map(r => r.id) ?? []
  )
  await db.from('teacher_classes').delete().eq('school_id', schoolId)
  await db.from('class_subjects').delete().eq('school_id', schoolId)
  const { error: schoolErr } = await db.from('schools').delete().eq('id', schoolId)
  if (schoolErr) console.error(`[cleanup] school ${schoolId} not deleted: ${schoolErr.message}`)
  for (const id of createdAuthUserIds) {
    await db.from('notification_log').delete().eq('user_id', id)
    await db.from('teachers').delete().eq('user_id', id)
    await db.from('profiles').delete().eq('id', id)
    const { error } = await db.auth.admin.deleteUser(id)
    if (error) console.error(`[cleanup] auth user ${id} not deleted: ${error.message}`)
  }
})

test('1. current tenure resolves a fresh compatibility class', async () => {
  await assignSubjectTeacher(schoolId, classId, mathsId, peterMembershipId)
  const csId = await currentClassSubjectId(classId, mathsId)

  const bridge = await ensureAssignmentCompatibilityClass(csId)
  assert.equal(bridge.classSubjectId, csId)
  assert.ok(bridge.teacherClassId)

  const { data: tc } = await db.from('teacher_classes').select('id, school_id, teacher_id').eq('id', bridge.teacherClassId).single()
  assert.equal(tc!.school_id, schoolId, 'compatibility class is institution-linked')
})

test('2. resolving the same tenure twice returns the SAME compatibility class (idempotent)', async () => {
  const csId = await currentClassSubjectId(classId, mathsId)
  const first = await ensureAssignmentCompatibilityClass(csId)
  const second = await ensureAssignmentCompatibilityClass(csId)
  assert.equal(first.teacherClassId, second.teacherClassId)

  const { data: rows } = await db.from('class_subject_legacy_bridge').select('id').eq('class_subject_id', csId)
  assert.equal(rows!.length, 1, 'exactly one bridge row for this tenure')
})

test('3. concurrent bridge creation for the SAME tenure produces exactly one compatibility class', async () => {
  // A brand-new tenure (English), never bridged before, so both concurrent
  // calls race the actual insert path rather than hitting the fast "already
  // exists" branch.
  const subjects = await listSubjects('junior_secondary')
  const englishId = subjects.find(s => s.name === 'English')!.id
  await assignSubjectTeacher(schoolId, classId, englishId, peterMembershipId)
  const csId = await currentClassSubjectId(classId, englishId)

  const results = await Promise.all([
    ensureAssignmentCompatibilityClass(csId),
    ensureAssignmentCompatibilityClass(csId),
    ensureAssignmentCompatibilityClass(csId),
    ensureAssignmentCompatibilityClass(csId),
    ensureAssignmentCompatibilityClass(csId),
  ])

  const distinctTeacherClassIds = new Set(results.map(r => r.teacherClassId))
  assert.equal(distinctTeacherClassIds.size, 1, 'all five concurrent callers agree on ONE compatibility class')

  const { data: bridgeRows } = await db.from('class_subject_legacy_bridge').select('id').eq('class_subject_id', csId)
  assert.equal(bridgeRows!.length, 1, 'exactly one bridge row survives — the unique constraint, not application luck, enforced this')
})

test('4. a non-current (closed) tenure is refused a fresh bridge', async () => {
  const closedCsId = await currentClassSubjectId(classId, mathsId)
  // Replace Peter with Mary -> closes Peter's Maths tenure.
  await assignSubjectTeacher(schoolId, classId, mathsId, maryMembershipId)

  await assert.rejects(
    () => ensureAssignmentCompatibilityClass(closedCsId),
    /is not current/,
  )
})

test('5. replacement teacher tenure gets a DIFFERENT bridge than the departed teacher\'s — historical bridge untouched', async () => {
  const newCsId = await currentClassSubjectId(classId, mathsId) // Mary's new tenure
  const maryBridge = await ensureAssignmentCompatibilityClass(newCsId)

  const { data: peterHistoricalRow } = await db
    .from('class_subjects').select('id, teacher_id, ended_at')
    .eq('class_id', classId).eq('subject_id', mathsId).not('ended_at', 'is', null).single()
  assert.equal(peterHistoricalRow!.teacher_id, peterMembershipId)

  const { data: peterBridgeRow } = await db
    .from('class_subject_legacy_bridge').select('teacher_class_id')
    .eq('class_subject_id', peterHistoricalRow!.id).maybeSingle()

  assert.ok(peterBridgeRow, 'Peter\'s original bridge (created in test 1) still exists, untouched')
  assert.notEqual(peterBridgeRow!.teacher_class_id, maryBridge.teacherClassId, 'Mary\'s tenure never repoints Peter\'s bridge')
})

test('6. departed/inactive membership is refused a fresh bridge even for what would otherwise be a current tenure', async () => {
  const subjects = await listSubjects('junior_secondary')
  const kiswahiliId = subjects.find(s => s.name === 'Kiswahili')?.id ?? subjects[2].id
  await assignSubjectTeacher(schoolId, classId, kiswahiliId, maryMembershipId)
  const csId = await currentClassSubjectId(classId, kiswahiliId)

  // deactivateSchoolMembership closes Mary's current assignments too (per
  // teacherLifecycle.test.ts's existing coverage) — so this proves the
  // membership-active guard independently would still fire even if a
  // current row somehow survived deactivation.
  await deactivateSchoolMembership(maryUserId, schoolId)

  await assert.rejects(
    () => ensureAssignmentCompatibilityClass(csId),
    /is not current|not an active school member/,
  )
})
