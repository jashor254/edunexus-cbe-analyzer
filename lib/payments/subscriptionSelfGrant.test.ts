// lib/payments/subscriptionSelfGrant.test.ts
//
// Live RLS regression tests for the subscriptions privilege escalation closed
// by supabase/migrations/20260812170000_subscriptions_close_self_grant.sql.
//
// These run against the real database with real anon and authenticated
// clients, because the thing under test IS the database's authorization
// behaviour. A migration that reads correctly is not proof that Postgres
// rejects the write — the pre-fix version of every negative test below
// SUCCEEDED against production.
//
// Run with: npx tsx --env-file=.env.local --test lib/payments/subscriptionSelfGrant.test.ts

import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createClient as createSupabaseJsClient } from '@supabase/supabase-js'
import { createTestServiceClient as createServiceClient } from '@/utils/supabase/test-service'
import { fulfillPayment, creditSubscription } from '@/lib/payments/fulfillment'

const MARKER = 'SYNTHETIC_SUBS_SELFGRANT'
const db = createServiceClient()
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const ANON_KEY     = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const FAR_FUTURE   = new Date(Date.now() + 10 * 365 * 24 * 3600 * 1000).toISOString()

const createdUsers: string[] = []

let attacker: string
let attackerClient: Awaited<ReturnType<typeof signIn>>
let victim: string
let victimSubId: string

async function mkUser(label: string): Promise<{ id: string; email: string; password: string }> {
  const email = `subs-rls-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.com`
  const password = `Test!${Math.random().toString(36).slice(2, 12)}`
  const { data, error } = await db.auth.admin.createUser({ email, password, email_confirm: true })
  if (error || !data?.user) throw new Error(`mkUser: ${error?.message}`)
  createdUsers.push(data.user.id)
  return { id: data.user.id, email, password }
}

async function signIn(email: string, password: string) {
  const client = createSupabaseJsClient(SUPABASE_URL, ANON_KEY)
  const { error } = await client.auth.signInWithPassword({ email, password })
  if (error) throw new Error(`signIn: ${error.message}`)
  return client
}

/** A subscription is only dangerous if checkFeatureAccess would honour it. */
async function activeSubCount(userId: string): Promise<number> {
  const { data } = await db.from('subscriptions')
    .select('id').eq('user_id', userId).eq('status', 'active').gt('expires_at', new Date().toISOString())
  return data?.length ?? 0
}

before(async () => {
  const a = await mkUser('attacker')
  attacker = a.id
  attackerClient = await signIn(a.email, a.password)

  const v = await mkUser('victim')
  victim = v.id
  const { data } = await db.from('subscriptions').insert({
    user_id: victim, plan: 'term', status: 'active',
    expires_at: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
  }).select('id').single()
  victimSubId = data!.id
})

after(async () => {
  for (const id of createdUsers) {
    await db.from('subscriptions').delete().eq('user_id', id)
    await db.from('payments').delete().eq('user_id', id)
    await db.from('token_balances').delete().eq('user_id', id)
    await db.from('teachers').delete().eq('user_id', id)
    await db.auth.admin.deleteUser(id)
  }
})

// ── Negative: INSERT ─────────────────────────────────────────────────────────

test('1. an authenticated user cannot self-insert an active subscription', async () => {
  const { error } = await attackerClient.from('subscriptions').insert({
    user_id: attacker, plan: 'family', status: 'active', expires_at: FAR_FUTURE,
  })
  assert.ok(error, 'the self-grant INSERT succeeded')
  assert.equal(await activeSubCount(attacker), 0)
})

test('2. an authenticated user cannot insert ANY subscription row, even a harmless-looking one', async () => {
  // A row inserted as 'expired' is still an unauthorized billing artifact, and
  // would be one UPDATE away from active if an UPDATE policy ever reappeared.
  const { error } = await attackerClient.from('subscriptions').insert({
    user_id: attacker, plan: 'term', status: 'expired', expires_at: new Date().toISOString(),
  })
  assert.ok(error, 'an authenticated user created a subscription row')
  const { data } = await db.from('subscriptions').select('id').eq('user_id', attacker)
  assert.equal(data?.length ?? 0, 0)
})

test('3. anon cannot insert a subscription', async () => {
  const anon = createSupabaseJsClient(SUPABASE_URL, ANON_KEY)
  const { error } = await anon.from('subscriptions').insert({
    user_id: victim, plan: 'family', status: 'active', expires_at: FAR_FUTURE,
  })
  assert.ok(error, 'anon created a subscription')
})

// ── Negative: UPDATE escalation ──────────────────────────────────────────────

test('4-7. an authenticated user cannot activate, extend, upgrade, or re-own a subscription', async () => {
  // Give the attacker a legitimate, expired, low-value subscription to escalate
  // FROM — the strongest version of the attack.
  const { data: own } = await db.from('subscriptions').insert({
    user_id: attacker, plan: 'term', status: 'expired',
    expires_at: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
  }).select('id').single()

  // 4. status: expired → active
  await attackerClient.from('subscriptions').update({ status: 'active' }).eq('id', own!.id)
  // 5. expires_at: past → far future
  await attackerClient.from('subscriptions').update({ expires_at: FAR_FUTURE }).eq('id', own!.id)
  // 6. plan: term → family (higher value)
  await attackerClient.from('subscriptions').update({ plan: 'family' }).eq('id', own!.id)
  // 7. user_id reassignment
  await attackerClient.from('subscriptions').update({ user_id: victim }).eq('id', own!.id)

  const { data: after } = await db.from('subscriptions')
    .select('user_id, plan, status, expires_at').eq('id', own!.id).single()
  assert.equal(after!.status, 'expired', 'status was escalated to active')
  assert.equal(after!.plan, 'term', 'plan was upgraded')
  assert.ok(new Date(after!.expires_at).getTime() < Date.now(), 'expiry was extended')
  assert.equal(after!.user_id, attacker, 'user_id was reassigned')
  assert.equal(await activeSubCount(attacker), 0)

  await db.from('subscriptions').delete().eq('id', own!.id)
})

test('8. an authenticated user cannot modify another user\'s subscription', async () => {
  await attackerClient.from('subscriptions').update({ plan: 'school' }).eq('id', victimSubId)
  const { data } = await db.from('subscriptions').select('plan').eq('id', victimSubId).single()
  assert.equal(data!.plan, 'term', "another user's subscription was modified")
})

test('9. an authenticated user cannot delete subscriptions', async () => {
  await attackerClient.from('subscriptions').delete().eq('id', victimSubId)
  const { data } = await db.from('subscriptions').select('id').eq('id', victimSubId).maybeSingle()
  assert.ok(data, "another user's subscription was deleted")
})

// ── Negative: the self-declared-admin escalation ─────────────────────────────

test('10. self-declaring teachers.role=admin no longer grants access to subscriptions', async () => {
  // Two independent layers now stand here, and this test asserts BOTH.
  //
  // Layer 1 (added later, by 20260812190000_close_self_declared_admin_escalation):
  // a client can no longer declare itself an admin at all.
  const { error: insErr } = await attackerClient.from('teachers').insert({
    user_id: attacker, full_name: MARKER, school: MARKER, role: 'admin',
  })
  assert.ok(insErr, 'a client self-declared teachers.role=admin')

  // Layer 2 (this migration): even WITH a genuine admin row — planted through
  // the service role, the only way one can now exist — subscriptions does not
  // trust it. This is what makes a pre-existing bad row harmless, and it must
  // keep holding independently of layer 1.
  await db.from('teachers').insert({
    user_id: attacker, full_name: MARKER, school: MARKER, role: 'teacher',
  })
  await db.from('teachers').update({ role: 'admin' }).eq('user_id', attacker)

  // Pre-fix, both of the following succeeded.
  const { data: crossRead } = await attackerClient.from('subscriptions')
    .select('id').eq('user_id', victim)
  assert.equal(crossRead?.length ?? 0, 0, "a self-declared admin read another user's subscription")

  await attackerClient.from('subscriptions').update({ plan: 'school' }).eq('id', victimSubId)
  const { data: afterWrite } = await db.from('subscriptions').select('plan').eq('id', victimSubId).single()
  assert.equal(afterWrite!.plan, 'term', "a self-declared admin modified another user's subscription")

  const { error: selfIns } = await attackerClient.from('subscriptions').insert({
    user_id: attacker, plan: 'family', status: 'active', expires_at: FAR_FUTURE,
  })
  assert.ok(selfIns, 'a self-declared admin self-granted a subscription')

  await db.from('teachers').delete().eq('user_id', attacker)
})

// ── Positive: reads and legitimate writers must still work ───────────────────

test('11. a user can still READ their own subscription (lib/api-protection.ts depends on this)', async () => {
  const v = await mkUser('reader')
  await db.from('subscriptions').insert({
    user_id: v.id, plan: 'term', status: 'active',
    expires_at: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
  })
  const client = await signIn(v.email, v.password)
  const { data, error } = await client.from('subscriptions').select('id, plan, status').eq('user_id', v.id)
  assert.equal(error, null)
  assert.equal(data?.length, 1)
  assert.equal(data![0].plan, 'term')

  // …and still cannot see anyone else's.
  const { data: others } = await client.from('subscriptions').select('id').eq('user_id', victim)
  assert.equal(others?.length ?? 0, 0)
})

test('12. verified payment fulfilment still creates a Term subscription', async () => {
  const u = await mkUser('term-buyer')
  const { data: payment } = await db.from('payments').insert({
    user_id: u.id, product_id: 'term', status: 'pending', amount: 1, transaction_id: `${MARKER}-term-${Date.now()}`,
  }).select('id').single()

  const result = await fulfillPayment(db, { id: payment!.id, user_id: u.id, product_id: 'term' })
  assert.equal(result, 'fulfilled')

  const { data: sub } = await db.from('subscriptions')
    .select('plan, status, payment_id').eq('user_id', u.id).single()
  assert.equal(sub!.plan, 'term')
  assert.equal(sub!.status, 'active')
  assert.equal(sub!.payment_id, payment!.id)
  assert.equal(await activeSubCount(u.id), 1)
})

test('13. verified payment fulfilment still creates a Family subscription', async () => {
  const u = await mkUser('family-buyer')
  const { data: payment } = await db.from('payments').insert({
    user_id: u.id, product_id: 'family', status: 'pending', amount: 1, transaction_id: `${MARKER}-fam-${Date.now()}`,
  }).select('id').single()

  const result = await fulfillPayment(db, { id: payment!.id, user_id: u.id, product_id: 'family' })
  assert.equal(result, 'fulfilled')

  const { data: sub } = await db.from('subscriptions').select('plan, status').eq('user_id', u.id).single()
  assert.equal(sub!.plan, 'family')
  assert.equal(sub!.status, 'active')
})

test('14. authorized admin/manual activation still creates and extends a subscription', async () => {
  const u = await mkUser('admin-activated')
  const { data: p1 } = await db.from('payments').insert({
    user_id: u.id, product_id: 'term', status: 'success', amount: 1, transaction_id: `${MARKER}-adm1-${Date.now()}`,
  }).select('id').single()

  // Same call app/api/admin/activate-user makes, with the same service client.
  await creditSubscription(db, u.id, 'term', p1!.id)
  const { data: created } = await db.from('subscriptions').select('id, expires_at').eq('user_id', u.id).single()
  assert.ok(created)

  const { data: p2 } = await db.from('payments').insert({
    user_id: u.id, product_id: 'term', status: 'success', amount: 1, transaction_id: `${MARKER}-adm2-${Date.now()}`,
  }).select('id').single()
  await creditSubscription(db, u.id, 'term', p2!.id)

  const { data: extended } = await db.from('subscriptions').select('id, expires_at').eq('user_id', u.id).single()
  assert.equal(extended!.id, created!.id, 'renewal created a second row instead of extending')
  assert.ok(new Date(extended!.expires_at).getTime() > new Date(created!.expires_at).getTime(),
    'renewal did not extend the expiry')
})

test('15. a legitimately fulfilled subscriber is recognised by the access layer', async () => {
  const u = await mkUser('access-check')
  const { data: payment } = await db.from('payments').insert({
    user_id: u.id, product_id: 'term', status: 'pending', amount: 1, transaction_id: `${MARKER}-acc-${Date.now()}`,
  }).select('id').single()
  await fulfillPayment(db, { id: payment!.id, user_id: u.id, product_id: 'term' })

  // The exact query checkFeatureAccess() step 6 runs.
  const { repos } = await import('@/lib/repositories')
  const sub = await repos.billing.findActiveSubscription(u.id)
  assert.ok(sub, 'a genuinely paid subscriber is no longer recognised as active')
})
