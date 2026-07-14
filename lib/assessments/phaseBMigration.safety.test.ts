// lib/assessments/phaseBMigration.safety.test.ts
//
// Migration safety, not domain behavior — no DB required. Same style as
// lib/intelligence/phaseMinus1Migration.safety.test.ts: guards the Phase B
// migration against ever becoming destructive, and confirms the
// backward-compat backfill covers exactly the 6 previously-hardcoded
// values, in the exact casing the existing UI actually sends.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const PHASE_B = readFileSync(
  join(__dirname, '../../supabase/migrations/20260713200000_phase_b_assessment_types.sql'),
  'utf8',
)

const PREVIOUSLY_HARDCODED_TYPES = ['exam', 'cat', 'midterm', 'endterm', 'opener', 'assignment']

test('the backfill seeds exactly the 6 previously-hardcoded values, in the exact casing the existing UI sends', () => {
  const valuesClauseStart = PHASE_B.indexOf('CROSS JOIN (VALUES')
  assert.ok(valuesClauseStart !== -1, 'expected to find the backfill VALUES clause')
  const clause = PHASE_B.slice(valuesClauseStart, valuesClauseStart + 300)
  for (const value of PREVIOUSLY_HARDCODED_TYPES) {
    assert.ok(clause.includes(`'${value}'`), `backfill must seed "${value}" — dropping it would silently break existing teachers using this exact API/UI path`)
  }
})

test('Phase B is purely additive to class_assessments — no DROP TABLE/COLUMN, no TRUNCATE, no DELETE', () => {
  const destructivePatterns = [/DROP\s+TABLE/i, /DROP\s+COLUMN/i, /TRUNCATE/i, /DELETE\s+FROM/i]
  for (const pattern of destructivePatterns) {
    assert.ok(!pattern.test(PHASE_B), `Phase B must not contain a destructive statement matching ${pattern}`)
  }
})

test('Phase B only drops the CHECK constraint, never the assessment_type column itself — backward read compatibility during rollout', () => {
  assert.ok(PHASE_B.includes('DROP CONSTRAINT IF EXISTS class_assessments_assessment_type_check'))
  assert.ok(!/DROP\s+COLUMN\s+assessment_type\b/i.test(PHASE_B), 'assessment_type (text) must be kept for backward-compatible reads, per the ratified rollout plan')
})

test('the assessment_type_id backfill only touches unlinked rows and never overwrites an existing link', () => {
  const updateStart = PHASE_B.indexOf('UPDATE class_assessments')
  assert.ok(updateStart !== -1, 'expected to find the assessment_type_id backfill UPDATE')
  const clause = PHASE_B.slice(updateStart, updateStart + 400)
  assert.ok(clause.includes('ca.assessment_type_id IS NULL'), 'the backfill must be idempotent and non-destructive — only fill nulls, never overwrite')
})
