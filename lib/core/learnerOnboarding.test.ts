// lib/core/learnerOnboarding.test.ts
//
// Sprint 9D — integration tests against real (synthetic, cleaned-up) rows,
// following the convention established in lib/core/schoolActivation.test.ts
// and lib/core/teacherOnboarding.test.ts.
//
// Run: npx tsx --env-file=.env.local --test lib/core/learnerOnboarding.test.ts
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createTestServiceClient as createServiceClient } from '@/utils/supabase/test-service'
import { repos } from '@/lib/repositories'
import { activateSchool } from '@/lib/core/schoolActivation'
import { inviteTeacher, acceptTeacherInvitation } from '@/lib/core/teacherOnboarding'
import { getClassRoster, listLearners } from '@/lib/core/learners'
import { deleteAuthUserOrThrow } from '@/lib/testing/deleteAuthUserOrThrow'
import {
  onboardLearner,
  ensureLearnerAdmitted,
  getLearnerReadiness,
  type LearnerOnboardingInput,
} from '@/lib/core/learnerOnboarding'

const SYNTHETIC_MARKER = 'SYNTHETIC_9D_LEARNER_TEST'
const db = createServiceClient()

let adminUserId: string
let schoolId: string
let classId: string
let termId: string
let academicYearId: string

const createdAuthUserIds: string[] = []
const createdSchoolIds: string[] = []

async function mkAuthUser(label: string): Promise<{ id: string; email: string }> {
  const email = `sprint9d-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.com`
  const { data, error } = await db.auth.admin.createUser({
    email,
    password: `Test!${Math.random().toString(36).slice(2, 10)}`,
    email_confirm: true,
  })
  if (error) throw error
  createdAuthUserIds.push(data.user.id)
  return { id: data.user.id, email }
}

async function freshActivatedSchool(): Promise<{ schoolId: string; classId: string; termId: string; academicYearId: string; adminUserId: string }> {
  const admin = await mkAuthUser('school-admin')
  const school = await repos.schools.create({ school_name: `${SYNTHETIC_MARKER}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}` }, admin.id)
  createdSchoolIds.push(school.id)
  await repos.schools.addSchoolUser(school.id, admin.id, 'school_admin')

  const activation = await activateSchool(school.id, { gradeCodes: ['G7'] })
  if (activation.status !== 'complete') throw new Error(`fixture activation failed: ${activation.error}`)

  const { data: classes } = await db.from('classes').select('id, academic_year_id').eq('school_id', school.id).limit(1)
  const { data: terms } = await db.from('terms').select('id').eq('school_id', school.id).order('term_number').limit(1)

  return { schoolId: school.id, classId: classes![0].id, termId: terms![0].id, academicYearId: classes![0].academic_year_id, adminUserId: admin.id }
}

before(async () => {
  const fixture = await freshActivatedSchool()
  schoolId = fixture.schoolId
  classId = fixture.classId
  termId = fixture.termId
  academicYearId = fixture.academicYearId
  adminUserId = fixture.adminUserId
})

after(async () => {
  for (const id of createdSchoolIds) {
    await db.from('schools').delete().eq('id', id) // cascades learners/learner_enrollments/learner_guardians/classes/etc
  }
  for (const id of createdAuthUserIds) {
    await db.from('teachers').delete().eq('user_id', id)
    await db.from('profiles').delete().eq('id', id)
    await db.from('notification_log').delete().eq('user_id', id)
    await db.from('platform_events').delete().eq('actor_id', id)
    await deleteAuthUserOrThrow(db, id)
  }
})

function baseInput(admissionNumber: string): LearnerOnboardingInput {
  return {
    admission_number: admissionNumber,
    first_name: 'Test',
    last_name: 'Learner',
    class_id: classId,
    term_id: termId,
    academic_year_id: academicYearId,
    guardian: { full_name: 'Test Guardian', phone: `0700${Math.floor(Math.random() * 1_000_000)}`, relationship: 'mother' },
  }
}

// ── First learner / second learner ───────────────────────────────────────────

test('onboardLearner: first learner — admission, guardian, and enrollment all created in one call', async () => {
  const input = baseInput(`A-${Date.now()}-1`)
  const result = await onboardLearner(schoolId, input)

  assert.equal(result.status, 'complete')
  assert.ok(result.learnerId)
  assert.deepEqual(result.steps.map(s => s.step), ['learner', 'guardian', 'enrollment'])
  assert.deepEqual(result.steps.map(s => s.status), ['created', 'created', 'created'])

  const { data: learnerRow } = await db.from('learners').select('admission_number').eq('id', result.learnerId).single()
  assert.equal(learnerRow?.admission_number, input.admission_number)

  const { data: guardianRows } = await db.from('learner_guardians').select('id').eq('learner_id', result.learnerId)
  assert.equal(guardianRows?.length, 1)

  const { data: enrollmentRows } = await db.from('learner_enrollments').select('id, class_id').eq('learner_id', result.learnerId)
  assert.equal(enrollmentRows?.length, 1)
  assert.equal(enrollmentRows?.[0].class_id, classId)
})

test('onboardLearner: a second, independent learner onboards into the same class without interfering with the first', async () => {
  const inputA = baseInput(`A-${Date.now()}-2a`)
  const inputB = baseInput(`A-${Date.now()}-2b`)
  const resultA = await onboardLearner(schoolId, inputA)
  const resultB = await onboardLearner(schoolId, inputB)

  assert.equal(resultA.status, 'complete')
  assert.equal(resultB.status, 'complete')
  assert.notEqual(resultA.learnerId, resultB.learnerId)

  const roster = await getClassRoster(classId, termId)
  const rosterIds = roster.map(l => l.id)
  assert.ok(rosterIds.includes(resultA.learnerId))
  assert.ok(rosterIds.includes(resultB.learnerId))
})

// ── Guardian optional ─────────────────────────────────────────────────────────

test('onboardLearner: guardian is genuinely optional — skipped cleanly, zero guardian rows created', async () => {
  const input = baseInput(`A-${Date.now()}-3`)
  delete (input as { guardian?: unknown }).guardian

  const result = await onboardLearner(schoolId, input)
  assert.equal(result.status, 'complete')
  const guardianStep = result.steps.find(s => s.step === 'guardian')
  assert.equal(guardianStep?.status, 'skipped')

  const { data: guardianRows } = await db.from('learner_guardians').select('id').eq('learner_id', result.learnerId)
  assert.equal(guardianRows?.length, 0)
})

// ── Repeated onboarding (idempotency, Part 4/9) ──────────────────────────────

test('onboardLearner: repeated onboarding with identical input creates zero duplicates', async () => {
  const input = baseInput(`A-${Date.now()}-4`)
  const first = await onboardLearner(schoolId, input)
  const second = await onboardLearner(schoolId, input)

  assert.equal(second.status, 'complete')
  assert.equal(second.learnerId, first.learnerId)
  assert.deepEqual(second.steps.map(s => s.status), ['already_exists', 'already_exists', 'already_exists'])

  const { data: learnerRows } = await db.from('learners').select('id').eq('school_id', schoolId).eq('admission_number', input.admission_number)
  assert.equal(learnerRows?.length, 1)
  const { data: guardianRows } = await db.from('learner_guardians').select('id').eq('learner_id', first.learnerId)
  assert.equal(guardianRows?.length, 1)
  const { data: enrollmentRows } = await db.from('learner_enrollments').select('id').eq('learner_id', first.learnerId)
  assert.equal(enrollmentRows?.length, 1)
})

test('onboardLearner: a duplicate admission_number reuses the existing learner rather than creating a second one, even with different names supplied', async () => {
  const admissionNumber = `A-${Date.now()}-5`
  const first = await onboardLearner(schoolId, baseInput(admissionNumber))

  const secondInput = baseInput(admissionNumber)
  secondInput.first_name = 'Completely Different Name'
  const second = await onboardLearner(schoolId, secondInput)

  assert.equal(second.learnerId, first.learnerId)
  const { data: learnerRow } = await db.from('learners').select('first_name').eq('id', first.learnerId).single()
  // Idempotent reuse, not an update — the original admission record wins.
  assert.equal(learnerRow?.first_name, 'Test')
})

// ── Learner moved during onboarding (Part 7) ─────────────────────────────────

// Phase 4 ("The Term Turns and the Learner Moves") rewrite — was "moves
// them, not duplicates them," asserting exactly one enrollment row
// survived (the OLD class_id overwritten in place). That in-place overwrite
// was precisely the history-destroying bug the Phase 3 audit found and
// Phase 4's migration (20260814173242_learner_enrollments_current_history.sql)
// exists to close. The corrected, desired behavior: re-enrolling into a
// different class now closes the old row (ended_at set, history intact)
// and opens a new current one — never duplicates the CURRENT roster, but
// no longer erases where the learner was before.
test('onboardLearner: re-onboarding the same learner into a different class for the same term preserves history — closes the old enrollment, opens a new current one, never duplicates the CURRENT roster', async () => {
  const { data: secondClass } = await db
    .from('classes')
    .insert({ school_id: schoolId, class_name: 'G7 Moved', display_name: 'G7 Moved', grade_id: (await db.from('classes').select('grade_id').eq('id', classId).single()).data!.grade_id, academic_year_id: academicYearId })
    .select('id')
    .single()

  const admissionNumber = `A-${Date.now()}-6`
  const first = await onboardLearner(schoolId, baseInput(admissionNumber))
  assert.equal(first.status, 'complete')

  const movedInput = baseInput(admissionNumber)
  movedInput.class_id = secondClass!.id
  const moved = await onboardLearner(schoolId, movedInput)
  assert.equal(moved.status, 'complete')
  assert.equal(moved.learnerId, first.learnerId)

  const { data: enrollmentRows } = await db.from('learner_enrollments').select('id, class_id, ended_at').eq('learner_id', first.learnerId).order('created_at')
  assert.equal(enrollmentRows?.length, 2, 'the original class placement must survive as closed history, not be overwritten')
  assert.equal(enrollmentRows?.[0].class_id, classId)
  assert.ok(enrollmentRows?.[0].ended_at, 'the original placement must be closed')
  assert.equal(enrollmentRows?.[1].class_id, secondClass!.id)
  assert.equal(enrollmentRows?.[1].ended_at, null, 'the new placement must be current')

  const currentRows = await db.from('learner_enrollments').select('id').eq('learner_id', first.learnerId).is('ended_at', null)
  assert.equal(currentRows.data?.length, 1, 'exactly one CURRENT enrollment — the roster is never duplicated')
})

// ── Failure recovery (Part 7/9) ──────────────────────────────────────────────

test('onboardLearner: fails cleanly at the enrollment step for a nonexistent class, without losing the already-admitted learner', async () => {
  const input = baseInput(`A-${Date.now()}-7`)
  input.class_id = '00000000-0000-0000-0000-000000000000'

  const result = await onboardLearner(schoolId, input)
  assert.equal(result.status, 'failed')
  assert.equal(result.failedStep, 'enrollment')
  assert.equal(result.steps.find(s => s.step === 'learner')?.status, 'created')
  assert.equal(result.steps.find(s => s.step === 'guardian')?.status, 'created')

  const { data: learnerRows } = await db.from('learners').select('id').eq('school_id', schoolId).eq('admission_number', input.admission_number)
  assert.equal(learnerRows?.length, 1) // admission survived the downstream failure

  // Retry with the correct class — learner/guardian are reused (not
  // recreated), only enrollment actually runs this time.
  const retryInput = baseInput(input.admission_number)
  const retry = await onboardLearner(schoolId, retryInput)
  assert.equal(retry.status, 'complete')
  assert.equal(retry.learnerId, learnerRows![0].id)
  assert.equal(retry.steps.find(s => s.step === 'learner')?.status, 'already_exists')
  assert.equal(retry.steps.find(s => s.step === 'enrollment')?.status, 'created')
})

test('ensureLearnerAdmitted (partial-pipeline building block): admits a learner in isolation, independently testable', async () => {
  const { result, learner } = await ensureLearnerAdmitted(schoolId, {
    admission_number: `A-${Date.now()}-8`,
    first_name: 'Isolated',
    last_name: 'Step',
  })
  assert.equal(result.status, 'created')
  assert.equal(learner.first_name, 'Isolated')
})

// ── Academic visibility (Part 5) — no duplicate class lists ─────────────────

test('the administrative class list and the academic (teacher) class list are the same underlying data — no duplicate lists', async () => {
  const input = baseInput(`A-${Date.now()}-9`)
  const result = await onboardLearner(schoolId, input)

  const teacherRoster = await getClassRoster(classId, termId) // "existing class query" a teacher's UI would call
  const adminList = await listLearners(schoolId, { classId, termId }) // admin-facing list

  const teacherIds = teacherRoster.map(l => l.id).sort()
  const adminIds = adminList.map(l => l.id).sort()
  assert.deepEqual(teacherIds, adminIds)
  assert.ok(teacherIds.includes(result.learnerId))
})

// ── Readiness (Part 6) ────────────────────────────────────────────────────────

test('getLearnerReadiness: reports not-enrolled honestly before enrollment, then full readiness after', async () => {
  const { learner } = await ensureLearnerAdmitted(schoolId, {
    admission_number: `A-${Date.now()}-10`,
    first_name: 'Readiness',
    last_name: 'Check',
  })

  const before = await getLearnerReadiness(learner.id, schoolId, termId)
  assert.equal(before.enrolled, false)
  assert.equal(before.classAssigned, false)
  assert.equal(before.visibleToTeacher, false)

  const enrollInput = baseInput(`unused-${Date.now()}`)
  await onboardLearner(schoolId, { ...enrollInput, admission_number: learner.admission_number })

  const after = await getLearnerReadiness(learner.id, schoolId, termId)
  assert.equal(after.enrolled, true)
  assert.equal(after.classAssigned, true)
  assert.equal(after.classId, classId)
  assert.equal(after.visibleToTeacher, true)
  // Sprint 9F: the Core learner chain is now bridged to the legacy-anchored
  // Assessment/Evidence/Projection/Compass pipeline (lib/core/academicBridge.ts) —
  // both flip true once enrolled, closing the gap Sprint 9D left honestly
  // false (see docs/engineering/implementation-log.md's Sprint 9F entry).
  assert.equal(after.eligibleForAssessment, true)
  assert.ok(after.eligibleForAssessmentReason.length > 0)
  assert.equal(after.eligibleForCompass, true)
  assert.ok(after.eligibleForCompassReason.length > 0)
})

// ── End-to-end: activation → teacher onboarding → learner onboarding ────────

test('end-to-end: a fresh school, activated, with a teacher onboarded, enrolls a learner the teacher automatically sees', async () => {
  const fixture = await freshActivatedSchool()

  const teacher = await mkAuthUser('e2e-teacher')
  const invite = await inviteTeacher(fixture.schoolId, teacher.email, fixture.adminUserId)
  assert.equal(invite.status, 'invited')
  const accept = await acceptTeacherInvitation(teacher.id, fixture.schoolId, { full_name: 'E2E Teacher' })
  assert.equal(accept.status, 'accepted')

  const learnerResult = await onboardLearner(fixture.schoolId, {
    admission_number: `E2E-${Date.now()}`,
    first_name: 'End',
    last_name: 'ToEnd',
    class_id: fixture.classId,
    term_id: fixture.termId,
    academic_year_id: fixture.academicYearId,
    guardian: { full_name: 'E2E Guardian', phone: `0711${Math.floor(Math.random() * 1_000_000)}`, relationship: 'father' },
  })
  assert.equal(learnerResult.status, 'complete')

  const readiness = await getLearnerReadiness(learnerResult.learnerId!, fixture.schoolId, fixture.termId)
  assert.equal(readiness.enrolled, true)
  assert.equal(readiness.visibleToTeacher, true)

  // The onboarded teacher's own class-roster query (what their dashboard
  // would call) sees the learner too — proving the whole chain, not just
  // the learner-onboarding piece in isolation.
  const roster = await getClassRoster(fixture.classId, fixture.termId)
  assert.ok(roster.some(l => l.id === learnerResult.learnerId))
})
