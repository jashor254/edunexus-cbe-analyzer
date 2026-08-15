// lib/core/learnerLifecycle.test.ts
//
// Phase 4 ("The Term Turns and the Learner Moves") — the canonical
// class-move operation (moveLearnerToClass) and the two scoping fixes
// (enrollLearner / withdrawLearner) the Phase 3 audit found (F1/F2).
//
// Run: npx tsx --env-file=.env.local --test lib/core/learnerLifecycle.test.ts

import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { createServiceClient } from '@/utils/supabase/service'
import { repos } from '@/lib/repositories'
import { activateSchool } from '@/lib/core/schoolActivation'
import { onboardLearner } from '@/lib/core/learnerOnboarding'
import { moveLearnerToClass, enrollLearner, withdrawLearner, getClassRoster } from '@/lib/core/learners'
import { requireSchoolAdmin } from '@/lib/core/permissions'
import { SchoolMismatchError, PermissionDeniedError, ValidationError } from '@/lib/core/errors'

const SYNTHETIC_MARKER = 'SYNTHETIC_PHASE4_LEARNER_LIFECYCLE_TEST'
const db = createServiceClient()
const PASSWORD = `Test!${Math.random().toString(36).slice(2, 12)}`

const createdAuthUserIds: string[] = []
const createdSchoolIds: string[] = []

async function mkAuthUser(label: string): Promise<{ id: string; email: string }> {
  const email = `${SYNTHETIC_MARKER.toLowerCase()}-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.com`
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

let schoolId: string
let adminId: string
let adminEmail: string
let teacherEmail: string
let termId: string
let academicYearId: string
let classA_id: string
let classB_id: string

let otherSchoolId: string
let otherSchoolClassId: string
let otherSchoolLearnerId: string

before(async () => {
  const admin = await mkAuthUser('admin')
  adminId = admin.id
  adminEmail = admin.email
  const school = await repos.schools.create({ school_name: `${SYNTHETIC_MARKER}-school` }, adminId)
  schoolId = school.id
  createdSchoolIds.push(schoolId)
  await repos.schools.addSchoolUser(schoolId, adminId, 'school_admin')
  const activation = await activateSchool(schoolId, { gradeCodes: ['G7'] })
  if (activation.status !== 'complete') throw new Error(`fixture activation failed: ${activation.error}`)

  const { data: classes } = await db.from('classes').select('id, grade_id, academic_year_id').eq('school_id', schoolId).limit(1)
  const gradeId = classes![0].grade_id
  academicYearId = classes![0].academic_year_id
  classA_id = classes![0].id

  const { data: classB } = await db.from('classes').insert({
    school_id: schoolId, class_name: 'G7 B', display_name: 'G7 B', grade_id: gradeId, academic_year_id: academicYearId,
  }).select('id').single()
  classB_id = classB!.id

  const term = await repos.schools.findCurrentTerm(schoolId)
  termId = term!.id

  const teacher = await mkAuthUser('teacher')
  teacherEmail = teacher.email
  await db.from('school_users').insert({ school_id: schoolId, user_id: teacher.id, role: 'teacher', is_active: true })

  const otherAdmin = await mkAuthUser('other-admin')
  const otherSchool = await repos.schools.create({ school_name: `${SYNTHETIC_MARKER}-other-school` }, otherAdmin.id)
  otherSchoolId = otherSchool.id
  createdSchoolIds.push(otherSchoolId)
  await repos.schools.addSchoolUser(otherSchoolId, otherAdmin.id, 'school_admin')
  const otherActivation = await activateSchool(otherSchoolId, { gradeCodes: ['G7'] })
  if (otherActivation.status !== 'complete') throw new Error(`other-school fixture activation failed: ${otherActivation.error}`)
  const { data: otherClasses } = await db.from('classes').select('id').eq('school_id', otherSchoolId).limit(1)
  otherSchoolClassId = otherClasses![0].id

  const otherLearnerResult = await onboardLearner(otherSchoolId, {
    admission_number: `${SYNTHETIC_MARKER}-OTHER-1`, first_name: 'Other', last_name: 'School',
    class_id: otherSchoolClassId, term_id: (await repos.schools.findCurrentTerm(otherSchoolId))!.id, academic_year_id: (await repos.schools.findCurrentTerm(otherSchoolId))!.academic_year_id,
  })
  otherSchoolLearnerId = otherLearnerResult.learnerId!
})

after(async () => {
  for (const id of [schoolId, otherSchoolId]) {
    await db.from('learner_enrollments').delete().eq('school_id', id)
    await db.from('learners').delete().eq('school_id', id)
    await db.from('school_users').delete().eq('school_id', id)
    await db.from('schools').delete().eq('id', id)
  }
  for (const id of createdAuthUserIds) {
    await db.from('profiles').delete().eq('id', id)
    await db.auth.admin.deleteUser(id)
  }
})

async function admitToClassA(admissionNumber: string): Promise<string> {
  const result = await onboardLearner(schoolId, {
    admission_number: admissionNumber, first_name: 'Jane', last_name: 'Test',
    class_id: classA_id, term_id: termId, academic_year_id: academicYearId,
  })
  assert.equal(result.status, 'complete')
  return result.learnerId!
}

// ── Task B / §22: moveLearnerToClass ────────────────────────────────────

test('moveLearnerToClass: history — old enrollment remains historically queryable, new one is current', async () => {
  const learnerId = await admitToClassA(`${SYNTHETIC_MARKER}-1`)
  const result = await moveLearnerToClass(schoolId, learnerId, classB_id)
  assert.equal(result.moved, true)
  assert.equal(result.enrollment.class_id, classB_id)

  const { data: rows } = await db.from('learner_enrollments').select('class_id, ended_at').eq('learner_id', learnerId).order('created_at')
  assert.equal(rows?.length, 2)
  assert.equal(rows?.[0].class_id, classA_id)
  assert.ok(rows?.[0].ended_at)
  assert.equal(rows?.[1].class_id, classB_id)
  assert.equal(rows?.[1].ended_at, null)

  const rosterA = await getClassRoster(classA_id, termId)
  const rosterB = await getClassRoster(classB_id, termId)
  assert.ok(!rosterA.some(l => l.id === learnerId), 'must no longer appear in the old class roster')
  assert.ok(rosterB.some(l => l.id === learnerId), 'must appear in the new class roster')
})

test('moveLearnerToClass: current uniqueness — the DB itself refuses two current enrollments for one learner+term', async () => {
  const learnerId = await admitToClassA(`${SYNTHETIC_MARKER}-2`)
  await assert.rejects(async () => {
    await db.from('learner_enrollments').insert({
      school_id: schoolId, learner_id: learnerId, class_id: classB_id, term_id: termId,
      academic_year_id: academicYearId, status: 'active', enrollment_date: new Date().toISOString().split('T')[0],
    }).throwOnError()
  })
})

test('moveLearnerToClass: same-class retry does not generate duplicate history', async () => {
  const learnerId = await admitToClassA(`${SYNTHETIC_MARKER}-3`)
  const first = await moveLearnerToClass(schoolId, learnerId, classA_id)
  assert.equal(first.moved, false)
  const second = await moveLearnerToClass(schoolId, learnerId, classA_id)
  assert.equal(second.moved, false)

  const { data: rows } = await db.from('learner_enrollments').select('id').eq('learner_id', learnerId)
  assert.equal(rows?.length, 1)
})

test('moveLearnerToClass: a cross-school learner is rejected', async () => {
  await assert.rejects(
    () => moveLearnerToClass(schoolId, otherSchoolLearnerId, classA_id),
    SchoolMismatchError
  )
})

test('moveLearnerToClass: a cross-school destination class is rejected', async () => {
  const learnerId = await admitToClassA(`${SYNTHETIC_MARKER}-4`)
  await assert.rejects(
    () => moveLearnerToClass(schoolId, learnerId, otherSchoolClassId),
    SchoolMismatchError
  )
})

test('moveLearnerToClass: a withdrawn learner is not silently reactivated', async () => {
  const learnerId = await admitToClassA(`${SYNTHETIC_MARKER}-5`)
  await withdrawLearner(learnerId, schoolId, termId)
  await assert.rejects(
    () => moveLearnerToClass(schoolId, learnerId, classB_id),
    ValidationError
  )
})

// ── Task D/E — F1/F2 scoping ────────────────────────────────────────────

test('enrollLearner: a cross-school learner_id is rejected (F1)', async () => {
  await assert.rejects(
    () => enrollLearner({ school_id: schoolId, learner_id: otherSchoolLearnerId, class_id: classA_id, term_id: termId, academic_year_id: academicYearId }),
    SchoolMismatchError
  )
})

test('enrollLearner: a cross-school class_id is rejected (F1)', async () => {
  const learnerId = await admitToClassA(`${SYNTHETIC_MARKER}-6`)
  await assert.rejects(
    () => enrollLearner({ school_id: schoolId, learner_id: learnerId, class_id: otherSchoolClassId, term_id: termId, academic_year_id: academicYearId }),
    SchoolMismatchError
  )
})

test('withdrawLearner: a cross-school learner_id is rejected (F2)', async () => {
  await assert.rejects(
    () => withdrawLearner(otherSchoolLearnerId, schoolId, termId),
    SchoolMismatchError
  )
})

// ── §24 — authorization ──────────────────────────────────────────────────

test('a plain teacher cannot pass requireSchoolAdmin to reach institutional enrollment mutation', async () => {
  const client = await signInAs(teacherEmail)
  await assert.rejects(() => requireSchoolAdmin(client, schoolId), PermissionDeniedError)
})

test('the school admin can pass requireSchoolAdmin for their own school', async () => {
  const client = await signInAs(adminEmail)
  const membership = await requireSchoolAdmin(client, schoolId)
  assert.equal(membership.role, 'school_admin')
})
