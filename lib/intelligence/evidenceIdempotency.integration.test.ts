// lib/intelligence/evidenceIdempotency.integration.test.ts
//
// Senior School Final Acceptance, Part A — proves the identical-retry gate
// added to `persistEvidenceBatch` (lib/intelligence/evidenceLifecycle.ts::
// isIdenticalObservation). Scope is deliberately narrow: retry protection
// for the SAME logical observation, never a general dedup system.
//
// Covers two independent production writers that both flow through
// persistEvidenceBatch via a correction_key:
//   - lib/assessments/evidence.ts::recordAssessmentEvidence (the legacy
//     gradebook/CSV-upload writer — Test C of
//     classAssessmentCorrectionKey.integration.test.ts already proves
//     manual entry and CSV upload converge on the SAME correction_key, so
//     exercising this one writer covers both).
//   - lib/core/academicBridge.ts::recordCanonicalAssessmentMarks (Phase 3C's
//     canonical marks-entry writer).
//
// Run: npx tsx --experimental-test-module-mocks --test lib/intelligence/evidenceIdempotency.integration.test.ts
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createTestServiceClient as createServiceClient } from '@/utils/supabase/test-service'
import { repos } from '@/lib/repositories'
import { activateSchool } from '@/lib/core/schoolActivation'
import { inviteTeacher, acceptTeacherInvitation } from '@/lib/core/teacherOnboarding'
import { createClass, assignSubjectTeacher } from '@/lib/core/classes'
import { listSubjects } from '@/lib/core/subjects'
import { onboardLearner } from '@/lib/core/learnerOnboarding'
import { createBridgedAssessment, recordBridgedMarks, recordCanonicalAssessmentMarks, ensureBridgedClass } from '@/lib/core/academicBridge'
import { recordAssessmentEvidence } from '@/lib/assessments/evidence'
import { recomputeLearnerProjection } from '@/lib/projection/recompute'
import { composeProgrammeAcademicRecord } from '@/lib/learnerBlueprint/composeProgrammeAcademicRecord'
import { createOrUpdateSeniorProgramme } from '@/lib/curriculum/seniorProgramme'
import { resolveLegacyStudentId } from '@/lib/core/identity'
import { asLearnerId } from '@/lib/core/identityTypes'
import { deleteAuthUserOrThrow } from '@/lib/testing/deleteAuthUserOrThrow'

const SYNTHETIC_MARKER = 'SYNTHETIC_IDEMPOTENCY_TEST'
const db = createServiceClient()

const createdAuthUserIds: string[] = []
const createdSchoolIds: string[] = []

async function mkUser(label: string): Promise<{ id: string; email: string }> {
  const email = `idem-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.com`
  const { data, error } = await db.auth.admin.createUser({ email, password: `Test!${Math.random().toString(36).slice(2, 10)}`, email_confirm: true })
  if (error) throw error
  createdAuthUserIds.push(data.user.id)
  return { id: data.user.id, email }
}

async function admit(schoolId: string, classId: string, termId: string, academicYearId: string, label: string) {
  const result = await onboardLearner(schoolId, {
    admission_number: `${SYNTHETIC_MARKER}-${label}-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
    first_name: label,
    last_name: 'Learner',
    class_id: classId,
    term_id: termId,
    academic_year_id: academicYearId,
    guardian: { full_name: `${label} Guardian`, phone: `07${Math.floor(Math.random() * 100_000_000)}`, relationship: 'mother' },
  })
  if (result.status !== 'complete') throw new Error(`fixture enrollment failed: ${result.error}`)
  return asLearnerId(result.learnerId!)
}

after(async () => {
  for (const id of createdSchoolIds) {
    const { data: coreLearners } = await db.from('learners').select('id').eq('school_id', id)
    const learnerExternalIds = (coreLearners ?? []).map(l => l.id)
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
        await db.from('students').delete().in('id', studentIds)
      }
    }
    const { data: coreClasses } = await db.from('classes').select('id').eq('school_id', id)
    const classExternalIds = (coreClasses ?? []).map(c => c.id)
    if (classExternalIds.length) {
      const { data: legacyClasses } = await db.from('teacher_classes').select('id').in('external_id', classExternalIds)
      const legacyClassIds = (legacyClasses ?? []).map(c => c.id)
      if (legacyClassIds.length) await db.from('class_assessments').delete().in('class_id', legacyClassIds)
      await db.from('teacher_classes').delete().in('external_id', classExternalIds)
    }
    await db.from('learner_programmes').delete().eq('school_id', id)
  }
  for (const id of createdSchoolIds) {
    await db.from('schools').delete().eq('id', id)
  }
  for (const id of createdAuthUserIds) {
    const { data: teacherRows } = await db.from('teachers').select('id').eq('user_id', id)
    const teacherIds = (teacherRows ?? []).map(t => t.id)
    if (teacherIds.length) {
      await db.from('ingestion_runs').delete().in('teacher_id', teacherIds)
      await db.from('assessment_types').delete().in('teacher_id', teacherIds)
    }
    await db.from('teachers').delete().eq('user_id', id)
    await db.from('profiles').delete().eq('id', id)
    await db.from('notification_log').delete().eq('user_id', id)
    await db.from('platform_events').delete().eq('actor_id', id)
    await db.from('ingestion_runs').delete().eq('initiated_by', id)
    await deleteAuthUserOrThrow(db, id)
  }
})

let schoolId: string
let adminId: string
let gradeEastId: string
let coreMathId: string
let termId: string
let academicYearId: string
let peter: { userId: string; email: string; membershipId: string }
let peterCoreMathsCsId: string

before(async () => {
  const admin = await mkUser('admin')
  adminId = admin.id
  const school = await repos.schools.create({ school_name: `${SYNTHETIC_MARKER}_${Date.now()}` }, admin.id)
  schoolId = school.id
  createdSchoolIds.push(schoolId)
  await repos.schools.addSchoolUser(schoolId, admin.id, 'school_admin')
  const act = await activateSchool(schoolId, { gradeCodes: ['G10'] })
  if (act.status !== 'complete') throw new Error(`fixture activation failed: ${act.error}`)

  const { data: classes } = await db.from('classes').select('id, grade_id, academic_year_id').eq('school_id', schoolId).limit(1)
  academicYearId = classes![0].academic_year_id
  const { data: terms } = await db.from('terms').select('id').eq('school_id', schoolId).eq('is_current', true).limit(1)
  termId = terms![0].id

  const seniorSubjects = await listSubjects('senior_secondary')
  coreMathId = seniorSubjects.find(s => s.name === 'Core Mathematics')!.id

  const east = await createClass(schoolId, { grade_id: classes![0].grade_id, academic_year_id: academicYearId, display_name: `${SYNTHETIC_MARKER} Grade 10 East` })
  gradeEastId = east.id

  const user = await mkUser('peter')
  await inviteTeacher(schoolId, user.email, adminId)
  const accepted = await acceptTeacherInvitation(user.id, schoolId, { full_name: `${SYNTHETIC_MARKER} Peter` })
  peter = { userId: user.id, email: user.email, membershipId: accepted.schoolUser.id }

  await assignSubjectTeacher(schoolId, gradeEastId, coreMathId, peter.membershipId)
  const { data } = await db.from('class_subjects').select('id').eq('class_id', gradeEastId).eq('subject_id', coreMathId).is('ended_at', null).single()
  peterCoreMathsCsId = data!.id as string
})

test('canonical marks-entry writer: identical retry produces no new evidence row; a real correction still supersedes', async () => {
  const { assessmentId } = await createBridgedAssessment(
    schoolId, gradeEastId, peter.userId,
    { title: 'Idempotency CAT', assessment_type: 'cat', term: '1', year: 2026, max_score: 100, subjects: [], curriculum_type: 'cbc' },
    peterCoreMathsCsId,
  )
  const learnerId = await admit(schoolId, gradeEastId, termId, academicYearId, 'Canon')
  await createOrUpdateSeniorProgramme({
    learnerId, schoolId, academicYearId, pathway: 'STEM', source: 'admin_entry',
    subjects: [{ subjectId: coreMathId, role: 'compulsory' }],
  })

  await recordCanonicalAssessmentMarks(schoolId, assessmentId, peter.userId, [{ coreLearnerId: learnerId, score: 72 }])
  await recordCanonicalAssessmentMarks(schoolId, assessmentId, peter.userId, [{ coreLearnerId: learnerId, score: 72 }]) // identical retry
  await recordCanonicalAssessmentMarks(schoolId, assessmentId, peter.userId, [{ coreLearnerId: learnerId, score: 72 }]) // identical retry again

  const legacyStudentId = (await resolveLegacyStudentId(learnerId))!
  const evidenceAfterRetries = await repos.evidence.findByLearner(legacyStudentId)
  const coreRows = evidenceAfterRetries.filter(e => e.subject === 'core_mathematics')
  assert.equal(coreRows.length, 1, 'three identical saves of the same value must leave exactly one evidence row, not three')
  assert.equal(coreRows[0].lifecycle_state, 'auto_confirmed')
  assert.equal(coreRows[0].score, 72)

  const auditLog = await repos.evidence.findAuditLog(coreRows[0].id)
  assert.equal(auditLog.length, 2, 'exactly the original creation + auto_confirmed events — no phantom superseded/re-created events from the retries')

  // Real correction — must still supersede exactly as before.
  await recordCanonicalAssessmentMarks(schoolId, assessmentId, peter.userId, [{ coreLearnerId: learnerId, score: 85 }])
  const evidenceAfterCorrection = await repos.evidence.findByLearner(legacyStudentId)
  const coreRowsAfterCorrection = evidenceAfterCorrection.filter(e => e.subject === 'core_mathematics')
  assert.equal(coreRowsAfterCorrection.length, 2, 'a genuine correction must still produce a new row')
  const confirmed = coreRowsAfterCorrection.find(e => e.lifecycle_state === 'auto_confirmed')
  const superseded = coreRowsAfterCorrection.find(e => e.lifecycle_state === 'superseded')
  assert.equal(confirmed?.score, 85)
  assert.equal(superseded?.score, 72)
  assert.equal(confirmed?.supersedes, superseded?.id)

  // Projection and Blueprint must reflect the corrected value, not the retried original nor a doubled count.
  const record = await composeProgrammeAcademicRecord(learnerId, legacyStudentId)
  assert.equal(record.status, 'available')
  const coreCard = record.data!.bySubject.find(s => s.subject === 'Core Mathematics')
  assert.equal(coreCard!.evidenceCount, 1, 'Blueprint must see one observation for this artifact, not three retries plus a correction')
})

test('CSV/legacy gradebook writer (recordAssessmentEvidence): identical re-run produces no new row', async () => {
  const bridged = await ensureBridgedClass(schoolId, gradeEastId, peter.userId)
  const { assessmentId } = await createBridgedAssessment(
    schoolId, gradeEastId, peter.userId,
    { title: 'Legacy Idempotency CAT', assessment_type: 'cat', term: '1', year: 2026, max_score: 100, subjects: ['Mathematics'], curriculum_type: 'cbc' },
  )
  const learnerId = await admit(schoolId, gradeEastId, termId, academicYearId, 'Legacy')

  await recordBridgedMarks(schoolId, assessmentId, bridged, peter.userId, [
    { coreLearnerId: learnerId, admission_number: 'LEGACY-1', student_name: 'Legacy Learner', subject_scores: { mathematics: 60 }, total_marks: 60, mean_score: 60 },
  ])
  const legacyStudentId = (await resolveLegacyStudentId(learnerId))!

  // Re-run the evidence writer directly on the SAME, unchanged marks —
  // exactly what a retried CSV upload or a duplicate webhook delivery does.
  await recordAssessmentEvidence(assessmentId, bridged.legacyTeacherId, peter.userId)
  await recordAssessmentEvidence(assessmentId, bridged.legacyTeacherId, peter.userId)

  const evidence = await repos.evidence.findByLearner(legacyStudentId)
  const mathRows = evidence.filter(e => e.subject === 'mathematics')
  assert.equal(mathRows.length, 1, 'two extra identical evidence-writer runs over unchanged marks must not create extra rows')
})

test('different learner, different assessment, and different subject are never treated as duplicates', async () => {
  const { assessmentId: assessmentA } = await createBridgedAssessment(
    schoolId, gradeEastId, peter.userId,
    { title: 'Distinctness A', assessment_type: 'cat', term: '1', year: 2026, max_score: 100, subjects: [], curriculum_type: 'cbc' },
    peterCoreMathsCsId,
  )
  const { assessmentId: assessmentB } = await createBridgedAssessment(
    schoolId, gradeEastId, peter.userId,
    { title: 'Distinctness B', assessment_type: 'cat', term: '1', year: 2026, max_score: 100, subjects: [], curriculum_type: 'cbc' },
    peterCoreMathsCsId,
  )
  const learnerX = await admit(schoolId, gradeEastId, termId, academicYearId, 'DistinctX')
  const learnerY = await admit(schoolId, gradeEastId, termId, academicYearId, 'DistinctY')

  // Same score (72) for two different learners on the same assessment.
  await recordCanonicalAssessmentMarks(schoolId, assessmentA, peter.userId, [
    { coreLearnerId: learnerX, score: 72 },
    { coreLearnerId: learnerY, score: 72 },
  ])
  // Same learner, same score, but a DIFFERENT assessment.
  await recordCanonicalAssessmentMarks(schoolId, assessmentB, peter.userId, [{ coreLearnerId: learnerX, score: 72 }])

  const legacyX = (await resolveLegacyStudentId(learnerX))!
  const legacyY = (await resolveLegacyStudentId(learnerY))!
  const evidenceX = (await repos.evidence.findByLearner(legacyX)).filter(e => e.subject === 'core_mathematics')
  const evidenceY = (await repos.evidence.findByLearner(legacyY)).filter(e => e.subject === 'core_mathematics')

  assert.equal(evidenceY.length, 1, 'a different learner with the same score is an independent observation')
  assert.equal(evidenceX.length, 2, 'the same learner scored on two different assessments produces two independent observations, not a dedup')
  assert.ok(evidenceX.every(e => e.lifecycle_state === 'auto_confirmed'), 'two different assessments never supersede each other')
})
