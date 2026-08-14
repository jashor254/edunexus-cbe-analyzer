// lib/projection/engine.test.ts
// Pure unit tests — no DB. Covers determinism, reproducibility, evidence
// traceability, and each projector's core rule, using synthetic
// EvidenceRow-shaped fixtures directly (not persisted).
// Run with: npx tsx --env-file=.env.local --test lib/projection/engine.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { computeLearnerProjection } from './engine'
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
    score: 70,
    cbc_level: 3,
    assessment_type: 'cat',
    academic_year: 2026,
    term: 1,
    evidence_source: 'csv_export',
    extraction_method: 'csv_parser_v1',
    raw_input_ref: 'test',
    ingestion_run_id: 'run-1',
    trust_tier: 2,
    evidence_confidence: 90,
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

// ── Determinism / reproducibility ────────────────────────────────────────────

test('computeLearnerProjection is deterministic — identical evidence produces identical output (excluding lastComputed)', () => {
  const now = new Date('2026-07-07T12:00:00Z')
  const ev = [
    evidence({ id: 'a', subject: 'mathematics', cbc_level: 2, created_at: '2026-01-01T00:00:00Z' }),
    evidence({ id: 'b', subject: 'mathematics', cbc_level: 3, created_at: '2026-03-01T00:00:00Z' }),
  ]

  const first = computeLearnerProjection(LEARNER_ID, ev, now)
  const second = computeLearnerProjection(LEARNER_ID, ev, now)

  assert.deepEqual(first, second, 'identical evidence + identical `now` must produce byte-identical output')
})

test('projection is empty (no fabricated values) when there is no evidence at all', () => {
  const p = computeLearnerProjection(LEARNER_ID, [])
  assert.equal(p.academic, null)
  assert.equal(p.capability, null)
  assert.equal(p.knowledge, null)
  assert.equal(p.behaviour, null)
  assert.equal(p.growth, null)
  assert.equal(p.risk, null)
  assert.equal(p.completeness, null)
})

// ── Evidence traceability ────────────────────────────────────────────────────

test('every projection\'s supportingEvidenceIds are real, and only the evidence actually used', () => {
  const ev = [
    evidence({ id: 'math-1', subject: 'mathematics', cbc_level: 3 }),
    evidence({ id: 'eng-1', subject: 'english', cbc_level: 4 }),
  ]
  const p = computeLearnerProjection(LEARNER_ID, ev)
  assert.ok(p.academic)
  assert.deepEqual(new Set(p.academic!.supportingEvidenceIds), new Set(['math-1', 'eng-1']))
})

// ── Academic Projector ───────────────────────────────────────────────────────

test('academic projector detects an improving trend from earliest to latest evidence', () => {
  const ev = [
    evidence({ id: 'a', subject: 'mathematics', cbc_level: 2, created_at: '2026-01-01T00:00:00Z' }),
    evidence({ id: 'b', subject: 'mathematics', cbc_level: 4, created_at: '2026-05-01T00:00:00Z' }),
  ]
  const p = computeLearnerProjection(LEARNER_ID, ev)
  assert.equal(p.academic!.value.bySubject.mathematics.trend, 'improving')
  assert.equal(p.academic!.value.bySubject.mathematics.latestLevel, 4)
})

test('academic projector reports insufficient_data for a subject with only one evidence record', () => {
  const ev = [evidence({ id: 'a', subject: 'geography', cbc_level: 3 })]
  const p = computeLearnerProjection(LEARNER_ID, ev)
  assert.equal(p.academic!.value.bySubject.geography.trend, 'insufficient_data')
})

// ── Capability Projector ─────────────────────────────────────────────────────

test('capability projector uses only the latest evidence per subject, not history', () => {
  const ev = [
    evidence({ id: 'a', subject: 'mathematics', cbc_level: 1, created_at: '2026-01-01T00:00:00Z' }),
    evidence({ id: 'b', subject: 'mathematics', cbc_level: 4, created_at: '2026-06-01T00:00:00Z' }),
  ]
  const p = computeLearnerProjection(LEARNER_ID, ev)
  assert.equal(p.capability!.value.bySubject.mathematics.level, 'exceptional')
  assert.deepEqual(p.capability!.supportingEvidenceIds, ['b'])
})

// ── Behaviour Projector ──────────────────────────────────────────────────────

test('behaviour projector returns null when only academic-score evidence exists (no behavioural sources)', () => {
  const ev = [evidence({ evidence_source: 'csv_export' })]
  const p = computeLearnerProjection(LEARNER_ID, ev)
  assert.equal(p.behaviour, null)
})

// ── Risk Projector ───────────────────────────────────────────────────────────

test('risk projector flags a subject at Below Expectation with declining trend as critical', () => {
  const ev = [
    evidence({ id: 'a', subject: 'mathematics', cbc_level: 2, created_at: '2026-01-01T00:00:00Z' }),
    evidence({ id: 'b', subject: 'mathematics', cbc_level: 1, created_at: '2026-05-01T00:00:00Z' }),
  ]
  const p = computeLearnerProjection(LEARNER_ID, ev)
  assert.equal(p.risk!.value.overallRiskLevel, 'critical')
  assert.equal(p.risk!.value.flags[0].subject, 'mathematics')
})

test('risk projector produces no flags for consistently strong evidence', () => {
  const ev = [
    evidence({ id: 'a', subject: 'mathematics', cbc_level: 4, created_at: '2026-01-01T00:00:00Z' }),
    evidence({ id: 'b', subject: 'mathematics', cbc_level: 4, created_at: '2026-05-01T00:00:00Z' }),
  ]
  const p = computeLearnerProjection(LEARNER_ID, ev)
  assert.equal(p.risk!.value.overallRiskLevel, 'normal')
  assert.deepEqual(p.risk!.value.flags, [])
})

// ── Growth Projector ──────────────────────────────────────────────────────────

// Phase 4B.1 (docs/architecture/comparable-context-growth-correction-
// phase4b1.md) — this test previously named itself "across all subjects
// combined," asserting the exact cross-subject-pooling algorithm that
// correction removed (it produced false "declining" verdicts for learners
// whose every individual subject was actually fine — see the doc's Victor
// Gitau case study). Rewritten to assert the corrected, honest behavior:
// decline is only ever asserted when it is real within at least one
// comparable context (here, both subjects genuinely decline, across
// genuinely distinct terms, which is why 'declining' is still the correct
// answer for this particular fixture).
test('growth projector detects overall decline when multiple subjects each genuinely decline across distinct terms', () => {
  const ev = [
    evidence({ id: 'a', subject: 'mathematics', cbc_level: 4, term: 1, created_at: '2026-01-01T00:00:00Z' }),
    evidence({ id: 'b', subject: 'english', cbc_level: 4, term: 1, created_at: '2026-01-02T00:00:00Z' }),
    evidence({ id: 'c', subject: 'mathematics', cbc_level: 1, term: 2, created_at: '2026-05-01T00:00:00Z' }),
    evidence({ id: 'd', subject: 'english', cbc_level: 1, term: 2, created_at: '2026-05-02T00:00:00Z' }),
  ]
  const p = computeLearnerProjection(LEARNER_ID, ev)
  assert.equal(p.growth!.value.trend, 'declining')
})

test('growth projector does NOT detect decline when subjects only differ from each other, not across time (the pre-4B.1 pooling bug)', () => {
  const ev = [
    evidence({ id: 'a', subject: 'mathematics', cbc_level: 4, term: 1, created_at: '2026-01-01T00:00:00Z' }),
    evidence({ id: 'b', subject: 'english', cbc_level: 1, term: 1, created_at: '2026-05-02T00:00:00Z' }),
  ]
  const p = computeLearnerProjection(LEARNER_ID, ev)
  assert.notEqual(p.growth!.value.trend, 'declining')
})

// ── Completeness Projector ───────────────────────────────────────────────────

test('completeness projector scores higher subject diversity and multiple sources higher', () => {
  const narrow = computeLearnerProjection(LEARNER_ID, [evidence({ subject: 'mathematics' })])
  const broad = computeLearnerProjection(LEARNER_ID, [
    evidence({ id: 'a', subject: 'mathematics' }),
    evidence({ id: 'b', subject: 'english' }),
    evidence({ id: 'c', subject: 'kiswahili' }),
    evidence({ id: 'd', subject: 'geography' }),
    evidence({ id: 'e', subject: 'science' }),
  ])
  assert.ok(broad.completeness!.value.completenessScore > narrow.completeness!.value.completenessScore)
})

// ── Confidence behavior ──────────────────────────────────────────────────────

test('a single piece of evidence never produces full confidence, regardless of its own extraction confidence', () => {
  const ev = [evidence({ evidence_confidence: 100 })]
  const p = computeLearnerProjection(LEARNER_ID, ev)
  assert.ok(p.academic!.confidence < 100, `expected single-evidence confidence to be capped, got ${p.academic!.confidence}`)
})

test('three or more corroborating pieces of evidence reach full confidence when each is fully confident', () => {
  const ev = [
    evidence({ id: 'a', evidence_confidence: 100 }),
    evidence({ id: 'b', evidence_confidence: 100 }),
    evidence({ id: 'c', evidence_confidence: 100 }),
  ]
  const p = computeLearnerProjection(LEARNER_ID, ev)
  assert.equal(p.academic!.confidence, 100)
})
