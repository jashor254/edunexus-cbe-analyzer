// lib/assessments/evidencePurpose.integration.test.ts
//
// Phase G integration proof against real (synthetic, cleaned up) data —
// verifying recordAssessmentEvidence (lib/assessments/evidence.ts) resolves
// purpose_id from the assessment's assessment_type_id -> assessment_types
// .default_purpose_id, per docs/architecture/learner-record-layer-decisions.md
// Decision 2, and never guesses one for a type with no default set.
//
// ⚠️ Creates one real (throwaway) auth.users account and legacy
// teachers/students/teacher_classes/class_assessments/learner_marks rows,
// all deleted in `after()`, including on failure.
//
// Run: npx tsx --env-file=.env.local --test lib/assessments/evidencePurpose.integration.test.ts
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createTestServiceClient as createServiceClient } from '@/utils/supabase/test-service'
import { createAssessment, bulkSaveMarks } from './mutations'
import { recordAssessmentEvidence } from './evidence'
import { repos } from '@/lib/repositories'
import { deleteAuthUserOrThrow } from '@/lib/testing/deleteAuthUserOrThrow'

const SYNTHETIC_MARKER = 'SYNTHETIC_EVIDENCE_PURPOSE_TEST'
const db = createServiceClient()

let authUserId: string
let teacherId: string
let classId: string
let studentId: string

before(async () => {
  const { data: authUser, error: authErr } = await db.auth.admin.createUser({
    email: `evidence-purpose-test-${Date.now()}@example.com`,
    password: `Test!${Math.random().toString(36).slice(2, 10)}`,
    email_confirm: true,
  })
  if (authErr) throw authErr
  authUserId = authUser.user.id

  const { data: teacher, error: teacherErr } = await db
    .from('teachers')
    .insert({ user_id: authUserId, full_name: SYNTHETIC_MARKER, school: SYNTHETIC_MARKER })
    .select('id')
    .single()
  if (teacherErr) throw teacherErr
  teacherId = teacher.id

  const { data: cls, error: clsErr } = await db
    .from('teacher_classes')
    .insert({ teacher_id: teacherId, name: SYNTHETIC_MARKER, grade: 7, subject: 'Mathematics', academic_year: '2026', class_code: `EPURP-${Date.now()}` })
    .select('id')
    .single()
  if (clsErr) throw clsErr
  classId = cls.id

  const { data: student, error: studentErr } = await db
    .from('students')
    .insert({ teacher_id: teacherId, name: SYNTHETIC_MARKER, grade: 7, level: 'Junior', school: SYNTHETIC_MARKER, added_by: 'teacher' })
    .select('id')
    .single()
  if (studentErr) throw studentErr
  studentId = student.id
})

after(async () => {
  const { data: assessments } = await db.from('class_assessments').select('id').eq('class_id', classId)
  const assessmentIds = (assessments ?? []).map(a => a.id)

  const { data: runs } = await db.from('ingestion_runs').select('id').eq('teacher_id', teacherId)
  const runIds = (runs ?? []).map(r => r.id)
  if (runIds.length > 0) {
    const { data: evByRun } = await db.from('learner_evidence').select('id').in('ingestion_run_id', runIds)
    const evIds = (evByRun ?? []).map(e => e.id)
    if (evIds.length > 0) {
      await db.from('evidence_projection_events').delete().in('evidence_id', evIds)
      await db.from('evidence_audit_log').delete().in('evidence_id', evIds)
      await db.from('learner_evidence').delete().in('id', evIds)
    }
    await db.from('ingestion_runs').delete().in('id', runIds)
  }

  if (assessmentIds.length > 0) {
    await db.from('learner_marks').delete().in('assessment_id', assessmentIds)
    await db.from('class_assessments').delete().in('id', assessmentIds)
  }
  await db.from('assessment_types').delete().eq('teacher_id', teacherId)
  await db.from('students').delete().eq('id', studentId)
  await db.from('teacher_classes').delete().eq('id', classId)
  await db.from('teachers').delete().eq('id', teacherId)
  await deleteAuthUserOrThrow(db, authUserId)
  console.log('[cleanup] synthetic evidence-purpose fixtures removed')
})

test('evidence from a known assessment type (cat) resolves purpose_id to "formative"', async () => {
  const assessment = await createAssessment(teacherId, classId, {
    title: 'CAT 1', assessmentType: 'cat', term: '1', year: 2026, maxScore: 100, subjects: ['Mathematics'],
  })
  await bulkSaveMarks(assessment.id, classId, teacherId, [
    { studentName: SYNTHETIC_MARKER, admNo: undefined, subjectScores: { Mathematics: 80 } },
  ])
  // student_id only resolves via admission number in bulkSaveMarks; set it directly for this test's purposes.
  await db.from('learner_marks').update({ student_id: studentId }).eq('assessment_id', assessment.id)

  await recordAssessmentEvidence(assessment.id, teacherId, authUserId)

  const { data: runs } = await db.from('ingestion_runs').select('id').eq('teacher_id', teacherId)
  const runId = runs![0].id
  const { data: evidence, error } = await db.from('learner_evidence').select('purpose_id').eq('ingestion_run_id', runId)
  if (error) throw error
  assert.ok(evidence!.length > 0)

  const formative = await repos.evidencePurposes.findByCode('formative')
  assert.equal(evidence![0].purpose_id, formative?.id, '"cat" must resolve to the "formative" purpose, per the Phase G migration\'s default mapping')
})

test('evidence from a custom, never-purposed assessment type resolves purpose_id to null, never a guess', async () => {
  const assessment = await createAssessment(teacherId, classId, {
    title: 'Portfolio Check', assessmentType: 'portfolio_check', term: '1', year: 2026, maxScore: 100, subjects: ['Mathematics'],
  })
  await bulkSaveMarks(assessment.id, classId, teacherId, [
    { studentName: SYNTHETIC_MARKER, admNo: undefined, subjectScores: { Mathematics: 70 } },
  ])
  await db.from('learner_marks').update({ student_id: studentId }).eq('assessment_id', assessment.id)

  await recordAssessmentEvidence(assessment.id, teacherId, authUserId)

  const { data: runs } = await db.from('ingestion_runs').select('id').eq('teacher_id', teacherId).order('started_at', { ascending: false }).limit(1)
  const runId = runs![0].id
  const { data: evidence, error } = await db.from('learner_evidence').select('purpose_id').eq('ingestion_run_id', runId)
  if (error) throw error
  assert.ok(evidence!.length > 0)
  assert.equal(evidence![0].purpose_id, null, 'a custom type with no default_purpose_id must resolve to null, never a fabricated guess')
})
