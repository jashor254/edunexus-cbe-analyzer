// lib/learnerIntelligence/canonicalCapability.integration.test.ts
//
// H2D / INTEL-CAP-001 — proves the actual production convergence, not a
// reimplementation of it: canonicalCapabilityFor() is the literal function
// app/api/teacher/monday-panel/route.ts and lib/attentionFeed/panel.ts now
// both call (see their import statements) to derive teacher-facing
// capability. This closes the exact contradiction H2C's
// INTEL-LEGACY-001 demonstrated between the legacy `assessments`-table
// path (computeCapabilityProfile()) and the canonical Projection-based
// path — Monday Panel and Attention Feed no longer read the raw,
// unfiltered `learner_profiles.capability_dimensions` column at all for
// current-capability display; both derive live from the same
// admissibility-aware Projection this test exercises directly.
//
// INTEL-CAP-001 — every user-facing learner capability conclusion (Monday
// Panel, Attention Feed) must derive from the canonical admissibility-aware
// intelligence state, and retracted evidence cannot influence it.
//
// Run: npx tsx --env-file=.env.local --experimental-test-module-mocks --test lib/learnerIntelligence/canonicalCapability.integration.test.ts
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createTestServiceClient as createServiceClient } from '@/utils/supabase/test-service'
import { startIngestionRun } from '@/lib/intelligence/ingestionRun'
import { persistEvidenceBatch, retractEvidence } from '@/lib/intelligence/evidenceLifecycle'
import { recomputeLearnerProjection } from '@/lib/projection/recompute'
import { canonicalCapabilityFor } from './canonicalCapability'
import type { LearnerEvidence } from '@/lib/intelligence/evidence'

const SYNTHETIC_MARKER = 'SYNTHETIC_INTEL_CAP_001_TEST'
const db = createServiceClient()

let initiatedByUserId: string
const createdStudentIds: string[] = []
const createdIngestionRunIds: string[] = []
const createdAssessmentIds: string[] = []

before(async () => {
  const email = `${SYNTHETIC_MARKER.toLowerCase()}-${Date.now()}@example.com`
  const { data, error } = await db.auth.admin.createUser({ email, password: `Test!${Math.random().toString(36).slice(2, 10)}`, email_confirm: true })
  if (error || !data.user) throw new Error(`initiator user creation failed: ${error?.message}`)
  initiatedByUserId = data.user.id
})

after(async () => {
  if (createdAssessmentIds.length) await db.from('assessments').delete().in('id', createdAssessmentIds)
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

async function seed(evidence: LearnerEvidence): Promise<string> {
  const run = await startIngestionRun({ source: 'teacher_upload', initiatedBy: initiatedByUserId, teacherId: null, institution: null })
  createdIngestionRunIds.push(run.id)
  const result = await persistEvidenceBatch([evidence], run.id)
  return result.inserted[0].id
}

function weakMathEvidence(studentId: string): LearnerEvidence {
  return {
    learnerId: studentId, extractedName: SYNTHETIC_MARKER, extractedExternalId: null,
    subject: 'mathematics', rawSubject: 'Mathematics', score: 28, cbcLevel: 1,
    assessmentType: 'cat', term: 1, academicYear: 2026, evidenceSource: 'teacher_upload',
    trustTier: 3, evidenceConfidence: 95, extractionMethod: 'h2d_intel_cap_001_v1',
    reviewStatus: 'auto_confirmed', rawInputRef: 'test', importedAt: '2026-01-01T00:00:00Z', issues: [],
  }
}

test('INTEL-CAP-001: canonicalCapabilityFor() — the function Monday Panel and Attention Feed both call — is not fooled by a conflicting legacy assessments row', async () => {
  const studentId = await makeStudent('legacy-conflict')

  // Real, confirmed, admissible Evidence Domain signal: weak Mathematics.
  await seed(weakMathEvidence(studentId))

  // A conflicting legacy `assessments` row claiming the opposite —
  // permanently admissible to the OLD path (no admissibility lifecycle on
  // this table), but this is exactly the table canonicalCapabilityFor()
  // never reads.
  const { data: assessmentRow, error } = await db.from('assessments').insert({
    student_id: studentId, term: 1, year: 2026, grade: 9,
    subject_scores: { mathematics: 4 },
  }).select('id').single()
  if (error || !assessmentRow) throw new Error(`assessment seed failed: ${error?.message}`)
  createdAssessmentIds.push(assessmentRow.id)

  const projection = await recomputeLearnerProjection(studentId)
  const capability = canonicalCapabilityFor(projection)

  assert.ok(capability)
  assert.notEqual(capability!.analytical_reasoning.level, 'exceptional', 'the conflicting legacy assessments row (Level 4) must not leak into the canonical capability Monday Panel/Attention Feed display')
  assert.equal(capability!.analytical_reasoning.level, 'emerging', 'must reflect only the real, admissible Evidence Domain signal (Level 1)')
})

test('INTEL-CAP-001: retracted evidence cannot influence the canonical capability Monday Panel and Attention Feed read', async () => {
  const studentId = await makeStudent('retracted-decoy')
  await seed(weakMathEvidence(studentId))

  const decoyId = await seed({
    learnerId: studentId, extractedName: SYNTHETIC_MARKER, extractedExternalId: null,
    subject: 'mathematics', rawSubject: 'Mathematics', score: 98, cbcLevel: 4,
    assessmentType: 'cat', term: 1, academicYear: 2026, evidenceSource: 'teacher_upload',
    trustTier: 3, evidenceConfidence: 95, extractionMethod: 'h2d_intel_cap_001_v1',
    reviewStatus: 'auto_confirmed', rawInputRef: 'test', importedAt: '2026-06-01T00:00:00Z', issues: [],
  })
  await retractEvidence(decoyId, initiatedByUserId, 'test: INTEL-CAP-001 retracted decoy must not influence canonical capability')

  const projection = await recomputeLearnerProjection(studentId)
  const capability = canonicalCapabilityFor(projection)

  assert.ok(capability)
  assert.notEqual(capability!.analytical_reasoning.level, 'exceptional', 'a retracted decoy must never surface in the canonical Monday Panel/Attention Feed capability read')
})

test('INTEL-CAP-001: a learner with zero admissible evidence produces no capability profile — never a fabricated one', async () => {
  const studentId = await makeStudent('no-evidence')
  const projection = await recomputeLearnerProjection(studentId)
  assert.equal(canonicalCapabilityFor(projection), null)
})
