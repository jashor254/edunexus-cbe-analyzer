// lib/schoolEffectiveness/service.integration.test.ts
//
// SEC-001 — the School Effectiveness Check persists and reads back (ADR-0034).
// Exercises the real path: createSchool() (which makes the user a school_admin
// and gives a valid schools.id), then createSchoolEffectivenessCheck() and
// getLatestSchoolEffectivenessCheck() against real Postgres + RLS-table FKs.
//
// DEEP tier — requires a disposable TEST_SUPABASE target; runs in CI, not in
// the STANDARD suite.
//
// Run: npx tsx --env-file=.env.local --test lib/schoolEffectiveness/service.integration.test.ts

import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createTestServiceClient as createServiceClient } from '@/utils/supabase/test-service'
import { createSchool } from '@/lib/core/school'
import {
  createSchoolEffectivenessCheck,
  getLatestSchoolEffectivenessCheck,
  CBC_GATSBY_FRAMEWORK_VERSION,
} from './service'

const MARKER = 'SYNTHETIC_SEC_001_TEST'
const db = createServiceClient()

let userId: string
let schoolId: string

before(async () => {
  const email = `${MARKER.toLowerCase()}-${Date.now()}@example.com`
  const { data, error } = await db.auth.admin.createUser({
    email,
    password: `Test!${Math.random().toString(36).slice(2, 10)}`,
    email_confirm: true,
  })
  if (error || !data.user) throw new Error(`user creation failed: ${error?.message}`)
  userId = data.user.id

  const { school } = await createSchool({ school_name: `${MARKER} School` }, userId)
  schoolId = school.id
})

after(async () => {
  if (schoolId) {
    await db.from('school_effectiveness_checks').delete().eq('school_id', schoolId)
    await db.from('school_users').delete().eq('school_id', schoolId)
    await db.from('schools').delete().eq('id', schoolId)
  }
  if (userId) await db.auth.admin.deleteUser(userId)
})

test('SEC-001: a self-report Check is scored, persisted, and read back as the latest', async () => {
  const check = await createSchoolEffectivenessCheck({
    schoolId,
    createdBy: userId,
    selfReport: [
      { benchmarkId: 'each_learners_needs', level: 1 },   // a real gap
      { benchmarkId: 'stable_programme', level: 4 },        // fully embedded
    ],
  })

  assert.equal(check.school_id, schoolId)
  assert.equal(check.created_by, userId)
  assert.equal(check.framework_version, CBC_GATSBY_FRAMEWORK_VERSION)
  assert.equal(check.ratings.length, 2)
  // No auto input → both ratings are self-reported.
  assert.ok(check.ratings.every((r) => r.source === 'self_report'))
  assert.equal(check.profile.benchmarks_rated, 2)
  assert.equal(check.profile.prioritised_gaps.length, 1)
  assert.equal(check.profile.prioritised_gaps[0].benchmarkId, 'each_learners_needs')

  const latest = await getLatestSchoolEffectivenessCheck(schoolId)
  assert.ok(latest, 'the persisted Check must read back')
  assert.equal(latest.id, check.id)
})

test('SEC-001: a school with no Check returns null, not an error', async () => {
  // A valid uuid with no rows — the read must be null-safe, not throw.
  const latest = await getLatestSchoolEffectivenessCheck('00000000-0000-0000-0000-000000000000')
  assert.equal(latest, null)
})
