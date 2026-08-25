// lib/core/coreAssessmentTypeIntegrity.test.ts
//
// Sprint 5F (docs/architecture/adr/0002-canonical-teacher-identity.md,
// docs/engineering/implementation-log.md): regression coverage for the
// ADR-0002 implementation — Core assessment creation now resolves the real
// `teachers.id` (the ratified canonical Teacher-domain identity) instead of
// trusting a caller-supplied `school_users.id`, fixing both the
// `class_assessments.teacher_id` FK violation and the previously-unresolved
// `assessment_type_id`.
//
// Two callers of createCoreAssessment() exist:
//   Caller 1 — app/api/core/assessments/route.ts -> lib/core/assessments.ts
//   ::createAssessment. Now resolves `teachers.id` via the existing
//   `resolveTeacher()` (the same function `requireClassTeacher` already
//   uses for authorization) and reuses `resolveOrCreateAssessmentType()` —
//   no new identity logic, no duplicated lookup.
//   Caller 2 — scripts/reference-school/06-seed-legacy-bridge.ts. Already
//   fixed in Sprint 5E's correction (has its own pre-existing
//   schoolUserIdToLegacyTeacherId map); unaffected by this sprint.
//
// The teacher-facing path (lib/assessments/mutations.ts) and its PATCH
// drift-prevention fix are unaffected — teacherId was already available
// there before any of this series started.
//
// Admin edge case (ADR-0002 Part 7, deliberately NOT solved): a
// school_admin/headteacher/deputy_headteacher caller with no `teachers` row
// makes resolveTeacher() return null. createAssessment throws a clear,
// descriptive error — the outcome (creation fails for this caller) is
// unchanged from before ADR-0002; only the failure's clarity improved.
//
// Run: npx tsx --env-file=.env.local --test lib/core/coreAssessmentTypeIntegrity.test.ts
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createTestServiceClient as createServiceClient } from '@/utils/supabase/test-service'
import { createAssessment as createCoreAssessment, listAssessments } from '@/lib/core/assessments'
import { createAssessment as createTeacherAssessment, updateAssessment } from '@/lib/assessments/mutations'

const SYNTHETIC_MARKER = 'SYNTHETIC_SPRINT5F_ASSESSMENT_TYPE'
const db = createServiceClient()

let teacherUserId: string
let teacherId: string
let classId: string
let noTeacherUserId: string
let createdAssessmentIds: string[] = []
let createdAssessmentTypeIds: string[] = []

before(async () => {
  const { data: auth } = await db.auth.admin.createUser({
    email: `sprint5f-teacher-${Date.now()}@example.com`,
    password: `Test!${Math.random().toString(36).slice(2, 10)}`,
    email_confirm: true,
  })
  teacherUserId = auth!.user.id

  const { data: noTeacherAuth } = await db.auth.admin.createUser({
    email: `sprint5f-noteacher-${Date.now()}@example.com`,
    password: `Test!${Math.random().toString(36).slice(2, 10)}`,
    email_confirm: true,
  })
  noTeacherUserId = noTeacherAuth!.user.id
  // noTeacherUserId deliberately gets no `teachers` row — simulates the
  // ADR-0002 admin edge case (a Core user with no legacy teacher record).

  const { data: teacherRow } = await db.from('teachers')
    .insert({ user_id: teacherUserId, full_name: SYNTHETIC_MARKER, school: SYNTHETIC_MARKER })
    .select('id').single()
  teacherId = teacherRow!.id

  const { data: classRow } = await db.from('teacher_classes')
    .insert({ teacher_id: teacherId, name: SYNTHETIC_MARKER, grade: 8, subject: 'Mathematics', class_code: `SYNTH-5F-${Date.now()}` })
    .select('id').single()
  classId = classRow!.id
})

after(async () => {
  if (createdAssessmentIds.length) await db.from('class_assessments').delete().in('id', createdAssessmentIds)
  if (createdAssessmentTypeIds.length) await db.from('assessment_types').delete().in('id', createdAssessmentTypeIds)
  await db.from('teacher_classes').delete().eq('id', classId)
  await db.from('teachers').delete().eq('id', teacherId)
  await db.auth.admin.deleteUser(teacherUserId)
  await db.auth.admin.deleteUser(noTeacherUserId)
})

async function readRow(id: string): Promise<{ teacher_id: string; assessment_type_id: string | null; assessment_type: string }> {
  const { data, error } = await db.from('class_assessments').select('teacher_id, assessment_type_id, assessment_type').eq('id', id).single()
  if (error) throw error
  return data
}

test('Core route: creation resolves the real teachers.id (not school_users.id) and resolves assessment_type_id', async () => {
  const assessment = await createCoreAssessment({
    class_id: classId,
    userId: teacherUserId,
    title: `${SYNTHETIC_MARKER}-core-path`,
    assessment_type: 'exam',
    term: '1',
    year: 2026,
    max_score: 100,
    subjects: ['Mathematics'],
    curriculum_type: 'cbc',
  })
  createdAssessmentIds.push(assessment.id)

  const row = await readRow(assessment.id)
  assert.equal(row.teacher_id, teacherId, 'must write the real teachers.id, per ADR-0002')
  assert.ok(row.assessment_type_id, 'assessment_type_id must be populated, not NULL')

  const { data: typeRow } = await db.from('assessment_types').select('id, name, teacher_id').eq('id', row.assessment_type_id!).single()
  assert.equal(typeRow!.name, 'exam')
  assert.equal(typeRow!.teacher_id, teacherId)
})

test('Core route: a second assessment of the same type reuses the same assessment_types row (no duplicate lookup/insert)', async () => {
  const first = await createCoreAssessment({
    class_id: classId, userId: teacherUserId, title: `${SYNTHETIC_MARKER}-cat-1`,
    assessment_type: 'cat', term: '1', year: 2026, max_score: 100, subjects: ['Mathematics'], curriculum_type: 'cbc',
  })
  const second = await createCoreAssessment({
    class_id: classId, userId: teacherUserId, title: `${SYNTHETIC_MARKER}-cat-2`,
    assessment_type: 'cat', term: '2', year: 2026, max_score: 100, subjects: ['Mathematics'], curriculum_type: 'cbc',
  })
  createdAssessmentIds.push(first.id, second.id)

  const rowFirst = await readRow(first.id)
  const rowSecond = await readRow(second.id)
  assert.ok(rowFirst.assessment_type_id)
  assert.equal(rowFirst.assessment_type_id, rowSecond.assessment_type_id, 'must resolve to one shared assessment_types row, not create a duplicate')
})

test('Core route: teacher resolution failure (no teachers row) throws a clear error and inserts nothing — the ADR-0002 admin edge case, preserved not solved', async () => {
  await assert.rejects(
    createCoreAssessment({
      class_id: classId, userId: noTeacherUserId, title: `${SYNTHETIC_MARKER}-should-not-exist`,
      assessment_type: 'exam', term: '1', year: 2026, max_score: 100, subjects: ['Mathematics'], curriculum_type: 'cbc',
    }),
    /no teacher record found/,
  )

  const { data: orphan } = await db.from('class_assessments').select('id').eq('title', `${SYNTHETIC_MARKER}-should-not-exist`)
  assert.equal(orphan?.length ?? 0, 0, 'no row should have been inserted when teacher resolution fails')
})

test('teacher-facing (legacy) assessment creation route is unchanged — still resolves assessment_type_id exactly as before', async () => {
  const assessment = await createTeacherAssessment(teacherId, classId, {
    title: `${SYNTHETIC_MARKER}-teacher-path`,
    assessmentType: 'exam',
    term: '1',
    year: 2026,
    maxScore: 100,
    subjects: ['Mathematics'],
  })
  createdAssessmentIds.push(assessment.id)
  assert.ok(assessment.assessment_type_id, 'teacher path must still populate assessment_type_id')
  assert.equal(assessment.teacher_id, teacherId)
})

test('a never-before-seen assessment_type name (Core route) is registered, not rejected or left null', async () => {
  const uniqueName = `${SYNTHETIC_MARKER}-custom-${Date.now()}`
  const assessment = await createCoreAssessment({
    class_id: classId, userId: teacherUserId, title: `${SYNTHETIC_MARKER}-custom`,
    assessment_type: uniqueName, term: '1', year: 2026, max_score: 100, subjects: ['Mathematics'], curriculum_type: 'cbc',
  })
  createdAssessmentIds.push(assessment.id)

  const row = await readRow(assessment.id)
  assert.ok(row.assessment_type_id, 'a new, unseen type name must be registered, not left NULL')

  const { data: typeRow } = await db.from('assessment_types').select('id, name').eq('id', row.assessment_type_id!).single()
  createdAssessmentTypeIds.push(typeRow!.id)
  assert.equal(typeRow!.name, uniqueName)
})

test('PATCH: changing assessment_type re-resolves assessment_type_id to match (no drift) — regression check, unaffected by this sprint', async () => {
  const assessment = await createTeacherAssessment(teacherId, classId, {
    title: `${SYNTHETIC_MARKER}-patch-sync`,
    assessmentType: 'exam',
    term: '1',
    year: 2026,
    maxScore: 100,
    subjects: ['Mathematics'],
  })
  createdAssessmentIds.push(assessment.id)
  const originalTypeId = assessment.assessment_type_id

  const updated = await updateAssessment(assessment.id, teacherId, { assessment_type: 'cat' })
  assert.equal(updated.assessment_type, 'cat')
  assert.ok(updated.assessment_type_id, 'assessment_type_id must still be populated after the PATCH')
  assert.notEqual(updated.assessment_type_id, originalTypeId, 'assessment_type_id must move to the new type, not stay pointed at the old one')

  const { data: typeRow } = await db.from('assessment_types').select('name').eq('id', updated.assessment_type_id!).single()
  assert.equal(typeRow!.name, 'cat')
})

test('PATCH: updates that do not touch assessment_type leave assessment_type_id untouched — regression check', async () => {
  const assessment = await createTeacherAssessment(teacherId, classId, {
    title: `${SYNTHETIC_MARKER}-patch-notype`,
    assessmentType: 'exam',
    term: '1',
    year: 2026,
    maxScore: 100,
    subjects: ['Mathematics'],
  })
  createdAssessmentIds.push(assessment.id)

  const updated = await updateAssessment(assessment.id, teacherId, { title: 'A New Title' })
  assert.equal(updated.title, 'A New Title')
  assert.equal(updated.assessment_type_id, assessment.assessment_type_id)
})

test('existing assessments with a NULL assessment_type_id (pre-fix data) still load without error — regression check', async () => {
  const { data: legacyRow, error } = await db.from('class_assessments').insert({
    class_id: classId, teacher_id: teacherId, title: `${SYNTHETIC_MARKER}-legacy-null`,
    assessment_type: 'exam', assessment_type_id: null, term: '1', year: 2026, max_score: 100, subjects: ['Mathematics'], curriculum_type: 'cbc',
  }).select('id').single()
  if (error) throw error
  createdAssessmentIds.push(legacyRow!.id)

  const rows = await listAssessments(classId, { term: '1', year: 2026 })
  const found = rows.find(r => r.id === legacyRow!.id)
  assert.ok(found, 'a row with NULL assessment_type_id must still be returned by listAssessments, not dropped or erroring')
})
