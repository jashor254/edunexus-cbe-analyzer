// lib/career/capabilityConvergence.integration.test.ts
//
// PHASE 5 — Career Intelligence Convergence.
//
// Proves the fix for the exact contradiction Phase 3's audit found and
// reproduced: GET /api/career/capability (read the PERSISTED
// students.capability_profile snapshot) and GET /api/career/capability-matches
// (read LIVE Projection via resolveFreshCapabilityProfile) could disagree
// for the same learner at the same moment, shown on the same Career
// Explorer page, because one always preferred a possibly-stale write and
// the other always preferred live truth.
//
// resolveCurrentCapabilityProfile() (lib/learnerIntelligence/
// careerIntelligenceOrchestration.ts) is the fix: canonical Projection
// FIRST, the persisted (Evidence + legacy `assessments` blend) snapshot
// only on genuine ABSENCE of canonical evidence — never compared, legacy
// never preferred when canonical exists. This file proves both halves of
// that contract against real data, plus that nothing is fabricated when
// neither source has anything.
//
// Requires local Docker Supabase — never production.
//
// Run: TEST_SUPABASE_URL=http://127.0.0.1:54321 ... npx tsx --experimental-test-module-mocks --test lib/career/capabilityConvergence.integration.test.ts

import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createTestServiceClient as createServiceClient } from '@/utils/supabase/test-service'
import { startIngestionRun } from '@/lib/intelligence/ingestionRun'
import { persistEvidenceBatch, retractEvidence } from '@/lib/intelligence/evidenceLifecycle'
import { recomputeAndSaveCapabilityProfile, getCapabilityProfile } from '@/lib/career/careerEngine'
import { resolveFreshCapabilityProfile, resolveCurrentCapabilityProfile } from '@/lib/learnerIntelligence/careerIntelligenceOrchestration'
import type { LearnerEvidence } from '@/lib/intelligence/evidence'

const SYNTHETIC_MARKER = 'SYNTHETIC_P5_CAP_CONVERGENCE'
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
    await db.from('capability_history').delete().in('student_id', createdStudentIds)
    await db.from('students').update({ capability_profile: null }).in('id', createdStudentIds)
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

async function seed(evidence: LearnerEvidence[]): Promise<string[]> {
  const run = await startIngestionRun({ source: 'teacher_upload', initiatedBy: initiatedByUserId, teacherId: null, institution: null })
  createdIngestionRunIds.push(run.id)
  const result = await persistEvidenceBatch(evidence, run.id)
  return result.inserted.map(r => r.id)
}

test('P5-1. live Projection wins over a deliberately stale persisted snapshot for the SAME learner', async () => {
  const studentId = await makeStudent('stale-snapshot')

  // Strong evidence, persisted as the "capability_profile" snapshot —
  // exactly what recomputeAndSaveCapabilityProfile (the POST /capability
  // and POST /capability-matches write path) does today.
  const [strongId] = await seed([makeEvidence(studentId, { cbcLevel: 4, score: 95 })])
  const staleSnapshot = await recomputeAndSaveCapabilityProfile(studentId)
  assert.ok(staleSnapshot, 'fixture setup: the strong-evidence snapshot must have persisted')
  assert.equal(staleSnapshot!.analytical_reasoning.level, 'exceptional')

  // Now the learner's REAL evidence changes (a correction/retraction) —
  // the persisted snapshot is NOT re-saved, simulating exactly the window
  // Phase 3 found: a write happened once, then evidence moved on.
  await retractEvidence(strongId, initiatedByUserId, 'test: P5-1 simulate stale snapshot after evidence correction')
  await seed([makeEvidence(studentId, { cbcLevel: 1, score: 22 })])

  // The stale, UN-refreshed persisted snapshot still says "exceptional".
  const staleRead = await getCapabilityProfile(studentId)
  assert.equal(staleRead!.analytical_reasoning.level, 'exceptional', 'fixture check: the persisted snapshot genuinely is stale relative to current evidence')

  // resolveCurrentCapabilityProfile must NOT return the stale answer.
  const current = await resolveCurrentCapabilityProfile(studentId)
  assert.ok(current, 'live Projection must produce a real profile from the current weak evidence')
  assert.equal(current!.analytical_reasoning.level, 'emerging', 'resolveCurrentCapabilityProfile must reflect LIVE evidence, never the stale persisted write')

  // And it must agree exactly with the canonical live-only resolver —
  // the same contract /api/career/capability-matches already trusted.
  const fresh = await resolveFreshCapabilityProfile(studentId)
  assert.equal(current!.analytical_reasoning.level, fresh!.profile.analytical_reasoning.level)
  assert.equal(current!.analytical_reasoning.raw_score, fresh!.profile.analytical_reasoning.raw_score)
})

test('P5-2. no canonical evidence at all: falls back to the persisted snapshot — coverage is preserved, not dropped', async () => {
  const studentId = await makeStudent('legacy-only')

  // Seed evidence, persist a snapshot, then retract the evidence entirely —
  // simulating a learner whose only capability signal predates Evidence
  // Domain coverage (or arrived through a since-orphaned intake path):
  // Projection has nothing, but a real snapshot was persisted historically.
  const [id] = await seed([makeEvidence(studentId, { cbcLevel: 3, score: 68 })])
  const saved = await recomputeAndSaveCapabilityProfile(studentId)
  assert.ok(saved, 'fixture setup: a snapshot must have persisted before the evidence is retracted')
  await retractEvidence(id, initiatedByUserId, 'test: P5-2 simulate legacy-only coverage (no live evidence)')

  const fresh = await resolveFreshCapabilityProfile(studentId)
  assert.equal(fresh, null, 'fixture check: Projection genuinely has nothing now')

  const current = await resolveCurrentCapabilityProfile(studentId)
  assert.ok(current, 'must fall back to the persisted snapshot rather than show "no data" for a student with real historical coverage')
  assert.equal(current!.analytical_reasoning.level, saved!.analytical_reasoning.level)
})

test('P5-3. neither source has anything: returns null, never a fabricated profile', async () => {
  const studentId = await makeStudent('no-data')
  const current = await resolveCurrentCapabilityProfile(studentId)
  assert.equal(current, null)
})
