// lib/ai/rateLimit.test.ts
//
// Security audit 2026-10-30, F-03 / F-13 — the daily AI caps' own contract,
// with the shared limiter mocked:
//   - every feature has a positive cap (the old ai_call_logs counter silently
//     enforced nothing for 12 of 14 features);
//   - the check RESERVES a slot in the feature's bucket for the current UTC day;
//   - a limiter failure propagates (fails closed) — never "allowed";
//   - a refund only ever releases a slot that was actually granted.
// Atomicity under concurrency is proven against a real database in
// app/api/academy/reflect/route.quota.integration.test.ts.
//
// Run with: npx tsx --experimental-test-module-mocks --test lib/ai/rateLimit.test.ts
import { test, before, beforeEach, mock } from 'node:test'
import assert from 'node:assert/strict'

class FakeUnavailable extends Error {}
type Reserve = { bucket: string; subject: string; limit: number; since: Date }
let reserveCalls: Reserve[] = []
let released: string[] = []
let reserveResult: { id: string } | null | Error = { id: 'res-1' }
let counts: Record<string, number> = {}

mock.module('@/lib/security/attemptLimiter', {
  namedExports: {
    reserveAttempt: async (input: Reserve) => {
      reserveCalls.push(input)
      if (reserveResult instanceof Error) throw reserveResult
      return reserveResult
    },
    releaseAttempt: async (r: { id: string }) => { released.push(r.id) },
    countAttempts: async () => counts,
    AttemptLimiterUnavailableError: FakeUnavailable,
  },
})

let mod: typeof import('./rateLimit')
before(async () => { mod = await import('./rateLimit') })
beforeEach(() => { reserveCalls = []; released = []; reserveResult = { id: 'res-1' }; counts = {} })

const midnightUtc = () => { const d = new Date(); d.setUTCHours(0, 0, 0, 0); return d }

test('every feature has a positive, finite daily cap', () => {
  for (const [feature, limit] of Object.entries(mod.DAILY_CALL_LIMITS)) {
    assert.ok(Number.isInteger(limit) && limit > 0, `${feature}: ${limit}`)
  }
})

test('a check reserves one slot in the feature bucket, keyed by user, for the current UTC day', async () => {
  const result = await mod.checkDailyCallLimit('user-1', 'teaching_quick_check')
  assert.deepEqual(result, { allowed: true, limit: mod.DAILY_CALL_LIMITS.teaching_quick_check, reservation: { id: 'res-1' } })
  assert.equal(reserveCalls.length, 1)
  assert.equal(reserveCalls[0].bucket, 'ai_daily:teaching_quick_check')
  assert.equal(reserveCalls[0].subject, 'user-1')
  assert.equal(reserveCalls[0].limit, mod.DAILY_CALL_LIMITS.teaching_quick_check)
  assert.equal(reserveCalls[0].since.toISOString(), midnightUtc().toISOString())
})

test('a full day is refused with the next UTC midnight as resetAt', async () => {
  reserveResult = null
  const result = await mod.checkDailyCallLimit('user-1', 'sow_generate')
  const tomorrow = midnightUtc(); tomorrow.setUTCDate(tomorrow.getUTCDate() + 1)
  assert.deepEqual(result, { allowed: false, limit: mod.DAILY_CALL_LIMITS.sow_generate, resetAt: tomorrow.toISOString() })
})

test('a limiter failure fails closed: the check throws, it never reports allowed', async () => {
  reserveResult = new FakeUnavailable('db down')
  await assert.rejects(mod.checkDailyCallLimit('user-1', 'learning_compass'), FakeUnavailable)
})

test('releaseDailyCall refunds a granted slot and is a no-op for a refused one', async () => {
  await mod.releaseDailyCall({ allowed: true, limit: 5, reservation: { id: 'res-9' } })
  await mod.releaseDailyCall({ allowed: false, limit: 5, resetAt: 'x' })
  assert.deepEqual(released, ['res-9'])
})

test('getDailyUsage reports the same reservations the cap enforces against', async () => {
  counts = { 'ai_daily:sow_generate': 3, 'ai_daily:paper_script_marking': 300 }
  const usage = await mod.getDailyUsage('user-1')
  assert.deepEqual(usage.sow_generate, { callsToday: 3, limit: mod.DAILY_CALL_LIMITS.sow_generate, remaining: mod.DAILY_CALL_LIMITS.sow_generate - 3 })
  assert.deepEqual(usage.paper_script_marking, { callsToday: 300, limit: 300, remaining: 0 })
  assert.equal(usage.holiday_plan.callsToday, 0)
})
