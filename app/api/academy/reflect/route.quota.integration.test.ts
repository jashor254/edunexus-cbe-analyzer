// app/api/academy/reflect/route.quota.integration.test.ts
//
// Security audit 2026-10-30, F-03 — the AI spending controls on a route that
// previously had none, exercised through the REAL route handler against a
// real database and the real atomic limiter. Only the request-scoped client
// factory (it needs Next's cookie context) and the AI judge itself are
// replaced — the judge with a counter, so the tests can assert how many
// provider calls actually happened:
//   - oversized input is rejected before any provider call or reservation;
//   - the daily cap holds, including under concurrent requests;
//   - a request that produced no genuine judgement does not use a slot.
//
// Run with: npm run test:deep (TEST_SUPABASE_* pointed at a disposable stack)
import { test, before, after, mock } from 'node:test'
import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { createClient as createSupabaseJsClient } from '@supabase/supabase-js'
import { createTestServiceClient } from '@/utils/supabase/test-service'
import { deleteAuthUserOrThrow } from '@/lib/testing/deleteAuthUserOrThrow'

const MARKER = 'SYNTHETIC_REFLECT_QUOTA'
// Mirrors DAILY_CALL_LIMITS.academy_reflection_feedback (lib/ai/rateLimit.ts);
// the 429 assertion below checks the route reports this same number.
const DAILY_CAP = 20
const db = createTestServiceClient()
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const ANON_KEY     = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

let aiCalls = 0
let fallbackMode = false
let currentClient: unknown = null

mock.module('@/utils/supabase/server', { namedExports: { createClient: async () => currentClient } })
mock.module('@/lib/academy/aiJudge', {
  namedExports: {
    scoreReflection: async () => {
      aiCalls++
      return {
        quality_score: 3, feedback_text: 'ok', growth_indicator: 'developing',
        suggested_next_action: 'next', isFallback: fallbackMode,
      }
    },
    scoreMissionComparison: async () => { throw new Error('not used') },
  },
})
mock.module('@/lib/academy/reflections', { namedExports: { upsertReflection: async () => ({ id: 'reflection' }) } })

let POST: (req: Request) => Promise<Response>
let lesson: { id: string; module_id: string }
const userIds: string[] = []
const teacherIds: string[] = []

async function signIn(email: string, password: string) {
  const c = createSupabaseJsClient(SUPABASE_URL, ANON_KEY)
  const { error } = await c.auth.signInWithPassword({ email, password })
  if (error) throw new Error(`signIn: ${error.message}`)
  return c
}

async function mkTeacher(label: string): Promise<{ userId: string; client: Awaited<ReturnType<typeof signIn>> }> {
  const email = `reflect-quota-${label}-${Date.now()}-${randomBytes(3).toString('hex')}-synthetic@example.com`
  const password = `Test!${randomBytes(8).toString('hex')}`
  const { data, error } = await db.auth.admin.createUser({ email, password, email_confirm: true })
  if (error || !data?.user) throw new Error(`user: ${error?.message}`)
  userIds.push(data.user.id)
  const { data: teacher, error: tErr } = await db.from('teachers').insert({ user_id: data.user.id, full_name: `${MARKER} ${label}`, school: MARKER }).select('id').single()
  if (tErr || !teacher) throw new Error(`teacher: ${tErr?.message}`)
  teacherIds.push(teacher.id)
  const { error: pErr } = await db.from('academy_progress').insert({ teacher_id: teacher.id, lesson_id: lesson.id })
  if (pErr) throw new Error(`progress: ${pErr.message}`)
  return { userId: data.user.id, client: await signIn(email, password) }
}

const body = (overrides: Record<string, string> = {}) => JSON.stringify({
  lesson_id: lesson.id, module_id: lesson.module_id,
  tried: 'Group discussion on fractions', worked: 'Learners explained to peers',
  failed: 'Time ran short', surprised: 'Quiet learners spoke up', next_action: 'Shorter intro',
  ...overrides,
})
const post = (payload: string) => POST(new Request('http://x/api/academy/reflect', { method: 'POST', body: payload }))

async function reservations(userId: string): Promise<number> {
  const { data, error } = await db.from('rate_limit_attempts').select('id').eq('subject', userId).eq('bucket', 'ai_daily:academy_reflection_feedback')
  if (error) throw new Error(error.message)
  return data.length
}

before(async () => {
  const { data, error } = await db.from('academy_lessons').select('id, module_id').limit(1).single()
  if (error || !data) throw new Error(`no seeded academy lesson: ${error?.message}`)
  lesson = data
  ;({ POST } = await import('./route'))
})

after(async () => {
  const steps: Array<[string, () => PromiseLike<{ error: { message: string } | null }>]> = [
    ['rate_limit_attempts', () => db.from('rate_limit_attempts').delete().in('subject', userIds)],
    ['academy_progress',    () => db.from('academy_progress').delete().in('teacher_id', teacherIds)],
    ['teachers',            () => db.from('teachers').delete().in('id', teacherIds)],
  ]
  for (const [name, run] of steps) {
    const { error } = await run()
    if (error) throw new Error(`cleanup ${name}: ${error.message}`)
  }
  for (const id of userIds) await deleteAuthUserOrThrow(db, id)
})

test('oversized reflection text is rejected before any provider call or reservation', async () => {
  const t = await mkTeacher('oversize')
  currentClient = t.client
  aiCalls = 0
  const res = await post(body({ tried: 'x'.repeat(2001) }))
  assert.equal(res.status, 400)
  assert.equal(aiCalls, 0)
  assert.equal(await reservations(t.userId), 0)
})

test(`30 concurrent requests against a cap of ${DAILY_CAP} make exactly ${DAILY_CAP} provider calls`, async () => {
  const t = await mkTeacher('concurrent')
  currentClient = t.client
  fallbackMode = false
  aiCalls = 0
  const statuses = (await Promise.all(Array.from({ length: 30 }, () => post(body())))).map(r => r.status)
  assert.equal(statuses.filter(s => s === 200).length, DAILY_CAP)
  assert.equal(statuses.filter(s => s === 429).length, 30 - DAILY_CAP)
  assert.equal(aiCalls, DAILY_CAP)

  const refused = await post(body())
  assert.equal(refused.status, 429)
  assert.match(String((await refused.json()).error), new RegExp(`Daily limit of ${DAILY_CAP} `))
  assert.equal(aiCalls, DAILY_CAP, 'a refused request reached the provider')
})

test('requests that produce no genuine judgement are refunded and never exhaust the cap', async () => {
  const t = await mkTeacher('fallback')
  currentClient = t.client
  fallbackMode = true
  for (let i = 0; i < DAILY_CAP + 5; i++) assert.equal((await post(body())).status, 200)
  assert.equal(await reservations(t.userId), 0)
  fallbackMode = false
})
