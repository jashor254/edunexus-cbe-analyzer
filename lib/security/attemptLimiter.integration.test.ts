// lib/security/attemptLimiter.integration.test.ts
//
// The shared attempt limiter (supabase/migrations/20261030121000_rate_limit_
// attempts.sql) against a real database: the limit holds, it holds under
// CONCURRENT reservations (the property an application-side count-then-
// insert cannot give), refunds work, the window prunes, and no client role
// can call it, read it, or forge rows in it.
//
// Run with: npm run test:deep (TEST_SUPABASE_* pointed at a disposable stack)
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { createClient as createSupabaseJsClient } from '@supabase/supabase-js'
import { createTestServiceClient } from '@/utils/supabase/test-service'
import { reserveAttempt, releaseAttempt, rollingWindowStart } from '@/lib/security/attemptLimiter'
import { deleteAuthUserOrThrow } from '@/lib/testing/deleteAuthUserOrThrow'

const BUCKET = `synthetic_limiter_${randomBytes(4).toString('hex')}`
const HOUR = 60 * 60 * 1000
const db = createTestServiceClient()
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const ANON_KEY     = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

const subject = (label: string) => `${label}-${randomBytes(4).toString('hex')}`
const since = () => rollingWindowStart(HOUR)

async function countRows(s: string): Promise<number> {
  const { data, error } = await db.from('rate_limit_attempts').select('id').eq('bucket', BUCKET).eq('subject', s)
  if (error) throw new Error(`countRows: ${error.message}`)
  return data.length
}

let userId: string
let authedClient: ReturnType<typeof createSupabaseJsClient>

before(async () => {
  const email = `limiter-${Date.now()}-${randomBytes(3).toString('hex')}-synthetic@example.com`
  const password = `Test!${randomBytes(8).toString('hex')}`
  const { data, error } = await db.auth.admin.createUser({ email, password, email_confirm: true })
  if (error || !data?.user) throw new Error(`user fixture: ${error?.message}`)
  userId = data.user.id
  authedClient = createSupabaseJsClient(SUPABASE_URL, ANON_KEY)
  const { error: signInError } = await authedClient.auth.signInWithPassword({ email, password })
  if (signInError) throw new Error(`signIn: ${signInError.message}`)
})

after(async () => {
  const { error } = await db.from('rate_limit_attempts').delete().like('bucket', 'synthetic_limiter_%')
  if (error) throw new Error(`cleanup: ${error.message}`)
  if (userId) await deleteAuthUserOrThrow(db, userId)
})

test('reservations are granted up to the limit, then refused', async () => {
  const s = subject('seq')
  for (let i = 0; i < 3; i++) assert.ok(await reserveAttempt({ bucket: BUCKET, subject: s, limit: 3, since: since() }, { db }))
  assert.equal(await reserveAttempt({ bucket: BUCKET, subject: s, limit: 3, since: since() }, { db }), null)
  assert.equal(await countRows(s), 3)
})

test('25 concurrent reservations against a limit of 10 grant exactly 10', async () => {
  const s = subject('concurrent')
  const results = await Promise.all(
    Array.from({ length: 25 }, () => reserveAttempt({ bucket: BUCKET, subject: s, limit: 10, since: since() }, { db }))
  )
  assert.equal(results.filter(Boolean).length, 10)
  assert.equal(await countRows(s), 10)
})

test('a released reservation frees exactly one slot', async () => {
  const s = subject('release')
  const first = await reserveAttempt({ bucket: BUCKET, subject: s, limit: 2, since: since() }, { db })
  assert.ok(await reserveAttempt({ bucket: BUCKET, subject: s, limit: 2, since: since() }, { db }))
  assert.equal(await reserveAttempt({ bucket: BUCKET, subject: s, limit: 2, since: since() }, { db }), null)
  await releaseAttempt(first!, { db })
  assert.ok(await reserveAttempt({ bucket: BUCKET, subject: s, limit: 2, since: since() }, { db }))
  assert.equal(await reserveAttempt({ bucket: BUCKET, subject: s, limit: 2, since: since() }, { db }), null)
})

test('rows older than the window no longer count, and are pruned', async () => {
  const s = subject('window')
  const old = new Date(Date.now() - 2 * HOUR).toISOString()
  const { error } = await db.from('rate_limit_attempts').insert([
    { bucket: BUCKET, subject: s, created_at: old }, { bucket: BUCKET, subject: s, created_at: old },
  ])
  if (error) throw new Error(`seed old rows: ${error.message}`)
  assert.ok(await reserveAttempt({ bucket: BUCKET, subject: s, limit: 1, since: since() }, { db }))
  assert.equal(await countRows(s), 1, 'expired rows were not pruned')
})

test('subjects and buckets are isolated from each other', async () => {
  const a = subject('iso-a'), b = subject('iso-b')
  assert.ok(await reserveAttempt({ bucket: BUCKET, subject: a, limit: 1, since: since() }, { db }))
  assert.equal(await reserveAttempt({ bucket: BUCKET, subject: a, limit: 1, since: since() }, { db }), null)
  assert.ok(await reserveAttempt({ bucket: BUCKET, subject: b, limit: 1, since: since() }, { db }))
  assert.ok(await reserveAttempt({ bucket: `${BUCKET}_other`, subject: a, limit: 1, since: since() }, { db }))
})

test('invalid arguments are rejected by the database', async () => {
  for (const args of [
    { p_bucket: '', p_subject: 's', p_limit: 1, p_since: since().toISOString() },
    { p_bucket: BUCKET, p_subject: 's', p_limit: 0, p_since: since().toISOString() },
    { p_bucket: BUCKET, p_subject: 's', p_limit: 1, p_since: new Date(Date.now() + HOUR).toISOString() },
  ]) {
    const { error } = await db.rpc('rate_limit_reserve', args)
    assert.ok(error, JSON.stringify(args))
  }
})

test('anon and signed-in clients cannot call the limiter functions', async () => {
  const anon = createSupabaseJsClient(SUPABASE_URL, ANON_KEY)
  for (const client of [anon, authedClient]) {
    const reserve = await client.rpc('rate_limit_reserve', { p_bucket: BUCKET, p_subject: userId, p_limit: 1000, p_since: since().toISOString() })
    assert.ok(reserve.error, 'client could reserve')
    const release = await client.rpc('rate_limit_release', { p_id: '00000000-0000-4000-8000-000000000000' })
    assert.ok(release.error, 'client could release')
  }
})

test('anon and signed-in clients cannot read, forge, or delete limiter rows', async () => {
  const s = subject('client-access')
  assert.ok(await reserveAttempt({ bucket: BUCKET, subject: s, limit: 5, since: since() }, { db }))
  const anon = createSupabaseJsClient(SUPABASE_URL, ANON_KEY)
  for (const client of [anon, authedClient]) {
    const read = await client.from('rate_limit_attempts').select('id')
    assert.equal((read.data ?? []).length, 0, 'client read limiter rows')
    const forged = await client.from('rate_limit_attempts').insert({ bucket: BUCKET, subject: s })
    assert.ok(forged.error, 'client inserted a limiter row')
    await client.from('rate_limit_attempts').delete().eq('subject', s)
  }
  assert.equal(await countRows(s), 1, 'a client changed limiter rows')
})
