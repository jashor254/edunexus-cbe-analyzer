// app/api/admin/founderOnly.integration.test.ts
//
// Security audit 2026-10-30, F-08: the four endpoints that were gated by a
// shared, guessable ADMIN_SECRET (admin/init, admin/trigger-cleanup,
// admin/cleanup-stats, GET /api/feedback) now require the founder's own
// signed-in session (requireGrowthUser). Exercised through the REAL route
// handlers against a real database; only the request-scoped client factory
// (it needs Next's cookie context) is replaced by a real signed-in or
// anonymous supabase-js client.
//
// The destructive endpoints (trigger-cleanup, init) are only ever called by
// callers who must be REFUSED — nothing here runs a cleanup or grants
// entitlements.
//
// Run with: npm run test:deep (TEST_SUPABASE_* pointed at a disposable stack)
import { test, before, after, mock } from 'node:test'
import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { createClient as createSupabaseJsClient } from '@supabase/supabase-js'
import { createTestServiceClient } from '@/utils/supabase/test-service'
import { deleteAuthUserOrThrow } from '@/lib/testing/deleteAuthUserOrThrow'

const db = createTestServiceClient()
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const ANON_KEY     = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

let currentClient: unknown = null
mock.module('@/utils/supabase/server', { namedExports: { createClient: async () => currentClient } })

type Handler = (req?: Request) => Promise<Response>
let initPost: Handler, triggerPost: Handler, statsGet: Handler, feedbackGet: Handler

const users: string[] = []
let founderEmail: string
let founderClient: unknown
let strangerClient: unknown
const previousFounderEnv = process.env.GROWTH_FOUNDER_EMAIL

async function mkUser(label: string) {
  const email = `founder-only-${label}-${Date.now()}-${randomBytes(3).toString('hex')}-synthetic@example.com`
  const password = `Test!${randomBytes(8).toString('hex')}`
  const { data, error } = await db.auth.admin.createUser({ email, password, email_confirm: true })
  if (error || !data?.user) throw new Error(`user: ${error?.message}`)
  users.push(data.user.id)
  const client = createSupabaseJsClient(SUPABASE_URL, ANON_KEY)
  const { error: signInError } = await client.auth.signInWithPassword({ email, password })
  if (signInError) throw new Error(`signIn: ${signInError.message}`)
  return { email, client }
}

before(async () => {
  const founder = await mkUser('founder')
  founderEmail = founder.email
  founderClient = founder.client
  strangerClient = (await mkUser('stranger')).client
  process.env.GROWTH_FOUNDER_EMAIL = founderEmail

  ;({ POST: initPost } = await import('./init/route'))
  ;({ POST: triggerPost } = await import('./trigger-cleanup/route'))
  ;({ GET: statsGet } = await import('./cleanup-stats/route'))
  ;({ GET: feedbackGet } = await import('../feedback/route'))
})

after(async () => {
  process.env.GROWTH_FOUNDER_EMAIL = previousFounderEnv
  const { error } = await db.from('growth_users').delete().in('id', users)
  if (error) throw new Error(`cleanup growth_users: ${error.message}`)
  for (const id of users) await deleteAuthUserOrThrow(db, id)
})

const anonymous = () => createSupabaseJsClient(SUPABASE_URL, ANON_KEY)
const withOldBearer = () => new Request('http://x', { method: 'POST', headers: { authorization: 'Bearer guessed-admin-secret', 'x-admin-secret': 'guessed-admin-secret' } })

test('with no session every founder endpoint is 401 — a bearer/x-admin-secret header no longer means anything', async () => {
  currentClient = anonymous()
  for (const [name, handler] of [['init', initPost], ['trigger-cleanup', triggerPost], ['cleanup-stats', statsGet], ['feedback GET', feedbackGet]] as const) {
    assert.equal((await handler(withOldBearer())).status, 401, name)
  }
})

test('a signed-in account that is not the founder is 403 on every founder endpoint', async () => {
  currentClient = strangerClient
  for (const [name, handler] of [['init', initPost], ['trigger-cleanup', triggerPost], ['cleanup-stats', statsGet], ['feedback GET', feedbackGet]] as const) {
    assert.equal((await handler(withOldBearer())).status, 403, name)
  }
})

test('the founder session is admitted (read-only endpoints)', async () => {
  currentClient = founderClient
  for (const [name, handler] of [['cleanup-stats', statsGet], ['feedback GET', feedbackGet]] as const) {
    const status = (await handler()).status
    assert.ok(status !== 401 && status !== 403, `${name}: founder refused with ${status}`)
  }
})
