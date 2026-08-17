// lib/core/promotions.reenrollmentGap.test.ts
//
// Sprint 11 (Release Candidate Audit) found a CRITICAL gap: runAnnualPromotion()
// inserted a learner_promotions log row (and, for graduation, updated
// learners.status) but never created a new active learner_enrollments row
// for the learner's new class/year, and never withdrew the old one.
// "Promotion" was a record of intent, not a real state transition.
//
// Sprint 12 Wave 2 (Critical 2, Release Blocker Remediation) fixed this —
// see lib/core/promotions.ts's runAnnualPromotion() and its own doc
// comment. This file, previously named for and asserting the gap's exact
// symptom, now asserts the fix directly, per its own original instruction
// ("update this test to assert the fixed behavior instead... do not delete
// it"). Kept as its own file (distinct from lib/core/promotions.test.ts's
// broader coverage) specifically because it is the direct, named
// before/after record of this Critical finding's resolution.
//
// Run: npx tsx --env-file=.env.local --test lib/core/promotions.reenrollmentGap.test.ts
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createTestServiceClient as createServiceClient } from '@/utils/supabase/test-service'
import { repos } from '@/lib/repositories'
import { activateSchool } from '@/lib/core/schoolActivation'
import { onboardLearner } from '@/lib/core/learnerOnboarding'
import { runAnnualPromotion } from '@/lib/core/promotions'
import { deleteAuthUserOrThrow } from '@/lib/testing/deleteAuthUserOrThrow'

const SYNTHETIC_MARKER = 'SYNTHETIC_S11_REENROLL_GAP_TEST'
const db = createServiceClient()

const createdAuthUserIds: string[] = []
const createdSchoolIds: string[] = []

async function mkAuthUser(label: string): Promise<{ id: string }> {
  const email = `s11-reenroll-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.com`
  const { data, error } = await db.auth.admin.createUser({
    email, password: `Test!${Math.random().toString(36).slice(2, 10)}`, email_confirm: true,
  })
  if (error) throw error
  createdAuthUserIds.push(data.user.id)
  return { id: data.user.id }
}

let schoolId: string
let classId: string
let nextClassId: string
let nextYearId: string
let termId: string
let academicYearId: string
let adminSchoolUserId: string
let learnerId: string

before(async () => {
  const admin = await mkAuthUser('admin')
  const school = await repos.schools.create({ school_name: `${SYNTHETIC_MARKER}_${Date.now()}` }, admin.id)
  schoolId = school.id
  createdSchoolIds.push(schoolId)
  const adminSchoolUser = await repos.schools.addSchoolUser(schoolId, admin.id, 'school_admin')
  adminSchoolUserId = adminSchoolUser.id

  const activation = await activateSchool(schoolId, { gradeCodes: ['G7'] })
  if (activation.status !== 'complete') throw new Error(`fixture activation failed: ${activation.error}`)

  const { data: classes } = await db.from('classes').select('id, academic_year_id, grade_id').eq('school_id', schoolId).limit(1)
  classId = classes![0].id
  academicYearId = classes![0].academic_year_id

  const { data: terms } = await db.from('terms').select('id').eq('school_id', schoolId).order('term_number').limit(1)
  termId = terms![0].id

  // A genuinely distinct destination year (not the same year as the
  // source) — a real promotion always moves a learner into a new academic
  // year, which is also what avoids learner_enrollments' UNIQUE(learner_id,
  // term_id) treating the new enrollment as "the same slot" as the old one.
  const nextYear = await repos.schools.insertAcademicYear(schoolId, {
    name: `${SYNTHETIC_MARKER}_NEXT`, start_date: '2027-01-01', end_date: '2027-12-31',
  })
  nextYearId = nextYear.id
  await repos.schools.insertTerm(schoolId, {
    academic_year_id: nextYear.id, term_number: 1, name: `${SYNTHETIC_MARKER}_NEXT-T1`, start_date: '2027-01-01', end_date: '2027-04-01',
  })
  const nextClass = await repos.teachers.insertClass(schoolId, {
    grade_id: classes![0].grade_id, academic_year_id: nextYear.id, display_name: `${SYNTHETIC_MARKER}_NEXT-CLASS`,
  })
  nextClassId = nextClass.id

  const learner = await onboardLearner(schoolId, {
    admission_number: `${SYNTHETIC_MARKER}-1`, first_name: 'Promote', last_name: 'Gap',
    class_id: classId, term_id: termId, academic_year_id: academicYearId,
  })
  learnerId = learner.learnerId!
})

after(async () => {
  for (const id of createdSchoolIds) {
    await db.from('schools').delete().eq('id', id)
  }
  for (const id of createdAuthUserIds) {
    await db.from('profiles').delete().eq('id', id)
    await deleteAuthUserOrThrow(db, id)
  }
})

test('FIX CONFIRMED (Sprint 12 Wave 2): runAnnualPromotion creates a real active enrollment for the promoted learner in the destination class, and withdraws the old one', async () => {
  const result = await runAnnualPromotion(schoolId, adminSchoolUserId, {
    academic_year_id: academicYearId,
    decisions: [{ learner_id: learnerId, promotion_type: 'promoted', to_class_id: nextClassId, to_academic_year_id: nextYearId }],
  })
  assert.equal(result.processed, 1)
  assert.equal(result.errors.length, 0)

  // The promotion row correctly records the intended destination...
  const { data: promotionRow } = await db.from('learner_promotions').select('to_class_id').eq('learner_id', learnerId).single()
  assert.equal(promotionRow!.to_class_id, nextClassId)

  // ...and now a real active learner_enrollments row exists for the
  // destination class — this is the fix, verified directly.
  const { data: newEnrollment } = await db
    .from('learner_enrollments')
    .select('status')
    .eq('learner_id', learnerId)
    .eq('class_id', nextClassId)
    .single()
  assert.equal(newEnrollment!.status, 'active', 'FIX REGRESSION: the learner must be actively enrolled in the destination class after promotion.')

  // The learner's OLD enrollment is correctly withdrawn, not left dangling.
  const { data: oldEnrollment } = await db
    .from('learner_enrollments')
    .select('status')
    .eq('learner_id', learnerId)
    .eq('class_id', classId)
    .single()
  assert.equal(oldEnrollment!.status, 'withdrawn', 'FIX REGRESSION: the learner\'s old enrollment must be withdrawn, not left "active" after promotion.')
})
