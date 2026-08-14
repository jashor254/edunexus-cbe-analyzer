// lib/projection/equivalenceHarness.integration.test.ts
//
// The Evidence Migration Trigger ADR's projection-equivalence gate.
// Proves: resolving a learner through Core identity (a synthetic
// coreLearnerId → students.external_id → resolveLegacyStudentId) produces
// identical LearnerIntelligenceProjection output to resolving the same
// learner directly through legacy identity — using real evidence rows,
// the real (unmodified) evidence repository, the real (unmodified)
// projection engine, and the real (unmodified) `resolveLegacyStudentId`.
//
// Does NOT migrate evidence, change foreign keys, or write to
// students.external_id in production — every fixture is synthetic and
// removed in `after()`.
//
// Run: npx tsx --env-file=.env.local --test lib/projection/equivalenceHarness.integration.test.ts
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createServiceClient } from '@/utils/supabase/service'
import { startIngestionRun } from '@/lib/intelligence/ingestionRun'
import { persistEvidenceBatch, retractEvidence } from '@/lib/intelligence/evidenceLifecycle'
import type { LearnerEvidence } from '@/lib/intelligence/evidence'
import { resolveLegacyStudentId } from '@/lib/core/identity'
import { asLearnerId } from '@/lib/core/identityTypes'
import {
  classifyBridge,
  runLegacyProjectionPath,
  runCoreResolvedProjectionPath,
  compareProjections,
  diffsOf,
} from './equivalenceHarness'

const SYNTHETIC_MARKER = 'SYNTHETIC_PROJECTION_EQUIVALENCE_TEST'
const db = createServiceClient()
const NOW = new Date('2026-08-03T12:00:00Z') // fixed clock — makes freshnessDays deterministic

function makeEvidence(overrides: Partial<LearnerEvidence> & { learnerId: string }): LearnerEvidence {
  return {
    learnerId: overrides.learnerId,
    extractedName: SYNTHETIC_MARKER,
    extractedExternalId: null,
    subject: 'mathematics',
    rawSubject: 'Mathematics',
    score: 70,
    cbcLevel: 3,
    assessmentType: 'cat',
    academicYear: 2026,
    term: 1,
    evidenceSource: 'csv_export',
    trustTier: 2,
    evidenceConfidence: 90,
    extractionMethod: 'test_fixture_v1',
    reviewStatus: 'auto_confirmed',
    rawInputRef: 'test',
    importedAt: NOW.toISOString(),
    issues: [],
    ...overrides,
  }
}

async function makeSyntheticStudent(label: string): Promise<{ studentId: string; coreLearnerId: string }> {
  const coreLearnerId = crypto.randomUUID() // stands in for a Core learners.id — never actually needs to exist as a real row, since resolveLegacyStudentId only ever queries students.external_id
  const { data, error } = await db
    .from('students')
    .insert({ name: `${SYNTHETIC_MARKER} ${label}`, grade: 9, external_id: coreLearnerId })
    .select('id')
    .single()
  if (error || !data) throw new Error(`makeSyntheticStudent failed: ${error?.message}`)
  return { studentId: data.id, coreLearnerId }
}

const createdStudentIds: string[] = []
const createdIngestionRunIds: string[] = []
const createdEvidenceIds: string[] = []
let initiatedByUserId: string

before(async () => {
  const email = `${SYNTHETIC_MARKER.toLowerCase()}-initiator-${Date.now()}@example.com`
  const { data, error } = await db.auth.admin.createUser({ email, password: `Test!${Math.random().toString(36).slice(2, 10)}`, email_confirm: true })
  if (error || !data.user) throw new Error(`initiator user creation failed: ${error?.message}`)
  initiatedByUserId = data.user.id
})

after(async () => {
  // Deletes by learner_id, not just the tracked-id arrays —
  // persistEvidenceBatch's `inserted` result only reflects rows it itself
  // inserted this call; a row superseded by a *later* seedEvidence call is
  // still a real, still-existing row referencing the same student. Also
  // clears evidence_audit_log/evidence_projection_events/learner_projections
  // — child tables discovered mid-implementation to also FK to
  // learner_evidence/students and block deletion if left behind.
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
  }
  if (createdIngestionRunIds.length) await db.from('ingestion_runs').delete().in('id', createdIngestionRunIds)
  if (createdStudentIds.length) await db.from('students').delete().in('id', createdStudentIds)
  if (initiatedByUserId) await db.auth.admin.deleteUser(initiatedByUserId)
})

async function seedEvidence(studentId: string, evidence: LearnerEvidence[]): Promise<string[]> {
  const run = await startIngestionRun({ source: 'csv_export', initiatedBy: initiatedByUserId, teacherId: null, institution: null })
  createdIngestionRunIds.push(run.id)
  const result = await persistEvidenceBatch(evidence, run.id)
  const ids = result.inserted.map(r => r.id)
  createdEvidenceIds.push(...ids)
  return ids
}

// ── Cohort A — rich evidence learner ─────────────────────────────────────────

test('Cohort A (rich evidence): Core-resolved and legacy-direct projections are equal across all projector types', async () => {
  const { studentId, coreLearnerId } = await makeSyntheticStudent('cohort-a')
  createdStudentIds.push(studentId)

  await seedEvidence(studentId, [
    makeEvidence({ learnerId: studentId, subject: 'mathematics', cbcLevel: 2, term: 1, academicYear: 2026 }),
    makeEvidence({ learnerId: studentId, subject: 'mathematics', cbcLevel: 3, term: 2, academicYear: 2026 }),
    makeEvidence({ learnerId: studentId, subject: 'english', cbcLevel: 4, term: 1, academicYear: 2026 }),
  ])

  const legacy = await runLegacyProjectionPath(studentId, NOW)
  const coreResult = await runCoreResolvedProjectionPath(asLearnerId(coreLearnerId), NOW)

  assert.equal(coreResult.status, 'RESOLVED')
  if (coreResult.status !== 'RESOLVED') return
  assert.equal(coreResult.legacyStudentId, studentId, 'Core resolution must land on the exact same legacy student')

  const cmp = compareProjections(legacy, coreResult.projection)
  assert.ok(cmp.equal, `expected equivalence, got diffs: ${JSON.stringify(diffsOf(cmp))}`)
  assert.ok(legacy.academic, 'sanity check: this cohort must actually produce a real academic projection, not an empty one')
})

// ── Cohort B — retracted/superseded evidence ─────────────────────────────────

test('Cohort B (retracted evidence): supersession/retraction is honored identically through both paths', async () => {
  const { studentId, coreLearnerId } = await makeSyntheticStudent('cohort-b')
  createdStudentIds.push(studentId)

  // Same claim key (learnerId:subject:assessmentType:academicYear:term) twice
  // — the second supersedes the first automatically (claimKey() supersession).
  await seedEvidence(studentId, [
    makeEvidence({ learnerId: studentId, subject: 'mathematics', cbcLevel: 2, term: 1, academicYear: 2026 }),
  ])
  const secondBatchIds = await seedEvidence(studentId, [
    makeEvidence({ learnerId: studentId, subject: 'mathematics', cbcLevel: 4, term: 1, academicYear: 2026 }),
  ])

  // Explicitly retract the newer one too, proving retraction (not just
  // supersession) is respected identically by both resolution paths.
  await retractEvidence(secondBatchIds[0], initiatedByUserId, 'test: verifying retraction is honored identically')

  const legacy = await runLegacyProjectionPath(studentId, NOW)
  const coreResult = await runCoreResolvedProjectionPath(asLearnerId(coreLearnerId), NOW)

  assert.equal(coreResult.status, 'RESOLVED')
  if (coreResult.status !== 'RESOLVED') return
  assert.equal(legacy.academic, null, 'sanity check: the only two pieces of evidence are superseded-then-retracted — no confirmed evidence should remain')

  const cmp = compareProjections(legacy, coreResult.projection)
  assert.ok(cmp.equal, `expected equivalence, got diffs: ${JSON.stringify(diffsOf(cmp))}`)
})

// ── Cohort C — sparse evidence learner ───────────────────────────────────────

test('Cohort C (sparse evidence): provisional/unavailable projections are equal through both paths', async () => {
  const { studentId, coreLearnerId } = await makeSyntheticStudent('cohort-c')
  createdStudentIds.push(studentId)

  await seedEvidence(studentId, [
    makeEvidence({ learnerId: studentId, subject: 'mathematics', cbcLevel: 3, term: 1, academicYear: 2026 }),
  ])

  const legacy = await runLegacyProjectionPath(studentId, NOW)
  const coreResult = await runCoreResolvedProjectionPath(asLearnerId(coreLearnerId), NOW)

  assert.equal(coreResult.status, 'RESOLVED')
  if (coreResult.status !== 'RESOLVED') return
  assert.ok(legacy.growth, 'sanity check: a growth projection object must still exist for sparse data')
  assert.equal(legacy.growth!.value.trend, 'insufficient_data', 'one data point must yield a provisional trend, not a fabricated one, in both paths')

  const cmp = compareProjections(legacy, coreResult.projection)
  assert.ok(cmp.equal, `expected equivalence, got diffs: ${JSON.stringify(diffsOf(cmp))}`)
})

// ── Cohort D — valid bridge (subsumed by A/B/C, asserted explicitly here) ───

test('Cohort D (valid bridge): a Core learner id resolves through external_id to exactly one legacy student', async () => {
  const { studentId, coreLearnerId } = await makeSyntheticStudent('cohort-d')
  createdStudentIds.push(studentId)

  const classification = await classifyBridge(asLearnerId(coreLearnerId))
  assert.deepEqual(classification, { status: 'ELIGIBLE', legacyStudentId: studentId })

  const resolved = await resolveLegacyStudentId(asLearnerId(coreLearnerId))
  assert.equal(resolved, studentId, 'the real production resolveLegacyStudentId must agree with the harness classification')
})

// ── Cohort E — no bridge ─────────────────────────────────────────────────────

test('Cohort E (no bridge): a never-bridged Core learner id is reported as absence, not an equivalence failure', async () => {
  const neverBridgedCoreLearnerId = crypto.randomUUID()

  const classification = await classifyBridge(asLearnerId(neverBridgedCoreLearnerId))
  assert.deepEqual(classification, { status: 'NO_BRIDGE' })

  const coreResult = await runCoreResolvedProjectionPath(asLearnerId(neverBridgedCoreLearnerId), NOW)
  assert.deepEqual(coreResult, { status: 'NO_BRIDGE' }, 'must be reported as NO_BRIDGE, never as an equivalence failure — there is nothing to compare')

  // The real production function must independently agree there's no legacy id here.
  const resolved = await resolveLegacyStudentId(asLearnerId(neverBridgedCoreLearnerId))
  assert.equal(resolved, null)
})

// ── Cohort F — ambiguous/duplicate bridge (synthetic only, per instructions) ─

test('Cohort F (ambiguous bridge): two legacy students sharing one external_id are reported as AMBIGUOUS, never resolved arbitrarily', async () => {
  const sharedCoreLearnerId = crypto.randomUUID()
  const a = await makeSyntheticStudent('cohort-f-a')
  const b = await makeSyntheticStudent('cohort-f-b')
  createdStudentIds.push(a.studentId, b.studentId)
  // Force both legacy rows to share one external_id — synthetic-only,
  // read-only afterwards, exactly as the ADR requires for this cohort.
  const { error } = await db.from('students').update({ external_id: sharedCoreLearnerId }).in('id', [a.studentId, b.studentId])
  if (error) throw new Error(`Cohort F setup failed: ${error.message}`)

  const classification = await classifyBridge(asLearnerId(sharedCoreLearnerId))
  assert.equal(classification.status, 'AMBIGUOUS_BRIDGE')
  assert.equal((classification as { count: number }).count, 2)

  const coreResult = await runCoreResolvedProjectionPath(asLearnerId(sharedCoreLearnerId), NOW)
  assert.deepEqual(coreResult, { status: 'AMBIGUOUS_BRIDGE' }, 'the harness must refuse to compare, never picking one of the two arbitrarily')

  // Document the real production function's current (known, separately
  // audited) limitation: it cannot distinguish this from NO_BRIDGE and
  // returns null — safely (never arbitrarily resolves one of the two), but
  // imprecisely. This assertion exists so a future fix to
  // resolveLegacyStudentId's classification is a visible, intentional
  // change to this test, not a silent behavior change.
  const resolved = await resolveLegacyStudentId(asLearnerId(sharedCoreLearnerId))
  assert.equal(resolved, null, 'known limitation: resolveLegacyStudentId returns null (not an arbitrary pick) for an ambiguous bridge — see the Identity Resolution Failure Audit')
})

// ── Drift detection — proves the comparator can actually fail ───────────────

test('drift detection: a deliberately altered evidence set causes the equivalence comparison to fail', async () => {
  const { studentId: studentA } = await makeSyntheticStudent('drift-a')
  const { studentId: studentB } = await makeSyntheticStudent('drift-b')
  createdStudentIds.push(studentA, studentB)

  await seedEvidence(studentA, [
    makeEvidence({ learnerId: studentA, subject: 'mathematics', cbcLevel: 2, term: 1, academicYear: 2026 }),
    makeEvidence({ learnerId: studentA, subject: 'mathematics', cbcLevel: 3, term: 2, academicYear: 2026 }),
  ])
  // Deliberately different evidence for student B — one fewer event, and a
  // different score — simulating exactly the kind of drift (an evidence
  // event silently dropped or reassigned during a migration) this gate
  // exists to catch.
  await seedEvidence(studentB, [
    makeEvidence({ learnerId: studentB, subject: 'mathematics', cbcLevel: 2, term: 1, academicYear: 2026 }),
  ])

  const projectionA = await runLegacyProjectionPath(studentA, NOW)
  const projectionB = await runLegacyProjectionPath(studentB, NOW)

  // Force learnerId to match so the ONLY real difference under test is the
  // evidence-derived content, not the trivial "different id" case.
  const cmp = compareProjections(projectionA, { ...projectionB, learnerId: projectionA.learnerId })
  assert.equal(cmp.equal, false, 'the comparator must detect this deliberate divergence, not pass by accident')
  if (!cmp.equal) {
    assert.ok(cmp.diffs.length > 0)
    assert.ok(cmp.diffs.some(d => d.field === 'academic' || d.field === 'growth'), 'the diagnostic must name which projector actually diverged')
  }
})
