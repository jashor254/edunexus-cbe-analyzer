// lib/assessments/assessmentType.integration.test.ts
//
// Phase B integration proof against real (synthetic, cleaned up) data —
// verifying resolve-or-create semantics, per-teacher scoping, and that a
// created assessment links to its resolved assessment_type, per
// docs/architecture/academic-evidence-layer.md §7.
//
// ⚠️ Creates one real (throwaway) auth.users account and legacy
// teachers/students/teacher_classes rows, all deleted in `after()`,
// including on failure.
//
// Run: npx tsx --env-file=.env.local --test lib/assessments/assessmentType.integration.test.ts
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createTestServiceClient as createServiceClient } from '@/utils/supabase/test-service'
import { createAssessment } from './mutations'
import { repos } from '@/lib/repositories'
import { deleteAuthUserOrThrow } from '@/lib/testing/deleteAuthUserOrThrow'

const SYNTHETIC_MARKER = 'SYNTHETIC_ASSESSMENT_TYPE_TEST'
const db = createServiceClient()

let authUserId: string
let teacherId: string
let classId: string

before(async () => {
  const { data: authUser, error: authErr } = await db.auth.admin.createUser({
    email: `assessment-type-test-${Date.now()}@example.com`,
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
    .insert({ teacher_id: teacherId, name: SYNTHETIC_MARKER, grade: 7, subject: 'Mathematics', academic_year: '2026', class_code: `ATYPE-${Date.now()}` })
    .select('id')
    .single()
  if (clsErr) throw clsErr
  classId = cls.id
})

after(async () => {
  await db.from('class_assessments').delete().eq('class_id', classId)
  await db.from('assessment_types').delete().eq('teacher_id', teacherId)
  await db.from('teacher_classes').delete().eq('id', classId)
  await db.from('teachers').delete().eq('id', teacherId)
  await deleteAuthUserOrThrow(db, authUserId)
  console.log('[cleanup] synthetic assessment-type fixtures removed')
})

test('a brand-new teacher account has no assessment_types until first use — no speculative seeding beyond this migration\'s own backfill scope', async () => {
  // This teacher was created AFTER the Phase B migration ran, so it never
  // received the backward-compat backfill (that only targeted teachers
  // existing at migration time) — confirms resolve-or-create, not the
  // migration, is what provisions types for teachers created going forward.
  const types = await repos.assessmentTypes.findAllForTeacher(teacherId)
  assert.equal(types.length, 0)
})

test('creating an assessment with a never-seen type name registers it, not rejects it', async () => {
  const assessment = await createAssessment(teacherId, classId, {
    title: 'Term 1 Baseline',
    assessmentType: 'baseline', // not one of the 6 previously-hardcoded values
    term: '1',
    year: 2026,
    maxScore: 100,
    subjects: ['Mathematics'],
  })

  assert.equal(assessment.assessment_type, 'baseline')
  assert.ok(assessment.assessment_type_id, 'a custom type name must resolve to a real assessment_types row, not be rejected or left unlinked')

  const types = await repos.assessmentTypes.findAllForTeacher(teacherId)
  assert.equal(types.length, 1)
  assert.equal(types[0].id, assessment.assessment_type_id)
  assert.equal(types[0].name, 'baseline')
})

test('creating a second assessment with the same type name reuses the existing row, does not duplicate it', async () => {
  const first = await createAssessment(teacherId, classId, {
    title: 'CAT 1', assessmentType: 'cat', term: '1', year: 2026, maxScore: 100, subjects: ['Mathematics'],
  })
  const second = await createAssessment(teacherId, classId, {
    title: 'CAT 2', assessmentType: 'cat', term: '2', year: 2026, maxScore: 100, subjects: ['Mathematics'],
  })

  assert.equal(first.assessment_type_id, second.assessment_type_id, 'the same name for the same teacher must resolve to the same row')

  const catTypes = (await repos.assessmentTypes.findAllForTeacher(teacherId)).filter(t => t.name === 'cat')
  assert.equal(catTypes.length, 1, 'must not create a duplicate assessment_types row for a name already resolved once')
})

test('assessment_types are scoped per teacher — one teacher\'s custom type is invisible to another', async () => {
  const { data: otherAuthUser } = await db.auth.admin.createUser({
    email: `assessment-type-test-other-${Date.now()}@example.com`,
    password: `Test!${Math.random().toString(36).slice(2, 10)}`,
    email_confirm: true,
  })
  const { data: otherTeacher } = await db
    .from('teachers')
    .insert({ user_id: otherAuthUser!.user.id, full_name: SYNTHETIC_MARKER, school: SYNTHETIC_MARKER })
    .select('id')
    .single()

  try {
    await createAssessment(teacherId, classId, {
      title: 'Portfolio Review', assessmentType: 'portfolio_review', term: '1', year: 2026, maxScore: 100, subjects: ['Mathematics'],
    })
    const otherTeacherTypes = await repos.assessmentTypes.findAllForTeacher(otherTeacher!.id)
    assert.equal(otherTeacherTypes.find(t => t.name === 'portfolio_review'), undefined, 'a type created for one teacher must not be visible to another')
  } finally {
    await db.from('teachers').delete().eq('id', otherTeacher!.id)
    await deleteAuthUserOrThrow(db, otherAuthUser!.user.id)
  }
})
