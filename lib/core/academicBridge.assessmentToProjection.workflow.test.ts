// lib/core/academicBridge.assessmentToProjection.workflow.test.ts
//
// Sprint 11 (Release Candidate Audit) — the single most consequential
// question in the whole audit was whether a Core-only school (streams,
// classes, subjects, admissions all done through app/teacher/core-office/*)
// actually produces a working Blueprint at all, or whether Core assessments
// and the Evidence/Projection pipeline are two silently disconnected
// systems. Traced as real code during this sprint: they are connected, via
// lib/core/academicBridge.ts's Assessment -> Evidence -> Projection
// orchestration (recordBridgedMarks). This was previously UNTESTED end to
// end — no existing test exercised the full chain from a Core-side mark
// entry through to a real learner_evidence row and a real Projection. This
// is that missing coverage, protecting the audit's most important finding
// against regression.
//
// Run: npx tsx --env-file=.env.local --test lib/core/academicBridge.assessmentToProjection.workflow.test.ts
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createServiceClient } from '@/utils/supabase/service'
import { repos } from '@/lib/repositories'
import { activateSchool } from '@/lib/core/schoolActivation'
import { onboardLearner } from '@/lib/core/learnerOnboarding'
import { inviteTeacher, acceptTeacherInvitation } from '@/lib/core/teacherOnboarding'
import { ensureBridgedClass, createBridgedAssessment, recordBridgedMarks } from '@/lib/core/academicBridge'

const SYNTHETIC_MARKER = 'SYNTHETIC_S11_BRIDGE_TEST'
const db = createServiceClient()

const createdAuthUserIds: string[] = []
const createdSchoolIds: string[] = []

async function mkAuthUser(label: string): Promise<{ id: string; email: string }> {
  const email = `s11-bridge-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.com`
  const { data, error } = await db.auth.admin.createUser({
    email, password: `Test!${Math.random().toString(36).slice(2, 10)}`, email_confirm: true,
  })
  if (error) throw error
  createdAuthUserIds.push(data.user.id)
  return { id: data.user.id, email }
}

let schoolId: string
let classId: string
let termId: string
let academicYearId: string
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
  academicYearId = classes![0].academic_year_id
  const { data: terms } = await db.from('terms').select('id').eq('school_id', schoolId).order('term_number').limit(1)
  termId = terms![0].id

  const teacherUser = await mkAuthUser('teacher')
  teacherUserId = teacherUser.id
  await inviteTeacher(schoolId, teacherUser.email, admin.id)
  await acceptTeacherInvitation(teacherUserId, schoolId, { full_name: 'S11 Bridge Teacher' })

  const learner = await onboardLearner(schoolId, {
    admission_number: `${SYNTHETIC_MARKER}-1`, first_name: 'Bridge', last_name: 'Learner',
    class_id: classId, term_id: termId, academic_year_id: academicYearId,
  })
  coreLearnerId = learner.learnerId!
})

after(async () => {
  // Legacy bridge shadow rows this test's fixture created — not covered by
  // the `schools` cascade (legacy teacher_classes/students is a separate,
  // pre-Core schema).
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

test('recordBridgedMarks: a Core-side mark entry produces a real, confirmed learner_evidence row', async () => {
  const bridgedClass = await ensureBridgedClass(schoolId, classId, teacherUserId)
  const { assessmentId } = await createBridgedAssessment(schoolId, classId, teacherUserId, {
    title: `${SYNTHETIC_MARKER} CAT 1`,
    assessment_type: 'formative',
    term: '1',
    year: new Date().getFullYear(),
    max_score: 100,
    subjects: ['Mathematics'],
    curriculum_type: 'cbc',
  })

  const { legacyStudentIds } = await recordBridgedMarks(schoolId, assessmentId, bridgedClass, teacherUserId, [{
    coreLearnerId,
    admission_number: `${SYNTHETIC_MARKER}-1`,
    student_name: 'Bridge Learner',
    subject_scores: { Mathematics: 78 },
    total_marks: 78,
    mean_score: 78,
  }])
  assert.equal(legacyStudentIds.length, 1)
  const legacyStudentId = legacyStudentIds[0]

  const evidence = await repos.evidence.findConfirmedEvidenceForLearner(legacyStudentId)
  assert.ok(evidence.length > 0, 'a Core-side bridged mark must produce real, confirmed Evidence — this is the whole audit finding this test protects')
})

test('recordBridgedMarks: the same mark entry produces a real Projection (Blueprint is not empty for a Core-only school)', async () => {
  const bridgedClass = await ensureBridgedClass(schoolId, classId, teacherUserId)
  const { assessmentId } = await createBridgedAssessment(schoolId, classId, teacherUserId, {
    title: `${SYNTHETIC_MARKER} CAT 2`,
    assessment_type: 'formative',
    term: '1',
    year: new Date().getFullYear(),
    max_score: 100,
    subjects: ['English'],
    curriculum_type: 'cbc',
  })

  const { legacyStudentIds } = await recordBridgedMarks(schoolId, assessmentId, bridgedClass, teacherUserId, [{
    coreLearnerId,
    admission_number: `${SYNTHETIC_MARKER}-1`,
    student_name: 'Bridge Learner',
    subject_scores: { English: 65 },
    total_marks: 65,
    mean_score: 65,
  }])
  const legacyStudentId = legacyStudentIds[0]

  const { data: projectionRows } = await db.from('learner_projections').select('projector_type').eq('learner_id', legacyStudentId)
  assert.ok(projectionRows && projectionRows.length > 0, 'recordBridgedMarks must leave at least one persisted projection row for this learner')
})
