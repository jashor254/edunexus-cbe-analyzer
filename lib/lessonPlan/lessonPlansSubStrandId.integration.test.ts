// lib/lessonPlan/lessonPlansSubStrandId.integration.test.ts
//
// H5A-3 CUR-LP-001 — proves lesson_plans.sub_strand_id persists the exact
// canonical sow_substrands.id a GeneratedLesson carried at generation time
// (CUR-LP-001), rejects a fabricated id via a real FK constraint, stays
// NULL when no canonical identity was ever available (CUR-LP-002-shaped —
// same rule as every prior sub_strand_id column), and never confuses two
// sub-strands that happen to share a title. Exercises the exact insert
// shape lib/lessonPlan/weeklyGenerator.ts's savePlans() uses (mirrored
// here, not reimplemented — verified against that file) against a real
// synthetic schemes_of_work/lesson_plans fixture.
//
// Run: npx tsx --env-file=.env.local --test lib/lessonPlan/lessonPlansSubStrandId.integration.test.ts
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createTestServiceClient as createServiceClient } from '@/utils/supabase/test-service'

const SYNTHETIC_MARKER = 'SYNTHETIC_H5A3_LESSON_PLANS_TEST'
const db = createServiceClient()

let authUserId: string
let teacherId: string
let schemeId: string
let learningAreaId: string
let strandId: string
let collisionStrandId: string
let subStrandXId: string
let subStrandYId: string

before(async () => {
  const { data: grade, error: gradeErr } = await db.from('sow_grades').select('id').eq('numeric_grade', 8).limit(1).maybeSingle()
  if (gradeErr) throw gradeErr
  if (!grade) throw new Error('no Grade 8 row found in sow_grades — cannot seed a synthetic learning area')

  const { data: la, error: laErr } = await db
    .from('sow_learning_areas')
    .insert({ name: SYNTHETIC_MARKER, grade_id: grade.id, order_index: 1 })
    .select('id').single()
  if (laErr) throw laErr
  learningAreaId = la.id

  const { data: strand, error: strandErr } = await db
    .from('sow_strands')
    .insert({ title: SYNTHETIC_MARKER, learning_area_id: learningAreaId, order_index: 1 })
    .select('id').single()
  if (strandErr) throw strandErr
  strandId = strand.id

  const { data: collisionStrand, error: collisionStrandErr } = await db
    .from('sow_strands')
    .insert({ title: `${SYNTHETIC_MARKER}_COLLISION`, learning_area_id: learningAreaId, order_index: 2 })
    .select('id').single()
  if (collisionStrandErr) throw collisionStrandErr
  collisionStrandId = collisionStrand.id

  const { data: ssX, error: ssXErr } = await db
    .from('sow_substrands')
    .insert({ title: 'Fractions (synthetic)', strand_id: strandId, order_index: 1 })
    .select('id').single()
  if (ssXErr) throw ssXErr
  subStrandXId = ssX.id

  const { data: ssY, error: ssYErr } = await db
    .from('sow_substrands')
    .insert({ title: 'Fractions (synthetic)', strand_id: collisionStrandId, order_index: 1 })
    .select('id').single()
  if (ssYErr) throw ssYErr
  subStrandYId = ssY.id

  const { data: auth, error: authErr } = await db.auth.admin.createUser({
    email: `h5a3-lesson-plans-${Date.now()}@example.com`,
    password: `Test!${Math.random().toString(36).slice(2, 10)}`,
    email_confirm: true,
  })
  if (authErr) throw authErr
  authUserId = auth.user.id

  const { data: teacher, error: teacherErr } = await db
    .from('teachers')
    .insert({ user_id: authUserId, full_name: SYNTHETIC_MARKER, school: SYNTHETIC_MARKER })
    .select('id')
    .single()
  if (teacherErr) throw teacherErr
  teacherId = teacher.id

  const { data: scheme, error: schemeErr } = await db
    .from('schemes_of_work')
    .insert({
      teacher_id: teacherId, school: SYNTHETIC_MARKER, grade: '8', learning_area: SYNTHETIC_MARKER,
      term: 1, year: 2026, curriculum_mode: 'cbc_junior', total_lessons: 4, total_weeks: 1,
      lessons_per_week: 4, average_confidence: 90, breaks: [], lessons: [], timeline: [],
    })
    .select('id').single()
  if (schemeErr) throw schemeErr
  schemeId = scheme.id
})

after(async () => {
  await db.from('lesson_plans').delete().eq('sow_id', schemeId)
  await db.from('schemes_of_work').delete().eq('id', schemeId)
  await db.from('sow_substrands').delete().in('strand_id', [strandId, collisionStrandId])
  await db.from('sow_strands').delete().in('id', [strandId, collisionStrandId])
  await db.from('sow_learning_areas').delete().eq('id', learningAreaId)
  if (teacherId) await db.from('teachers').delete().eq('id', teacherId)
  if (authUserId) await db.auth.admin.deleteUser(authUserId)
})

// The exact insert shape lib/lessonPlan/weeklyGenerator.ts's savePlans() uses
// for lesson_plans, minus fields irrelevant to this contract.
function planRow(weekNumber: number, lessonNumber: number, strand: string, subStrand: string, subStrandId: string | null) {
  return {
    sow_id: schemeId, teacher_id: authUserId, week_number: weekNumber, lesson_number: lessonNumber,
    strand, sub_strand: subStrand, sub_strand_id: subStrandId,
    learning_outcomes: [], key_inquiry_questions: [], learning_resources: [], status: 'generated',
  }
}

test('CUR-LP-001: a real sow_substrands.id persists exactly on lesson_plans.sub_strand_id', async () => {
  const { data, error } = await db
    .from('lesson_plans')
    .insert(planRow(1, 1, SYNTHETIC_MARKER, 'Fractions (synthetic)', subStrandXId))
    .select('id, sub_strand_id')
    .single()

  assert.equal(error, null)
  assert.equal(data!.sub_strand_id, subStrandXId)
})

test('unknown upstream identity persists as NULL, text preserved, never fabricated', async () => {
  const { data, error } = await db
    .from('lesson_plans')
    .insert(planRow(1, 2, SYNTHETIC_MARKER, 'Some AI-generated topic text', null))
    .select('id, sub_strand_id, sub_strand')
    .single()

  assert.equal(error, null)
  assert.equal(data!.sub_strand_id, null)
  assert.equal(data!.sub_strand, 'Some AI-generated topic text')
})

test('lesson_plans.sub_strand_id rejects a fabricated id — the FK constraint is real, not a UI convention', async () => {
  const fakeId = '00000000-0000-0000-0000-000000000000'
  const { error } = await db
    .from('lesson_plans')
    .insert(planRow(1, 3, SYNTHETIC_MARKER, 'Fractions (synthetic)', fakeId))

  assert.ok(error, 'expected a foreign key violation for a non-existent sub_strand_id')
  assert.match(error!.message, /foreign key|violates/i)
})

test('pre-existing lesson_plans rows (no sub_strand_id at all) remain valid — no backfill, no rewrite', async () => {
  const row = planRow(1, 4, SYNTHETIC_MARKER, 'Legacy-shaped text', null)
  delete (row as { sub_strand_id?: string | null }).sub_strand_id
  const { data, error } = await db
    .from('lesson_plans')
    .insert(row)
    .select('id, sub_strand_id, sub_strand')
    .single()

  assert.equal(error, null)
  assert.equal(data!.sub_strand_id, null)
  assert.equal(data!.sub_strand, 'Legacy-shaped text')
})

test('same-name collision: two sub-strands sharing an identical title persist to their own distinct lesson_plans rows, never confused', async () => {
  const { data: rowX, error: errX } = await db
    .from('lesson_plans')
    .insert(planRow(2, 1, SYNTHETIC_MARKER, 'Fractions (synthetic)', subStrandXId))
    .select('id, sub_strand_id, sub_strand')
    .single()
  const { data: rowY, error: errY } = await db
    .from('lesson_plans')
    .insert(planRow(2, 2, `${SYNTHETIC_MARKER}_COLLISION`, 'Fractions (synthetic)', subStrandYId))
    .select('id, sub_strand_id, sub_strand')
    .single()

  assert.equal(errX, null)
  assert.equal(errY, null)
  assert.equal(rowX!.sub_strand, rowY!.sub_strand, 'both share the same title — the interesting case')
  assert.notEqual(rowX!.sub_strand_id, rowY!.sub_strand_id)
  assert.equal(rowX!.sub_strand_id, subStrandXId)
  assert.equal(rowY!.sub_strand_id, subStrandYId)
})
