// lib/core/assignmentLearnerBridge.test.ts
//
// Phase 1C — proves the institutional learner roster bridge:
//   - reuses an existing Core-learner <-> legacy-student mapping, never
//     duplicates it
//   - safely provisions a compatibility student for an unmapped learner
//     (no fake auth, no fake parent, school_id stamped)
//   - is cross-school safe (a learner outside the target school is refused)
//   - is concurrency-safe (5 simultaneous calls converge on one student)
//   - materializes a Phase 1B compatibility class's roster from current
//     Core enrollment, idempotently
//   - correctly reflects new enrollment and exit (move away) without
//     touching historical assignment/evidence rows
//   - creates no evidence merely by bridging or syncing
//   - composes with the existing, unmodified fanOutPendingSubmissions so
//     exactly the right learners receive a pending submission
//
// Run: npx tsx --experimental-test-module-mocks --test lib/core/assignmentLearnerBridge.test.ts
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { createTestServiceClient as createServiceClient } from '@/utils/supabase/test-service'
import { repos } from '@/lib/repositories'
import { activateSchool } from '@/lib/core/schoolActivation'
import { inviteTeacher, acceptTeacherInvitation } from '@/lib/core/teacherOnboarding'
import { createClass, assignSubjectTeacher } from '@/lib/core/classes'
import { listSubjects } from '@/lib/core/subjects'
import { onboardLearner } from '@/lib/core/learnerOnboarding'
import { moveLearnerToClass } from '@/lib/core/learners'
import { asLearnerId } from '@/lib/core/identityTypes'
import {
  ensureAssignmentCompatibilityStudent,
  syncAssignmentCompatibilityRoster,
} from '@/lib/core/assignmentLearnerBridge'
import { createAssignment } from '@/lib/assignments/create'
import { deleteAuthUserOrThrow } from '@/lib/testing/deleteAuthUserOrThrow'

const SYNTHETIC_MARKER = 'SYNTHETIC_P1C_LEARNER_BRIDGE'
const db = createServiceClient()
const PASSWORD = `Test!${Math.random().toString(36).slice(2, 12)}`

const createdAuthUserIds: string[] = []
const createdSchoolIds: string[] = []

async function mkUser(label: string): Promise<{ id: string; email: string }> {
  const email = `p1c-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.com`
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
let academicYearId: string
let termId: string
let classId: string
let otherClassId: string
let mathsId: string
let teacherUserId: string
let teacherEmail: string
let teacherMembershipId: string

before(async () => {
  const admin = await mkUser('admin')
  adminId = admin.id
  const school = await repos.schools.create({ school_name: `${SYNTHETIC_MARKER}_${Date.now()}` }, adminId)
  schoolId = school.id
  createdSchoolIds.push(schoolId)
  await repos.schools.addSchoolUser(schoolId, adminId, 'school_admin')
  const act = await activateSchool(schoolId, { gradeCodes: ['G7'] })
  if (act.status !== 'complete') throw new Error(`fixture activation failed: ${act.error}`)

  const { data: classes } = await db.from('classes').select('id, grade_id, academic_year_id').eq('school_id', schoolId).limit(1)
  const gradeId = classes![0].grade_id
  academicYearId = classes![0].academic_year_id
  classId = classes![0].id

  const { data: class7B } = await db.from('classes').insert({
    school_id: schoolId, class_name: '7B', display_name: '7B', grade_id: gradeId, academic_year_id: academicYearId,
  }).select('id').single()
  otherClassId = class7B!.id

  const term = await repos.schools.findCurrentTerm(schoolId)
  termId = term!.id

  const subjects = await listSubjects('junior_secondary')
  mathsId = subjects.find(s => s.name === 'Mathematics')!.id

  const teacherUser = await mkUser('teacher')
  await inviteTeacher(schoolId, teacherUser.email, adminId)
  const accepted = await acceptTeacherInvitation(teacherUser.id, schoolId, { full_name: `${SYNTHETIC_MARKER} Teacher` })
  teacherUserId = teacherUser.id
  teacherEmail = teacherUser.email
  teacherMembershipId = accepted.schoolUser.id

  const otherAdmin = await mkUser('other-admin')
  const otherSchool = await repos.schools.create({ school_name: `${SYNTHETIC_MARKER}-other-school` }, otherAdmin.id)
  otherSchoolId = otherSchool.id
  createdSchoolIds.push(otherSchoolId)
  await repos.schools.addSchoolUser(otherSchoolId, otherAdmin.id, 'school_admin')
  await activateSchool(otherSchoolId, { gradeCodes: ['G7'] })
})

after(async () => {
  if (createdSchoolIds.length) {
    const { data: coreLearners } = await db.from('learners').select('id').in('school_id', createdSchoolIds)
    const learnerExternalIds = (coreLearners ?? []).map(l => l.id)
    if (learnerExternalIds.length) {
      const { data: bridgedStudents } = await db.from('students').select('id').in('external_id', learnerExternalIds)
      const studentIds = (bridgedStudents ?? []).map(s => s.id)
      if (studentIds.length) {
        await db.from('assignment_submissions').delete().in('student_id', studentIds)
        await db.from('learner_evidence').delete().in('learner_id', studentIds)
        await db.from('learner_projections').delete().in('learner_id', studentIds)
        await db.from('class_students').delete().in('student_id', studentIds)
        await db.from('students').delete().in('id', studentIds)
      }
    }
  }
  if (createdSchoolIds.length) {
    const { data: classSubjectRows } = await db.from('class_subjects').select('id').in('school_id', createdSchoolIds)
    const csIds = (classSubjectRows ?? []).map(r => r.id)
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
    await db.from('learner_enrollments').delete().eq('school_id', id)
    await db.from('learners').delete().eq('school_id', id)
    await db.from('class_subjects').delete().eq('school_id', id)
    await db.from('school_users').delete().eq('school_id', id)
    await db.from('schools').delete().eq('id', id)
  }
  for (const id of createdAuthUserIds) {
    await db.from('teachers').delete().eq('user_id', id)
    await db.from('profiles').delete().eq('id', id)
    await db.from('notification_log').delete().eq('user_id', id)
    await db.from('platform_events').delete().eq('actor_id', id)
    await deleteAuthUserOrThrow(db, id)
  }
})

async function admitToClass(admissionNumber: string, targetClassId: string): Promise<string> {
  const result = await onboardLearner(schoolId, {
    admission_number: admissionNumber, first_name: 'Test', last_name: 'Learner',
    class_id: targetClassId, term_id: termId, academic_year_id: academicYearId,
  })
  assert.equal(result.status, 'complete')
  return result.learnerId!
}

// ── §1: unmapped learner is safely provisioned ──────────────────────────

test('an unmapped Core learner gets a fresh compatibility student — no fake auth, school_id stamped', async () => {
  const learnerId = await admitToClass(`${SYNTHETIC_MARKER}-FRESH`, classId)

  const { studentId, created } = await ensureAssignmentCompatibilityStudent(schoolId, asLearnerId(learnerId), 7)
  assert.equal(created, true)

  const { data: row } = await db.from('students').select('id, external_id, school_id, user_id, parent_user_id, added_by, level').eq('id', studentId).single()
  assert.equal(row!.external_id, learnerId)
  assert.equal(row!.school_id, schoolId, 'school ownership stamped on the compatibility row')
  assert.equal(row!.user_id, null, 'no fabricated auth linkage')
  assert.equal(row!.parent_user_id, null, 'no fabricated parent linkage')
  assert.equal(row!.added_by, 'system')
  assert.equal(row!.level, 'Junior School')
})

// ── §2: idempotent — repeated calls reuse the same row ──────────────────

test('repeated calls for the same learner reuse the same compatibility student, never duplicate', async () => {
  const learnerId = await admitToClass(`${SYNTHETIC_MARKER}-IDEMPOTENT`, classId)
  const first = await ensureAssignmentCompatibilityStudent(schoolId, asLearnerId(learnerId), 7)
  const second = await ensureAssignmentCompatibilityStudent(schoolId, asLearnerId(learnerId), 7)
  assert.equal(first.studentId, second.studentId)
  assert.equal(second.created, false)

  const { data: rows } = await db.from('students').select('id').eq('external_id', learnerId)
  assert.equal(rows!.length, 1)
})

// ── §3: existing mapping (any path) is reused, never duplicated ─────────

test('a learner already bridged via a different path (direct external_id row) is reused as-is', async () => {
  const learnerId = await admitToClass(`${SYNTHETIC_MARKER}-PREEXISTING`, classId)
  const { data: preexisting } = await db.from('students').insert({
    name: 'Pre-existing Bridge', grade: 7, level: 'Junior School', curriculum_type: 'cbc',
    added_by: 'system', external_id: learnerId,
  }).select('id').single()

  const { studentId, created } = await ensureAssignmentCompatibilityStudent(schoolId, asLearnerId(learnerId), 7)
  assert.equal(studentId, preexisting!.id)
  assert.equal(created, false, 'existing mapping reused, not duplicated')
})

// ── §4: cross-school mismatch is blocked ─────────────────────────────────

test('a learner from a different school is refused, never silently bridged', async () => {
  const foreignLearnerId = await (async () => {
    const otherTerm = await repos.schools.findCurrentTerm(otherSchoolId)
    const { data: otherClasses } = await db.from('classes').select('id').eq('school_id', otherSchoolId).limit(1)
    const result = await onboardLearner(otherSchoolId, {
      admission_number: `${SYNTHETIC_MARKER}-FOREIGN`, first_name: 'Foreign', last_name: 'Learner',
      class_id: otherClasses![0].id, term_id: otherTerm!.id, academic_year_id: (await db.from('classes').select('academic_year_id').eq('id', otherClasses![0].id).single()).data!.academic_year_id,
    })
    return result.learnerId!
  })()

  await assert.rejects(
    () => ensureAssignmentCompatibilityStudent(schoolId, asLearnerId(foreignLearnerId), 7),
  )

  const { data: rows } = await db.from('students').select('id').eq('external_id', foreignLearnerId)
  assert.equal(rows?.length ?? 0, 0, 'no compatibility row was created for the wrong school')
})

// ── §5: concurrency ───────────────────────────────────────────────────────

test('5 concurrent ensure calls for the SAME learner converge on exactly one compatibility student', async () => {
  const learnerId = await admitToClass(`${SYNTHETIC_MARKER}-CONCURRENT`, classId)

  const results = await Promise.all([
    ensureAssignmentCompatibilityStudent(schoolId, asLearnerId(learnerId), 7),
    ensureAssignmentCompatibilityStudent(schoolId, asLearnerId(learnerId), 7),
    ensureAssignmentCompatibilityStudent(schoolId, asLearnerId(learnerId), 7),
    ensureAssignmentCompatibilityStudent(schoolId, asLearnerId(learnerId), 7),
    ensureAssignmentCompatibilityStudent(schoolId, asLearnerId(learnerId), 7),
  ])

  const distinct = new Set(results.map(r => r.studentId))
  assert.equal(distinct.size, 1, 'all five concurrent callers agree on ONE compatibility student')

  const { data: rows } = await db.from('students').select('id').eq('external_id', learnerId)
  assert.equal(rows!.length, 1, 'exactly one row survives — the DB constraint enforced this, not application luck')
})

// ── §6: no evidence generated by bridge creation alone ───────────────────

test('bridging a learner produces no learner_evidence and no learner_projections row', async () => {
  const learnerId = await admitToClass(`${SYNTHETIC_MARKER}-NOEVIDENCE`, classId)
  const { studentId } = await ensureAssignmentCompatibilityStudent(schoolId, asLearnerId(learnerId), 7)

  const { data: evidence } = await db.from('learner_evidence').select('id').eq('learner_id', studentId)
  const { data: projections } = await db.from('learner_projections').select('id').eq('learner_id', studentId)
  assert.equal(evidence?.length ?? 0, 0)
  assert.equal(projections?.length ?? 0, 0)
})

// ── §7-9: roster sync — materialization, idempotency, new enrollment ─────

test('roster sync materializes class_students for every currently enrolled learner, idempotently', async () => {
  await assignSubjectTeacher(schoolId, classId, mathsId, teacherMembershipId)
  const csId = await currentClassSubjectId(classId, mathsId)

  const l1 = await admitToClass(`${SYNTHETIC_MARKER}-ROSTER1`, classId)
  const l2 = await admitToClass(`${SYNTHETIC_MARKER}-ROSTER2`, classId)

  const first = await syncAssignmentCompatibilityRoster(csId)
  assert.equal(first.currentRosterSize >= 2, true)
  assert.ok(first.studentsCreated >= 2)

  const { data: rosterRows } = await db.from('class_students').select('students(external_id)').eq('class_id', first.teacherClassId)
  const rosterLearnerIds = (rosterRows ?? []).map(r => (r.students as unknown as { external_id: string }).external_id)
  assert.ok(rosterLearnerIds.includes(l1))
  assert.ok(rosterLearnerIds.includes(l2))

  // Re-run: idempotent, no duplicate class_students rows, no re-creation.
  const second = await syncAssignmentCompatibilityRoster(csId)
  assert.equal(second.studentsCreated, 0, 'second run creates no new compatibility students')
  assert.equal(second.teacherClassId, first.teacherClassId)
  const { data: rosterRowsAfter } = await db.from('class_students').select('id').eq('class_id', first.teacherClassId)
  assert.equal(rosterRowsAfter!.length, rosterRows!.length, 'no duplicate roster rows on repeated sync')

  // New enrollment: a third learner joins, sync picks them up.
  const l3 = await admitToClass(`${SYNTHETIC_MARKER}-ROSTER3`, classId)
  const third = await syncAssignmentCompatibilityRoster(csId)
  assert.equal(third.currentRosterSize, second.currentRosterSize + 1)
  const { data: rosterRowsFinal } = await db.from('class_students').select('students(external_id)').eq('class_id', first.teacherClassId)
  assert.ok((rosterRowsFinal ?? []).map(r => (r.students as unknown as { external_id: string }).external_id).includes(l3))
})

// ── §10-11: exit on move — current roster correct, history preserved ─────

test('a learner who moves away is removed from the compatibility roster on next sync, but historical submissions survive', async () => {
  await assignSubjectTeacher(schoolId, classId, mathsId, teacherMembershipId)
  const csId = await currentClassSubjectId(classId, mathsId)

  const leaverId = await admitToClass(`${SYNTHETIC_MARKER}-LEAVER`, classId)
  const stayerId = await admitToClass(`${SYNTHETIC_MARKER}-STAYER`, classId)

  const before = await syncAssignmentCompatibilityRoster(csId)
  assert.ok(before.currentRosterSize >= 2)

  // Real assignment against the compatibility class, so we can prove history survives.
  const teacherClient = await signInAs(teacherEmail)
  const { assignment } = await createAssignment(teacherClient, {
    classId: before.teacherClassId, title: 'Phase 1C Fixture Assignment', subject: 'Mathematics',
    topic: 'Fractions', substrandId: null, instructions: 'Do the thing',
    dueDate: new Date(Date.now() + 86400000).toISOString(),
    type: undefined, maxScore: undefined, isQuiz: undefined, isAdaptive: undefined,
    isCompassGuided: undefined, isHolidayAssignment: undefined, holidayPeriod: undefined, lessonPlanId: undefined,
  })
  const { data: leaverStudent } = await db.from('students').select('id').eq('external_id', leaverId).single()
  const { data: submissionsBefore } = await db.from('assignment_submissions').select('id, status').eq('assignment_id', assignment.id).eq('student_id', leaverStudent!.id)
  assert.equal(submissionsBefore?.length, 1, 'fixture assumption: fan-out pre-created a pending submission for the leaver')

  const move = await moveLearnerToClass(schoolId, leaverId, otherClassId)
  assert.equal(move.moved, true)

  const after = await syncAssignmentCompatibilityRoster(csId)
  assert.equal(after.removed, 1)
  assert.equal(after.currentRosterSize, before.currentRosterSize - 1)

  const { data: rosterAfter } = await db.from('class_students').select('id').eq('class_id', before.teacherClassId).eq('student_id', leaverStudent!.id)
  assert.equal(rosterAfter?.length, 0, 'leaver no longer on the current compatibility roster')

  const { data: stayerStudent } = await db.from('students').select('id').eq('external_id', stayerId).single()
  const { data: rosterStayer } = await db.from('class_students').select('id').eq('class_id', before.teacherClassId).eq('student_id', stayerStudent!.id)
  assert.equal(rosterStayer?.length, 1, 'stayer untouched')

  // History preserved: the submission row from before the move still exists, unchanged.
  const { data: submissionsAfter } = await db.from('assignment_submissions').select('id, status').eq('assignment_id', assignment.id).eq('student_id', leaverStudent!.id)
  assert.deepEqual(submissionsAfter, submissionsBefore, 'historical assignment_submissions untouched by roster exit')
})

// ── §12: assignment fan-out proof ─────────────────────────────────────────

test('assignment fan-out reaches exactly the synced roster, no extra learner', async () => {
  await assignSubjectTeacher(schoolId, classId, mathsId, teacherMembershipId)
  const csId = await currentClassSubjectId(classId, mathsId)

  const inRosterId = await admitToClass(`${SYNTHETIC_MARKER}-FANOUT-IN`, classId)
  const notInRosterId = await admitToClass(`${SYNTHETIC_MARKER}-FANOUT-OUT`, otherClassId) // different Core class, never synced into this compatibility class

  const synced = await syncAssignmentCompatibilityRoster(csId)

  const teacherClient = await signInAs(teacherEmail)
  const { assignment } = await createAssignment(teacherClient, {
    classId: synced.teacherClassId, title: 'Phase 1C Fan-out Fixture', subject: 'Mathematics',
    topic: 'Algebra', substrandId: null, instructions: 'Solve for x',
    dueDate: new Date(Date.now() + 86400000).toISOString(),
    type: undefined, maxScore: undefined, isQuiz: undefined, isAdaptive: undefined,
    isCompassGuided: undefined, isHolidayAssignment: undefined, holidayPeriod: undefined, lessonPlanId: undefined,
  })

  const { data: inRosterStudent } = await db.from('students').select('id').eq('external_id', inRosterId).single()
  const { data: submissionsForIn } = await db.from('assignment_submissions').select('id').eq('assignment_id', assignment.id).eq('student_id', inRosterStudent!.id)
  assert.equal(submissionsForIn?.length, 1, 'the synced learner received a pending submission')

  const { data: notInRosterStudent } = await db.from('students').select('id').eq('external_id', notInRosterId)
  if (notInRosterStudent?.length) {
    const { data: submissionsForOut } = await db.from('assignment_submissions').select('id').eq('assignment_id', assignment.id).eq('student_id', notInRosterStudent[0].id)
    assert.equal(submissionsForOut?.length ?? 0, 0, 'the unrelated-class learner received nothing')
  }
})
