// lib/core/phase4PilotScenario.integration.test.ts
//
// Phase 4 ("The Term Turns and the Learner Moves") — the primary proof,
// per the phase brief's own §31 scenario, that the self-serve institutional
// loop for LEARNERS closes the same way Phase 2 proved it for teachers.
//
// School A, Term 1: 7A = {Jane, Peter}, 7B = {Mary}. Alice -> 7A Math,
// Brian -> 7B Math (both via the real Phase 2 invite/accept lifecycle, not
// raw DB rows).
//
//   Step 1 — admin moves Jane 7A -> 7B. Prove: 7A = {Peter}, 7B = {Mary, Jane},
//            and Jane's original 7A placement survives as closed history.
//   Step 2 — term rolls over (Task C's rollEnrollmentsToTerm, the function
//            runEndOfTerm now calls). Prove Term 2: 7A = {Peter}, 7B = {Mary, Jane}.
//   Step 3 — teachers do nothing. Alice's and Brian's own class rosters
//            (read the same way MyTeaching/gradebook would — by their
//            assigned class + the school's current term) reflect exactly
//            administration's changes.
//   Step 4 — a cross-school enrollment mutation is rejected.
//
// Run: npx tsx --env-file=.env.local --test lib/core/phase4PilotScenario.integration.test.ts

import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createServiceClient } from '@/utils/supabase/service'
import { repos } from '@/lib/repositories'
import { activateSchool } from '@/lib/core/schoolActivation'
import { onboardLearner } from '@/lib/core/learnerOnboarding'
import { moveLearnerToClass, getClassRoster, rollEnrollmentsToTerm, enrollLearner } from '@/lib/core/learners'
import { inviteSchoolMember, acceptTeacherInvitation } from '@/lib/core/teacherOnboarding'
import { assignSubjectTeacher } from '@/lib/core/classes'
import { listSubjects } from '@/lib/core/subjects'
import { SchoolMismatchError } from '@/lib/core/errors'

const SYNTHETIC_MARKER = 'SYNTHETIC_PHASE4_PILOT_SCENARIO'
const db = createServiceClient()

const createdAuthUserIds: string[] = []
const createdSchoolIds: string[] = []

async function mkAuthUser(label: string) {
  const email = `${SYNTHETIC_MARKER.toLowerCase()}-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.com`
  const { data, error } = await db.auth.admin.createUser({ email, password: 'Test!12345678', email_confirm: true })
  if (error) throw error
  createdAuthUserIds.push(data.user.id)
  return { id: data.user.id, email }
}

let schoolId: string
let otherSchoolId: string
let adminId: string
let academicYearId: string
let term1Id: string
let term2Id: string
let class7A_id: string
let class7B_id: string
let mathSubjectId: string

let janeId: string
let peterId: string
let maryId: string

let aliceSchoolUserId: string
let brianSchoolUserId: string

before(async () => {
  const admin = await mkAuthUser('admin')
  adminId = admin.id
  const school = await repos.schools.create({ school_name: `${SYNTHETIC_MARKER}-school` }, adminId)
  schoolId = school.id
  createdSchoolIds.push(schoolId)
  await repos.schools.addSchoolUser(schoolId, adminId, 'school_admin')
  const activation = await activateSchool(schoolId, { gradeCodes: ['G7'] })
  if (activation.status !== 'complete') throw new Error(`fixture activation failed: ${activation.error}`)

  const { data: classes } = await db.from('classes').select('id, grade_id, academic_year_id').eq('school_id', schoolId).limit(1)
  const gradeId = classes![0].grade_id
  academicYearId = classes![0].academic_year_id
  class7A_id = classes![0].id

  const { data: class7B } = await db.from('classes').insert({
    school_id: schoolId, class_name: '7B', display_name: '7B', grade_id: gradeId, academic_year_id: academicYearId,
  }).select('id').single()
  class7B_id = class7B!.id

  const term1 = await repos.schools.findCurrentTerm(schoolId)
  term1Id = term1!.id
  const allTerms = await repos.schools.listTerms(schoolId, academicYearId)
  term2Id = allTerms.find(t => t.term_number === 2)!.id

  const mathSubjects = await listSubjects('junior_secondary')
  mathSubjectId = mathSubjects.find(s => s.name.toLowerCase().includes('math'))?.id ?? mathSubjects[0].id

  // ── School A, Term 1 rosters ──
  const jane = await onboardLearner(schoolId, { admission_number: `${SYNTHETIC_MARKER}-JANE`, first_name: 'Jane', last_name: 'Wanjiru', class_id: class7A_id, term_id: term1Id, academic_year_id: academicYearId })
  const peter = await onboardLearner(schoolId, { admission_number: `${SYNTHETIC_MARKER}-PETER`, first_name: 'Peter', last_name: 'Otieno', class_id: class7A_id, term_id: term1Id, academic_year_id: academicYearId })
  const mary = await onboardLearner(schoolId, { admission_number: `${SYNTHETIC_MARKER}-MARY`, first_name: 'Mary', last_name: 'Achieng', class_id: class7B_id, term_id: term1Id, academic_year_id: academicYearId })
  janeId = jane.learnerId!
  peterId = peter.learnerId!
  maryId = mary.learnerId!

  // ── Teachers, via the real Phase 2 invite/accept lifecycle ──
  const aliceUser = await mkAuthUser('alice')
  await inviteSchoolMember(schoolId, aliceUser.email, 'teacher', adminId)
  const aliceAccepted = await acceptTeacherInvitation(aliceUser.id, schoolId, { full_name: 'Alice' })
  aliceSchoolUserId = aliceAccepted.schoolUser.id

  const brianUser = await mkAuthUser('brian')
  await inviteSchoolMember(schoolId, brianUser.email, 'teacher', adminId)
  const brianAccepted = await acceptTeacherInvitation(brianUser.id, schoolId, { full_name: 'Brian' })
  brianSchoolUserId = brianAccepted.schoolUser.id

  await assignSubjectTeacher(schoolId, class7A_id, mathSubjectId, aliceSchoolUserId)
  await assignSubjectTeacher(schoolId, class7B_id, mathSubjectId, brianSchoolUserId)

  // ── A second, unrelated school for Step 4's cross-school proof ──
  const otherAdmin = await mkAuthUser('other-admin')
  const otherSchool = await repos.schools.create({ school_name: `${SYNTHETIC_MARKER}-other-school` }, otherAdmin.id)
  otherSchoolId = otherSchool.id
  createdSchoolIds.push(otherSchoolId)
  await repos.schools.addSchoolUser(otherSchoolId, otherAdmin.id, 'school_admin')
  await activateSchool(otherSchoolId, { gradeCodes: ['G7'] })
})

after(async () => {
  for (const id of [schoolId, otherSchoolId]) {
    await db.from('class_subjects').delete().eq('school_id', id)
    await db.from('learner_enrollments').delete().eq('school_id', id)
    await db.from('learners').delete().eq('school_id', id)
    await db.from('school_users').delete().eq('school_id', id)
    await db.from('schools').delete().eq('id', id)
  }
  for (const id of createdAuthUserIds) {
    await db.from('teachers').delete().eq('user_id', id)
    await db.from('profiles').delete().eq('id', id)
    await db.auth.admin.deleteUser(id)
  }
})

test('Day 1: Term 1 rosters are exactly as the admin set them up', async () => {
  const roster7A = await getClassRoster(class7A_id, term1Id)
  const roster7B = await getClassRoster(class7B_id, term1Id)
  assert.deepEqual(roster7A.map(l => l.id).sort(), [janeId, peterId].sort())
  assert.deepEqual(roster7B.map(l => l.id), [maryId])
})

test('Step 1: admin moves Jane 7A -> 7B — current rosters update, old placement survives as history', async () => {
  const result = await moveLearnerToClass(schoolId, janeId, class7B_id)
  assert.equal(result.moved, true)

  const roster7A = await getClassRoster(class7A_id, term1Id)
  const roster7B = await getClassRoster(class7B_id, term1Id)
  assert.deepEqual(roster7A.map(l => l.id), [peterId])
  assert.deepEqual(roster7B.map(l => l.id).sort(), [maryId, janeId].sort())

  const { data: janeHistory } = await db.from('learner_enrollments').select('class_id, ended_at').eq('learner_id', janeId).order('created_at')
  assert.equal(janeHistory?.length, 2)
  assert.equal(janeHistory?.[0].class_id, class7A_id)
  assert.ok(janeHistory?.[0].ended_at, 'Jane was in 7A earlier this term — that fact must remain provable')
  assert.equal(janeHistory?.[1].class_id, class7B_id)
  assert.equal(janeHistory?.[1].ended_at, null)
})

test('Step 2: term rolls over — Term 2 rosters carry forward exactly the post-move state', async () => {
  await rollEnrollmentsToTerm(schoolId, class7A_id, term1Id, term2Id, academicYearId)
  await rollEnrollmentsToTerm(schoolId, class7B_id, term1Id, term2Id, academicYearId)

  const roster7A_t2 = await getClassRoster(class7A_id, term2Id)
  const roster7B_t2 = await getClassRoster(class7B_id, term2Id)
  assert.deepEqual(roster7A_t2.map(l => l.id), [peterId])
  assert.deepEqual(roster7B_t2.map(l => l.id).sort(), [maryId, janeId].sort())
})

test('Step 3: teachers do nothing — Alice\'s and Brian\'s own class rosters already reflect administration\'s changes', async () => {
  // Alice's and Brian's teaching assignments themselves are untouched by
  // any of the learner movement above — class_subjects only changes when
  // an admin reassigns a POST, which didn't happen here.
  const { data: aliceAssignment } = await db.from('class_subjects').select('class_id').eq('teacher_id', aliceSchoolUserId).is('ended_at', null).single()
  const { data: brianAssignment } = await db.from('class_subjects').select('class_id').eq('teacher_id', brianSchoolUserId).is('ended_at', null).single()
  assert.equal(aliceAssignment?.class_id, class7A_id)
  assert.equal(brianAssignment?.class_id, class7B_id)

  // What Alice/Brian actually see when they open their class (the same
  // getClassRoster call every roster-consuming surface uses) already
  // reflects the move + rollover — neither teacher wrote anything.
  const aliceRoster = await getClassRoster(aliceAssignment!.class_id, term2Id)
  const brianRoster = await getClassRoster(brianAssignment!.class_id, term2Id)
  assert.deepEqual(aliceRoster.map(l => l.id), [peterId])
  assert.deepEqual(brianRoster.map(l => l.id).sort(), [maryId, janeId].sort())
})

test('Step 4: a cross-school enrollment mutation is rejected', async () => {
  await assert.rejects(
    () => moveLearnerToClass(otherSchoolId, janeId, class7A_id),
    SchoolMismatchError
  )
  await assert.rejects(
    () => enrollLearner({ school_id: otherSchoolId, learner_id: janeId, class_id: class7A_id, term_id: term1Id, academic_year_id: academicYearId }),
    SchoolMismatchError
  )
})
