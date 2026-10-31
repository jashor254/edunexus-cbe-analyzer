// lib/paperIntelligence/markingClaim.test.ts
//
// One whole-script marking pass per submission at a time (markingClaim.ts).
// Paper Intelligence carries no per-paper charge or quota, so this is an
// operational guard on EduNexus' own AI cost, not a commercial limit.
//
// No DB: repos.jobs is an in-memory fake of the claim rows.
//
// Run: npx tsx --experimental-test-module-mocks --test lib/paperIntelligence/markingClaim.test.ts
import { test, before, beforeEach, mock } from 'node:test'
import assert from 'node:assert/strict'

type Row = { id: string; created_at: string; status: string; submission: string }
let rows: Row[] = []
let seq = 0
let failInsert = false

mock.module('@/lib/repositories', {
  namedExports: {
    repos: {
      jobs: {
        insertProcessingClaim: async (input: { payload: { submission_id: string } }) => {
          if (failInsert) throw new Error('db down')
          seq++
          const row = { id: `j${String(seq).padStart(3, '0')}`, created_at: new Date(Date.now() + seq).toISOString(), status: 'processing', submission: input.payload.submission_id }
          rows.push(row)
          return { id: row.id, created_at: row.created_at }
        },
        listProcessingJobsForResource: async (_t: string, _k: string, value: string) =>
          rows.filter(r => r.submission === value && r.status === 'processing'),
        updateProgress: async (id: string, patch: { status?: string }) => {
          const r = rows.find(x => x.id === id)
          if (r && patch.status) r.status = patch.status
        },
      },
    },
  },
})
mock.module('@/lib/observability/logger', { namedExports: { logger: { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} } } })

let mod: typeof import('./markingClaim')
before(async () => { mod = await import('./markingClaim') })
beforeEach(() => { rows = []; seq = 0; failInsert = false })

test('isWinningClaim: earliest live claim wins; id breaks a timestamp tie', () => {
  const now = Date.parse('2026-10-30T08:01:00Z')
  const a = { id: 'b', created_at: '2026-10-30T08:00:10Z' }
  const b = { id: 'a', created_at: '2026-10-30T08:00:10Z' }
  const c = { id: 'c', created_at: '2026-10-30T08:00:20Z' }
  assert.equal(mod.isWinningClaim('a', [a, b, c], now), true)
  assert.equal(mod.isWinningClaim('b', [a, b, c], now), false)
  assert.equal(mod.isWinningClaim('c', [a, b, c], now), false)
})

test('isWinningClaim: a dead (expired) claim never blocks a new pass', () => {
  const now = Date.parse('2026-10-30T08:10:00Z')
  const dead = { id: 'old', created_at: '2026-10-30T08:00:00Z' } // 10 min ago > TTL
  const fresh = { id: 'new', created_at: '2026-10-30T08:09:59Z' }
  assert.equal(mod.isWinningClaim('new', [dead, fresh], now), true)
})

test('the TTL outlives the mark-script route\'s 120s maxDuration', () => {
  assert.ok(mod.MARKING_CLAIM_TTL_MS > 120_000)
})

test('a lone request claims; a second request while it runs is refused', async () => {
  const first = await mod.claimScriptMarking('sub-1', 'u1')
  assert.equal(first.claimed, true)
  const second = await mod.claimScriptMarking('sub-1', 'u2')
  assert.equal(second.claimed, false, 'a co-teacher cannot start a parallel pass either')
  assert.equal(rows.find(r => r.id === 'j002')?.status, 'failed', 'the refused claim is closed, not left processing')
})

test('after release, the script can be marked again (re-mark after a retaken page)', async () => {
  const first = await mod.claimScriptMarking('sub-1', 'u1')
  if (first.claimed) await first.release('completed')
  assert.equal((await mod.claimScriptMarking('sub-1', 'u1')).claimed, true)
})

test('different submissions never block each other (a class batch marks in parallel)', async () => {
  assert.equal((await mod.claimScriptMarking('sub-1', 'u1')).claimed, true)
  assert.equal((await mod.claimScriptMarking('sub-2', 'u1')).claimed, true)
})

test('N concurrent requests for one submission: exactly one proceeds', async () => {
  const results = await Promise.all(Array.from({ length: 5 }, () => mod.claimScriptMarking('sub-9', 'u1')))
  assert.equal(results.filter(r => r.claimed).length, 1)
})

test('claim store failure fails open (marking proceeds) rather than blocking a teacher', async () => {
  failInsert = true
  assert.equal((await mod.claimScriptMarking('sub-1', 'u1')).claimed, true)
})
