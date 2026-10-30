// lib/growth/growthUsersEscalation.integration.test.ts
//
// Pre-deployment audit 2026-10-30, AUDIT-F16 (pre-existing, found while
// verifying F-08): a signed-in user must NOT be able to self-register as a
// Growth OS user by inserting a growth_users row. That row flips
// is_growth_user() to true, which is the whole RLS predicate on every
// growth_* table, so the escalation grants read/write of the founder's sales
// CRM directly over PostgREST.
//
// Closed by supabase/migrations/20261030125000_growth_users_close_self_insert.sql.
// Against the pre-migration schema the first two assertions below FAIL (the
// self-insert succeeds and the stranger reads growth_schools).
//
// Run with: npm run test:deep (TEST_SUPABASE_* pointed at a disposable stack)
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { createClient as createSupabaseJsClient } from '@supabase/supabase-js'
import { createTestServiceClient } from '@/utils/supabase/test-service'
import { deleteAuthUserOrThrow } from '@/lib/testing/deleteAuthUserOrThrow'

const MARKER = 'SYNTHETIC_GROWTH_ESCALATION'
const db = createTestServiceClient()
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const ANON_KEY     = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

async function signInUser(label: string) {
  const email = `growth-esc-${label}-${Date.now()}-${randomBytes(3).toString('hex')}-synthetic@example.com`
  const password = `Test!${randomBytes(8).toString('hex')}`
  const { data, error } = await db.auth.admin.createUser({ email, password, email_confirm: true })
  if (error || !data?.user) throw new Error(`mkUser: ${error?.message}`)
  const client = createSupabaseJsClient(SUPABASE_URL, ANON_KEY)
  const { error: signInError } = await client.auth.signInWithPassword({ email, password })
  if (signInError) throw new Error(`signIn: ${signInError.message}`)
  return { id: data.user.id, client }
}

const userIds: string[] = []
let attacker: Awaited<ReturnType<typeof signInUser>>
let seededSchoolId: string | null = null

before(async () => {
  attacker = await signInUser('attacker')
  userIds.push(attacker.id)
  // A CRM row the escalation would expose, if growth_schools accepts this shape.
  const { data, error } = await db.from('growth_schools')
    .insert({ name: `${MARKER} prospect`, county: 'Kirinyaga', stage: 'discovered' })
    .select('id').single()
  if (error) console.error(`[audit-f16] growth_schools fixture skipped: ${error.message}`)
  else seededSchoolId = data.id
})

after(async () => {
  if (seededSchoolId) await db.from('growth_schools').delete().eq('id', seededSchoolId)
  await db.from('growth_users').delete().in('id', userIds)
  for (const id of userIds) await deleteAuthUserOrThrow(db, id)
})

test('a signed-in non-founder cannot self-register as a Growth OS user', async () => {
  const { error } = await attacker.client.from('growth_users').insert({ id: attacker.id, full_name: 'not the founder' })
  assert.ok(error, 'growth_users self-insert was accepted')
  const { data } = await db.from('growth_users').select('id').eq('id', attacker.id)
  assert.equal((data ?? []).length, 0, 'an attacker growth_users row exists')
})

test('without that row, is_growth_user() stays false and the CRM is not readable', async (t) => {
  if (!seededSchoolId) return t.skip('growth_schools fixture unavailable on this schema')
  const { data } = await attacker.client.from('growth_schools').select('id').limit(5)
  assert.equal((data ?? []).length, 0, 'attacker read growth_schools without being a registered growth user')
})

test('the service role can still register the founder (legitimate bootstrap unaffected)', async () => {
  const { error } = await db.from('growth_users').insert({ id: attacker.id, full_name: 'founder bootstrap' })
  assert.equal(error, null, 'service-role growth_users insert was blocked')
  await db.from('growth_users').delete().eq('id', attacker.id)
})
