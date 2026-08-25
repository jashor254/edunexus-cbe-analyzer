// lib/assessments/unlinkedMarks.integration.test.ts
//
// P0 repair proof (Adaptive Evidence Reliability audit, P0-1): a mark
// submitted through bulkSaveMarks/upsertMarksCSV for a name that doesn't
// resolve to exactly one roster learner (unmatched, or ambiguous because two
// roster entries share a name) previously saved successfully to the
// gradebook while being silently excluded from learner_evidence — the API
// response reported full success regardless. This proves both functions now
// return an honest `unlinked` count computed from the actual link outcome,
// that a saved-but-unlinked row still never produces Evidence (unchanged,
// correct behaviour — this repair does not fabricate identity), and that a
// linked row is unaffected.
//
// ⚠️ Creates one real (throwaway) auth.users account and legacy
// teachers/students/teacher_classes/class_students/class_assessments/
// learner_marks rows, all deleted in `after()`, including on failure.
//
// Run: npx tsx --env-file=.env.local --test lib/assessments/unlinkedMarks.integration.test.ts

import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createTestServiceClient as createServiceClient } from '@/utils/supabase/test-service'
import { createAssessment, bulkSaveMarks, upsertMarksCSV } from './mutations'
import { recordAssessmentEvidence } from './evidence'
import { deleteAuthUserOrThrow } from '@/lib/testing/deleteAuthUserOrThrow'

const SYNTHETIC_MARKER = 'SYNTHETIC_UNLINKED_MARKS_TEST'
const db = createServiceClient()

let authUserId: string
let teacherId: string
let classId: string
let aliceId: string
let bobTwinAId: string
let bobTwinBId: string

before(async () => {
  const { data: authUser, error: authErr } = await db.auth.admin.createUser({
    email: `unlinked-marks-test-${Date.now()}@example.com`,
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
    .insert({ teacher_id: teacherId, name: SYNTHETIC_MARKER, grade: 7, subject: 'Mathematics', academic_year: '2026', class_code: `UNLK-${Date.now()}` })
    .select('id')
    .single()
  if (clsErr) throw clsErr
  classId = cls.id

  // Alice: unique name, resolves cleanly.
  const { data: alice, error: aliceErr } = await db
    .from('students')
    .insert({ teacher_id: teacherId, name: 'Alice Wanjiru', grade: 7, level: 'Junior', school: SYNTHETIC_MARKER, added_by: 'teacher' })
    .select('id')
    .single()
  if (aliceErr) throw aliceErr
  aliceId = alice.id

  // Two learners sharing a name on the same roster — a mark for "Bob Otieno"
  // must resolve to neither, not to an arbitrary guess between them.
  const { data: bobA, error: bobAErr } = await db
    .from('students')
    .insert({ teacher_id: teacherId, name: 'Bob Otieno', grade: 7, level: 'Junior', school: SYNTHETIC_MARKER, added_by: 'teacher' })
    .select('id')
    .single()
  if (bobAErr) throw bobAErr
  bobTwinAId = bobA.id

  const { data: bobB, error: bobBErr } = await db
    .from('students')
    .insert({ teacher_id: teacherId, name: 'Bob Otieno', grade: 7, level: 'Junior', school: SYNTHETIC_MARKER, added_by: 'teacher' })
    .select('id')
    .single()
  if (bobBErr) throw bobBErr
  bobTwinBId = bobB.id

  await db.from('class_students').insert([
    { class_id: classId, student_id: aliceId },
    { class_id: classId, student_id: bobTwinAId },
    { class_id: classId, student_id: bobTwinBId },
  ])
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
  await db.from('class_students').delete().eq('class_id', classId)
  await db.from('students').delete().in('id', [aliceId, bobTwinAId, bobTwinBId])
  await db.from('teacher_classes').delete().eq('id', classId)
  await db.from('teachers').delete().eq('id', teacherId)
  await deleteAuthUserOrThrow(db, authUserId)
  console.log('[cleanup] synthetic unlinked-marks fixtures removed')
})

test('Case A — a fully-linked batch reports zero unlinked', async () => {
  const assessment = await createAssessment(teacherId, classId, {
    title: 'CAT — Linked Batch', assessmentType: 'cat', term: '1', year: 2026, maxScore: 100, subjects: ['Mathematics'],
  })

  const { marks, unlinked } = await bulkSaveMarks(assessment.id, classId, teacherId, [
    { studentName: 'Alice Wanjiru', subjectScores: { Mathematics: 80 } },
  ], 'cbc', 100)

  assert.equal(unlinked, 0, 'a name that matches exactly one roster learner must not be counted as unlinked')
  assert.equal(marks.length, 1, 'the mark still saves to the gradebook')

  const { data: row } = await db.from('learner_marks').select('student_id').eq('assessment_id', assessment.id).single()
  assert.equal(row!.student_id, aliceId)
})

test('Case B — an unmatched name (not on the roster) saves the mark but is counted unlinked', async () => {
  const assessment = await createAssessment(teacherId, classId, {
    title: 'CAT — Unmatched', assessmentType: 'cat', term: '1', year: 2026, maxScore: 100, subjects: ['Mathematics'],
  })

  const { marks, unlinked } = await bulkSaveMarks(assessment.id, classId, teacherId, [
    { studentName: 'Ghost Learner', subjectScores: { Mathematics: 60 } },
  ], 'cbc', 100)

  assert.equal(unlinked, 1, 'a name absent from the roster must be counted unlinked')
  assert.equal(marks.length, 1, 'the mark must still save to the gradebook — this repair never rejects a valid score row')

  const { data: row } = await db.from('learner_marks').select('student_id').eq('assessment_id', assessment.id).single()
  assert.equal(row!.student_id, null, 'no arbitrary learner may be assigned to an unmatched name')
})

test('Case C — an ambiguous duplicate-name mark saves but is counted unlinked, never guessed', async () => {
  const assessment = await createAssessment(teacherId, classId, {
    title: 'CAT — Ambiguous', assessmentType: 'cat', term: '1', year: 2026, maxScore: 100, subjects: ['Mathematics'],
  })

  const { marks, unlinked } = await bulkSaveMarks(assessment.id, classId, teacherId, [
    { studentName: 'Bob Otieno', subjectScores: { Mathematics: 55 } },
  ], 'cbc', 100)

  assert.equal(unlinked, 1, 'a name shared by two roster learners must be counted unlinked, not resolved to either one')
  assert.equal(marks.length, 1)

  const { data: row } = await db.from('learner_marks').select('student_id').eq('assessment_id', assessment.id).single()
  assert.equal(row!.student_id, null, 'ambiguity must never be resolved by guessing between the two learners')
})

test('Case D — a mixed batch reports the exact unlinked count and only linked rows reach Evidence', async () => {
  const assessment = await createAssessment(teacherId, classId, {
    title: 'CAT — Mixed Batch', assessmentType: 'cat', term: '1', year: 2026, maxScore: 100, subjects: ['Mathematics'],
  })

  const { marks, unlinked } = await bulkSaveMarks(assessment.id, classId, teacherId, [
    { studentName: 'Alice Wanjiru', subjectScores: { Mathematics: 80 } }, // linked
    { studentName: 'Bob Otieno',    subjectScores: { Mathematics: 55 } }, // ambiguous
    { studentName: 'Ghost Learner', subjectScores: { Mathematics: 60 } }, // unmatched
  ], 'cbc', 100)

  assert.equal(marks.length, 3, 'the current API response must still report all three rows as saved (`saved: marks.length`)')
  assert.equal(unlinked, 2, 'exactly the two unlinkable rows must be counted — this is the fact the API previously never disclosed')

  const { data: teacher } = await db.from('teachers').select('user_id').eq('id', teacherId).maybeSingle()
  await recordAssessmentEvidence(assessment.id, teacherId, teacher!.user_id as string)

  const { data: runs } = await db.from('ingestion_runs').select('id').eq('teacher_id', teacherId).order('created_at', { ascending: false }).limit(1)
  const runId = runs![0].id
  const { data: evidence, error } = await db.from('learner_evidence').select('learner_id').eq('ingestion_run_id', runId)
  if (error) throw error

  assert.equal(evidence!.length, 1, 'only the one linked mark may produce Evidence — the unlinked rows must not fabricate a learner_id')
  assert.equal(evidence![0].learner_id, aliceId)
})

test('CSV path (upsertMarksCSV) reports the same unlinked semantics as manual entry', async () => {
  const assessment = await createAssessment(teacherId, classId, {
    title: 'CAT — CSV Mixed', assessmentType: 'cat', term: '1', year: 2026, maxScore: 100, subjects: ['Mathematics'],
  })

  const result = await upsertMarksCSV(assessment.id, classId, teacherId, [
    { studentName: 'Alice Wanjiru', subjectScores: { Mathematics: 90 } },
    { studentName: 'Ghost Learner', subjectScores: { Mathematics: 40 } },
  ], 'cbc', 100)

  assert.equal(result.unlinked, 1, 'CSV upload must count unlinked rows using the same rule as manual entry')
  assert.equal(result.inserted, 2, 'both rows still save to the gradebook')
})
