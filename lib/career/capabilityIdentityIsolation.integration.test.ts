// lib/career/capabilityIdentityIsolation.integration.test.ts
//
// H2B / ID-CAP-001 — capability reasoning for learner A can never consume
// evidence belonging to learner B.
//
// H2B's code-trace audit found this already looked structurally sound
// (findAssessmentHistory/Projection reads always scope by a single
// student_id/learner_id, no batched query feeds capabilityExtractor, no
// loop-variable reuse across students) — this is EXISTING protection
// established by reading, not by a passing test. Executable proof was
// still missing: nothing had ever actually run the real capability path
// for two distinct synthetic learners side by side and asserted zero
// cross-contamination. That is what this file proves, through the same
// canonical Projection-based path CAP-002 uses.
//
// Run: npx tsx --env-file=.env.local --experimental-test-module-mocks --test lib/career/capabilityIdentityIsolation.integration.test.ts
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createTestServiceClient as createServiceClient } from '@/utils/supabase/test-service'
import { startIngestionRun } from '@/lib/intelligence/ingestionRun'
import { persistEvidenceBatch } from '@/lib/intelligence/evidenceLifecycle'
import { recomputeLearnerProjection } from '@/lib/projection/recompute'
import { projectionToScoreHistory } from '@/lib/learnerIntelligence/projectionAdapters'
import { extractCapabilityProfile } from '@/lib/career/capabilityExtractor'
import type { LearnerEvidence } from '@/lib/intelligence/evidence'

const SYNTHETIC_MARKER = 'SYNTHETIC_ID_CAP_001_TEST'
const db = createServiceClient()

let initiatedByUserId: string
const createdStudentIds: string[] = []
const createdIngestionRunIds: string[] = []

before(async () => {
  const email = `${SYNTHETIC_MARKER.toLowerCase()}-${Date.now()}@example.com`
  const { data, error } = await db.auth.admin.createUser({ email, password: `Test!${Math.random().toString(36).slice(2, 10)}`, email_confirm: true })
  if (error || !data.user) throw new Error(`initiator user creation failed: ${error?.message}`)
  initiatedByUserId = data.user.id
})

after(async () => {
  if (createdStudentIds.length) {
    const { data: evidenceRows } = await db.from('learner_evidence').select('id').in('learner_id', createdStudentIds)
    const evidenceIds = (evidenceRows ?? []).map(r => r.id)
    if (evidenceIds.length) {
      await db.from('evidence_audit_log').delete().in('evidence_id', evidenceIds)
      await db.from('evidence_projection_events').delete().in('evidence_id', evidenceIds)
      await db.from('learner_evidence').update({ supersedes: null, superseded_by: null }).in('id', evidenceIds)
      await db.from('learner_evidence').delete().in('id', evidenceIds)
    }
    await db.from('learner_projections').delete().in('learner_id', createdStudentIds)
    await db.from('students').delete().in('id', createdStudentIds)
  }
  if (createdIngestionRunIds.length) await db.from('ingestion_runs').delete().in('id', createdIngestionRunIds)
  if (initiatedByUserId) await db.auth.admin.deleteUser(initiatedByUserId)
})

async function makeStudent(label: string): Promise<string> {
  const { data, error } = await db.from('students').insert({ name: `${SYNTHETIC_MARKER} ${label}`, grade: 9 }).select('id').single()
  if (error || !data) throw new Error(`makeStudent failed: ${error?.message}`)
  createdStudentIds.push(data.id)
  return data.id
}

function makeEvidence(studentId: string, overrides: Partial<LearnerEvidence> = {}): LearnerEvidence {
  return {
    learnerId: studentId,
    extractedName: SYNTHETIC_MARKER,
    extractedExternalId: null,
    subject: 'mathematics',
    rawSubject: 'Mathematics',
    score: 40,
    cbcLevel: 1,
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

async function seed(studentId: string, evidence: LearnerEvidence[]): Promise<void> {
  const run = await startIngestionRun({ source: 'teacher_upload', initiatedBy: initiatedByUserId, teacherId: null, institution: null })
  createdIngestionRunIds.push(run.id)
  await persistEvidenceBatch(evidence, run.id)
}

async function capabilityFor(studentId: string) {
  const projection = await recomputeLearnerProjection(studentId)
  const scoreHistory = projectionToScoreHistory(projection)
  return scoreHistory.length > 0 ? extractCapabilityProfile(scoreHistory) : null
}

test('ID-CAP-001: two learners with deliberately opposite mathematics evidence produce independent, non-contaminated capability profiles', async () => {
  const learnerA = await makeStudent('learner-a-strong')
  const learnerB = await makeStudent('learner-b-weak')

  // Deliberately opposite so any leak in either direction is unmistakable.
  await seed(learnerA, [makeEvidence(learnerA, { cbcLevel: 4, score: 98 })])
  await seed(learnerB, [makeEvidence(learnerB, { cbcLevel: 1, score: 25 })])

  const profileA = await capabilityFor(learnerA)
  const profileB = await capabilityFor(learnerB)

  assert.ok(profileA && profileB, 'both learners have real evidence and must produce real profiles')
  assert.equal(profileA!.analytical_reasoning.level, 'exceptional', 'learner A (strong, uncontested Level 4) must read as exceptional')
  assert.equal(profileB!.analytical_reasoning.level, 'emerging', 'learner B (weak, uncontested Level 1) must read as emerging — must not inherit learner A\'s strength')
  assert.notEqual(profileA!.analytical_reasoning.raw_score, profileB!.analytical_reasoning.raw_score)
})

test('ID-CAP-001: recomputing learner A after learner B is seeded does not pull learner B\'s evidence into A\'s projection', async () => {
  const learnerA = await makeStudent('learner-a-first')
  await seed(learnerA, [makeEvidence(learnerA, { cbcLevel: 2, score: 55 })])
  const beforeB = await capabilityFor(learnerA)

  const learnerB = await makeStudent('learner-b-after')
  await seed(learnerB, [makeEvidence(learnerB, { cbcLevel: 4, score: 99 })])
  const afterB = await capabilityFor(learnerA)

  assert.ok(beforeB && afterB)
  assert.equal(beforeB!.analytical_reasoning.level, afterB!.analytical_reasoning.level, 'learner A\'s profile must be identical before and after an unrelated learner B is seeded')
  assert.equal(afterB!.assessment_count, 1, 'learner A must still show exactly its own one assessment, never learner B\'s')
})
