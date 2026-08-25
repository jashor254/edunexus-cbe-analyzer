// lib/curriculum/assignmentSubstrandId.integration.test.ts
//
// ADR-0024 Sprint A, Objective 3 — proves the assignments.substrand_id
// column actually does what it exists to do: persist a real, FK-enforced
// reference to sow_substrands, not a fabricated or free-floating value.
// Uses a real substrand already seeded in the live database (looked up
// dynamically, not hardcoded, so this doesn't break if that row is later
// edited/removed) — synthetic only for the teacher/class/assignment rows,
// which are cleaned up in after().
//
// Run: npx tsx --env-file=.env.local --test lib/curriculum/assignmentSubstrandId.integration.test.ts
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createTestServiceClient as createServiceClient } from '@/utils/supabase/test-service'

const SYNTHETIC_MARKER = 'SYNTHETIC_ADR0024_SUBSTRAND_TEST'
const db = createServiceClient()

let authUserId: string
let teacherId: string
let classId: string
let realSubstrandId: string

before(async () => {
  const { data: substrand, error: substrandErr } = await db
    .from('sow_substrands')
    .select('id')
    .limit(1)
    .maybeSingle()
  if (substrandErr) throw substrandErr
  if (!substrand) throw new Error('No sow_substrands row found — cannot test against real curriculum data')
  realSubstrandId = substrand.id

  const { data: auth, error: authErr } = await db.auth.admin.createUser({
    email: `adr0024-substrand-${Date.now()}@example.com`,
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

  const { data: cls, error: clsErr } = await db
    .from('teacher_classes')
    .insert({ teacher_id: teacherId, name: SYNTHETIC_MARKER, grade: 8, subject: 'Mathematics', class_code: `${SYNTHETIC_MARKER}_${Date.now()}` })
    .select('id')
    .single()
  if (clsErr) throw clsErr
  classId = cls.id
})

after(async () => {
  await db.from('teacher_classes').delete().eq('id', classId) // cascades assignments
  if (teacherId) await db.from('teachers').delete().eq('id', teacherId)
  if (authUserId) await db.auth.admin.deleteUser(authUserId)
})

test('assignments.substrand_id persists a real sow_substrands reference', async () => {
  const { data, error } = await db
    .from('assignments')
    .insert({
      class_id: classId, teacher_id: teacherId, title: 'Test', subject: 'Mathematics', topic: 'Data Handling',
      instructions: 'x', due_date: new Date().toISOString(), substrand_id: realSubstrandId,
    })
    .select('id, substrand_id')
    .single()

  assert.equal(error, null)
  assert.equal(data!.substrand_id, realSubstrandId)
})

test('assignments.substrand_id is nullable — custom-mode assignments with no curriculum anchor remain valid', async () => {
  const { data, error } = await db
    .from('assignments')
    .insert({
      class_id: classId, teacher_id: teacherId, title: 'Custom Test', subject: 'Mathematics', topic: 'Custom',
      instructions: 'x', due_date: new Date().toISOString(), substrand_id: null,
    })
    .select('id, substrand_id')
    .single()

  assert.equal(error, null)
  assert.equal(data!.substrand_id, null)
})

test('assignments.substrand_id rejects a fabricated ID — the FK constraint is real, not just a UI convention', async () => {
  const fakeId = '00000000-0000-0000-0000-000000000000'
  const { error } = await db
    .from('assignments')
    .insert({
      class_id: classId, teacher_id: teacherId, title: 'Fabricated', subject: 'Mathematics', topic: 'Nonsense',
      instructions: 'x', due_date: new Date().toISOString(), substrand_id: fakeId,
    })

  assert.ok(error, 'expected a foreign key violation for a non-existent substrand_id')
  assert.match(error!.message, /foreign key|violates/i)
})

test('pre-existing assignments (no substrand_id at all) remain readable — no backfill, no rewrite', async () => {
  const { data, error } = await db
    .from('assignments')
    .insert({
      class_id: classId, teacher_id: teacherId, title: 'Legacy-shaped', subject: 'Mathematics', topic: 'Fractions',
      instructions: 'x', due_date: new Date().toISOString(),
      // substrand_id omitted entirely, matching every assignment created before this migration
    })
    .select('id, substrand_id, topic')
    .single()

  assert.equal(error, null)
  assert.equal(data!.substrand_id, null)
  assert.equal(data!.topic, 'Fractions')
})
