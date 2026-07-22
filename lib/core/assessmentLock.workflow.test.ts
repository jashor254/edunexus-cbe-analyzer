// lib/core/assessmentLock.workflow.test.ts
//
// Sprint 12 Wave 2 (High 2/6, Release Blocker Remediation) — verifies the
// new lock guards: "Lock Assessment" (is_published) previously didn't
// block further mark edits at all (a real Release Candidate audit
// finding). This test proves lib/core/assessments.ts's saveScores() now
// refuses to write once an assessment is published, and that
// recordAssessmentEvidence() silently no-ops rather than producing
// Evidence for a locked assessment. Uses the same Core-bridge fixture
// pattern as lib/core/academicBridge.assessmentToProjection.workflow.test.ts.
//
// Run: npx tsx --env-file=.env.local --test lib/core/assessmentLock.workflow.test.ts
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createServiceClient } from '@/utils/supabase/service'
import { repos } from '@/lib/repositories'
import { activateSchool } from '@/lib/core/schoolActivation'
import { onboardLearner } from '@/lib/core/learnerOnboarding'
import { inviteTeacher, acceptTeacherInvitation } from '@/lib/core/teacherOnboarding'
import { ensureBridgedClass, ensureBridgedLearner, createBridgedAssessment } from '@/lib/core/academicBridge'
import { saveScores } from '@/lib/core/assessments'
import { recordAssessmentEvidence } from '@/lib/assessments/evidence'

const SYNTHETIC_MARKER = 'SYNTHETIC_S12_LOCK_TEST'
const db = createServiceClient()

const createdAuthUserIds: string[] = []
const createdSchoolIds: string[] = []

async function mkAuthUser(label: string): Promise<{ id: string; email: string }> {
  const email = `s12-lock-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.com`
  const { data, error } = await db.auth.admin.createUser({
    email, password: `Test!${Math.random().toString(36).slice(2, 10)}`, email_confirm: true,
  })
  if (error) throw error
  createdAuthUserIds.push(data.user.id)
  return { id: data.user.id, email }
}

let schoolId: string
let classId: string
let teacherUserId: string
let coreLearnerId: string

before(async () => {
  const admin = await mkAuthUser('admin')
  const school = await repos.schools.create({ school_name: `${SYNTHETIC_MARKER}_${Date.now()}` }, admin.id)
  schoolId = school.id
  createdSchoolIds.push(schoolId)
  await repos.schools.addSchoolUser(schoolId, admin.id, 'school_admin')

  const activation = await activateSchool(schoolId, { gradeCodes: ['G7'] })
  if (activation.status !== 'complete') throw new Error(`fixture activation failed: ${activation.error}`)

  const { data: classes } = await db.from('classes').select('id, academic_year_id').eq('school_id', schoolId).limit(1)
  classId = classes![0].id
  const { data: terms } = await db.from('terms').select('id').eq('school_id', schoolId).order('term_number').limit(1)
  const termId = terms![0].id

  const teacherUser = await mkAuthUser('teacher')
  teacherUserId = teacherUser.id
  await inviteTeacher(schoolId, teacherUser.email, admin.id)
  await acceptTeacherInvitation(teacherUserId, schoolId, { full_name: 'S12 Lock Teacher' })

  const learner = await onboardLearner(schoolId, {
    admission_number: `${SYNTHETIC_MARKER}-1`, first_name: 'Lock', last_name: 'Learner',
    class_id: classId, term_id: termId, academic_year_id: classes![0].academic_year_id,
  })
  coreLearnerId = learner.learnerId!
})

after(async () => {
  await db.from('students').delete().eq('external_id', coreLearnerId)
  await db.from('teacher_classes').delete().eq('external_id', classId)
  for (const id of createdSchoolIds) {
    await db.from('schools').delete().eq('id', id)
  }
  for (const id of createdAuthUserIds) {
    await db.from('teachers').delete().eq('user_id', id)
    await db.from('profiles').delete().eq('id', id)
    await db.auth.admin.deleteUser(id)
  }
})

test('saveScores: succeeds on an unpublished assessment (happy path, unaffected by the lock guard)', async () => {
  const bridgedClass = await ensureBridgedClass(schoolId, classId, teacherUserId)
  const { assessmentId } = await createBridgedAssessment(schoolId, classId, teacherUserId, {
    title: `${SYNTHETIC_MARKER} Unlocked`, assessment_type: 'formative', term: '1',
    year: new Date().getFullYear(), max_score: 100, subjects: ['Mathematics'], curriculum_type: 'cbc',
  })
  const { legacyStudentId } = await ensureBridgedLearner(schoolId, coreLearnerId, bridgedClass)
  await assert.doesNotReject(() => saveScores(assessmentId, bridgedClass.legacyClassId, bridgedClass.legacyTeacherId, [{
    learner_id: legacyStudentId, admission_number: `${SYNTHETIC_MARKER}-1`, student_name: 'Lock Learner',
    subject_scores: { Mathematics: 70 }, total_marks: 70, mean_score: 70,
  }]))
})

test('saveScores: refuses to write once the assessment is published (High 2 fix)', async () => {
  const bridgedClass = await ensureBridgedClass(schoolId, classId, teacherUserId)
  const { assessmentId } = await createBridgedAssessment(schoolId, classId, teacherUserId, {
    title: `${SYNTHETIC_MARKER} Locked`, assessment_type: 'formative', term: '1',
    year: new Date().getFullYear(), max_score: 100, subjects: ['English'], curriculum_type: 'cbc',
  })
  await db.from('class_assessments').update({ is_published: true }).eq('id', assessmentId)
  const { legacyStudentId } = await ensureBridgedLearner(schoolId, coreLearnerId, bridgedClass)

  await assert.rejects(
    () => saveScores(assessmentId, bridgedClass.legacyClassId, bridgedClass.legacyTeacherId, [{
      learner_id: legacyStudentId, admission_number: `${SYNTHETIC_MARKER}-1`, student_name: 'Lock Learner',
      subject_scores: { English: 90 }, total_marks: 90, mean_score: 90,
    }]),
    /locked/
  )

  // Confirmed no write happened — no learner_marks row exists for this assessment.
  const { data: marks } = await db.from('learner_marks').select('id').eq('assessment_id', assessmentId)
  assert.equal((marks ?? []).length, 0)
})

test('recordAssessmentEvidence: silently no-ops for a published (locked) assessment rather than producing Evidence', async () => {
  const bridgedClass = await ensureBridgedClass(schoolId, classId, teacherUserId)
  const { assessmentId } = await createBridgedAssessment(schoolId, classId, teacherUserId, {
    title: `${SYNTHETIC_MARKER} Evidence Locked`, assessment_type: 'formative', term: '1',
    year: new Date().getFullYear(), max_score: 100, subjects: ['Science'], curriculum_type: 'cbc',
  })
  // Save scores BEFORE locking (the only way real marks could exist), then
  // lock, then attempt evidence recording directly — simulating a caller
  // that reaches this function after the assessment was locked in the
  // meantime (the defense-in-depth scenario, not the normal flow).
  const { legacyStudentId } = await ensureBridgedLearner(schoolId, coreLearnerId, bridgedClass)
  await saveScores(assessmentId, bridgedClass.legacyClassId, bridgedClass.legacyTeacherId, [{
    learner_id: legacyStudentId, admission_number: `${SYNTHETIC_MARKER}-1`, student_name: 'Lock Learner',
    subject_scores: { Science: 85 }, total_marks: 85, mean_score: 85,
  }])
  await db.from('class_assessments').update({ is_published: true }).eq('id', assessmentId)

  const { data: before } = await db.from('learner_evidence').select('id').eq('learner_id', legacyStudentId)
  const beforeCount = (before ?? []).length

  await assert.doesNotReject(() => recordAssessmentEvidence(assessmentId, bridgedClass.legacyTeacherId, teacherUserId))

  const { data: after } = await db.from('learner_evidence').select('id').eq('learner_id', legacyStudentId)
  assert.equal((after ?? []).length, beforeCount, 'no NEW Evidence should be produced for a locked assessment')
})
