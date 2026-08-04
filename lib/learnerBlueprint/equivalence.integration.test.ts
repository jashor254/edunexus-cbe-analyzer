// lib/learnerBlueprint/equivalence.integration.test.ts
//
// The Blueprint half of the Evidence Migration Trigger ADR's
// projection/Blueprint-equivalence gate. `composeBlueprint()` itself only
// has one entry point (`ids.coreLearnerId`, internally resolving
// `resolveLegacyStudentId`) — there is no separate "legacy-direct" top-level
// Blueprint signature to compare against. The meaningful equivalence claim
// is therefore about the specific legacy-identity-keyed composers
// `composeBlueprint` calls with its resolved id: proving that calling those
// same, real, unmodified composer functions directly with an independently
// known legacy id produces identical output to calling them with the id
// `resolveLegacyStudentId` resolves for the matching Core learner.
//
// `loadProjectionAccess` and `composeLearningCompass` are used as the two
// representative targets — both are purely DB-derived (no AI), and their
// `BlueprintSection`/`ProjectionAccessResult` shapes cover status,
// freshness, availability, unavailable-reason, and data — the fields
// Phase 6 of the ADR asks this gate to prove equivalent.
//
// Run: npx tsx --env-file=.env.local --test lib/learnerBlueprint/equivalence.integration.test.ts
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createServiceClient } from '@/utils/supabase/service'
import { startIngestionRun } from '@/lib/intelligence/ingestionRun'
import { persistEvidenceBatch } from '@/lib/intelligence/evidenceLifecycle'
import type { LearnerEvidence } from '@/lib/intelligence/evidence'
import { resolveLegacyStudentId } from '@/lib/core/identity'
import { loadProjectionAccess } from './projectionAccess'
import { composeLearningCompass } from './composeLearningCompass'
import { compareProjections, diffsOf } from '@/lib/projection/equivalenceHarness'

const SYNTHETIC_MARKER = 'SYNTHETIC_BLUEPRINT_EQUIVALENCE_TEST'
const db = createServiceClient()

async function makeSyntheticStudent(label: string): Promise<{ studentId: string; coreLearnerId: string }> {
  const coreLearnerId = crypto.randomUUID()
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
  // Deletes by learner_id, not just the tracked-id array, and also clears
  // evidence_audit_log/evidence_projection_events/learner_projections — see
  // the matching comment in
  // lib/projection/equivalenceHarness.integration.test.ts.
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
  if (createdStudentIds.length) await db.from('holiday_plans').delete().in('student_id', createdStudentIds)
  if (createdStudentIds.length) await db.from('students').delete().in('id', createdStudentIds)
  if (initiatedByUserId) await db.auth.admin.deleteUser(initiatedByUserId)
})

async function seedEvidence(studentId: string, evidence: LearnerEvidence[]): Promise<void> {
  const run = await startIngestionRun({ source: 'csv_export', initiatedBy: initiatedByUserId, teacherId: null, institution: null })
  createdIngestionRunIds.push(run.id)
  const result = await persistEvidenceBatch(evidence, run.id)
  createdEvidenceIds.push(...result.inserted.map(r => r.id))
}

function makeEvidence(learnerId: string, overrides: Partial<LearnerEvidence> = {}): LearnerEvidence {
  return {
    learnerId,
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
    importedAt: new Date().toISOString(),
    issues: [],
    ...overrides,
  }
}

test('loadProjectionAccess: Core-resolved and legacy-direct calls produce equivalent ProjectionAccessResult', async () => {
  const { studentId, coreLearnerId } = await makeSyntheticStudent('projection-access')
  createdStudentIds.push(studentId)
  await seedEvidence(studentId, [makeEvidence(studentId)])

  const legacyResult = await loadProjectionAccess(studentId)

  const resolvedId = await resolveLegacyStudentId(coreLearnerId)
  assert.equal(resolvedId, studentId, 'must prove real resolution, not assume it')
  const coreResult = await loadProjectionAccess(resolvedId)

  assert.equal(coreResult.error, null)
  assert.equal(legacyResult.error, null)
  assert.ok(legacyResult.projection?.academic, 'sanity check: evidence was seeded, an academic projection must exist')

  // Reuses the same equivalence contract as the projection harness (every
  // field except the deliberately time-dependent `lastComputed`) rather
  // than re-deriving a second, ad-hoc comparison rule.
  assert.ok(legacyResult.projection && coreResult.projection)
  const cmp = compareProjections(legacyResult.projection!, coreResult.projection!)
  assert.ok(cmp.equal, `expected equivalence, got diffs: ${JSON.stringify(diffsOf(cmp))}`)
})

test('loadProjectionAccess: a null legacy id (no bridge) degrades explicitly, matching the documented absence contract', async () => {
  const result = await loadProjectionAccess(null)
  assert.deepEqual(result, { projection: null, error: null })
})

test('composeLearningCompass: Core-resolved and legacy-direct calls produce an identical BlueprintSection', async () => {
  const { studentId, coreLearnerId } = await makeSyntheticStudent('learning-compass')
  createdStudentIds.push(studentId)

  const legacySection = await composeLearningCompass(studentId)
  const resolvedId = await resolveLegacyStudentId(coreLearnerId)
  assert.equal(resolvedId, studentId)
  const coreSection = await composeLearningCompass(resolvedId)

  assert.deepEqual(coreSection, legacySection)
  assert.equal(legacySection.status, 'available')
})

test('composeLearningCompass: bridge absence produces the documented "unavailable" state, not a thrown error or an equivalence failure', async () => {
  const section = await composeLearningCompass(null)
  assert.equal(section.status, 'unavailable')
  assert.equal(section.data, null)
  assert.match(section.unavailableReason ?? '', /No legacy student identity bridged/)
})

test('drift detection: a deliberately different legacy id produces a non-equivalent composeLearningCompass result', async () => {
  const a = await makeSyntheticStudent('drift-compass-a')
  const b = await makeSyntheticStudent('drift-compass-b')
  createdStudentIds.push(a.studentId, b.studentId)

  // composeLearningCompass reads compass-session/holiday-plan state, not
  // evidence — so the guaranteed-divergent input here is a published
  // holiday plan for A only, simulating resolution landing on the wrong
  // learner (the one property this drift test exists to catch).
  const { error } = await db.from('holiday_plans').insert({
    student_id: a.studentId, term: 1, year: 2026, holiday_period: 'term1_end',
    holiday_days: 14, plan_data: {}, is_published: true, published_at: new Date().toISOString(),
  })
  if (error) throw new Error(`holiday_plans seed failed: ${error.message}`)

  const sectionA = await composeLearningCompass(a.studentId)
  const sectionB = await composeLearningCompass(b.studentId)

  assert.notDeepEqual(sectionA, sectionB, 'the comparator must be able to detect a real divergence, not pass by construction')
  assert.equal(sectionA.data?.holidayProgrammeAvailable, true)
  assert.equal(sectionB.data?.holidayProgrammeAvailable, false)
})
