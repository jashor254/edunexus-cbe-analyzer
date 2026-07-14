// lib/intelligence/phaseCMigration.safety.test.ts
//
// Migration safety, not domain behavior — no DB required. Same style as
// the other phaseX Migration.safety.test.ts files this series.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const PHASE_C = readFileSync(
  join(__dirname, '../../supabase/migrations/20260713210000_phase_c_teacher_remarks.sql'),
  'utf8',
)

const PRE_PHASE_C_SOURCES = [
  'csv_export', 'excel_import', 'report_card_photo', 'report_card_pdf',
  'sms_api', 'lms_api', 'teacher_upload', 'parent_observation',
  'compass_session', 'classroom_observation', 'national_dataset', 'holiday_return',
]

function extractCheckConstraintValues(sql: string, constraintName: string): string[] {
  const anchor = sql.indexOf(`ADD CONSTRAINT ${constraintName}`)
  assert.ok(anchor !== -1, `expected to find "ADD CONSTRAINT ${constraintName}" in the migration`)
  const clause = sql.slice(anchor, anchor + 700)
  return [...clause.matchAll(/'([a-z_]+)'/g)].map(m => m[1])
}

test('the widened evidence_source CHECK constraint is a strict superset of every pre-Phase-C value, plus teacher_remark', () => {
  const widened = extractCheckConstraintValues(PHASE_C, 'learner_evidence_evidence_source_check')
  for (const value of PRE_PHASE_C_SOURCES) {
    assert.ok(widened.includes(value), `Phase C must not drop pre-existing evidence_source value "${value}"`)
  }
  assert.ok(widened.includes('teacher_remark'), 'Phase C must add teacher_remark')
})

test('Phase C is purely additive — no DROP TABLE/COLUMN, no TRUNCATE, no DELETE', () => {
  const destructivePatterns = [/DROP\s+TABLE/i, /DROP\s+COLUMN/i, /TRUNCATE/i, /DELETE\s+FROM/i]
  for (const pattern of destructivePatterns) {
    assert.ok(!pattern.test(PHASE_C), `Phase C must not contain a destructive statement matching ${pattern}`)
  }
})

test('the erasure exception covers payload, not just extracted_name/extracted_external_id/score', () => {
  const exceptionStart = PHASE_C.indexOf('IF NOT is_erasure AND')
  assert.ok(exceptionStart !== -1, 'expected to find the erasure-exception IF block')
  const clause = PHASE_C.slice(exceptionStart, exceptionStart + 300)
  assert.ok(clause.includes('NEW.extracted_name'))
  assert.ok(clause.includes('NEW.extracted_external_id'))
  assert.ok(clause.includes('NEW.score'))
  assert.ok(
    clause.includes('NEW.payload'),
    'erasure must purge payload too — a teacher remark\'s real content lives there, not in extracted_name; erasure that skips payload does not actually erase anything for this evidence source',
  )
})

test('payload is NOT in the unconditional (always-protected) fact block — only in the erasure-exempt block', () => {
  const exceptionStart = PHASE_C.indexOf('IF NOT is_erasure AND')
  const unconditionalBlock = PHASE_C.slice(0, exceptionStart)
  const lastUnconditionalIfStart = unconditionalBlock.lastIndexOf('IF NEW.learner_id')
  const unconditionalClause = unconditionalBlock.slice(lastUnconditionalIfStart)
  assert.ok(
    !unconditionalClause.includes('NEW.payload'),
    'payload must only be checked inside the erasure-exempt block — if it also appears in the unconditional block, erasure can never succeed for any row with a payload (the two conditions would contradict each other)',
  )
})
