// lib/core/institutionOwnership.test.ts
// Phase 0 — Institution Ownership Enforcement. Covers the resolver's
// resolution order, idempotency, and the concurrency guarantee the
// `provision_teacher_school` Postgres function provides (transaction-scoped
// advisory lock + double-checked re-select).
// Run with: npx tsx --env-file=.env.local --test lib/core/institutionOwnership.test.ts
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createTestServiceClient as createServiceClient } from '@/utils/supabase/test-service'
import { resolveOwningSchool } from '@/lib/core/institutionOwnership'
import { deleteAuthUserOrThrow } from '@/lib/testing/deleteAuthUserOrThrow'

const SYNTHETIC_MARKER = 'SYNTHETIC_INSTITUTIONOWNERSHIP_TEST'
const db = createServiceClient()

const createdUserIds: string[] = []
const createdSchoolIds: string[] = []

async function mkUser(label: string): Promise<string> {
  const email = `institution-ownership-test-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`
  const { data, error } = await db.auth.admin.createUser({ email, password: 'Test!12345678', email_confirm: true })
  if (error || !data.user) throw new Error(`mkUser failed: ${error?.message}`)
  createdUserIds.push(data.user.id)
  return data.user.id
}

after(async () => {
  if (createdSchoolIds.length > 0) {
    await db.from('school_users').delete().in('school_id', createdSchoolIds)
    await db.from('schools').delete().in('id', createdSchoolIds)
  }
  for (const id of createdUserIds) {
    await deleteAuthUserOrThrow(db, id)
  }
})

test('existing active school_users membership is returned as-is (step 1), no school provisioned', async () => {
  const userId = await mkUser('existing-member')
  const { data: school } = await db
    .from('schools')
    .insert({ school_name: SYNTHETIC_MARKER })
    .select('id')
    .single()
  createdSchoolIds.push(school!.id)
  await db.from('school_users').insert({ school_id: school!.id, user_id: userId, role: 'teacher', invited_by: userId, is_active: true })

  const result = await resolveOwningSchool(userId, 'should not be used')
  assert.equal(result.schoolId, school!.id, 'must return the existing membership\'s school, not provision a new one')
  assert.equal(result.created, false)
})

test('no membership provisions exactly one school and one school_admin membership', async () => {
  const userId = await mkUser('first-write')

  const result = await resolveOwningSchool(userId, `${SYNTHETIC_MARKER} first-write`)
  createdSchoolIds.push(result.schoolId)

  assert.ok(result.schoolId, 'must return a non-null schoolId')
  assert.equal(result.created, true)

  const { data: school } = await db.from('schools').select('id, provisioning_source, created_by').eq('id', result.schoolId).single()
  assert.equal(school?.provisioning_source, 'teacher_first_write_auto_provision')
  assert.equal(school?.created_by, userId)

  const { data: membership } = await db
    .from('school_users')
    .select('role, is_active')
    .eq('school_id', result.schoolId)
    .eq('user_id', userId)
    .single()
  assert.equal(membership?.role, 'school_admin')
  assert.equal(membership?.is_active, true)

  const { count } = await db.from('schools').select('id', { count: 'exact', head: true }).eq('created_by', userId)
  assert.equal(count, 1, 'exactly one school must exist for this user')
})

test('repeated resolver calls for the same user are idempotent — no second school is created', async () => {
  const userId = await mkUser('idempotent')

  const first = await resolveOwningSchool(userId, `${SYNTHETIC_MARKER} idempotent`)
  createdSchoolIds.push(first.schoolId)
  const second = await resolveOwningSchool(userId, `${SYNTHETIC_MARKER} idempotent again`)
  const third = await resolveOwningSchool(userId, `${SYNTHETIC_MARKER} idempotent again again`)

  assert.equal(second.schoolId, first.schoolId)
  assert.equal(third.schoolId, first.schoolId)
  assert.equal(second.created, false, 'second call must see the existing membership from step 1, not provision again')

  const { count } = await db.from('schools').select('id', { count: 'exact', head: true }).eq('created_by', userId)
  assert.equal(count, 1)
})

test('concurrent first writes by the same user never create two provisional schools', async () => {
  const userId = await mkUser('concurrent')

  // Fire many resolver calls simultaneously — the pre-check ("does this
  // user have a membership yet?") will pass for all of them before any
  // insert commits, so this only stays safe because of the Postgres-side
  // advisory-xact-lock + double-checked re-select inside
  // provision_teacher_school, not because of anything in this test.
  const results = await Promise.all(
    Array.from({ length: 8 }, () => resolveOwningSchool(userId, `${SYNTHETIC_MARKER} concurrent`))
  )

  const uniqueSchoolIds = new Set(results.map(r => r.schoolId))
  assert.equal(uniqueSchoolIds.size, 1, 'all 8 concurrent calls must resolve to exactly one school')
  createdSchoolIds.push(...uniqueSchoolIds)

  const { count } = await db.from('schools').select('id', { count: 'exact', head: true }).eq('created_by', userId)
  assert.equal(count, 1, 'exactly one school must have been inserted, despite 8 concurrent callers')

  const { count: membershipCount } = await db
    .from('school_users')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('is_active', true)
  assert.equal(membershipCount, 1, 'exactly one active membership must exist, not one per concurrent call')
})
