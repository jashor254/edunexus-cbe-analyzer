// lib/assignments/evidence.substrand.integration.test.ts
//
// ADR-0024 Sprint B — proves recordAssignmentMarkEvidence() actually
// preserves canonical curriculum identity when available, and falls back
// to exactly its prior free-text behaviour when it isn't. Uses a real
// sow_substrands row (looked up dynamically) for the canonical path, and
// a fabricated topic string for the legacy path — synthetic only for the
// evidence/ingestion-run rows created, cleaned up in after().
//
// Run: npx tsx --env-file=.env.local --test lib/assignments/evidence.substrand.integration.test.ts
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createServiceClient } from '@/utils/supabase/service'
import { recordAssignmentMarkEvidence } from './evidence'

const SYNTHETIC_MARKER = 'SYNTHETIC_ADR0024_SPRINTB_TEST'
const db = createServiceClient()

let authUserId: string
let teacherId: string
let studentId: string
let realSubstrand: { id: string; title: string; strand_id: string }
let realStrandTitle: string

before(async () => {
  const { data: substrand, error: substrandErr } = await db
    .from('sow_substrands')
    .select('id, title, strand_id')
    .limit(1)
    .maybeSingle()
  if (substrandErr) throw substrandErr
  if (!substrand) throw new Error('No sow_substrands row found')
  realSubstrand = substrand

  const { data: strand, error: strandErr } = await db
    .from('sow_strands')
    .select('title')
    .eq('id', substrand.strand_id)
    .single()
  if (strandErr) throw strandErr
  realStrandTitle = strand.title

  const { data: auth, error: authErr } = await db.auth.admin.createUser({
    email: `adr0024-sprintb-${Date.now()}@example.com`,
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
  // learner_evidence has two child tables with their own FKs
  // (evidence_audit_log, evidence_projection_events, both populated by
  // persistEvidenceBatch) — neither cascades, so both must be cleared
  // before learner_evidence itself can be deleted, matching the Evidence
  // Domain's real referential shape (confirmed via pg_constraint, not
  // assumed) rather than the simpler shape every other Evidence-adjacent
  // fixture in this repo happens not to have hit yet.
  const { data: evidenceRows } = await db
    .from('learner_evidence')
    .select('id')
    .like('raw_input_ref', 'assignment:SYNTHETIC_ADR0024%')
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

test('canonical path: substrandId present resolves real strand/sub-strand titles from the SOW hierarchy, not raw topic text', async () => {
  await recordAssignmentMarkEvidence({
    studentId, teacherId, teacherUserId: authUserId,
    assignmentId: 'SYNTHETIC_ADR0024_SPRINTB_TEST-canonical',
    subject: 'Mathematics',
    topic: 'this raw text must NOT be used when substrandId resolves', // deliberately wrong, to prove it's ignored
    substrandId: realSubstrand.id,
    score: 18, maxScore: 20, academicYear: 2026, term: 1, markedAt: new Date().toISOString(),
  })

  const { data: rows, error } = await db
    .from('learner_evidence')
    .select('strand, sub_strand, sub_strand_id')
    .eq('learner_id', studentId)
    .like('raw_input_ref', 'assignment:SYNTHETIC_ADR0024_SPRINTB_TEST-canonical%')

  assert.equal(error, null)
  assert.equal(rows!.length, 1)
  assert.equal(rows![0].sub_strand_id, realSubstrand.id)
  assert.equal(rows![0].sub_strand, realSubstrand.title)
  assert.equal(rows![0].strand, realStrandTitle)
})

test('legacy path: substrandId null falls back to exactly the prior behaviour — topic as subStrand, strand null, sub_strand_id null', async () => {
  await recordAssignmentMarkEvidence({
    studentId, teacherId, teacherUserId: authUserId,
    assignmentId: 'SYNTHETIC_ADR0024_SPRINTB_TEST-legacy',
    subject: 'Mathematics',
    topic: 'Fractions',
    substrandId: null,
    score: 15, maxScore: 20, academicYear: 2026, term: 1, markedAt: new Date().toISOString(),
  })

  const { data: rows, error } = await db
    .from('learner_evidence')
    .select('strand, sub_strand, sub_strand_id')
    .eq('learner_id', studentId)
    .like('raw_input_ref', 'assignment:SYNTHETIC_ADR0024_SPRINTB_TEST-legacy%')

  assert.equal(error, null)
  assert.equal(rows!.length, 1)
  assert.equal(rows![0].sub_strand_id, null)
  assert.equal(rows![0].strand, null)
  assert.equal(rows![0].sub_strand, 'Fractions')
})
