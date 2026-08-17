// lib/core/promotions.test.ts
//
// Sprint 10 (Core Administration Completion) — lib/core/promotions.ts had
// zero test coverage before this sprint (docs/architecture/
// sprint9-school-operations-excellence-audit.md §Phase 7: "Core: 100%/0%
// (placeholder)" — backend never exercised at all, since the only caller
// was a FutureModule placeholder tile). This is the first real coverage of
// previewPromotion() and runAnnualPromotion(), now that the new Promotion
// page (app/teacher/core-office/academic/promotion) calls both.
//
// Run: npx tsx --env-file=.env.local --test lib/core/promotions.test.ts
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createTestServiceClient as createServiceClient } from '@/utils/supabase/test-service'
import { repos } from '@/lib/repositories'
import { activateSchool } from '@/lib/core/schoolActivation'
import { onboardLearner } from '@/lib/core/learnerOnboarding'
import { previewPromotion, runAnnualPromotion, getLearnerPromotionHistory } from '@/lib/core/promotions'
import { deleteAuthUserOrThrow } from '@/lib/testing/deleteAuthUserOrThrow'

const SYNTHETIC_MARKER = 'SYNTHETIC_S10_PROMOTIONS_TEST'
const db = createServiceClient()

const createdAuthUserIds: string[] = []
const createdSchoolIds: string[] = []

async function mkAuthUser(label: string): Promise<{ id: string }> {
  const email = `s10-promo-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.com`
  const { data, error } = await db.auth.admin.createUser({
    email, password: `Test!${Math.random().toString(36).slice(2, 10)}`, email_confirm: true,
  })
  if (error) throw error
  createdAuthUserIds.push(data.user.id)
  return { id: data.user.id }
}

let schoolId: string
let classId: string
let destinationClassId: string
let destinationYearId: string
let termId: string
let academicYearId: string
let adminSchoolUserId: string
let learnerAId: string
let learnerBId: string
let learnerCId: string
let learnerDId: string
let learnerEId: string

before(async () => {
  const admin = await mkAuthUser('admin')
  const school = await repos.schools.create({ school_name: `${SYNTHETIC_MARKER}_${Date.now()}` }, admin.id)
  schoolId = school.id
  createdSchoolIds.push(schoolId)
  const adminSchoolUser = await repos.schools.addSchoolUser(schoolId, admin.id, 'school_admin')
  // learner_promotions.processed_by is a FK to school_users(id), not
  // auth.uid() — see lib/core/promotions.ts's own doc comment and the
  // app/api/core/promotions/route.ts fix this sprint made for exactly this.
  adminSchoolUserId = adminSchoolUser.id

  const activation = await activateSchool(schoolId, { gradeCodes: ['G7'] })
  if (activation.status !== 'complete') throw new Error(`fixture activation failed: ${activation.error}`)

  const { data: classes } = await db.from('classes').select('id, academic_year_id, grade_id').eq('school_id', schoolId).limit(1)
  classId = classes![0].id
  academicYearId = classes![0].academic_year_id
  const { data: terms } = await db.from('terms').select('id').eq('school_id', schoolId).order('term_number').limit(1)
  termId = terms![0].id

  // A genuinely distinct destination academic year + class (Sprint 12 Wave
  // 2, Critical 2) — deliberately NOT the same year as the source, since
  // that would make the destination enrollment's term_id collide with the
  // source enrollment's (learner_enrollments' UNIQUE(learner_id,term_id)),
  // which upsertEnrollment would then treat as "move within the same
  // term," not "create a new enrollment" — correct behavior for that case,
  // but not what a real promotion (always into a new academic year) does.
  const destYear = await repos.schools.insertAcademicYear(schoolId, {
    name: `${SYNTHETIC_MARKER}_NEXT`, start_date: '2027-01-01', end_date: '2027-12-31',
  })
  destinationYearId = destYear.id
  await repos.schools.insertTerm(schoolId, {
    academic_year_id: destYear.id, term_number: 1, name: `${SYNTHETIC_MARKER}_NEXT-T1`, start_date: '2027-01-01', end_date: '2027-04-01',
  })
  const destClass = await repos.teachers.insertClass(schoolId, {
    grade_id: classes![0].grade_id, academic_year_id: destYear.id, display_name: `${SYNTHETIC_MARKER}_NEXT-CLASS`,
  })
  destinationClassId = destClass.id

  const learnerA = await onboardLearner(schoolId, {
    admission_number: `${SYNTHETIC_MARKER}-A`, first_name: 'Promote', last_name: 'Learner',
    class_id: classId, term_id: termId, academic_year_id: academicYearId,
  })
  learnerAId = learnerA.learnerId!

  const learnerB = await onboardLearner(schoolId, {
    admission_number: `${SYNTHETIC_MARKER}-B`, first_name: 'Graduate', last_name: 'Learner',
    class_id: classId, term_id: termId, academic_year_id: academicYearId,
  })
  learnerBId = learnerB.learnerId!

  const learnerC = await onboardLearner(schoolId, {
    admission_number: `${SYNTHETIC_MARKER}-C`, first_name: 'Duplicate', last_name: 'Learner',
    class_id: classId, term_id: termId, academic_year_id: academicYearId,
  })
  learnerCId = learnerC.learnerId!

  const learnerD = await onboardLearner(schoolId, {
    admission_number: `${SYNTHETIC_MARKER}-D`, first_name: 'NoDestination', last_name: 'Learner',
    class_id: classId, term_id: termId, academic_year_id: academicYearId,
  })
  learnerDId = learnerD.learnerId!

  const learnerE = await onboardLearner(schoolId, {
    admission_number: `${SYNTHETIC_MARKER}-E`, first_name: 'Concurrent', last_name: 'Learner',
    class_id: classId, term_id: termId, academic_year_id: academicYearId,
  })
  learnerEId = learnerE.learnerId!
})

after(async () => {
  for (const id of createdSchoolIds) {
    await db.from('schools').delete().eq('id', id)
  }
  for (const id of createdAuthUserIds) {
    await db.from('profiles').delete().eq('id', id)
    await db.from('notification_log').delete().eq('user_id', id)
    await db.from('platform_events').delete().eq('actor_id', id)
    await db.from('ingestion_runs').delete().eq('initiated_by', id)
    await deleteAuthUserOrThrow(db, id)
  }
})

test('previewPromotion: lists active enrollments for the academic year with a suggested action, and flags learners with no report card yet', async () => {
  const preview = await previewPromotion(schoolId, academicYearId, termId)
  assert.equal(preview.length, 5)
  const admissionNumbers = preview.map(p => p.admission_number).sort()
  assert.deepEqual(admissionNumbers, [`${SYNTHETIC_MARKER}-A`, `${SYNTHETIC_MARKER}-B`, `${SYNTHETIC_MARKER}-C`, `${SYNTHETIC_MARKER}-D`, `${SYNTHETIC_MARKER}-E`])
  // High 4 — none of these learners has a generated report card in this
  // fixture; the field must exist and be false, not silently absent.
  assert.ok(preview.every(p => p.hasReportCard === false))
})

test('runAnnualPromotion: a "promoted" decision withdraws the old enrollment and creates a real new one in the destination class (Critical 2 fix)', async () => {
  const result = await runAnnualPromotion(schoolId, adminSchoolUserId, {
    academic_year_id: academicYearId,
    decisions: [{ learner_id: learnerAId, promotion_type: 'promoted', to_class_id: destinationClassId, to_academic_year_id: destinationYearId }],
  })
  assert.equal(result.processed, 1)
  assert.equal(result.errors.length, 0)

  const history = await getLearnerPromotionHistory(learnerAId, schoolId)
  assert.equal(history.length, 1)
  assert.equal(history[0].promotion_type, 'promoted')
  assert.equal(history[0].from_class_id, classId)
  assert.equal(history[0].to_class_id, destinationClassId)

  const { data: learner } = await db.from('learners').select('status').eq('id', learnerAId).single()
  assert.equal(learner!.status, 'active', 'a promoted (not graduated) learner must remain active')

  // The actual fix, verified directly: a real active enrollment now exists
  // in the destination class, and the old one is withdrawn.
  const { data: newEnrollment } = await db.from('learner_enrollments').select('status').eq('learner_id', learnerAId).eq('class_id', destinationClassId).single()
  assert.equal(newEnrollment!.status, 'active')
  const { data: oldEnrollment } = await db.from('learner_enrollments').select('status').eq('learner_id', learnerAId).eq('class_id', classId).single()
  assert.equal(oldEnrollment!.status, 'withdrawn')
})

test('runAnnualPromotion: a "graduated" decision updates learner.status, sets a graduation_date, and withdraws the old enrollment', async () => {
  const result = await runAnnualPromotion(schoolId, adminSchoolUserId, {
    academic_year_id: academicYearId,
    decisions: [{ learner_id: learnerBId, promotion_type: 'graduated' }],
  })
  assert.equal(result.processed, 1)
  assert.equal(result.errors.length, 0)

  const { data: learner } = await db.from('learners').select('status, graduation_date').eq('id', learnerBId).single()
  assert.equal(learner!.status, 'graduated')
  assert.ok(learner!.graduation_date)

  const history = await getLearnerPromotionHistory(learnerBId, schoolId)
  assert.equal(history[0].promotion_type, 'graduated')

  // Previously left dangling "active" forever — now correctly withdrawn.
  const { data: oldEnrollment } = await db.from('learner_enrollments').select('status').eq('learner_id', learnerBId).eq('class_id', classId).single()
  assert.equal(oldEnrollment!.status, 'withdrawn')
})

test('runAnnualPromotion: a "promoted" decision with no destination class is reported as an error, not silently logged (Critical 2 validation)', async () => {
  const result = await runAnnualPromotion(schoolId, adminSchoolUserId, {
    academic_year_id: academicYearId,
    decisions: [{ learner_id: learnerDId, promotion_type: 'promoted' }],
  })
  assert.equal(result.processed, 0)
  assert.equal(result.errors.length, 1)
  assert.match(result.errors[0], /requires both to_class_id and to_academic_year_id/)

  // No promotion row and no enrollment change — the whole decision was
  // refused, not half-applied.
  const history = await getLearnerPromotionHistory(learnerDId, schoolId)
  assert.equal(history.length, 0)
})

test('runAnnualPromotion: a duplicate promotion for the same learner+year is refused, not double-recorded (double-submit / replay protection)', async () => {
  const first = await runAnnualPromotion(schoolId, adminSchoolUserId, {
    academic_year_id: academicYearId,
    decisions: [{ learner_id: learnerCId, promotion_type: 'promoted', to_class_id: destinationClassId, to_academic_year_id: destinationYearId }],
  })
  assert.equal(first.processed, 1)

  const second = await runAnnualPromotion(schoolId, adminSchoolUserId, {
    academic_year_id: academicYearId,
    decisions: [{ learner_id: learnerCId, promotion_type: 'promoted', to_class_id: destinationClassId, to_academic_year_id: destinationYearId }],
  })
  assert.equal(second.processed, 0)
  assert.equal(second.errors.length, 1)
  assert.match(second.errors[0], /already has a promotion recorded/)

  const history = await getLearnerPromotionHistory(learnerCId, schoolId)
  assert.equal(history.length, 1, 'exactly one promotion row must exist after a double-submit')
})

test('runAnnualPromotion: two genuinely concurrent promotions of the same learner+year cannot both succeed (Sprint C0 Task 1 — DB-level uniqueness backstop)', async () => {
  // Sprint 12's guard (listPromotionHistory check before insert) only
  // protects against a *sequential* replay — the test above ("a duplicate
  // promotion... is refused") proves that. It says nothing about two
  // requests racing each other, where both read "no existing row" before
  // either writes. Release Gate 1 (docs/architecture/
  // release-gate-1-pilot-readiness-certification.md) found learner_promotions
  // had zero unique constraint to protect against exactly that. The
  // migration this test verifies (supabase/migrations/
  // 20260723120000_learner_promotions_uniqueness.sql) adds
  // UNIQUE(learner_id, from_academic_year_id) — this test fires two real,
  // simultaneous calls (Promise.all, not sequential awaits) against the
  // same learner+year and asserts the database itself prevents a
  // duplicate row from ever landing, regardless of which request wins the
  // race.
  const fire = () => runAnnualPromotion(schoolId, adminSchoolUserId, {
    academic_year_id: academicYearId,
    decisions: [{ learner_id: learnerEId, promotion_type: 'promoted', to_class_id: destinationClassId, to_academic_year_id: destinationYearId }],
  })

  const [first, second] = await Promise.all([fire(), fire()])

  // Exactly one of the two concurrent calls may have actually processed
  // the promotion; the other must report it as an error (from the DB
  // constraint violation now surfacing through the existing per-decision
  // catch block), never both succeeding.
  const totalProcessed = first.processed + second.processed
  assert.equal(totalProcessed, 1, 'exactly one of two concurrent promotions must succeed, not zero and not both')
  const totalErrors = first.errors.length + second.errors.length
  assert.equal(totalErrors, 1, 'the losing concurrent request must be reported as an error, not silently dropped or silently duplicated')

  // The real, load-bearing assertion: no matter how the race resolved,
  // exactly one learner_promotions row exists for this learner afterward —
  // the exact invariant the Release Gate 1 finding said had no database
  // backstop.
  const history = await getLearnerPromotionHistory(learnerEId, schoolId)
  assert.equal(history.length, 1, 'a genuine concurrent double-submit must never produce two learner_promotions rows for the same learner+year')

  // And the enrollment side is equally clean — not two active enrollments,
  // not zero.
  const { data: activeEnrollments } = await db
    .from('learner_enrollments')
    .select('id, status')
    .eq('learner_id', learnerEId)
    .eq('status', 'active')
  assert.equal(activeEnrollments!.length, 1, 'a genuine concurrent double-promotion must never leave the learner with zero or multiple active enrollments')
})

test('runAnnualPromotion: an unknown learner_id is reported as an error, not thrown, and does not block the batch', async () => {
  const fakeId = '00000000-0000-0000-0000-000000000000'
  const result = await runAnnualPromotion(schoolId, adminSchoolUserId, {
    academic_year_id: academicYearId,
    decisions: [
      { learner_id: fakeId, promotion_type: 'promoted', to_class_id: destinationClassId, to_academic_year_id: destinationYearId },
    ],
  })
  assert.equal(result.processed, 0)
  assert.equal(result.errors.length, 1)
  assert.match(result.errors[0], new RegExp(fakeId))
})
