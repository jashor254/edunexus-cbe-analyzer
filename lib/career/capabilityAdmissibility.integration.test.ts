// lib/career/capabilityAdmissibility.integration.test.ts
//
// H2B / CAP-002 — evidence that is not admissible to learner reasoning
// must not contribute capability signal.
//
// H2B's audit found capabilityExtractor.ts has TWO separate production
// input paths with different admissibility guarantees:
//
//   1. computeCapabilityProfile() -> repos.learnerModel.findAssessmentHistory()
//      reads the `assessments` table unconditionally (no status/lifecycle
//      column exists on that table at all — every row ever inserted is
//      permanently admissible input). This is a real architectural gap,
//      not a guarded invariant: there is nothing to test into existence
//      without a product decision on whether `assessments` rows need
//      correction/admissibility semantics. NOT covered here — reported as
//      a finding, not silently fixed (H2B scope lock: no redesign).
//
//   2. careerIntelligenceEngine.ts's Career Intelligence Report path:
//      recomputeLearnerProjection() -> projectionToScoreHistory() ->
//      extractCapabilityProfile() — the canonical, evidence-admissibility-
//      aware path (same one Blueprint/Compass/Parent Career Intelligence
//      all use). This DOES have real admissibility filtering, inherited
//      from Projection's own read boundary
//      (findConfirmedEvidenceForLearner: lifecycle_state IN
//      auto_confirmed/reviewed_confirmed only) — but nothing had ever
//      proven that guarantee survives all the way through to capability
//      output. That is what this file proves.
//
// Run: npx tsx --env-file=.env.local --experimental-test-module-mocks --test lib/career/capabilityAdmissibility.integration.test.ts
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createTestServiceClient as createServiceClient } from '@/utils/supabase/test-service'
import { startIngestionRun } from '@/lib/intelligence/ingestionRun'
import { persistEvidenceBatch, retractEvidence, rejectReview, eraseEvidence } from '@/lib/intelligence/evidenceLifecycle'
import { recomputeLearnerProjection } from '@/lib/projection/recompute'
import { projectionToScoreHistory } from '@/lib/learnerIntelligence/projectionAdapters'
import { extractCapabilityProfile } from '@/lib/career/capabilityExtractor'
import type { LearnerEvidence } from '@/lib/intelligence/evidence'

const SYNTHETIC_MARKER = 'SYNTHETIC_CAP_002_TEST'
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

async function seed(studentId: string, evidence: LearnerEvidence[]): Promise<string[]> {
  const run = await startIngestionRun({ source: 'teacher_upload', initiatedBy: initiatedByUserId, teacherId: null, institution: null })
  createdIngestionRunIds.push(run.id)
  const result = await persistEvidenceBatch(evidence, run.id)
  return result.inserted.map(r => r.id)
}

async function capabilityFor(studentId: string) {
  const projection = await recomputeLearnerProjection(studentId)
  const scoreHistory = projectionToScoreHistory(projection)
  return scoreHistory.length > 0 ? extractCapabilityProfile(scoreHistory) : null
}

test('CAP-002: active confirmed evidence contributes real capability signal', async () => {
  const studentId = await makeStudent('active')
  // Strong, uncontested mathematics evidence.
  await seed(studentId, [makeEvidence(studentId, { cbcLevel: 4, score: 95 })])

  const profile = await capabilityFor(studentId)
  assert.ok(profile, 'confirmed evidence must produce a real capability profile')
  assert.equal(profile!.analytical_reasoning.confidence > 0, true, 'a real confirmed mathematics score must be reflected as observed signal')
})

test('CAP-002: retracted evidence contributes zero capability signal', async () => {
  const studentId = await makeStudent('retracted')
  // A dramatic Level 4 score that, if admitted, would be unmistakable in the output.
  const [id] = await seed(studentId, [makeEvidence(studentId, { cbcLevel: 4, score: 98 })])
  await retractEvidence(id, initiatedByUserId, 'test: CAP-002 retracted evidence must not reach capability scoring')

  const profile = await capabilityFor(studentId)
  assert.equal(profile, null, 'the only evidence is retracted — Projection has no admissible academic evidence, so no scoreHistory and no fabricated profile')
})

test('CAP-002: erased evidence contributes zero capability signal', async () => {
  const studentId = await makeStudent('erased')
  const [id] = await seed(studentId, [makeEvidence(studentId, { cbcLevel: 4, score: 98 })])
  await eraseEvidence(id, initiatedByUserId, 'test: CAP-002 erased evidence must not reach capability scoring')

  const profile = await capabilityFor(studentId)
  assert.equal(profile, null, 'erased evidence must be as invisible to capability reasoning as retracted evidence')
})

test('CAP-002: rejected (never-confirmed) evidence contributes zero capability signal', async () => {
  const studentId = await makeStudent('rejected')
  // trustTier 1 (parent_observation) routes to pending_review rather than
  // auto-confirming, so there is something real to reject.
  const [id] = await seed(studentId, [makeEvidence(studentId, {
    cbcLevel: 4, score: 98, evidenceSource: 'parent_observation', trustTier: 1, reviewStatus: 'pending_review',
  })])
  await rejectReview(id, initiatedByUserId, 'test: CAP-002 rejected evidence must not reach capability scoring')

  const profile = await capabilityFor(studentId)
  assert.equal(profile, null, 'rejected evidence never reached confirmed standing and must not surface as capability signal')
})

test('CAP-002: a superseded predecessor contributes zero signal once its correction is confirmed', async () => {
  const studentId = await makeStudent('superseded')
  const { assignmentMarkKey } = await import('@/lib/intelligence/correctionKey')
  const correctionKey = assignmentMarkKey({ assignmentId: crypto.randomUUID(), studentId, source: 'teacher_upload' })

  // Original weak mark, then a genuine regrade to strong — the weak mark is
  // superseded, not merely "one of several observations."
  await seed(studentId, [makeEvidence(studentId, { cbcLevel: 1, score: 30, correctionKey })])
  await seed(studentId, [makeEvidence(studentId, { cbcLevel: 4, score: 95, correctionKey })])

  const profile = await capabilityFor(studentId)
  assert.ok(profile, 'the regrade is confirmed evidence and must produce a real profile')
  // The projection's history for this subject must show only the corrected
  // (strong) mark, not the superseded weak one, at the raw-score level.
  assert.equal(profile!.assessment_count, 1, 'only the corrected mark counts as the current snapshot, not both the original and its correction')
})
