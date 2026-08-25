// lib/curriculum/curriculumContext.integration.test.ts
//
// Wave 7 validation (Curriculum Grounding Layer). Proves
// resolveCurriculumContext() against real rows in sow_strands/
// sow_substrands/sow_learning_outcomes — inserted here directly rather
// than relying on already-seeded data, because a live-database check
// during this wave found sow_learning_outcomes.substrand_id is almost
// entirely orphaned from sow_substrands.id in this environment (1 of 51
// sampled rows resolved) — a pre-existing data-integrity gap, unrelated
// to this module, out of scope to repair here. This test proves the
// resolver is correct against well-formed data and against the documented
// "not found" case; it does not assert anything about the live seeded
// data's current completeness.
//
// ⚠️ Inserts and deletes its own throwaway rows into sow_strands/
// sow_substrands/sow_learning_outcomes (real curriculum tables, not a
// sandbox) — cleaned up in `after()`, including on failure. Uses a
// synthetic learning-area to avoid colliding with any real curriculum row.
//
// Run: npx tsx --env-file=.env.local --test lib/curriculum/curriculumContext.integration.test.ts
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createTestServiceClient as createServiceClient } from '@/utils/supabase/test-service'
import { resolveCurriculumContext, UNAVAILABLE_CURRICULUM_FIELDS } from './curriculumContext'

const SYNTHETIC_MARKER = 'SYNTHETIC_CURRICULUM_CONTEXT_TEST'
const db = createServiceClient()

let learningAreaId: string
let strandId: string
let subStrandWithOutcomesId: string
let subStrandWithoutOutcomesId: string
// H5A-1 CUR-ID-003 (parent-chain integrity) — a second strand under the
// same synthetic learning area, carrying a sub-strand with the EXACT SAME
// title as subStrandWithOutcomesId's. If resolveCurriculumContext() ever
// resolved by name instead of by primary key, these two rows would be the
// perfect trap for that bug.
let collisionStrandId: string
let collisionSubStrandId: string

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

  const { data: ss1, error: ss1Err } = await db
    .from('sow_substrands')
    .insert({ title: 'Fractions (synthetic)', strand_id: strandId, order_index: 1 })
    .select('id').single()
  if (ss1Err) throw ss1Err
  subStrandWithOutcomesId = ss1.id

  const { data: ss2, error: ss2Err } = await db
    .from('sow_substrands')
    .insert({ title: 'Decimals (synthetic)', strand_id: strandId, order_index: 2 })
    .select('id').single()
  if (ss2Err) throw ss2Err
  subStrandWithoutOutcomesId = ss2.id

  await db.from('sow_learning_outcomes').insert([
    { substrand_id: subStrandWithOutcomesId, outcome: 'Add fractions with different denominators', outcome_type: 'skill', order_index: 1 },
    { substrand_id: subStrandWithOutcomesId, outcome: 'Subtract fractions with different denominators', outcome_type: 'skill', order_index: 2 },
  ])
  // subStrandWithoutOutcomesId deliberately gets zero learning outcomes.

  const { data: collisionStrand, error: collisionStrandErr } = await db
    .from('sow_strands')
    .insert({ title: `${SYNTHETIC_MARKER}_COLLISION`, learning_area_id: learningAreaId, order_index: 2 })
    .select('id').single()
  if (collisionStrandErr) throw collisionStrandErr
  collisionStrandId = collisionStrand.id

  const { data: collisionSubStrand, error: collisionSubStrandErr } = await db
    .from('sow_substrands')
    .insert({ title: 'Fractions (synthetic)', strand_id: collisionStrandId, order_index: 1 })
    .select('id').single()
  if (collisionSubStrandErr) throw collisionSubStrandErr
  collisionSubStrandId = collisionSubStrand.id
})

after(async () => {
  await db.from('sow_learning_outcomes').delete().in('substrand_id', [subStrandWithOutcomesId, subStrandWithoutOutcomesId])
  await db.from('sow_substrands').delete().in('strand_id', [strandId, collisionStrandId])
  await db.from('sow_strands').delete().in('id', [strandId, collisionStrandId])
  await db.from('sow_learning_areas').delete().eq('id', learningAreaId)
  console.log('[cleanup] synthetic curriculum-context fixtures removed')
})

test('resolveCurriculumContext returns real Strand/Sub-Strand/Learning Outcomes when they exist', async () => {
  const ctx = await resolveCurriculumContext(subStrandWithOutcomesId)
  assert.ok(ctx)
  assert.equal(ctx!.strandId, strandId)
  assert.equal(ctx!.subStrandTitle, 'Fractions (synthetic)')
  assert.deepEqual(ctx!.learningOutcomes, [
    'Add fractions with different denominators',
    'Subtract fractions with different denominators',
  ])
  assert.deepEqual(ctx!.unavailableFields, UNAVAILABLE_CURRICULUM_FIELDS)
})

test('resolveCurriculumContext returns an empty (not fabricated) outcomes list when none are seeded', async () => {
  const ctx = await resolveCurriculumContext(subStrandWithoutOutcomesId)
  assert.ok(ctx)
  assert.equal(ctx!.subStrandTitle, 'Decimals (synthetic)')
  assert.deepEqual(ctx!.learningOutcomes, [])
})

test('resolveCurriculumContext returns null (never a fabricated stand-in) for a sub-strand id that does not exist', async () => {
  const ctx = await resolveCurriculumContext('00000000-0000-0000-0000-000000000000')
  assert.equal(ctx, null)
})

// H5A-1 CUR-ID-003 — two sub-strands share the exact same title
// ("Fractions (synthetic)") under two different strands. Resolution is by
// sow_substrands.id (a primary key), never by title, so each id must
// resolve to its own strand — never the other one's — even though a
// name-based lookup could not tell them apart.
test('resolveCurriculumContext resolves by primary key, not title — same-named sub-strands under different strands do not collide', async () => {
  const ctxA = await resolveCurriculumContext(subStrandWithOutcomesId)
  const ctxB = await resolveCurriculumContext(collisionSubStrandId)

  assert.ok(ctxA)
  assert.ok(ctxB)
  assert.equal(ctxA!.subStrandTitle, ctxB!.subStrandTitle, 'both share the same title — the interesting case')
  assert.notEqual(ctxA!.subStrandId, ctxB!.subStrandId)
  assert.notEqual(ctxA!.strandId, ctxB!.strandId, 'each sub-strand must resolve to its OWN parent strand')
  assert.equal(ctxA!.strandId, strandId)
  assert.equal(ctxB!.strandId, collisionStrandId)
})
