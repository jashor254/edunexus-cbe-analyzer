// lib/projection/growthProjector.test.ts
// Phase 4B.1 (docs/architecture/comparable-context-growth-correction-
// phase4b1.md) — pure unit tests for the comparable-context growth
// correction. Covers the regression list the correction itself was built
// to prove: cross-subject pooling can no longer manufacture a false
// improving/declining trend.
// Run with: npx tsx --env-file=.env.local --test lib/projection/growthProjector.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { projectGrowth } from './growthProjector'
import type { EvidenceRow } from '@/lib/repositories/evidence.repository'

const LEARNER_ID = 'learner-1'

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

const NOW = new Date('2026-07-27T00:00:00Z')

test('same subject L3 -> L4 across distinct terms = improving', () => {
  const p = projectGrowth([
    evidence({ id: 'a', subject: 'mathematics', cbc_level: 3, term: 1, created_at: '2026-01-10T00:00:00Z' }),
    evidence({ id: 'b', subject: 'mathematics', cbc_level: 4, term: 2, created_at: '2026-06-10T00:00:00Z' }),
  ], NOW)
  assert.equal(p!.value.trend, 'improving')
  assert.equal(p!.value.sourceSubject, 'mathematics')
  assert.equal(p!.value.bySubject.mathematics.trend, 'improving')
})

test('same subject L3 -> L1 across distinct terms = declining', () => {
  const p = projectGrowth([
    evidence({ id: 'a', subject: 'mathematics', cbc_level: 3, term: 1, created_at: '2026-01-10T00:00:00Z' }),
    evidence({ id: 'b', subject: 'mathematics', cbc_level: 1, term: 2, created_at: '2026-06-10T00:00:00Z' }),
  ], NOW)
  assert.equal(p!.value.trend, 'declining')
  assert.equal(p!.value.sourceSubject, 'mathematics')
})

test('same subject unchanged across distinct terms = stable', () => {
  const p = projectGrowth([
    evidence({ id: 'a', subject: 'mathematics', cbc_level: 3, term: 1, created_at: '2026-01-10T00:00:00Z' }),
    evidence({ id: 'b', subject: 'mathematics', cbc_level: 3, term: 2, created_at: '2026-06-10T00:00:00Z' }),
  ], NOW)
  assert.equal(p!.value.trend, 'stable')
})

test('one observation = insufficient_data', () => {
  const p = projectGrowth([
    evidence({ id: 'a', subject: 'mathematics', cbc_level: 3, term: 1 }),
  ], NOW)
  assert.equal(p!.value.trend, 'insufficient_data')
  assert.equal(p!.value.sourceSubject, null)
})

test('multiple observations in one effective term do not establish movement', () => {
  const p = projectGrowth([
    evidence({ id: 'a', subject: 'mathematics', cbc_level: 2, term: 1, assessment_type: 'cat', created_at: '2026-01-10T00:00:00Z' }),
    evidence({ id: 'b', subject: 'mathematics', cbc_level: 4, term: 1, assessment_type: 'term_exam', created_at: '2026-03-10T00:00:00Z' }),
  ], NOW)
  assert.equal(p!.value.bySubject.mathematics.trend, 'insufficient_data')
  assert.equal(p!.value.trend, 'insufficient_data')
})

test('early Subject A Level 4 plus later Subject B Level 3 does not equal decline (the exact Victor Gitau bug)', () => {
  const p = projectGrowth([
    evidence({ id: 'a', subject: 'kiswahili_lugha', cbc_level: 4, term: 1, created_at: '2026-01-10T00:00:00Z' }),
    evidence({ id: 'b', subject: 'mathematics', cbc_level: 3, term: 1, created_at: '2026-06-10T00:00:00Z' }),
  ], NOW)
  assert.notEqual(p!.value.trend, 'declining')
  assert.equal(p!.value.trend, 'insufficient_data') // neither subject alone has 2 distinct periods
})

test('early Subject A Level 3 plus later Subject B Level 4 does not equal improvement', () => {
  const p = projectGrowth([
    evidence({ id: 'a', subject: 'mathematics', cbc_level: 3, term: 1, created_at: '2026-01-10T00:00:00Z' }),
    evidence({ id: 'b', subject: 'kiswahili_lugha', cbc_level: 4, term: 1, created_at: '2026-06-10T00:00:00Z' }),
  ], NOW)
  assert.notEqual(p!.value.trend, 'improving')
  assert.equal(p!.value.trend, 'insufficient_data')
})

test('one valid subject trend plus one single-observation subject does not corrupt the valid trend', () => {
  const p = projectGrowth([
    evidence({ id: 'a', subject: 'mathematics', cbc_level: 3, term: 1, created_at: '2026-01-10T00:00:00Z' }),
    evidence({ id: 'b', subject: 'mathematics', cbc_level: 4, term: 2, created_at: '2026-06-10T00:00:00Z' }),
    evidence({ id: 'c', subject: 'kiswahili_lugha', cbc_level: 4, term: 2, created_at: '2026-07-01T00:00:00Z' }),
  ], NOW)
  assert.equal(p!.value.trend, 'improving')
  assert.equal(p!.value.sourceSubject, 'mathematics')
  assert.equal(p!.value.bySubject.kiswahili_lugha.trend, 'insufficient_data')
})

test('conflicting valid subject trends are represented honestly as mixed, not forced to one direction', () => {
  const p = projectGrowth([
    evidence({ id: 'a', subject: 'mathematics', cbc_level: 2, term: 1, created_at: '2026-01-10T00:00:00Z' }),
    evidence({ id: 'b', subject: 'mathematics', cbc_level: 4, term: 2, created_at: '2026-06-10T00:00:00Z' }),
    evidence({ id: 'c', subject: 'kiswahili_lugha', cbc_level: 4, term: 1, created_at: '2026-01-10T00:00:00Z' }),
    evidence({ id: 'd', subject: 'kiswahili_lugha', cbc_level: 2, term: 2, created_at: '2026-06-10T00:00:00Z' }),
  ], NOW)
  assert.equal(p!.value.trend, 'mixed')
  assert.equal(p!.value.sourceSubject, null)
  // 2+ contributing contexts -> no single scalar score, per-subject detail lives in bySubject
  assert.equal(p!.value.earliestScore, null)
  assert.equal(p!.value.latestScore, null)
  assert.equal(p!.value.bySubject.mathematics.trend, 'improving')
  assert.equal(p!.value.bySubject.kiswahili_lugha.trend, 'declining')
})

test('all valid subjects improving = improving overall', () => {
  const p = projectGrowth([
    evidence({ id: 'a', subject: 'mathematics', cbc_level: 2, term: 1, created_at: '2026-01-10T00:00:00Z' }),
    evidence({ id: 'b', subject: 'mathematics', cbc_level: 4, term: 2, created_at: '2026-06-10T00:00:00Z' }),
    evidence({ id: 'c', subject: 'kiswahili_lugha', cbc_level: 2, term: 1, created_at: '2026-01-10T00:00:00Z' }),
    evidence({ id: 'd', subject: 'kiswahili_lugha', cbc_level: 3, term: 2, created_at: '2026-06-10T00:00:00Z' }),
  ], NOW)
  assert.equal(p!.value.trend, 'improving')
})

test('all valid subjects declining = declining overall', () => {
  const p = projectGrowth([
    evidence({ id: 'a', subject: 'mathematics', cbc_level: 4, term: 1, created_at: '2026-01-10T00:00:00Z' }),
    evidence({ id: 'b', subject: 'mathematics', cbc_level: 2, term: 2, created_at: '2026-06-10T00:00:00Z' }),
    evidence({ id: 'c', subject: 'kiswahili_lugha', cbc_level: 3, term: 1, created_at: '2026-01-10T00:00:00Z' }),
    evidence({ id: 'd', subject: 'kiswahili_lugha', cbc_level: 1, term: 2, created_at: '2026-06-10T00:00:00Z' }),
  ], NOW)
  assert.equal(p!.value.trend, 'declining')
})

test('stable subject alongside an improving subject leans improving, not diluted to stable', () => {
  const p = projectGrowth([
    evidence({ id: 'a', subject: 'mathematics', cbc_level: 3, term: 1, created_at: '2026-01-10T00:00:00Z' }),
    evidence({ id: 'b', subject: 'mathematics', cbc_level: 3, term: 2, created_at: '2026-06-10T00:00:00Z' }),
    evidence({ id: 'c', subject: 'kiswahili_lugha', cbc_level: 2, term: 1, created_at: '2026-01-10T00:00:00Z' }),
    evidence({ id: 'd', subject: 'kiswahili_lugha', cbc_level: 4, term: 2, created_at: '2026-06-10T00:00:00Z' }),
  ], NOW)
  assert.equal(p!.value.trend, 'improving')
})

test('no subject has 2 distinct periods anywhere = insufficient_data', () => {
  const p = projectGrowth([
    evidence({ id: 'a', subject: 'mathematics', cbc_level: 3, term: 1 }),
    evidence({ id: 'b', subject: 'kiswahili_lugha', cbc_level: 4, term: 1 }),
    evidence({ id: 'c', subject: 'english', cbc_level: 2, term: 1 }),
  ], NOW)
  assert.equal(p!.value.trend, 'insufficient_data')
})

test('record input order does not affect result', () => {
  const rows = [
    evidence({ id: 'a', subject: 'mathematics', cbc_level: 2, term: 1, created_at: '2026-01-10T00:00:00Z' }),
    evidence({ id: 'b', subject: 'mathematics', cbc_level: 4, term: 2, created_at: '2026-06-10T00:00:00Z' }),
    evidence({ id: 'c', subject: 'kiswahili_lugha', cbc_level: 4, term: 1, created_at: '2026-01-10T00:00:00Z' }),
    evidence({ id: 'd', subject: 'kiswahili_lugha', cbc_level: 2, term: 2, created_at: '2026-06-10T00:00:00Z' }),
  ]
  const forward = projectGrowth(rows, NOW)
  const reversed = projectGrowth([...rows].reverse(), NOW)
  assert.equal(forward!.value.trend, reversed!.value.trend)
  assert.deepEqual(forward!.value.bySubject, reversed!.value.bySubject)
})

test('no scored evidence returns null, not a fabricated projection', () => {
  const p = projectGrowth([evidence({ id: 'a', cbc_level: null })], NOW)
  assert.equal(p, null)
})
