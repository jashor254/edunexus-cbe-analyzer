// lib/intelligence/phaseGMigration.safety.test.ts
//
// Migration safety, not domain behavior — no DB required. Same style as
// lib/intelligence/phaseMinus1Migration.safety.test.ts and
// lib/assessments/phaseBMigration.safety.test.ts.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const PHASE_G = readFileSync(
  join(__dirname, '../../supabase/migrations/20260713203000_phase_g_evidence_purposes.sql'),
  'utf8',
)

const CANONICAL_PURPOSES = ['diagnostic', 'formative', 'summative', 'practice', 'practical']
const PHASE_B_TYPE_NAMES = ['opener', 'cat', 'midterm', 'endterm', 'exam', 'assignment']

test('all 5 canonical purposes are seeded', () => {
  for (const code of CANONICAL_PURPOSES) {
    assert.ok(PHASE_G.includes(`'${code}'`), `expected the "${code}" purpose to be seeded`)
  }
})

test('Phase G is purely additive — no DROP TABLE/COLUMN, no TRUNCATE, no unconditional DELETE', () => {
  const destructivePatterns = [/DROP\s+TABLE/i, /DROP\s+COLUMN/i, /TRUNCATE/i, /DELETE\s+FROM/i]
  for (const pattern of destructivePatterns) {
    assert.ok(!pattern.test(PHASE_G), `Phase G must not contain a destructive statement matching ${pattern}`)
  }
})

test('the default_purpose_id backfill maps every Phase B seeded type name and never overwrites an existing mapping', () => {
  const updateStart = PHASE_G.indexOf('UPDATE assessment_types')
  assert.ok(updateStart !== -1, 'expected to find the default_purpose_id backfill UPDATE')
  const clause = PHASE_G.slice(updateStart, updateStart + 800)
  assert.ok(clause.includes('at.default_purpose_id IS NULL'), 'the backfill must be idempotent — only fill nulls, never overwrite a deliberately-set mapping')
  for (const name of PHASE_B_TYPE_NAMES) {
    assert.ok(clause.includes(`at.name = '${name}'`), `expected a default purpose mapping for "${name}"`)
  }
})

test('the immutability trigger replacement still protects every pre-existing fact column, not just the new one', () => {
  const triggerStart = PHASE_G.indexOf('CREATE OR REPLACE FUNCTION enforce_evidence_immutability')
  assert.ok(triggerStart !== -1)
  const body = PHASE_G.slice(triggerStart, triggerStart + 2500)
  const mustStillProtect = [
    'learner_id', 'subject', 'raw_subject', 'cbc_level', 'assessment_type', 'academic_year',
    'term', 'evidence_source', 'extraction_method', 'raw_input_ref', 'ingestion_run_id',
    'trust_tier', 'evidence_confidence', 'confidence_formula_version', 'created_at',
    'school_id', 'curriculum_version_id',
  ]
  for (const col of mustStillProtect) {
    assert.ok(body.includes(`NEW.${col}`), `Phase G's replacement trigger must still check NEW.${col} — dropping a prior column's protection here would silently make it mutable again`)
  }
  assert.ok(body.includes('NEW.purpose_id'), 'purpose_id itself must be protected by the same trigger')
})
