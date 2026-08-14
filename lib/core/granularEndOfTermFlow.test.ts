// lib/core/granularEndOfTermFlow.test.ts
//
// Sprint 10A Commit 3 — app/teacher/core-term/page.tsx drives the
// End-of-Term pipeline as four SEPARATE calls (lock -> compute -> generate
// -> publish), not the one-shot runEndOfTerm() Commit 2's test already
// covers. This proves that granular sequence works end-to-end against real
// bridged fixture data, including the intermediate states the new UI's
// status row (Phase 5) reads directly off these same functions' output —
// no new business logic, this is the exact call sequence the UI makes.
//
// Run: npx tsx --env-file=.env.local --test lib/core/granularEndOfTermFlow.test.ts
import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { createServiceClient } from '@/utils/supabase/service'
import { repos } from '@/lib/repositories'
import { activateSchool } from '@/lib/core/schoolActivation'
import { inviteTeacher, acceptTeacherInvitation } from '@/lib/core/teacherOnboarding'
import { onboardLearner } from '@/lib/core/learnerOnboarding'
import { createBridgedAssessment, recordBridgedMarks, ensureBridgedClass } from '@/lib/core/academicBridge'
import { publishAssessment, computeTermSummaries, listAssessments, getClassPerformanceSummary } from '@/lib/core/assessments'
import { generateReportCards, publishReportCards, listClassReportCards } from '@/lib/core/report-cards'
import { asLearnerId } from '@/lib/core/identityTypes'

const SYNTHETIC_MARKER = 'SYNTHETIC_10A_GRANULAR_TEST'
const db = createServiceClient()

const createdAuthUserIds: string[] = []
const createdSchoolIds: string[] = []

async function mkAuthUser(label: string): Promise<{ id: string; email: string }> {
  const email = `sprint10a-gran-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.com`
  const { data, error } = await db.auth.admin.createUser({
    email, password: `Test!${Math.random().toString(36).slice(2, 10)}`, email_confirm: true,
  })
  if (error) throw error
  createdAuthUserIds.push(data.user.id)
  return { id: data.user.id, email }
}

after(async () => {
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
    await db.from('school_report_cards').delete().in('school_id', createdSchoolIds)
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

test('granular teacher journey: lock -> compute -> generate -> publish, each a separate call, matching the new UI status row at every step', async () => {
  const admin = await mkAuthUser('admin')
  const school = await repos.schools.create({ school_name: `${SYNTHETIC_MARKER}_${Date.now()}` }, admin.id)
  createdSchoolIds.push(school.id)
  await repos.schools.addSchoolUser(school.id, admin.id, 'school_admin')
  const activation = await activateSchool(school.id, { gradeCodes: ['G10'] })
  assert.equal(activation.status, 'complete')

  const teacher = await mkAuthUser('teacher')
  await inviteTeacher(school.id, teacher.email, admin.id)
  await acceptTeacherInvitation(teacher.id, school.id, { full_name: 'Granular Teacher' })

  const { data: classes } = await db.from('classes').select('id, academic_year_id').eq('school_id', school.id).limit(1)
  const { data: terms } = await db.from('terms').select('id, term_number').eq('school_id', school.id).order('term_number').limit(1)
  const classId = classes![0].id
  const termId = terms![0].id
  const academicYearId = classes![0].academic_year_id

  const enroll = await onboardLearner(school.id, {
    admission_number: `gran-${Date.now()}`,
    first_name: 'Granular', last_name: 'Learner',
    class_id: classId, term_id: termId, academic_year_id: academicYearId,
    guardian: { full_name: 'Granular Guardian', phone: `07${Math.floor(Math.random() * 100_000_000)}`, relationship: 'mother' },
  })
  assert.equal(enroll.status, 'complete')
  const coreLearnerId = enroll.learnerId!

  const { assessmentId } = await createBridgedAssessment(school.id, classId, teacher.id, {
    title: 'Granular CAT', assessment_type: 'cat', term: '1', year: 2026, max_score: 100, subjects: ['SS-MATH'], curriculum_type: 'cbc',
  })
  const bridgedClass = await ensureBridgedClass(school.id, classId, teacher.id)
  await recordBridgedMarks(school.id, assessmentId, bridgedClass, teacher.id, [
    { coreLearnerId: asLearnerId(coreLearnerId), admission_number: 'gran', student_name: 'Granular Learner', subject_scores: { 'SS-MATH': 60 }, total_marks: 60, mean_score: 60 },
  ])

  // Before lock: exactly the "Assessments Locked = false" state the UI reads.
  let visible = await listAssessments(classId, { term: '1', year: 2026 })
  assert.equal(visible.length, 1)
  assert.equal(visible[0].is_published, false)

  // Step 1: Lock (the new action this commit added a route for).
  await publishAssessment(assessmentId)
  visible = await listAssessments(classId, { term: '1', year: 2026 })
  assert.equal(visible[0].is_published, true)

  // Before compute: "Summaries Generated = false" state.
  let summary = await getClassPerformanceSummary(classId, termId)
  assert.equal(summary.length, 0)

  // Step 2: Compute summaries (separately from report generation).
  await computeTermSummaries(school.id, classId, termId, {})
  summary = await getClassPerformanceSummary(classId, termId)
  assert.equal(summary.length, 1)
  assert.equal(summary[0].avg_score, 60)

  // Before generate: "Reports Generated = false" state.
  let cards = await listClassReportCards(classId, termId, school.id)
  assert.equal(cards.length, 0)

  // Step 3: Generate report cards (not yet published).
  const { generated } = await generateReportCards(admin.id, school.id, classId, termId, {})
  assert.equal(generated, 1)
  cards = await listClassReportCards(classId, termId, school.id)
  assert.equal(cards.length, 1)
  assert.equal(cards[0].is_published, false) // "Reports Published = false" still

  // Step 4: Publish report cards.
  const { published } = await publishReportCards(admin.id, school.id, termId, classId)
  assert.equal(published, 1)
  cards = await listClassReportCards(classId, termId, school.id)
  assert.equal(cards[0].is_published, true)
  assert.equal(cards[0].overall_cbc_level, 'ME') // 60 with default 75/50/25 boundaries: 60 >= 50 and < 75 -> ME
})
