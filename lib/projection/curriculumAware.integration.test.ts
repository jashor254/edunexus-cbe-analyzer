// lib/projection/curriculumAware.integration.test.ts
//
// ADR-0024 Phase 2 — proves the FULL real chain end to end: a teacher
// marks an assignment with a real canonical substrand_id (Sprint A) ->
// recordAssignmentMarkEvidence resolves and preserves it (Sprint B) ->
// recomputeLearnerProjection() (real DB read, not a fixture) produces a
// populated bySubStrand entry. This is the one test in the whole ADR-0024
// series that proves every sprint's work actually composes correctly
// together, not just each piece in isolation.
//
// Run: npx tsx --env-file=.env.local --test lib/projection/curriculumAware.integration.test.ts
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createServiceClient } from '@/utils/supabase/service'
import { recordAssignmentMarkEvidence } from '@/lib/assignments/evidence'
import { recomputeLearnerProjection } from './recompute'

const SYNTHETIC_MARKER = 'SYNTHETIC_ADR0024_PHASE2_TEST'
const db = createServiceClient()

let authUserId: string
let teacherId: string
let studentId: string
let realSubstrand: { id: string; title: string; strand_id: string }

before(async () => {
  const { data: substrand, error: substrandErr } = await db
    .from('sow_substrands')
    .select('id, title, strand_id')
    .limit(1)
    .maybeSingle()
  if (substrandErr) throw substrandErr
  if (!substrand) throw new Error('No sow_substrands row found')
  realSubstrand = substrand

  const { data: auth, error: authErr } = await db.auth.admin.createUser({
    email: `adr0024-phase2-${Date.now()}@example.com`,
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

  const { data: student, error: studentErr } = await db
    .from('students')
    .insert({ user_id: authUserId, name: SYNTHETIC_MARKER, grade: 8, level: 'Junior School' })
    .select('id')
    .single()
  if (studentErr) throw studentErr
  studentId = student.id
})

after(async () => {
  await db.from('learner_projections').delete().eq('learner_id', studentId)
  const { data: evidenceRows } = await db
    .from('learner_evidence')
    .select('id')
    .like('raw_input_ref', 'assignment:SYNTHETIC_ADR0024_PHASE2%')
  const evidenceIds = (evidenceRows ?? []).map(r => r.id)
  if (evidenceIds.length) {
    await db.from('evidence_projection_events').delete().in('evidence_id', evidenceIds)
    await db.from('evidence_audit_log').delete().in('evidence_id', evidenceIds)
    await db.from('learner_evidence').delete().in('id', evidenceIds)
  }
  await db.from('ingestion_runs').delete().eq('teacher_id', teacherId)
  if (studentId) await db.from('students').delete().eq('id', studentId)
  if (teacherId) await db.from('teachers').delete().eq('id', teacherId)
  if (authUserId) await db.auth.admin.deleteUser(authUserId)
})

test('real canonical evidence flows all the way into a persisted, curriculum-aware Projection', async () => {
  await recordAssignmentMarkEvidence({
    studentId, teacherId, teacherUserId: authUserId,
    assignmentId: 'SYNTHETIC_ADR0024_PHASE2_TEST-e2e',
    subject: 'Mathematics',
    topic: 'this must not appear anywhere in the projection',
    substrandId: realSubstrand.id,
    score: 17, maxScore: 20, academicYear: 2026, term: 1, markedAt: new Date().toISOString(),
  })

  const projection = await recomputeLearnerProjection(studentId)

  assert.ok(projection.academic, 'expected a real academic projection')
  const subStrandEntry = projection.academic!.value.bySubStrand[realSubstrand.id]
  assert.ok(subStrandEntry, 'expected the real substrand to appear in bySubStrand')
  assert.equal(subStrandEntry.subStrandTitle, realSubstrand.title)
  assert.equal(subStrandEntry.subject, 'Mathematics')

  // Confirms it's genuinely persisted (learner_projections), not just an
  // in-memory return value — the same table every other Projection
  // consumer (Adaptive Learning, Career Intelligence, Blueprint) reads.
  const { data: persisted } = await db
    .from('learner_projections')
    .select('value')
    .eq('learner_id', studentId)
    .eq('projector_type', 'academic')
    .single()
  const persistedValue = persisted!.value as { bySubStrand: Record<string, unknown> }
  assert.ok(persistedValue.bySubStrand[realSubstrand.id], 'bySubStrand must be in the persisted row, not just the in-memory return')
})
