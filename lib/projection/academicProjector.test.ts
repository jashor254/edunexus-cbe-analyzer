// lib/projection/academicProjector.test.ts
// Regression coverage for the subject-key canonicalization contract between
// projectAcademic()'s bySubject/bySubStrand construction (the write side)
// and lib/adaptiveLearning/recommend.ts's resolveAcademicSignal()/
// decideAdaptive() (the read side). Found via a real end-to-end HTTP trace:
// a learner with exactly one confirmed, auto_confirmed learner_evidence row
// (subject: "Mathematics", cbc_level: 1) was misclassified as
// insufficient_data/no_evidence — identical to a learner with zero evidence
// — because projectAcademic() grouped bySubject by the raw evidence.subject
// string while decideAdaptive() looked up bySubject[mapSubject(subject)
// .canonicalSubject]. "Mathematics" !== "mathematics" as object keys, so the
// real, confirmed evidence was silently invisible to the adaptive reader.
//
// Not every evidence producer canonicalizes `subject` before persisting:
// lib/assessments/evidence.ts (CSV/marks import) does; lib/formativeSignals/
// evidence.ts and lib/compass/evidence.ts do not — they persist the raw
// human-entered form. projectAcademic() is the one place all evidence funnels
// through before the adaptive reader ever sees it, so canonicalizing there
// makes every producer's evidence reachable without requiring each producer
// to individually agree on casing.
// Run with: npx tsx --env-file=.env.local --test lib/projection/academicProjector.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { projectAcademic } from './academicProjector'
import { decideAdaptive } from '@/lib/adaptiveLearning/recommend'
import type { LearnerIntelligenceProjection } from './types'
import type { EvidenceRow } from '@/lib/repositories/evidence.repository'
import { asStudentId } from '@/lib/core/identityTypes'

const LEARNER_ID = 'learner-1'

function evidence(overrides: Partial<EvidenceRow>): EvidenceRow {
  return {
    id: overrides.id ?? `ev-${Math.random().toString(36).slice(2, 8)}`,
    created_at: overrides.created_at ?? new Date().toISOString(),
    learner_id: asStudentId(LEARNER_ID),
    extracted_name: 'Test Learner',
    extracted_external_id: null,
    subject: 'mathematics',
    raw_subject: 'Mathematics',
    score: null,
    cbc_level: 1,
    assessment_type: 'assignment',
    academic_year: 2026,
    term: null,
    evidence_source: 'classroom_observation',
    extraction_method: 'formative_signal_v1',
    raw_input_ref: 'test',
    ingestion_run_id: 'run-1',
    trust_tier: 2,
    evidence_confidence: 95,
    confidence_formula_version: 'v1',
    issues: [],
    lifecycle_state: 'auto_confirmed',
    reviewed_by: null, reviewed_at: null, review_reason: null,
    retracted_by: null, retracted_at: null, retraction_reason: null,
    supersedes: null, superseded_by: null,
    verification_state: 'unverified',
    updated_at: overrides.created_at ?? new Date().toISOString(),
    strand: null, sub_strand: null, sub_strand_id: null, knowledge_node_id: null,
    school_id: null, curriculum_version_id: null,
    erased_by: null, erased_at: null, erasure_reason: null,
    purpose_id: null,
    correction_key: null,
    payload: null,
    ...overrides,
  }
}

/** Wraps a projectAcademic() result into the minimal LearnerIntelligenceProjection decideAdaptive() needs. */
function asLearnerProjection(academic: ReturnType<typeof projectAcademic>): LearnerIntelligenceProjection {
  return {
    learnerId: LEARNER_ID, academic, capability: null, knowledge: null,
    behaviour: null, growth: null, risk: null, completeness: null,
  }
}

// ── Test 1 — one formative signal, raw "Mathematics" subject ──────────────

test('one confirmed evidence row with subject "Mathematics" is visible to resolveAcademicSignal via decideAdaptive', () => {
  const academic = projectAcademic([
    evidence({ id: 'a', subject: 'Mathematics', cbc_level: 1 }),
  ])
  assert.ok(academic, 'projectAcademic must not return null for one scored evidence row')
  assert.ok(academic!.value.bySubject['mathematics'], 'bySubject must expose the canonical key, not the raw "Mathematics" key')
  assert.equal(academic!.value.bySubject['Mathematics'], undefined, 'no raw-cased key should exist alongside the canonical one')

  const decision = decideAdaptive(asLearnerProjection(academic), 'Mathematics')
  assert.notEqual(decision.groupType, 'insufficient_data', 'one confirmed evidence point must not be classified as insufficient_data')
  assert.equal(decision.evidenceState, 'initial')
  assert.equal(decision.observationCount, 1)
  assert.equal(decision.level, 1)
  assert.equal(decision.provisional, true, 'a single observation is provisional, per decideAdaptive\'s own initial-evidence rule')
})

// ── Test 2 — zero evidence must remain insufficient_data ───────────────────

test('zero evidence still resolves to insufficient_data / no_evidence — unchanged by the fix', () => {
  const academic = projectAcademic([])
  assert.equal(academic, null, 'no scored evidence must still produce no projection, not a fabricated one')

  const decision = decideAdaptive(asLearnerProjection(academic), 'Mathematics')
  assert.equal(decision.groupType, 'insufficient_data')
  assert.equal(decision.evidenceState, 'no_evidence')
  assert.equal(decision.observationCount, 0)
  assert.equal(decision.rationale, 'No confirmed academic evidence has been resolved for Mathematics yet, at any grain.')
})

// ── Test 3 — case-variant subjects must not fragment into separate keys ────

test('"Mathematics" and "mathematics" evidence merge into one canonical bySubject entry, never two', () => {
  const academic = projectAcademic([
    evidence({ id: 'a', subject: 'Mathematics', cbc_level: 2, created_at: '2026-01-10T00:00:00Z' }),
    evidence({ id: 'b', subject: 'mathematics', cbc_level: 4, created_at: '2026-06-10T00:00:00Z' }),
  ])
  assert.ok(academic)
  const keys = Object.keys(academic!.value.bySubject)
  assert.deepEqual(keys, ['mathematics'], 'both rows must land in exactly one canonical key, not fragment into two')
  assert.equal(academic!.value.bySubject.mathematics.history.length, 2, 'both rows must be aggregated into the same history')
  assert.equal(academic!.value.bySubject.mathematics.latestLevel, 4, 'chronological ordering must still hold across the merged rows')
})

// ── Test 4 — existing CSV/marks evidence (already canonical) keeps working ──

test('evidence already stored with a canonical subject (lib/assessments/evidence.ts style) is unaffected', () => {
  const academic = projectAcademic([
    evidence({ id: 'a', subject: 'mathematics', cbc_level: 3, evidence_source: 'csv_export', trust_tier: 2 }),
  ])
  assert.ok(academic)
  assert.ok(academic!.value.bySubject.mathematics)

  const decision = decideAdaptive(asLearnerProjection(academic), 'Mathematics')
  assert.notEqual(decision.groupType, 'insufficient_data')
  assert.equal(decision.level, 3)
})

// ── Test 5 — raw-subject producers (formative signal, Compass) become reachable ──

test('raw-subject evidence from formative-signal and Compass-style producers reaches the same canonical lookup', () => {
  const formativeSignalStyle = evidence({
    id: 'fs-1', subject: 'Mathematics', cbc_level: 1,
    evidence_source: 'classroom_observation', extraction_method: 'formative_signal_v1',
  })
  const compassStyle = evidence({
    id: 'cs-1', subject: 'Mathematics', cbc_level: 3,
    evidence_source: 'compass_session', trust_tier: 1, extraction_method: 'compass_session_v1',
    created_at: '2026-02-01T00:00:00Z',
  })

  const academicFormative = projectAcademic([formativeSignalStyle])
  assert.ok(academicFormative)
  const formativeDecision = decideAdaptive(asLearnerProjection(academicFormative), 'Mathematics')
  assert.notEqual(formativeDecision.groupType, 'insufficient_data', 'formative-signal evidence (raw subject) must be reachable')

  const academicCompass = projectAcademic([compassStyle])
  assert.ok(academicCompass)
  const compassDecision = decideAdaptive(asLearnerProjection(academicCompass), 'Mathematics')
  assert.notEqual(compassDecision.groupType, 'insufficient_data', 'Compass-session evidence (raw subject) must be reachable')
})

// ── bySubStrand carries the same canonicalization ───────────────────────────

test('bySubStrand.subject is canonicalized so resolveAcademicSignal\'s subStrand.subject === canonicalSubject check can match', () => {
  const academic = projectAcademic([
    evidence({ id: 'a', subject: 'Mathematics', cbc_level: 2, sub_strand_id: 'ss-1', sub_strand: 'Fractions', strand: 'Numbers' }),
  ])
  assert.ok(academic)
  assert.equal(academic!.value.bySubStrand['ss-1']?.subject, 'mathematics')

  const decision = decideAdaptive(asLearnerProjection(academic), 'Mathematics', 'ss-1')
  assert.equal(decision.grain, 'subStrand')
  assert.notEqual(decision.groupType, 'insufficient_data')
})
