// lib/quiz/quizEvidence.integration.test.ts
//
// ADR-0024 Sprint C — proves recordQuizAutoGradeEvidence() closes the gap
// named in the original System Map audit (quiz results generated zero
// learner Evidence) correctly: canonical curriculum identity preserved
// when available, legacy free-text fallback otherwise, and — the sprint's
// own non-negotiable invariant — machine-scored evidence lands at its own
// trust tier (2), distinguishable from teacher-verified evidence (3).
//
// Run: npx tsx --env-file=.env.local --test lib/quiz/quizEvidence.integration.test.ts
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createTestServiceClient as createServiceClient } from '@/utils/supabase/test-service'
import { recordQuizAutoGradeEvidence } from './quizEvidence'

const SYNTHETIC_MARKER = 'SYNTHETIC_ADR0024_SPRINTC_TEST'
const db = createServiceClient()

let authUserId: string
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
    email: `adr0024-sprintc-${Date.now()}@example.com`,
    password: `Test!${Math.random().toString(36).slice(2, 10)}`,
    email_confirm: true,
  })
  if (authErr) throw authErr
  authUserId = auth.user.id

  const { data: student, error: studentErr } = await db
    .from('students')
    .insert({ user_id: authUserId, name: SYNTHETIC_MARKER, grade: 8, level: 'Junior School' })
    .select('id')
    .single()
  if (studentErr) throw studentErr
  studentId = student.id
})

after(async () => {
  // Same referential shape confirmed in Sprint B's test — two child tables
  // don't cascade and must be cleared before learner_evidence itself.
  const { data: evidenceRows } = await db
    .from('learner_evidence')
    .select('id')
    .like('raw_input_ref', 'assignment:SYNTHETIC_ADR0024_SPRINTC%')
  const evidenceIds = (evidenceRows ?? []).map(r => r.id)
  if (evidenceIds.length) {
    await db.from('evidence_projection_events').delete().in('evidence_id', evidenceIds)
    await db.from('evidence_audit_log').delete().in('evidence_id', evidenceIds)
    await db.from('learner_evidence').delete().in('id', evidenceIds)
  }
  await db.from('ingestion_runs').delete().eq('initiated_by', authUserId)
  if (studentId) await db.from('students').delete().eq('id', studentId)
  if (authUserId) await db.auth.admin.deleteUser(authUserId)
})

test('canonical path: substrandId resolves real strand/sub-strand titles, ignores a deliberately wrong topic', async () => {
  await recordQuizAutoGradeEvidence({
    studentId, initiatedBy: authUserId,
    assignmentId: 'SYNTHETIC_ADR0024_SPRINTC_TEST-canonical',
    subject: 'Mathematics',
    topic: 'this raw text must NOT be used when substrandId resolves',
    substrandId: realSubstrand.id,
    score: 18, maxScore: 20, academicYear: 2026, term: 1,
  })

  const { data: rows, error } = await db
    .from('learner_evidence')
    .select('strand, sub_strand, sub_strand_id, evidence_source, trust_tier')
    .eq('learner_id', studentId)
    .like('raw_input_ref', 'assignment:SYNTHETIC_ADR0024_SPRINTC_TEST-canonical%')

  assert.equal(error, null)
  assert.equal(rows!.length, 1)
  assert.equal(rows![0].sub_strand_id, realSubstrand.id)
  assert.equal(rows![0].sub_strand, realSubstrand.title)
  assert.equal(rows![0].strand, realStrandTitle)
  assert.equal(rows![0].evidence_source, 'quiz_auto_grade')
  assert.equal(rows![0].trust_tier, 2)
})

test('legacy path: substrandId null falls back to topic as subStrand, strand null, sub_strand_id null', async () => {
  await recordQuizAutoGradeEvidence({
    studentId, initiatedBy: authUserId,
    assignmentId: 'SYNTHETIC_ADR0024_SPRINTC_TEST-legacy',
    subject: 'Mathematics',
    topic: 'Fractions',
    substrandId: null,
    score: 10, maxScore: 20, academicYear: 2026, term: 1,
  })

  const { data: rows, error } = await db
    .from('learner_evidence')
    .select('strand, sub_strand, sub_strand_id')
    .eq('learner_id', studentId)
    .like('raw_input_ref', 'assignment:SYNTHETIC_ADR0024_SPRINTC_TEST-legacy%')

  assert.equal(error, null)
  assert.equal(rows!.length, 1)
  assert.equal(rows![0].sub_strand_id, null)
  assert.equal(rows![0].strand, null)
  assert.equal(rows![0].sub_strand, 'Fractions')
})

test('machine-scored evidence is distinguishable from teacher-verified evidence: Tier 2 auto-confirms but stays a lower tier than teacher_upload\'s Tier 3', async () => {
  await recordQuizAutoGradeEvidence({
    studentId, initiatedBy: authUserId,
    assignmentId: 'SYNTHETIC_ADR0024_SPRINTC_TEST-tier',
    subject: 'Mathematics', topic: 'Algebra', substrandId: null,
    score: 20, maxScore: 20, academicYear: 2026, term: 1,
  })

  const { data: row } = await db
    .from('learner_evidence')
    .select('trust_tier, evidence_source, lifecycle_state')
    .eq('learner_id', studentId)
    .like('raw_input_ref', 'assignment:SYNTHETIC_ADR0024_SPRINTC_TEST-tier%')
    .single()

  assert.equal(row!.evidence_source, 'quiz_auto_grade')
  assert.equal(row!.trust_tier, 2)
  assert.ok(row!.trust_tier < 3, 'quiz_auto_grade must never reach teacher_upload\'s Tier 3')
  // Clean identity, no field issues, full-mark score -> confidence 95 (tier-2
  // ceiling), which does clear the 85 auto-confirm threshold — a quiz
  // result doesn't have to sit in a review queue to be usable, unlike a
  // Tier 1 source, which structurally never can.
  assert.equal(row!.lifecycle_state, 'auto_confirmed')
})

test('score correctly scales to a partial-credit CBC level, same converter every other producer uses', async () => {
  await recordQuizAutoGradeEvidence({
    studentId, initiatedBy: authUserId,
    assignmentId: 'SYNTHETIC_ADR0024_SPRINTC_TEST-level',
    subject: 'Mathematics', topic: 'Geometry', substrandId: null,
    score: 5, maxScore: 20, academicYear: 2026, term: 1, // 25%
  })

  const { data: row } = await db
    .from('learner_evidence')
    .select('score, cbc_level')
    .eq('learner_id', studentId)
    .like('raw_input_ref', 'assignment:SYNTHETIC_ADR0024_SPRINTC_TEST-level%')
    .single()

  assert.equal(row!.score, 25)
  assert.ok(row!.cbc_level === 1 || row!.cbc_level === 2, `expected a low CBC level for 25%, got ${row!.cbc_level}`)
})

test('Phase 2B: subject identity is now canonicalized through mapSubject, not stored verbatim — confirmed live regression (this producer previously bypassed the boundary and wrote subject="Mathematics" capitalized, fragmenting it from the gradebook pipeline\'s "mathematics")', async () => {
  await recordQuizAutoGradeEvidence({
    studentId, initiatedBy: authUserId,
    assignmentId: 'SYNTHETIC_ADR0024_SPRINTC_TEST-subjectcase',
    subject: 'Mathematics', topic: 'Algebra', substrandId: null,
    score: 15, maxScore: 20, academicYear: 2026, term: 1,
  })

  const { data: row } = await db
    .from('learner_evidence')
    .select('subject, raw_subject')
    .eq('learner_id', studentId)
    .like('raw_input_ref', 'assignment:SYNTHETIC_ADR0024_SPRINTC_TEST-subjectcase%')
    .single()

  assert.equal(row!.subject, 'mathematics', 'canonical subject must be lowercased/normalized, matching every other Evidence producer')
  assert.equal(row!.raw_subject, 'Mathematics', 'raw_subject must still preserve exactly what the source said')
})
