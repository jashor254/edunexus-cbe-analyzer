// lib/growth/repositories/school.repository.integration.test.ts
//
// Validates GrowthSchoolRepository against real Supabase writes: insert,
// fuzzy-dedup lookup, update, and the pipeline_stage check constraint.
// Creates real (throwaway) rows, deleted in after() including on failure.
//
// Run: npx tsx --env-file=.env.local --test lib/growth/repositories/school.repository.integration.test.ts

import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createServiceClient } from '@/utils/supabase/service'
import { growthRepos } from '@/lib/growth/repositories'
import { createSchool } from '@/lib/growth/services/schools'

const MARKER = 'SYNTHETIC_GROWTH_C0_SCHOOL_TEST'
const db = createServiceClient()
let founderId: string | null = null
const schoolIds: string[] = []

before(async () => {
  const { data, error } = await db.auth.admin.createUser({
    email: `${MARKER.toLowerCase()}-${Date.now()}@example.com`,
    password: 'synthetic-test-password-1',
    email_confirm: true,
  })
  if (error || !data.user) throw new Error(`setup: could not create synthetic founder: ${error?.message}`)
  founderId = data.user.id
  await growthRepos.users.ensure(founderId, 'Synthetic Founder')
})

after(async () => {
  for (const id of schoolIds) await db.from('growth_schools').delete().eq('id', id)
  if (founderId) {
    await db.from('growth_users').delete().eq('id', founderId)
    await db.auth.admin.deleteUser(founderId)
  }
})

test('createSchool inserts a real row with default stage/status', async () => {
  const school = await createSchool({ name: `${MARKER} Academy`, county: 'Kiambu' }, founderId!)
  schoolIds.push(school.id)
  assert.equal(school.pipeline_stage, 'research')
  assert.equal(school.status, 'active')
  assert.equal(school.county, 'Kiambu')
})

test('createSchool rejects a fuzzy-duplicate name', async () => {
  await assert.rejects(
    () => createSchool({ name: `  ${MARKER} academy  ` }, founderId!),
    /already exists/,
  )
})

test('changeStage rejects an invalid stage and accepts a valid one', async () => {
  const { changeStage } = await import('@/lib/growth/services/schools')
  const school = await growthRepos.schools.findByNameFuzzy(`${MARKER} Academy`)
  assert.ok(school)

  // @ts-expect-error deliberately invalid input to prove the guard rejects it
  await assert.rejects(() => changeStage(school!.id, 'not_a_real_stage'), /Invalid pipeline stage/)

  const updated = await changeStage(school!.id, 'contacted')
  assert.equal(updated.pipeline_stage, 'contacted')
})
