// lib/school/intelligence.riskConvergence.integration.test.ts
//
// PHASE 3.5 — Risk Consumer Convergence. Proves computeTeacherActivity()'s
// at_risk_students count is now sourced from the canonical Projection
// Engine (same authority computeSchoolIntelligence() already used), not
// the legacy learner_profiles.overall_risk_level — the exact mixed-
// authority gap Phase 3's audit found ("a Principal Dashboard render
// could describe risk using two different sources for two different
// widgets").
//
// Reuses the real school/teacher/learner bridge fixture toolkit
// (lib/core/academicBridge.ts, lib/core/schoolActivation.ts,
// lib/core/teacherOnboarding.ts, lib/core/learnerOnboarding.ts) already
// proven end-to-end by lib/core/academicBridge.test.ts — not a new
// fixture pattern.
//
// Requires local Docker Supabase — never production (createTestServiceClient
// refuses a production-shaped URL under test context regardless).
//
// Run: TEST_SUPABASE_URL=http://127.0.0.1:54321 ... npx tsx --experimental-test-module-mocks --test lib/school/intelligence.riskConvergence.integration.test.ts

import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createTestServiceClient as createServiceClient } from '@/utils/supabase/test-service'
import { repos } from '@/lib/repositories'
import { activateSchool } from '@/lib/core/schoolActivation'
import { inviteTeacher, acceptTeacherInvitation } from '@/lib/core/teacherOnboarding'
import { onboardLearner } from '@/lib/core/learnerOnboarding'
import { ensureBridgedClass, createBridgedAssessment, recordBridgedMarks } from '@/lib/core/academicBridge'
import { computeTeacherActivity } from './intelligence'
import { deleteAuthUserOrThrow } from '@/lib/testing/deleteAuthUserOrThrow'
import { asLearnerId } from '@/lib/core/identityTypes'

const SYNTHETIC_MARKER = 'SYNTHETIC_P35_RISK_CONVERGENCE'
const db = createServiceClient()

const createdAuthUserIds: string[] = []
const createdSchoolIds: string[] = []

async function mkAuthUser(label: string): Promise<{ id: string; email: string }> {
  const email = `p35risk-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.com`
  const { data, error } = await db.auth.admin.createUser({
    email, password: `Test!${Math.random().toString(36).slice(2, 10)}`, email_confirm: true,
  })
  if (error) throw error
  createdAuthUserIds.push(data.user.id)
  return { id: data.user.id, email }
}

async function fullySetUpSchool(labelPrefix: string) {
  const admin = await mkAuthUser(`${labelPrefix}-admin`)
  const school = await repos.schools.create({ school_name: `${SYNTHETIC_MARKER}_${labelPrefix}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}` }, admin.id)
  createdSchoolIds.push(school.id)
  await repos.schools.addSchoolUser(school.id, admin.id, 'school_admin')

  const activation = await activateSchool(school.id, { gradeCodes: ['G10'] })
  if (activation.status !== 'complete') throw new Error(`fixture activation failed: ${activation.error}`)

  const teacher = await mkAuthUser(`${labelPrefix}-teacher`)
  const invite = await inviteTeacher(school.id, teacher.email, admin.id)
  if (invite.status !== 'invited') throw new Error(`fixture invite failed: ${invite.status}`)
  const accept = await acceptTeacherInvitation(teacher.id, school.id, { full_name: `${labelPrefix} Teacher` })
  if (accept.status !== 'accepted') throw new Error(`fixture accept failed: ${accept.status}`)

  // findVerifiedTeachers() (the entry point computeTeacherActivity's caller
  // uses) requires teachers.is_verified — set explicitly rather than
  // assuming acceptTeacherInvitation's default, so this fixture doesn't
  // silently depend on an implementation detail of a different module.
  await db.from('teachers').update({ is_verified: true }).eq('user_id', teacher.id)
  const { data: teacherRow } = await db.from('teachers').select('id').eq('user_id', teacher.id).single()

  const { data: classes } = await db.from('classes').select('id, academic_year_id').eq('school_id', school.id).limit(1)
  const { data: terms } = await db.from('terms').select('id').eq('school_id', school.id).order('term_number').limit(1)

  return {
    schoolId: school.id,
    adminUserId: admin.id,
    teacherUserId: teacher.id,
    teacherId: teacherRow!.id as string,
    classId: classes![0].id,
    academicYearId: classes![0].academic_year_id,
    termId: terms![0].id,
  }
}

async function admitAndEnroll(fixture: Awaited<ReturnType<typeof fullySetUpSchool>>, admissionNumber: string) {
  const result = await onboardLearner(fixture.schoolId, {
    admission_number: admissionNumber, first_name: 'Risk', last_name: 'Test',
    class_id: fixture.classId, term_id: fixture.termId, academic_year_id: fixture.academicYearId,
    guardian: { full_name: 'Risk Guardian', phone: `07${Math.floor(Math.random() * 100_000_000)}`, relationship: 'mother' },
  })
  if (result.status !== 'complete') throw new Error(`fixture enrollment failed: ${result.error}`)
  return result.learnerId!
}

after(async () => {
  if (createdSchoolIds.length) {
    const { data: coreLearners } = await db.from('learners').select('id').in('school_id', createdSchoolIds)
    const { data: coreClasses } = await db.from('classes').select('id').in('school_id', createdSchoolIds)
    const learnerExternalIds = (coreLearners ?? []).map(l => l.id)
    const classExternalIds = (coreClasses ?? []).map(c => c.id)

    if (learnerExternalIds.length) {
      const { data: bridgedStudents } = await db.from('students').select('id').in('external_id', learnerExternalIds)
      const studentIds = (bridgedStudents ?? []).map(s => s.id)
      if (studentIds.length) {
        const { data: evidenceRows } = await db.from('learner_evidence').select('id').in('learner_id', studentIds)
        const evidenceIds = (evidenceRows ?? []).map(e => e.id)
        if (evidenceIds.length) {
          await db.from('evidence_audit_log').delete().in('evidence_id', evidenceIds)
          await db.from('evidence_projection_events').delete().in('evidence_id', evidenceIds)
        }
        await db.from('learner_evidence').delete().in('learner_id', studentIds)
        await db.from('learner_projections').delete().in('learner_id', studentIds)
        await db.from('learner_marks').delete().in('student_id', studentIds)
        await db.from('learner_profiles').delete().in('student_id', studentIds)
        await db.from('students').delete().in('id', studentIds)
      }
    }
    if (classExternalIds.length) await db.from('teacher_classes').delete().in('external_id', classExternalIds)
  }
  for (const id of createdSchoolIds) {
    await db.from('schools').delete().eq('id', id) // cascades Core-side rows
  }
  for (const id of createdAuthUserIds) {
    await db.from('teachers').delete().eq('user_id', id)
    await db.from('profiles').delete().eq('id', id)
    await deleteAuthUserOrThrow(db, id).catch(() => {}) // best-effort
  }
})

async function seedLegacyRiskProfile(legacyStudentId: string, overallRiskLevel: string): Promise<void> {
  await db.from('learner_profiles').upsert({
    student_id: legacyStudentId,
    overall_risk_level: overallRiskLevel,
  }, { onConflict: 'student_id' })
}

// ── Scenario: Projection HIGH overrides stale legacy LOW ────────────────────

test('Projection critical overrides stale legacy "normal": at_risk_students counts the Projection-flagged learner', async () => {
  const fixture = await fullySetUpSchool('high-over-low')
  const learnerId = await admitAndEnroll(fixture, `HIGH-${Date.now()}`)

  const bridgedClass = await ensureBridgedClass(fixture.schoolId, fixture.classId, fixture.teacherUserId)
  const { assessmentId } = await createBridgedAssessment(fixture.schoolId, fixture.classId, fixture.teacherUserId, {
    title: 'Term 1 CAT', assessment_type: 'cat', term: '1', year: 2026, max_score: 100,
    subjects: ['mathematics'], curriculum_type: 'cbc',
  })
  // First a strong mark, then a declining one — riskProjector.ts flags
  // "Below Expectation ... and declining" as critical for exactly this shape.
  const { legacyStudentIds: r1 } = await recordBridgedMarks(fixture.schoolId, assessmentId, bridgedClass, fixture.teacherUserId, [
    { coreLearnerId: asLearnerId(learnerId), admission_number: 'HIGH', student_name: 'Risk Test', subject_scores: { mathematics: 88 }, total_marks: 88, mean_score: 88 },
  ])
  const legacyStudentId = r1[0]
  const { assessmentId: assessment2 } = await createBridgedAssessment(fixture.schoolId, fixture.classId, fixture.teacherUserId, {
    title: 'Term 2 CAT', assessment_type: 'cat', term: '2', year: 2026, max_score: 100,
    subjects: ['mathematics'], curriculum_type: 'cbc',
  })
  await recordBridgedMarks(fixture.schoolId, assessment2, bridgedClass, fixture.teacherUserId, [
    { coreLearnerId: asLearnerId(learnerId), admission_number: 'HIGH', student_name: 'Risk Test', subject_scores: { mathematics: 20 }, total_marks: 20, mean_score: 20 },
  ])

  // Stale legacy says "normal" — deliberately wrong/out of date.
  await seedLegacyRiskProfile(legacyStudentId, 'normal')

  const [signal] = await computeTeacherActivity([fixture.teacherId], [fixture.teacherUserId])
  assert.equal(signal.at_risk_students, 1, 'Projection (critical) must win over stale legacy (normal)')
})

// ── Scenario: stale legacy HIGH does not leak when Projection is LOW ────────

test('stale legacy "critical" does not leak into at_risk_students when Projection says normal', async () => {
  const fixture = await fullySetUpSchool('low-over-high')
  const learnerId = await admitAndEnroll(fixture, `LOW-${Date.now()}`)

  const bridgedClass = await ensureBridgedClass(fixture.schoolId, fixture.classId, fixture.teacherUserId)
  const { assessmentId } = await createBridgedAssessment(fixture.schoolId, fixture.classId, fixture.teacherUserId, {
    title: 'Term 1 CAT', assessment_type: 'cat', term: '1', year: 2026, max_score: 100,
    subjects: ['mathematics'], curriculum_type: 'cbc',
  })
  const { legacyStudentIds } = await recordBridgedMarks(fixture.schoolId, assessmentId, bridgedClass, fixture.teacherUserId, [
    { coreLearnerId: asLearnerId(learnerId), admission_number: 'LOW', student_name: 'Risk Test', subject_scores: { mathematics: 92 }, total_marks: 92, mean_score: 92 },
  ])
  const legacyStudentId = legacyStudentIds[0]

  // Stale legacy says "critical" — deliberately wrong/out of date.
  await seedLegacyRiskProfile(legacyStudentId, 'critical')

  const [signal] = await computeTeacherActivity([fixture.teacherId], [fixture.teacherUserId])
  assert.equal(signal.at_risk_students, 0, 'stale legacy "critical" must not leak through when Projection says normal')
})

// ── Scenario: no evidence at all ─────────────────────────────────────────────

test('no evidence at all (and no learner_profiles row): Projection resolves to normal, not counted', async () => {
  const fixture = await fullySetUpSchool('no-evidence')
  await admitAndEnroll(fixture, `NOEV-${Date.now()}`)
  // No assessment/marks recorded — no legacy_profiles row seeded either.

  const [signal] = await computeTeacherActivity([fixture.teacherId], [fixture.teacherUserId])
  assert.equal(signal.at_risk_students, 0)
})

// ── Scenario: cross-school isolation ─────────────────────────────────────────

test('cross-school isolation: a critical learner in School B never counts toward School A\'s teacher activity', async () => {
  const schoolA = await fullySetUpSchool('isoA')
  const schoolB = await fullySetUpSchool('isoB')

  await admitAndEnroll(schoolA, `ISOA-${Date.now()}`) // School A: no evidence, normal

  const learnerB = await admitAndEnroll(schoolB, `ISOB-${Date.now()}`)
  const bridgedClassB = await ensureBridgedClass(schoolB.schoolId, schoolB.classId, schoolB.teacherUserId)
  const { assessmentId } = await createBridgedAssessment(schoolB.schoolId, schoolB.classId, schoolB.teacherUserId, {
    title: 'Term 1 CAT', assessment_type: 'cat', term: '1', year: 2026, max_score: 100,
    subjects: ['mathematics'], curriculum_type: 'cbc',
  })
  await recordBridgedMarks(schoolB.schoolId, assessmentId, bridgedClassB, schoolB.teacherUserId, [
    { coreLearnerId: asLearnerId(learnerB), admission_number: 'ISOB', student_name: 'Risk Test B', subject_scores: { mathematics: 15 }, total_marks: 15, mean_score: 15 },
  ])

  const [signalA] = await computeTeacherActivity([schoolA.teacherId], [schoolA.teacherUserId])
  const [signalB] = await computeTeacherActivity([schoolB.teacherId], [schoolB.teacherUserId])

  assert.equal(signalA.at_risk_students, 0, "School A's teacher activity must not see School B's at-risk learner")
  assert.equal(signalB.at_risk_students, 1, "School B's own at-risk learner must still be counted for School B's teacher")
})
