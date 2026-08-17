// lib/core/bridgeIntegrity.integration.test.ts
//
// Run: npm test -- lib/core/bridgeIntegrity.integration.test.ts
//
// IDENTITY-1 Phase 2 — proves the bridge constraint BEFORE it exists (so a
// failing run here is the signal that the migration hasn't landed yet) and
// AFTER (so a regression in the constraint itself is caught).
//
// What this proves and why it's narrow:
//
//   `students.external_id` had a designed dual purpose — Core learner bridge
//   (integration_connection_id IS NULL) and external-integration identity
//   (integration_connection_id IS NOT NULL) — but the second half is dormant:
//   0 rows, 0 code references, confirmed by repository-wide search. So the
//   correct constraint is a PARTIAL unique index, scoped to the bridge case
//   only, which is the one condition Phase 2's migration gate authorized.
//
// This does NOT test cardinality in the reverse direction (one learner with
// multiple students rows) — that direction is a business-logic concern
// `ensureBridgedLearner`'s existing find-then-insert already handles, not a
// database constraint this phase touches.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createTestServiceClient as createServiceClient } from '@/utils/supabase/test-service'

const db = createServiceClient()
const SYNTHETIC_MARKER = 'SYNTHETIC_BRIDGE_INTEGRITY_TEST'

async function makeSchool(): Promise<string> {
  const { data, error } = await db
    .from('schools')
    .insert({ school_name: `${SYNTHETIC_MARKER}-school` })
    .select('id')
    .single()
  if (error) throw error
  return data.id
}

async function makeLearner(schoolId: string, admissionNumber: string): Promise<string> {
  const { data, error } = await db
    .from('learners')
    .insert({ school_id: schoolId, admission_number: admissionNumber, first_name: 'Test', last_name: 'Learner' })
    .select('id')
    .single()
  if (error) throw error
  return data.id
}

async function makeStudent(externalId: string | null, opts: { integrationConnectionId?: string | null } = {}): Promise<{ id: string } | { error: string }> {
  const { data, error } = await db
    .from('students')
    .insert({
      name: SYNTHETIC_MARKER,
      grade: 8,
      level: 'Junior School',
      added_by: 'system',
      external_id: externalId,
      integration_connection_id: opts.integrationConnectionId ?? null,
    })
    .select('id')
    .single()
  if (error) return { error: error.message }
  return data
}

async function cleanup(studentIds: string[], learnerIds: string[], schoolIds: string[]): Promise<void> {
  const safely = async (fn: () => PromiseLike<unknown>) => { try { await fn() } catch { /* best-effort */ } }
  if (studentIds.length) await safely(() => db.from('students').delete().in('id', studentIds))
  if (learnerIds.length) await safely(() => db.from('learners').delete().in('id', learnerIds))
  if (schoolIds.length) await safely(() => db.from('schools').delete().in('id', schoolIds))
}

test('the bridge constraint rejects a second student claiming the same Core learner', async () => {
  const schoolId = await makeSchool()
  const learnerId = await makeLearner(schoolId, `${SYNTHETIC_MARKER}-001`)
  const studentIds: string[] = []

  try {
    const first = await makeStudent(learnerId)
    assert.ok('id' in first, `first bridge write should succeed: ${JSON.stringify(first)}`)
    if ('id' in first) studentIds.push(first.id)

    const second = await makeStudent(learnerId)
    // Captured for cleanup BEFORE the assertion, so a run against a
    // not-yet-migrated database (where this insert unexpectedly succeeds)
    // still cleans up both rows instead of leaking one.
    if ('id' in second) studentIds.push(second.id)

    // This is the assertion the whole migration exists to make true. Before
    // the partial unique index lands, this insert SUCCEEDS (the historical
    // defect); after it lands, it must be rejected.
    assert.ok('error' in second, 'a second student row claiming the same Core learner id must be rejected')
    if ('error' in second) {
      assert.match(second.error, /duplicate key|unique constraint/i)
    }
  } finally {
    await cleanup(studentIds, [learnerId], [schoolId])
  }
})

test('two students with no bridge at all (external_id NULL) are unaffected', async () => {
  const studentIds: string[] = []
  try {
    const a = await makeStudent(null)
    const b = await makeStudent(null)
    assert.ok('id' in a && 'id' in b, 'unbridged students must never be constrained against each other')
    if ('id' in a) studentIds.push(a.id)
    if ('id' in b) studentIds.push(b.id)
  } finally {
    await cleanup(studentIds, [], [])
  }
})

test('two DIFFERENT Core learners may each be bridged independently', async () => {
  const schoolId = await makeSchool()
  const learnerA = await makeLearner(schoolId, `${SYNTHETIC_MARKER}-A`)
  const learnerB = await makeLearner(schoolId, `${SYNTHETIC_MARKER}-B`)
  const studentIds: string[] = []

  try {
    const a = await makeStudent(learnerA)
    const b = await makeStudent(learnerB)
    assert.ok('id' in a && 'id' in b, 'distinct Core learners must bridge independently')
    if ('id' in a) studentIds.push(a.id)
    if ('id' in b) studentIds.push(b.id)
  } finally {
    await cleanup(studentIds, [learnerA, learnerB], [schoolId])
  }
})

// The dormant external-integration design must keep working. Phase 0 found
// `students.integration_connection_id` had no FK; Phase 2 re-proved that
// finding and it was WRONG — a real, enforced
// `FOREIGN KEY (integration_connection_id) REFERENCES integration_connections(id)`
// exists (`integration_connections_...`). `integration_connections` itself has
// 0 rows and needs a `developer_profiles` row to seed one, which is a fixture
// chain outside this phase's scope — so this proves the constraint is scoped
// by construction (`WHERE integration_connection_id IS NULL` in the migration
// below) rather than by exercising a real integration end to end.
test('the constraint is scoped to bridge rows by construction (WHERE integration_connection_id IS NULL)', async () => {
  const migrationSql = require('node:fs')
    .readFileSync(
      require('node:path').join(__dirname, '../../supabase/migrations/20260814150000_students_external_id_bridge_integrity.sql'),
      'utf-8',
    )
  assert.match(
    migrationSql, /WHERE\s+integration_connection_id\s+IS\s+NULL/i,
    'the bridge uniqueness constraint must be scoped to integration_connection_id IS NULL, so a real external-integration row (once that path is implemented) is never governed by it',
  )
})
