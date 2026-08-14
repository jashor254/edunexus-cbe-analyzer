// lib/core/computeTermSummariesBridge.test.ts
//
// Sprint 10A — proves the fix for a confirmed live bug found while auditing
// runEndOfTerm(): computeTermSummaries (lib/core/assessments.ts) was writing
// learner_marks.student_id (a legacy `students.id`, Sprint 9F's bridge) directly
// into term_subject_summaries.learner_id, which has a real FK to `learners.id`
// — a different id space. For any Core-native/bridged school this made every
// upsertTermSubjectSummaries call fail its FK check, breaking the
// Assessment -> Evidence -> Projection -> Summaries chain End-of-Term depends
// on. The fix resolves each mark's student_id back to its Core learner via
// the same external_id link academicBridge.ts already uses in the other
// direction (lib/repositories/teacher.repository.ts::findExternalIdsByStudentIds).
//
// Run: npx tsx --env-file=.env.local --test lib/core/computeTermSummariesBridge.test.ts
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createServiceClient } from '@/utils/supabase/service'
import { repos } from '@/lib/repositories'
import { activateSchool } from '@/lib/core/schoolActivation'
import { inviteTeacher, acceptTeacherInvitation } from '@/lib/core/teacherOnboarding'
import { onboardLearner } from '@/lib/core/learnerOnboarding'
import { createBridgedAssessment, recordBridgedMarks, ensureBridgedClass } from '@/lib/core/academicBridge'
import { publishAssessment, computeTermSummaries } from '@/lib/core/assessments'
import { asLearnerId } from '@/lib/core/identityTypes'

const SYNTHETIC_MARKER = 'SYNTHETIC_10A_TERMSUMMARY_TEST'
const db = createServiceClient()

const createdAuthUserIds: string[] = []
const createdSchoolIds: string[] = []

async function mkAuthUser(label: string): Promise<{ id: string; email: string }> {
  const email = `sprint10a-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.com`
  const { data, error } = await db.auth.admin.createUser({
    email,
    password: `Test!${Math.random().toString(36).slice(2, 10)}`,
    email_confirm: true,
  })
  if (error) throw error
  createdAuthUserIds.push(data.user.id)
  return { id: data.user.id, email }
}

after(async () => {
  // Mirrors lib/core/academicReadMigration.test.ts's cleanup convention
  // (Sprint 9F's full-dependency-chain sweep).
  if (createdSchoolIds.length) {
    const { data: coreLearners } = await db.from('learners').select('id').in('school_id', createdSchoolIds)
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
        await db.from('class_students').delete().in('student_id', studentIds)
        await db.from('students').delete().in('id', studentIds)
      }
    }
    await db.from('term_subject_summaries').delete().in('school_id', createdSchoolIds)
    const { data: coreClasses } = await db.from('classes').select('id').in('school_id', createdSchoolIds)
    const classExternalIds = (coreClasses ?? []).map(c => c.id)
    if (classExternalIds.length) await db.from('teacher_classes').delete().in('external_id', classExternalIds)
  }
  for (const id of createdSchoolIds) await db.from('schools').delete().eq('id', id)
  for (const id of createdAuthUserIds) {
    await db.from('teachers').delete().eq('user_id', id)
    await db.from('profiles').delete().eq('id', id)
    await db.auth.admin.deleteUser(id)
  }
})

async function fullyOnboardedLearner(labelPrefix: string) {
  const admin = await mkAuthUser(`${labelPrefix}-admin`)
  const school = await repos.schools.create({ school_name: `${SYNTHETIC_MARKER}_${labelPrefix}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}` }, admin.id)
  createdSchoolIds.push(school.id)
  await repos.schools.addSchoolUser(school.id, admin.id, 'school_admin')

  const activation = await activateSchool(school.id, { gradeCodes: ['G10'] })
  if (activation.status !== 'complete') throw new Error(`fixture activation failed: ${activation.error}`)

  const teacher = await mkAuthUser(`${labelPrefix}-teacher`)
  const invite = await inviteTeacher(school.id, teacher.email, admin.id)
  if (invite.status !== 'invited') throw new Error(`fixture invite failed`)
  const accept = await acceptTeacherInvitation(teacher.id, school.id, { full_name: `${labelPrefix} Teacher` })
  if (accept.status !== 'accepted') throw new Error(`fixture accept failed`)

  const { data: classes } = await db.from('classes').select('id, academic_year_id').eq('school_id', school.id).limit(1)
  const { data: terms } = await db.from('terms').select('id').eq('school_id', school.id).order('term_number').limit(1)
  const classId = classes![0].id
  const termId = terms![0].id
  const academicYearId = classes![0].academic_year_id

  const enroll = await onboardLearner(school.id, {
    admission_number: `${labelPrefix}-${Date.now()}`,
    first_name: 'Term',
    last_name: 'Summary',
    class_id: classId,
    term_id: termId,
    academic_year_id: academicYearId,
    guardian: { full_name: 'Term Summary Guardian', phone: `07${Math.floor(Math.random() * 100_000_000)}`, relationship: 'mother' },
  })
  if (enroll.status !== 'complete') throw new Error(`fixture enrollment failed: ${enroll.error}`)
  const coreLearnerId = enroll.learnerId!

  const { assessmentId } = await createBridgedAssessment(school.id, classId, teacher.id, {
    title: 'Term Summary CAT',
    assessment_type: 'cat',
    term: '1',
    year: 2026,
    max_score: 100,
    subjects: ['SS-MATH'],
    curriculum_type: 'cbc',
  })
  const bridgedClass = await ensureBridgedClass(school.id, classId, teacher.id)
  const { legacyStudentIds } = await recordBridgedMarks(school.id, assessmentId, bridgedClass, teacher.id, [
    { coreLearnerId: asLearnerId(coreLearnerId), admission_number: 'TS', student_name: 'Term Summary', subject_scores: { 'SS-MATH': 82 }, total_marks: 82, mean_score: 82 },
  ])
  await publishAssessment(assessmentId)

  return {
    schoolId: school.id, classId, termId, coreLearnerId,
    legacyStudentId: legacyStudentIds[0],
    legacyClassId: bridgedClass.legacyClassId,
    legacyTeacherId: bridgedClass.legacyTeacherId,
  }
}

test('computeTermSummaries resolves a bridged legacy student_id to its Core learner_id (the FK term_subject_summaries.learner_id actually points at)', async () => {
  const fixture = await fullyOnboardedLearner('bridge')

  await computeTermSummaries(fixture.schoolId, fixture.classId, fixture.termId, {})

  const { data: rows, error } = await db
    .from('term_subject_summaries')
    .select('learner_id, weighted_score, cbc_level')
    .eq('class_id', fixture.classId)
    .eq('term_id', fixture.termId)

  assert.equal(error, null)
  assert.equal(rows?.length, 1)
  assert.equal(rows![0].learner_id, fixture.coreLearnerId) // NOT fixture.legacyStudentId
  assert.notEqual(rows![0].learner_id, fixture.legacyStudentId)
  assert.equal(rows![0].weighted_score, 82)
})

test('computeTermSummaries skips a mark whose student_id has no bridge (no external_id) instead of writing an invalid learner_id', async () => {
  const fixture = await fullyOnboardedLearner('unbridged')

  // Simulate a pre-bridge/orphaned learner_marks row: same shape as a real
  // bridged row, but pointing at a students row with no external_id set —
  // this must never happen via the real bridge path, but a defensive skip
  // here is cheaper than a corrupted FK-violating write.
  const { data: assessmentRows } = await db.from('class_assessments').select('id').eq('class_id', fixture.legacyClassId).limit(1)
  const orphanAssessmentId = assessmentRows![0].id
  const { data: orphanStudent, error: insertErr } = await db
    .from('students')
    .insert({ name: 'Orphan Student', grade: 10, level: 'Senior School', curriculum_type: 'cbc', added_by: 'system', teacher_id: fixture.legacyTeacherId })
    .select('id')
    .single()
  assert.equal(insertErr, null)

  const { error: markErr } = await db.from('learner_marks').insert({
    assessment_id: orphanAssessmentId,
    class_id: fixture.legacyClassId,
    student_id: orphanStudent!.id,
    admission_number: 'ORPHAN',
    student_name: 'Orphan Student',
    subject_scores: { 'SS-MATH': 40 },
    total_marks: 40,
    teacher_id: fixture.legacyTeacherId,
  })
  assert.equal(markErr, null)

  await computeTermSummaries(fixture.schoolId, fixture.classId, fixture.termId, {})

  const { data: rows } = await db
    .from('term_subject_summaries')
    .select('learner_id')
    .eq('class_id', fixture.classId)
    .eq('term_id', fixture.termId)
  // Only the real bridged learner's summary — the orphan mark was skipped, not written.
  assert.equal(rows?.length, 1)
  assert.equal(rows![0].learner_id, fixture.coreLearnerId)

  await db.from('learner_marks').delete().eq('student_id', orphanStudent!.id)
  await db.from('students').delete().eq('id', orphanStudent!.id)
})
