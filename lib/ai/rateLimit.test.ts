// lib/ai/rateLimit.test.ts
//
// Daily AI caps (docs/audits/ai-call-efficiency-deep-audit.md F-01). The caps
// used to count ai_call_logs rows that almost no feature ever wrote, so 10 of
// 11 never tripped. These tests prove the reservation model: a unit is
// reserved before the work and counted, a failed operation hands it back, the
// cap refuses at the boundary, concurrent requests can never over-admit, and
// a broken quota store fails open loudly rather than silently.
//
// No real DB: repos.analytics is an in-memory fake of the three quota methods.
//
// Run: npx tsx --experimental-test-module-mocks --test lib/ai/rateLimit.test.ts
import { test, before, beforeEach, mock } from 'node:test'
import assert from 'node:assert/strict'

type Row = { id: string; userId: string; feature: string; success: boolean; reason?: string }
let rows: Row[] = []
let nextId = 0
let failNextCount = false
const errorLogs: string[] = []

mock.module('@/lib/repositories', {
  namedExports: {
    repos: {
      analytics: {
        countQuotaReservations: async (userId: string, feature: string) => {
          if (failNextCount) { failNextCount = false; throw new Error('db down') }
          return rows.filter(r => r.userId === userId && r.feature === feature && r.success).length
        },
        insertQuotaReservation: async (userId: string, feature: string) => {
          const id = `r${++nextId}`
          rows.push({ id, userId, feature, success: true })
          return id
        },
        releaseQuotaReservation: async (id: string, reason: string) => {
          const row = rows.find(r => r.id === id)
          if (row) { row.success = false; row.reason = reason }
        },
      },
    },
  },
})

mock.module('@/lib/observability/logger', {
  namedExports: {
    logger: {
      debug: () => {}, info: () => {}, warn: () => {},
      error: (message: string) => { errorLogs.push(message) },
    },
  },
})

let rl: typeof import('./rateLimit')

before(async () => { rl = await import('./rateLimit') })
beforeEach(() => { rows = []; nextId = 0; failNextCount = false; errorLogs.length = 0 })

function seed(userId: string, feature: string, n: number): void {
  for (let i = 0; i < n; i++) rows.push({ id: `seed${i}`, userId, feature, success: true })
}

test('a reservation under the cap is allowed and writes exactly one counted row', async () => {
  const r = await rl.reserveDailyCall('u1', 'sow_generate')
  assert.equal(r.allowed, true)
  assert.equal(rows.filter(x => x.success).length, 1)
  assert.equal(r.callsToday, 1)
})

test('at the cap the request is refused WITHOUT writing a row', async () => {
  seed('u1', 'sow_generate', rl.DAILY_CALL_LIMITS.sow_generate)
  const before = rows.length
  const r = await rl.reserveDailyCall('u1', 'sow_generate')
  assert.equal(r.allowed, false)
  if (r.allowed === false) assert.match(r.resetAt, /T00:00:00\.000Z$/, 'resets at UTC midnight')
  assert.equal(rows.length, before)
})

test('boundary: the last unit (limit - 1 used) is allowed; the next one is refused', async () => {
  const limit = rl.DAILY_CALL_LIMITS.career_intelligence_report
  seed('u1', 'career_intelligence_report', limit - 1)
  assert.equal((await rl.reserveDailyCall('u1', 'career_intelligence_report')).allowed, true)
  assert.equal((await rl.reserveDailyCall('u1', 'career_intelligence_report')).allowed, false)
})

test('release() hands the unit back — a failed operation does not count', async () => {
  const limit = rl.DAILY_CALL_LIMITS.career_intelligence_report
  seed('u1', 'career_intelligence_report', limit - 1)
  const r = await rl.reserveDailyCall('u1', 'career_intelligence_report')
  assert.equal(r.allowed, true)
  if (r.allowed) await r.release('generation failed')
  assert.equal((await rl.reserveDailyCall('u1', 'career_intelligence_report')).allowed, true, 'the released unit is available again')
})

test('release() is idempotent — a double release cannot free a second, unrelated unit', async () => {
  const r = await rl.reserveDailyCall('u1', 'slides_generate')
  assert.equal(r.allowed, true)
  if (r.allowed) { await r.release('x'); await r.release('x') }
  assert.equal(rows.filter(x => !x.success).length, 1)
})

test('caps are per user and per feature — one feature\'s usage never blocks another', async () => {
  seed('u1', 'sow_generate', rl.DAILY_CALL_LIMITS.sow_generate)
  assert.equal((await rl.reserveDailyCall('u1', 'slides_generate')).allowed, true, 'different feature')
  assert.equal((await rl.reserveDailyCall('u2', 'sow_generate')).allowed, true, 'different user')
})

test('concurrency: N simultaneous requests racing for the last slots never over-admit', async () => {
  const limit = rl.DAILY_CALL_LIMITS.career_intelligence_report // 2
  seed('u1', 'career_intelligence_report', limit - 1)          // exactly one slot left
  const results = await Promise.all(Array.from({ length: 5 }, () => rl.reserveDailyCall('u1', 'career_intelligence_report')))
  const admitted = results.filter(r => r.allowed).length
  assert.ok(admitted <= 1, `at most the one remaining slot may be admitted, got ${admitted}`)
  assert.ok(rows.filter(r => r.success).length <= limit, 'live rows never exceed the cap')
})

test('every capped TokenFeature has a positive limit (nothing silently uncapped)', () => {
  for (const [feature, limit] of Object.entries(rl.DAILY_CALL_LIMITS)) {
    assert.ok(Number.isInteger(limit) && limit > 0, `${feature} must have a positive integer cap`)
  }
})

test('a quota-store failure fails OPEN but is logged as an error, never silent', async () => {
  failNextCount = true
  const r = await rl.reserveDailyCall('u1', 'sow_generate')
  assert.equal(r.allowed, true)
  assert.equal(errorLogs.length, 1)
  assert.match(errorLogs[0], /failing open/)
})

test('reserveDailyCallOrThrow surfaces an exhausted cap as DailyLimitExceededError', async () => {
  seed('u1', 'lesson_plan_generate', rl.DAILY_CALL_LIMITS.lesson_plan_generate)
  await assert.rejects(
    () => rl.reserveDailyCallOrThrow('u1', 'lesson_plan_generate'),
    (err: unknown) => err instanceof rl.DailyLimitExceededError && err.limit === rl.DAILY_CALL_LIMITS.lesson_plan_generate,
  )
})

test('getDailyUsage reports live (counted) units only', async () => {
  seed('u1', 'holiday_plan', 3)
  const r = await rl.reserveDailyCall('u1', 'holiday_plan')
  if (r.allowed) await r.release('failed')
  const usage = await rl.getDailyUsage('u1')
  assert.equal(usage.holiday_plan.callsToday, 3)
  assert.equal(usage.holiday_plan.remaining, rl.DAILY_CALL_LIMITS.holiday_plan - 3)
})
