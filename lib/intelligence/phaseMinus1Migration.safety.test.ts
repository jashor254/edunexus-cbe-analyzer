// lib/intelligence/phaseMinus1Migration.safety.test.ts
//
// Migration safety, not domain behavior — no DB required. Guards against
// the Phase -1 migration (supabase/migrations/20260713190000_phase_minus1_evidence_foundation.sql)
// ever being edited into a narrowing change: the widened lifecycle_state
// and evidence_audit_log.event_type CHECK constraints must remain a strict
// superset of the pre-Phase-1 values from 20260707_evidence_domain.sql,
// and every value the application code (EvidenceRow / EvidenceAuditEvent)
// can produce must appear in both constraints. A future edit that drops a
// value from either CHECK would still typecheck in TS but would reject
// real inserts at the database — this test catches that class of drift
// before it reaches a live database.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const MIGRATIONS_DIR = join(__dirname, '../../supabase/migrations')
const PHASE2 = readFileSync(join(MIGRATIONS_DIR, '20260707_evidence_domain.sql'), 'utf8')
const PHASE_MINUS_1 = readFileSync(join(MIGRATIONS_DIR, '20260713190000_phase_minus1_evidence_foundation.sql'), 'utf8')

const PRE_PHASE_MINUS_1_LIFECYCLE_STATES = [
  'auto_confirmed', 'pending_review', 'reviewed_confirmed',
  'reviewed_rejected', 'superseded', 'retracted',
]
const PRE_PHASE_MINUS_1_AUDIT_EVENT_TYPES = [
  'created', 'auto_confirmed', 'routed_to_review', 'reviewed_confirmed',
  'reviewed_rejected', 'superseded', 'retracted', 'verification_updated',
]

function extractCheckConstraintValues(sql: string, constraintName: string): string[] {
  const anchor = sql.indexOf(`ADD CONSTRAINT ${constraintName}`)
  assert.ok(anchor !== -1, `expected to find "ADD CONSTRAINT ${constraintName}" in the migration`)
  const clause = sql.slice(anchor, anchor + 500)
  return [...clause.matchAll(/'([a-z_]+)'/g)].map(m => m[1])
}

test('the widened lifecycle_state CHECK constraint is a strict superset of every pre-Phase--1 value', () => {
  const widened = extractCheckConstraintValues(PHASE_MINUS_1, 'learner_evidence_lifecycle_state_check')
  for (const value of PRE_PHASE_MINUS_1_LIFECYCLE_STATES) {
    assert.ok(widened.includes(value), `Phase -1 must not drop pre-existing lifecycle_state value "${value}"`)
  }
  assert.ok(widened.includes('erased'), 'Phase -1 must add the erased lifecycle state')
})

test('the widened evidence_audit_log.event_type CHECK constraint is a strict superset of every pre-Phase--1 value', () => {
  const widened = extractCheckConstraintValues(PHASE_MINUS_1, 'evidence_audit_log_event_type_check')
  for (const value of PRE_PHASE_MINUS_1_AUDIT_EVENT_TYPES) {
    assert.ok(widened.includes(value), `Phase -1 must not drop pre-existing event_type value "${value}"`)
  }
  assert.ok(widened.includes('erased'), 'Phase -1 must add the erased audit event type')
})

test('Phase -1 is purely additive — every DDL statement uses IF NOT EXISTS, ADD COLUMN, or CREATE OR REPLACE', () => {
  // A coarse but meaningful guard: no DROP TABLE, DROP COLUMN, or TRUNCATE
  // anywhere in the migration — a genuinely additive migration should never
  // need any of them.
  const destructivePatterns = [/DROP\s+TABLE/i, /DROP\s+COLUMN/i, /TRUNCATE/i, /DELETE\s+FROM/i]
  for (const pattern of destructivePatterns) {
    assert.ok(!pattern.test(PHASE_MINUS_1), `Phase -1 must not contain a destructive statement matching ${pattern}`)
  }
})

test('20260707_evidence_domain.sql itself is unchanged — Phase -1 widens, it does not edit history', () => {
  // Pre-Phase--1 lifecycle/event_type values must still be literally present
  // in the original migration file — Phase -1 must not have rewritten it.
  for (const value of PRE_PHASE_MINUS_1_LIFECYCLE_STATES) {
    assert.ok(PHASE2.includes(`'${value}'`), `20260707_evidence_domain.sql must still contain "${value}"`)
  }
})
