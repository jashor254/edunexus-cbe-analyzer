// lib/security/attemptLimiter.test.ts
//
// The application side of the shared attempt limiter: it must FAIL CLOSED
// (a database error is an exception, never "allowed"), map the RPC's
// null/uuid contract faithfully, and send only server-derived values. The
// database's own atomicity and access control are proven in
// attemptLimiter.integration.test.ts against a real stack.
//
// Run with: npx tsx --test lib/security/attemptLimiter.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  reserveAttempt, releaseAttempt, rollingWindowStart, AttemptLimiterUnavailableError,
} from './attemptLimiter'

type Db = NonNullable<NonNullable<Parameters<typeof reserveAttempt>[1]>['db']>

function rpcDb(response: { data: unknown; error: { message: string } | null }) {
  const calls: Array<{ fn: string; args: Record<string, unknown> }> = []
  const db = { async rpc(fn: string, args: Record<string, unknown>) { calls.push({ fn, args }); return response } }
  return { db: db as unknown as Db, calls }
}

const INPUT = { bucket: 'test_bucket', subject: 'user-1', limit: 10, since: new Date('2026-10-30T11:00:00Z') }

test('a granted reservation returns its id', async () => {
  const { db, calls } = rpcDb({ data: 'res-1', error: null })
  assert.deepEqual(await reserveAttempt(INPUT, { db }), { id: 'res-1' })
  assert.deepEqual(calls, [{
    fn: 'rate_limit_reserve',
    args: { p_bucket: 'test_bucket', p_subject: 'user-1', p_limit: 10, p_since: '2026-10-30T11:00:00.000Z' },
  }])
})

test('a subject at its limit gets null (refused), not an exception', async () => {
  const { db } = rpcDb({ data: null, error: null })
  assert.equal(await reserveAttempt(INPUT, { db }), null)
})

test('a limiter database error fails CLOSED with AttemptLimiterUnavailableError', async () => {
  const { db } = rpcDb({ data: null, error: { message: 'connection refused' } })
  await assert.rejects(reserveAttempt(INPUT, { db }), AttemptLimiterUnavailableError)
})

test('an unexpected RPC payload is treated as refused, never as granted', async () => {
  for (const data of [true, 1, { id: 'x' }, undefined]) {
    const { db } = rpcDb({ data, error: null })
    assert.equal(await reserveAttempt(INPUT, { db }), null, JSON.stringify(data))
  }
})

test('release refunds by reservation id and does not throw on failure', async () => {
  const ok = rpcDb({ data: null, error: null })
  await releaseAttempt({ id: 'res-1' }, { db: ok.db })
  assert.deepEqual(ok.calls, [{ fn: 'rate_limit_release', args: { p_id: 'res-1' } }])

  const failing = rpcDb({ data: null, error: { message: 'timeout' } })
  await releaseAttempt({ id: 'res-2' }, { db: failing.db })
})

test('rollingWindowStart is exactly windowMs before now', () => {
  const now = new Date('2026-10-30T12:00:00Z')
  assert.equal(rollingWindowStart(60 * 60 * 1000, now).toISOString(), '2026-10-30T11:00:00.000Z')
})
