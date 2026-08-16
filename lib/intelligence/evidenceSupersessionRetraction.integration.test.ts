// lib/intelligence/evidenceSupersessionRetraction.integration.test.ts
//
// H2A / EVD-SUP-001 — retracting a superseding evidence row never
// reactivates (and never otherwise mutates) the predecessor it superseded.
// Once evidence is superseded, that is a permanent fact about its position
// in the correction chain; a later retraction of the *successor* is a
// separate, independent lifecycle event.
//
// This resolves the APPLICATION_BLOCKED question docs/architecture/
// assurance-tiers.md raised against lib/projection/equivalenceHarness.
// integration.test.ts's Cohort B ("does retracting a superseding evidence
// row un-supersede its predecessor?"). Investigation for H2A found that
// question was never actually a live product ambiguity: Cohort B's fixture
// uses evidenceSource: 'csv_export' with no correctionKey, and
// lib/intelligence/correctionKey.ts's NAMESPACE_SOURCES map does not permit
// csv_export to mint a correction key at all — so under the current Phase E4
// correctionGroupKey() supersession rule (evidenceLifecycle.ts), Cohort B's
// two evidence rows were NEVER actually in a supersedes/superseded_by
// relationship to begin with (correctionGroupKey() returns null for both,
// so persistEvidenceBatch() treats them as two independent, permanently-true
// observations — like two teacher remarks). Cohort B is failing for that
// reason (a stale FIXTURE_DEFECT predating Phase E4, the same class already
// documented for lib/core/coreAssessmentTypeIntegrity.test.ts), not because
// retraction reactivates anything in production. This file constructs a
// *genuine* correction-keyed supersession (teacher_upload / assignment_mark,
// the one Phase E4 was built for) to prove the real invariant directly,
// against the real evidenceLifecycle.ts functions and the real DB trigger
// (enforce_evidence_immutability), not a mock.
//
// Run: npx tsx --env-file=.env.local --experimental-test-module-mocks --test lib/intelligence/evidenceSupersessionRetraction.integration.test.ts
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createTestServiceClient as createServiceClient } from '@/utils/supabase/test-service'
import { startIngestionRun } from '@/lib/intelligence/ingestionRun'
import { persistEvidenceBatch, retractEvidence } from '@/lib/intelligence/evidenceLifecycle'
import { assignmentMarkKey } from '@/lib/intelligence/correctionKey'
import type { LearnerEvidence } from '@/lib/intelligence/evidence'

const SYNTHETIC_MARKER = 'SYNTHETIC_EVD_SUP_001_TEST'
const db = createServiceClient()

let studentId: string
let initiatedByUserId: string
const createdIngestionRunIds: string[] = []

before(async () => {
  const { data: student, error: studentError } = await db
    .from('students')
    .insert({ name: `${SYNTHETIC_MARKER} student`, grade: 9 })
    .select('id')
    .single()
  if (studentError || !student) throw new Error(`student creation failed: ${studentError?.message}`)
  studentId = student.id

  const email = `${SYNTHETIC_MARKER.toLowerCase()}-${Date.now()}@example.com`
  const { data: user, error: userError } = await db.auth.admin.createUser({ email, password: `Test!${Math.random().toString(36).slice(2, 10)}`, email_confirm: true })
  if (userError || !user.user) throw new Error(`initiator user creation failed: ${userError?.message}`)
  initiatedByUserId = user.user.id
})

after(async () => {
  if (studentId) {
    const { data: evidenceRows } = await db.from('learner_evidence').select('id').eq('learner_id', studentId)
    const evidenceIds = (evidenceRows ?? []).map(r => r.id)
    if (evidenceIds.length) {
      await db.from('evidence_audit_log').delete().in('evidence_id', evidenceIds)
      await db.from('evidence_projection_events').delete().in('evidence_id', evidenceIds)
      await db.from('learner_evidence').update({ supersedes: null, superseded_by: null }).in('id', evidenceIds)
      await db.from('learner_evidence').delete().in('id', evidenceIds)
    }
    await db.from('students').delete().eq('id', studentId)
  }
  if (createdIngestionRunIds.length) await db.from('ingestion_runs').delete().in('id', createdIngestionRunIds)
  if (initiatedByUserId) await db.auth.admin.deleteUser(initiatedByUserId)
})

function makeMarkEvidence(overrides: Partial<LearnerEvidence> & { correctionKey: string }): LearnerEvidence {
  return {
    learnerId: studentId,
    extractedName: SYNTHETIC_MARKER,
    extractedExternalId: null,
    subject: 'mathematics',
    rawSubject: 'Mathematics',
    score: 70,
    cbcLevel: 3,
    assessmentType: 'cat',
    academicYear: 2026,
    term: 1,
    evidenceSource: 'teacher_upload',
    trustTier: 3,
    evidenceConfidence: 95,
    extractionMethod: 'test_fixture_v1',
    reviewStatus: 'auto_confirmed',
    rawInputRef: 'test',
    importedAt: new Date().toISOString(),
    issues: [],
    ...overrides,
  }
}

async function seed(evidence: LearnerEvidence[]): Promise<string[]> {
  const run = await startIngestionRun({ source: 'teacher_upload', initiatedBy: initiatedByUserId, teacherId: null, institution: null })
  createdIngestionRunIds.push(run.id)
  const result = await persistEvidenceBatch(evidence, run.id)
  return result.inserted.map(r => r.id)
}

async function lifecycleStateOf(evidenceId: string): Promise<string> {
  const { data } = await db.from('learner_evidence').select('lifecycle_state, superseded_by').eq('id', evidenceId).single()
  return data!.lifecycle_state
}

test('EVD-SUP-001: a regrade genuinely supersedes the original mark (sanity check on the correction-keyed mechanism itself)', async () => {
  const assignmentId = crypto.randomUUID()
  const correctionKey = assignmentMarkKey({ assignmentId, studentId, source: 'teacher_upload' })

  const [firstId] = await seed([makeMarkEvidence({ correctionKey, cbcLevel: 2, score: 55 })])
  assert.equal(await lifecycleStateOf(firstId), 'auto_confirmed')

  const [secondId] = await seed([makeMarkEvidence({ correctionKey, cbcLevel: 3, score: 70 })])

  assert.equal(await lifecycleStateOf(firstId), 'superseded', 'the regrade must actually supersede the original mark — proves the fixture is exercising real supersession, not the stale claimKey() path')
  assert.equal(await lifecycleStateOf(secondId), 'auto_confirmed')
})

test('EVD-SUP-001: retracting the superseding evidence does not reactivate the predecessor — it remains permanently superseded', async () => {
  const assignmentId = crypto.randomUUID()
  const correctionKey = assignmentMarkKey({ assignmentId, studentId, source: 'teacher_upload' })

  const [firstId] = await seed([makeMarkEvidence({ correctionKey, cbcLevel: 2, score: 55 })])
  const [secondId] = await seed([makeMarkEvidence({ correctionKey, cbcLevel: 3, score: 70 })])
  assert.equal(await lifecycleStateOf(firstId), 'superseded', 'sanity check: real supersession happened before retraction')

  await retractEvidence(secondId, initiatedByUserId, 'test: verifying retraction never reactivates a predecessor')

  assert.equal(await lifecycleStateOf(secondId), 'retracted')
  assert.equal(await lifecycleStateOf(firstId), 'superseded', 'EVD-SUP-001: the predecessor must remain superseded — retraction of its successor is a fact about the successor only')

  // Confirms the read boundary every consumer actually uses agrees: neither
  // row in *this* correction chain is "confirmed" evidence any more (scoped
  // to firstId/secondId — the shared synthetic student may carry other
  // confirmed evidence from sibling tests in this file).
  const { data: confirmed } = await db
    .from('learner_evidence')
    .select('id')
    .in('id', [firstId, secondId])
    .in('lifecycle_state', ['auto_confirmed', 'reviewed_confirmed'])
  assert.deepEqual(confirmed, [], 'a superseded-then-retracted correction chain must contribute zero confirmed evidence')
})

test('EVD-SUP-001: retracting evidence never mutates any unrelated evidence row', async () => {
  const unrelatedKey = assignmentMarkKey({ assignmentId: crypto.randomUUID(), studentId, source: 'teacher_upload' })
  const [unrelatedId] = await seed([makeMarkEvidence({ correctionKey: unrelatedKey, subject: 'english', cbcLevel: 4, score: 90 })])

  const assignmentId = crypto.randomUUID()
  const correctionKey = assignmentMarkKey({ assignmentId, studentId, source: 'teacher_upload' })
  const [firstId] = await seed([makeMarkEvidence({ correctionKey, cbcLevel: 2, score: 55 })])
  const [secondId] = await seed([makeMarkEvidence({ correctionKey, cbcLevel: 3, score: 70 })])

  await retractEvidence(secondId, initiatedByUserId, 'test: blast-radius check')

  assert.equal(await lifecycleStateOf(unrelatedId), 'auto_confirmed', 'an evidence row with no relation to the retracted one must be completely untouched')
  assert.equal(await lifecycleStateOf(firstId), 'superseded')
})
