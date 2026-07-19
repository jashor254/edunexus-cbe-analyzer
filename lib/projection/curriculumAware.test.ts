// lib/projection/curriculumAware.test.ts
// ADR-0024 Phase 2 — pure unit tests for bySubStrand on the Academic and
// Knowledge projectors. No DB. Mirrors engine.test.ts's fixture helper.
// Run with: npx tsx --test lib/projection/curriculumAware.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { projectAcademic } from './academicProjector'
import { projectKnowledge } from './knowledgeProjector'
import type { EvidenceRow } from '@/lib/repositories/evidence.repository'

const LEARNER_ID = 'learner-1'
const SUBSTRAND_A = 'substrand-fractions'
const SUBSTRAND_B = 'substrand-geometry'

function evidence(overrides: Partial<EvidenceRow>): EvidenceRow {
  return {
    id: overrides.id ?? `ev-${Math.random().toString(36).slice(2, 8)}`,
    created_at: overrides.created_at ?? new Date().toISOString(),
    learner_id: LEARNER_ID,
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
    payload: null,
    ...overrides,
  }
}

// ── Academic projector ───────────────────────────────────────────────────

test('projectAcademic: bySubStrand is absent for evidence with no sub_strand_id — graceful fallback, no fabrication', () => {
  const ev = [evidence({ cbc_level: 3, sub_strand_id: null })]
  const p = projectAcademic(ev)
  assert.deepEqual(p!.value.bySubStrand, {}, 'no fabricated sub-strand entries when no evidence carries a canonical id')
  assert.ok(p!.value.bySubject.mathematics, 'bySubject must still be populated — this is the fallback callers use')
})

test('projectAcademic: bySubStrand groups by sub_strand_id, tracks trend independently per sub-strand', () => {
  const ev = [
    evidence({ id: 'a1', sub_strand_id: SUBSTRAND_A, strand: 'Numbers', sub_strand: 'Fractions', cbc_level: 1, created_at: '2026-01-01T00:00:00Z' }),
    evidence({ id: 'a2', sub_strand_id: SUBSTRAND_A, strand: 'Numbers', sub_strand: 'Fractions', cbc_level: 3, created_at: '2026-03-01T00:00:00Z' }),
    evidence({ id: 'b1', sub_strand_id: SUBSTRAND_B, strand: 'Measurement', sub_strand: 'Geometry', cbc_level: 4, created_at: '2026-01-01T00:00:00Z' }),
  ]
  const p = projectAcademic(ev)

  assert.equal(p!.value.bySubStrand[SUBSTRAND_A].latestLevel, 3)
  assert.equal(p!.value.bySubStrand[SUBSTRAND_A].trend, 'improving')
  assert.equal(p!.value.bySubStrand[SUBSTRAND_A].subStrandTitle, 'Fractions')
  assert.equal(p!.value.bySubStrand[SUBSTRAND_A].strandTitle, 'Numbers')
  assert.equal(p!.value.bySubStrand[SUBSTRAND_B].latestLevel, 4)
  assert.equal(p!.value.bySubStrand[SUBSTRAND_B].trend, 'insufficient_data') // only one data point for this sub-strand
})

test('projectAcademic: mixed evidence — some rows carry a canonical id, some don\'t — both bySubject and bySubStrand are correct simultaneously', () => {
  const ev = [
    evidence({ id: 'a1', sub_strand_id: SUBSTRAND_A, cbc_level: 2, created_at: '2026-01-01T00:00:00Z' }),
    evidence({ id: 'a2', sub_strand_id: null, cbc_level: 3, created_at: '2026-02-01T00:00:00Z' }), // legacy, free-text-only evidence
  ]
  const p = projectAcademic(ev)
  assert.equal(p!.value.bySubject.mathematics.latestLevel, 3, 'subject-level view includes ALL scored evidence, canonical or not')
  assert.equal(Object.keys(p!.value.bySubStrand).length, 1, 'sub-strand view includes only the canonically-anchored row')
  assert.equal(p!.value.bySubStrand[SUBSTRAND_A].latestLevel, 2)
})

test('projectAcademic: every bySubStrand entry\'s evidence is included in supportingEvidenceIds', () => {
  const ev = [evidence({ id: 'a1', sub_strand_id: SUBSTRAND_A, cbc_level: 2 })]
  const p = projectAcademic(ev)
  assert.ok(p!.supportingEvidenceIds.includes('a1'))
})

// ── Knowledge projector ──────────────────────────────────────────────────

test('projectKnowledge: bySubStrand absent with no canonical evidence, present and correct with it', () => {
  const noAnchor = projectKnowledge([evidence({ cbc_level: 2, sub_strand_id: null })])
  assert.deepEqual(noAnchor!.value.bySubStrand, {})

  const withAnchor = projectKnowledge([evidence({ id: 'a1', sub_strand_id: SUBSTRAND_A, strand: 'Numbers', sub_strand: 'Fractions', cbc_level: 2 })])
  assert.equal(withAnchor!.value.bySubStrand[SUBSTRAND_A].currentLevel, 2)
  assert.equal(withAnchor!.value.bySubStrand[SUBSTRAND_A].subStrandTitle, 'Fractions')
})

test('projectKnowledge: a sub-strand\'s own latest row can differ from the subject\'s overall latest row — both must appear in supportingEvidenceIds', () => {
  const ev = [
    // Subject's overall latest (no sub-strand anchor) — wins bySubject.
    evidence({ id: 'latest-subject', sub_strand_id: null, cbc_level: 4, created_at: '2026-06-01T00:00:00Z' }),
    // An older row, but the ONLY evidence for this specific sub-strand — must still surface in bySubStrand.
    evidence({ id: 'latest-substrand', sub_strand_id: SUBSTRAND_A, cbc_level: 1, created_at: '2026-01-01T00:00:00Z' }),
  ]
  const p = projectKnowledge(ev)

  assert.equal(p!.value.bySubject.mathematics.currentLevel, 4)
  assert.equal(p!.value.bySubStrand[SUBSTRAND_A].currentLevel, 1)
  // The invariant this test exists to prove: both rows actually used must
  // be represented, not just whichever one happened to win bySubject.
  assert.ok(p!.supportingEvidenceIds.includes('latest-subject'))
  assert.ok(p!.supportingEvidenceIds.includes('latest-substrand'))
})

test('projectKnowledge: determinism preserved with bySubStrand present', () => {
  const ev = [evidence({ id: 'a1', sub_strand_id: SUBSTRAND_A, cbc_level: 2, created_at: '2026-01-01T00:00:00Z' })]
  const now = new Date('2026-07-07T00:00:00Z')
  const first = projectKnowledge(ev, now)
  const second = projectKnowledge(ev, now)
  assert.deepEqual(first, second)
})
