// lib/core/academicActivation.test.ts
//
// Sprint 9E — integration tests against real (synthetic, cleaned-up) rows,
// following the convention established in lib/core/schoolActivation.test.ts,
// lib/core/teacherOnboarding.test.ts, and lib/core/learnerOnboarding.test.ts.
//
// Run: npx tsx --env-file=.env.local --test lib/core/academicActivation.test.ts
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createTestServiceClient as createServiceClient } from '@/utils/supabase/test-service'
import { repos } from '@/lib/repositories'
import { activateSchool } from '@/lib/core/schoolActivation'
import { createAcademicYear } from '@/lib/core/school'
import { seedGradeSubjectsForSchool } from '@/lib/core/subjects'
import { inviteTeacher, acceptTeacherInvitation } from '@/lib/core/teacherOnboarding'
import { onboardLearner } from '@/lib/core/learnerOnboarding'
import { getSchoolAcademicReadiness, resolveActiveAcademicYear, resolveActiveTerm } from '@/lib/core/academicActivation'
import { deleteAuthUserOrThrow } from '@/lib/testing/deleteAuthUserOrThrow'

const SYNTHETIC_MARKER = 'SYNTHETIC_9E_ACADEMIC_TEST'
const db = createServiceClient()

const createdAuthUserIds: string[] = []
const createdSchoolIds: string[] = []

async function mkAuthUser(label: string): Promise<{ id: string; email: string }> {
  const email = `sprint9e-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.com`
  const { data, error } = await db.auth.admin.createUser({
    email,
    password: `Test!${Math.random().toString(36).slice(2, 10)}`,
    email_confirm: true,
  })
  if (error) throw error
  createdAuthUserIds.push(data.user.id)
  return { id: data.user.id, email }
}

async function mkSchool(): Promise<{ schoolId: string; adminUserId: string }> {
  const admin = await mkAuthUser('admin')
  const school = await repos.schools.create({ school_name: `${SYNTHETIC_MARKER}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}` }, admin.id)
  createdSchoolIds.push(school.id)
  await repos.schools.addSchoolUser(school.id, admin.id, 'school_admin')
  return { schoolId: school.id, adminUserId: admin.id }
}

after(async () => {
  for (const id of createdSchoolIds) {
    await db.from('schools').delete().eq('id', id) // cascades everything Core-side
  }
  for (const id of createdAuthUserIds) {
    await db.from('teachers').delete().eq('user_id', id)
    await db.from('profiles').delete().eq('id', id)
    await db.from('notification_log').delete().eq('user_id', id)
    await db.from('platform_events').delete().eq('actor_id', id)
    await deleteAuthUserOrThrow(db, id)
  }
})

// ── Missing year / missing term (Part 7) ─────────────────────────────────────

test('missing year: a school with no academic year reports academicYear unresolved and overallReady false', async () => {
  const { schoolId } = await mkSchool()
  const readiness = await getSchoolAcademicReadiness(schoolId)

  assert.equal(readiness.academicYear.resolved, false)
  assert.equal(readiness.term.resolved, false)
  assert.equal(readiness.overallReady, false)
  assert.ok(readiness.blockingReasons.some(r => r.includes('No academic year')))
})

test('missing term: a school with a year but no term reports term unresolved specifically', async () => {
  const { schoolId } = await mkSchool()
  await createAcademicYear(schoolId, { name: '2026', start_date: '2026-01-01', end_date: '2026-12-31' })

  const readiness = await getSchoolAcademicReadiness(schoolId)
  assert.equal(readiness.academicYear.resolved, true)
  assert.equal(readiness.term.resolved, false)
  assert.ok(readiness.blockingReasons.some(r => r.includes('No term exists')))
})

test('activateSchool now sets a real current academic year and term (Sprint 12 Wave 1, High 1 — was previously a documented gap; see schoolActivation.test.ts for the direct fix test)', async () => {
  const { schoolId } = await mkSchool()
  const activation = await activateSchool(schoolId, { gradeCodes: ['G7'] })
  assert.equal(activation.status, 'complete')

  const { data: years } = await db.from('academic_years').select('is_current').eq('school_id', schoolId)
  assert.ok(years?.some(y => y.is_current === true), 'activation must leave a real current academic year set')

  const year = await resolveActiveAcademicYear(schoolId)
  assert.equal(year.resolved, true)
  const term = await resolveActiveTerm(schoolId, year.value!.id)
  assert.equal(term.resolved, true)
})

test('resolveActiveAcademicYear/resolveActiveTerm: still fall back to the first row for a school with no current row at all — defense-in-depth for any school activated before Sprint 12, or any other future gap', async () => {
  const { schoolId } = await mkSchool()
  const activation = await activateSchool(schoolId, { gradeCodes: ['G7'] })
  assert.equal(activation.status, 'complete')

  // Simulate the pre-Sprint-12 state directly, rather than relying on
  // activation to (no longer) produce it — this is now a test of the
  // fallback's own defensive behavior, not of activation's output.
  await db.from('academic_years').update({ is_current: false }).eq('school_id', schoolId)
  await db.from('terms').update({ is_current: false }).eq('school_id', schoolId)

  const { data: years } = await db.from('academic_years').select('is_current').eq('school_id', schoolId)
  assert.ok(years?.every(y => y.is_current === false))

  const year = await resolveActiveAcademicYear(schoolId)
  assert.equal(year.resolved, true)
  const term = await resolveActiveTerm(schoolId, year.value!.id)
  assert.equal(term.resolved, true)
})

// ── Missing subject source / no teachers / no learners (Part 7) ─────────────

test('missing subject source: an activated school with classes but no grade_subjects reports subjects unready, everything else unaffected', async () => {
  const { schoolId } = await mkSchool()
  const activation = await activateSchool(schoolId, { gradeCodes: ['G7'] })
  assert.equal(activation.status, 'complete')

  // H1D-3C: activateSchool now seeds grade_subjects itself as one of its
  // own steps (DR-08, schoolActivation.ts's ensureGradeSubjects — a
  // deliberate fix so a freshly-activated school never starts in a
  // zero-subjects state). This test's actual target is
  // getSchoolAcademicReadiness's own reporting correctness when subjects
  // are missing, not activateSchool's behavior — reconstructing that
  // input state explicitly rather than assuming activation still produces
  // it, so the readiness-check invariant stays covered.
  await db.from('grade_subjects').delete().eq('school_id', schoolId)

  const readiness = await getSchoolAcademicReadiness(schoolId)
  assert.equal(readiness.classes.count, 1)
  assert.equal(readiness.subjects.allGradesInUseHaveSubjects, false)
  assert.equal(readiness.subjects.byGrade[0].hasSubjects, false)
  assert.equal(readiness.overallReady, false)
  // Sprint C0 Task 2 — reworded to remove internal function/file references
  // (was: "call seedGradeSubjectsForSchool() or assignSubjectToGrade()
  // (lib/core/subjects.ts)"), since this string reaches a school admin's
  // screen directly, not just a log.
  assert.ok(readiness.blockingReasons.some(r => r.includes("grade(s) in use don't have subjects set up")))
  assert.ok(!readiness.blockingReasons.some(r => r.includes('seedGradeSubjectsForSchool')), 'reason string must not leak internal function names to the admin-facing UI')
})

test('no teachers: an activated school with subjects seeded but no teacher reports teachers unready with a clear reason', async () => {
  const { schoolId } = await mkSchool()
  await activateSchool(schoolId, { gradeCodes: ['G7'] })
  await seedGradeSubjectsForSchool(schoolId)

  const readiness = await getSchoolAcademicReadiness(schoolId)
  assert.equal(readiness.subjects.allGradesInUseHaveSubjects, true)
  assert.equal(readiness.teachers.activeTeacherMemberships, 0)
  assert.equal(readiness.teachers.allActiveTeachersHaveCanonicalIdentity, false)
  assert.ok(readiness.teachers.reason?.includes('No active teacher memberships'))
  assert.equal(readiness.overallReady, false)
})

test('no learners: a school with subjects and a ready teacher but zero enrollment reports learners unready', async () => {
  const { schoolId, adminUserId } = await mkSchool()
  await activateSchool(schoolId, { gradeCodes: ['G7'] })
  await seedGradeSubjectsForSchool(schoolId)

  const teacher = await mkAuthUser('teacher-no-learners')
  await inviteTeacher(schoolId, teacher.email, adminUserId)
  await acceptTeacherInvitation(teacher.id, schoolId, { full_name: 'No Learners Teacher' })

  const readiness = await getSchoolAcademicReadiness(schoolId)
  assert.equal(readiness.teachers.allActiveTeachersHaveCanonicalIdentity, true)
  assert.equal(readiness.learners.enrolledLearnerCount, 0)
  assert.equal(readiness.learners.allClassesHaveLearners, false)
  assert.ok(readiness.learners.reason?.includes('No learners enrolled'))
  assert.equal(readiness.overallReady, false)
})

// ── Partially configured school ──────────────────────────────────────────────

test('partially configured school: activated only (no subjects, no teacher, no learners) reports every downstream gap simultaneously', async () => {
  const { schoolId } = await mkSchool()
  await activateSchool(schoolId, { gradeCodes: ['G7'] })
  // H1D-3C: see the "missing subject source" test above — activateSchool
  // now always seeds grade_subjects (DR-08); reconstructing the
  // pre-DR-08 input state explicitly to keep testing the readiness
  // reporter's own multi-gap logic.
  await db.from('grade_subjects').delete().eq('school_id', schoolId)

  const readiness = await getSchoolAcademicReadiness(schoolId)
  assert.equal(readiness.academicYear.resolved, true)
  assert.equal(readiness.term.resolved, true)
  assert.equal(readiness.classes.count, 1)
  assert.equal(readiness.subjects.allGradesInUseHaveSubjects, false)
  assert.equal(readiness.teachers.activeTeacherMemberships, 0)
  assert.equal(readiness.learners.enrolledLearnerCount, 0)
  assert.equal(readiness.overallReady, false)
  assert.equal(readiness.blockingReasons.length, 3) // subjects, teachers, learners (year/term/classes all resolved)
})

// ── Fully ready school ────────────────────────────────────────────────────────

test('fully ready school: every prerequisite resolved reports overallReady true with zero blocking reasons', async () => {
  const { schoolId, adminUserId } = await mkSchool()
  const activation = await activateSchool(schoolId, { gradeCodes: ['G7'] })
  assert.equal(activation.status, 'complete')
  await seedGradeSubjectsForSchool(schoolId)

  const teacher = await mkAuthUser('teacher-fully-ready')
  await inviteTeacher(schoolId, teacher.email, adminUserId)
  await acceptTeacherInvitation(teacher.id, schoolId, { full_name: 'Fully Ready Teacher' })

  const { data: classes } = await db.from('classes').select('id, academic_year_id').eq('school_id', schoolId).limit(1)
  const { data: terms } = await db.from('terms').select('id').eq('school_id', schoolId).order('term_number').limit(1)

  const learnerResult = await onboardLearner(schoolId, {
    admission_number: `FR-${Date.now()}`,
    first_name: 'Fully',
    last_name: 'Ready',
    class_id: classes![0].id,
    term_id: terms![0].id,
    academic_year_id: classes![0].academic_year_id,
  })
  assert.equal(learnerResult.status, 'complete')

  const readiness = await getSchoolAcademicReadiness(schoolId)
  assert.equal(readiness.activationStatus, 'ACTIVE')
  assert.equal(readiness.academicYear.resolved, true)
  assert.equal(readiness.term.resolved, true)
  assert.equal(readiness.classes.count, 1)
  assert.equal(readiness.subjects.allGradesInUseHaveSubjects, true)
  assert.equal(readiness.teachers.allActiveTeachersHaveCanonicalIdentity, true)
  assert.equal(readiness.learners.allClassesHaveLearners, true)
  assert.equal(readiness.overallReady, true)
  assert.deepEqual(readiness.blockingReasons, [])
})

// ── Repeated readiness evaluation (Part 9) — read-only, no side effects ─────

test('repeated readiness evaluation is stable and mutates nothing', async () => {
  const { schoolId, adminUserId } = await mkSchool()
  await activateSchool(schoolId, { gradeCodes: ['G7'] })
  await seedGradeSubjectsForSchool(schoolId)
  const teacher = await mkAuthUser('teacher-repeated')
  await inviteTeacher(schoolId, teacher.email, adminUserId)
  await acceptTeacherInvitation(teacher.id, schoolId, { full_name: 'Repeated Teacher' })

  const first = await getSchoolAcademicReadiness(schoolId)
  const { count: classCountBefore } = await db.from('classes').select('id', { count: 'exact', head: true }).eq('school_id', schoolId)
  const { count: yearCountBefore } = await db.from('academic_years').select('id', { count: 'exact', head: true }).eq('school_id', schoolId)

  const second = await getSchoolAcademicReadiness(schoolId)
  const { count: classCountAfter } = await db.from('classes').select('id', { count: 'exact', head: true }).eq('school_id', schoolId)
  const { count: yearCountAfter } = await db.from('academic_years').select('id', { count: 'exact', head: true }).eq('school_id', schoolId)

  assert.deepEqual(second, first)
  assert.equal(classCountAfter, classCountBefore)
  assert.equal(yearCountAfter, yearCountBefore)
})
