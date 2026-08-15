// lib/testing/legacyRosterConvergence.http.integration.test.ts
//
// Phase 5 — proves the actual route composition (not just the underlying
// lib functions, already covered by lib/core/legacyRosterConvergence.test.ts):
// PATCH /api/core/learners/[id] action:'move' calls moveLearnerToClass()
// THEN removeStaleLegacyRosterMembership() in sequence, through a real
// authenticated HTTP request.
//
// Run: LMS_TEST_BASE_URL=http://localhost:3000 npx tsx --env-file=.env.local --test lib/testing/legacyRosterConvergence.http.integration.test.ts
// (requires a real dev server already running)

import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createServiceClient } from '@/utils/supabase/service'
import { repos } from '@/lib/repositories'
import { activateSchool } from '@/lib/core/schoolActivation'
import { inviteTeacher, acceptTeacherInvitation } from '@/lib/core/teacherOnboarding'
import { onboardLearner } from '@/lib/core/learnerOnboarding'
import { ensureBridgedClass, ensureBridgedLearner } from '@/lib/core/academicBridge'
import { asLearnerId } from '@/lib/core/identityTypes'
import { signInForHttpTest, type SyntheticSession } from './httpAuthTestHelper'

const BASE_URL = process.env.LMS_TEST_BASE_URL ?? 'http://localhost:3000'
const SYNTHETIC_MARKER = 'SYNTHETIC_PHASE5_CONVERGENCE_HTTP_TEST'
const db = createServiceClient()

const createdAuthUserIds: string[] = []
const createdSchoolIds: string[] = []

async function mkAuthUser(label: string) {
  const email = `${SYNTHETIC_MARKER.toLowerCase()}-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.com`
  const password = `Test!${Math.random().toString(36).slice(2, 10)}`
  const { data, error } = await db.auth.admin.createUser({ email, password, email_confirm: true })
  if (error) throw error
  createdAuthUserIds.push(data.user.id)
  return { id: data.user.id, email, password }
}

let schoolId: string
let adminSession: SyntheticSession
let class7A_id: string
let class7B_id: string
let learnerId: string
let legacyStudentId: string
let legacyClassId: string

before(async () => {
  const admin = await mkAuthUser('admin')
  const school = await repos.schools.create({ school_name: `${SYNTHETIC_MARKER}-school` }, admin.id)
  schoolId = school.id
  createdSchoolIds.push(schoolId)
  await repos.schools.addSchoolUser(schoolId, admin.id, 'school_admin')
  const activation = await activateSchool(schoolId, { gradeCodes: ['G7'] })
  if (activation.status !== 'complete') throw new Error(`fixture activation failed: ${activation.error}`)
  adminSession = await signInForHttpTest(admin.email, admin.password)

  const { data: classes } = await db.from('classes').select('id, grade_id, academic_year_id').eq('school_id', schoolId).limit(1)
  const gradeId = classes![0].grade_id
  const academicYearId = classes![0].academic_year_id
  class7A_id = classes![0].id

  const { data: class7B } = await db.from('classes').insert({
    school_id: schoolId, class_name: '7B', display_name: '7B', grade_id: gradeId, academic_year_id: academicYearId,
  }).select('id').single()
  class7B_id = class7B!.id

  const term = await repos.schools.findCurrentTerm(schoolId)

  const teacher = await mkAuthUser('teacher')
  await inviteTeacher(schoolId, teacher.email, admin.id)
  await acceptTeacherInvitation(teacher.id, schoolId, { full_name: 'HTTP Test Teacher' })

  const result = await onboardLearner(schoolId, {
    admission_number: `${SYNTHETIC_MARKER}-JANE`, first_name: 'Jane', last_name: 'HttpTest',
    class_id: class7A_id, term_id: term!.id, academic_year_id: academicYearId,
  })
  learnerId = result.learnerId!

  const bridged = await ensureBridgedClass(schoolId, class7A_id, teacher.id)
  legacyClassId = bridged.legacyClassId
  const bridgedLearner = await ensureBridgedLearner(schoolId, asLearnerId(learnerId), bridged)
  legacyStudentId = bridgedLearner.legacyStudentId
})

after(async () => {
  await db.from('class_students').delete().eq('student_id', legacyStudentId)
  await db.from('teacher_classes').delete().eq('external_id', class7A_id)
  await db.from('students').delete().eq('external_id', learnerId)
  await db.from('learner_enrollments').delete().eq('school_id', schoolId)
  await db.from('learners').delete().eq('school_id', schoolId)
  await db.from('teachers').delete().in('user_id', createdAuthUserIds)
  await db.from('school_users').delete().eq('school_id', schoolId)
  await db.from('schools').delete().eq('id', schoolId)
  for (const id of createdAuthUserIds) {
    await db.from('profiles').delete().eq('id', id)
    await db.auth.admin.deleteUser(id)
  }
})

function cookie(session: SyntheticSession) {
  return { Cookie: session.cookieHeader }
}

test('PATCH .../move: the legacy 7A roster is real before the request', async () => {
  const { data } = await db.from('class_students').select('id').eq('class_id', legacyClassId).eq('student_id', legacyStudentId)
  assert.equal(data?.length, 1)
})

test('PATCH .../move: converges legacy roster in the same HTTP request as the canonical move', async () => {
  const res = await fetch(`${BASE_URL}/api/core/learners/${learnerId}`, {
    method: 'PATCH',
    headers: { ...cookie(adminSession), 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'move', schoolId, class_id: class7B_id }),
  })
  assert.equal(res.status, 200)
  const json = await res.json()
  assert.equal(json.data.moved, true)

  const { data: legacyAfter } = await db.from('class_students').select('id').eq('class_id', legacyClassId).eq('student_id', legacyStudentId)
  assert.equal(legacyAfter?.length, 0, 'the legacy roster row must be gone after the same HTTP request that moved the learner')
})
