// lib/sow/generationJob.test.ts
//
// Proves "only the first Scheme of Work is free" is decided by GENERATION
// history, not saved rows. The leak this pins: a teacher who generated and
// downloaded a scheme without saving it stayed at zero saved schemes, so every
// later scheme was their "first" and free. No real DB — repositories mocked.
//
// Run with: npm test -- lib/sow/generationJob.test.ts
import { test, before, beforeEach, mock } from 'node:test'
import assert from 'node:assert/strict'

type Job = { id: string; status: string; created_at: string; started_at: string | null; payload: Record<string, unknown> | null }

let savedCount = 0
let jobs: Job[] = []

mock.module('@/lib/repositories', {
  namedExports: {
    repos: {
      curriculum: { countByTeacher: async (_teacherId: string) => savedCount },
      jobs: {
        listJobsForUser: async (_userId: string, _type: string) => jobs,
        claimForSave: async () => 'claimed',
        releaseSaveClaim: async () => undefined,
      },
    },
  },
})

let countsAsUsedGeneration: typeof import('./generationJob').countsAsUsedGeneration
let isWinningFreeTrial: typeof import('./generationJob').isWinningFreeTrial
let hasUsedFirstScheme: typeof import('./generationJob').hasUsedFirstScheme
let confirmFreeTrialJob: typeof import('./generationJob').confirmFreeTrialJob
// Mirrors STALE_GENERATION_AFTER_MS; asserted equal in before() so it cannot drift.
const STALE_GENERATION_AFTER_MS = 60 * 60 * 1000

before(async () => {
  const mod = await import('./generationJob')
  ;({ countsAsUsedGeneration, isWinningFreeTrial, hasUsedFirstScheme, confirmFreeTrialJob } = mod)
  assert.equal(mod.STALE_GENERATION_AFTER_MS, STALE_GENERATION_AFTER_MS)
})

// Real clock: hasUsedFirstScheme/confirmFreeTrialJob read Date.now() themselves.
const NOW = Date.now()
const iso = (msAgo: number) => new Date(NOW - msAgo).toISOString()
const job = (id: string, status: string, msAgo: number, payload: Record<string, unknown> | null = null): Job =>
  ({ id, status, created_at: iso(msAgo), started_at: iso(msAgo), payload })

beforeEach(() => {
  savedCount = 0
  jobs = []
})

// ── countsAsUsedGeneration ────────────────────────────────────────────────────

test('a completed generation counts as a scheme the teacher has had', () => {
  assert.equal(countsAsUsedGeneration(job('a', 'completed', 5 * 86_400_000), NOW), true)
})

test('an in-flight generation counts — a second click cannot start another free one', () => {
  assert.equal(countsAsUsedGeneration(job('a', 'processing', 60_000), NOW), true)
})

test('a failed generation does not count — the teacher got nothing', () => {
  assert.equal(countsAsUsedGeneration(job('a', 'failed', 60_000), NOW), false)
})

test('a generation stuck in processing past the stale window does not count', () => {
  assert.equal(countsAsUsedGeneration(job('a', 'processing', STALE_GENERATION_AFTER_MS + 1), NOW), false)
})

// ── hasUsedFirstScheme ────────────────────────────────────────────────────────

test('THE LEAK: a generated-but-never-saved scheme uses up the free scheme', async () => {
  savedCount = 0
  jobs = [job('a', 'completed', 86_400_000)]
  assert.equal(await hasUsedFirstScheme('user', 'teacher'), true)
})

test('a brand-new teacher still gets the free scheme', async () => {
  assert.equal(await hasUsedFirstScheme('user', 'teacher'), false)
})

test('a teacher whose only generation failed still gets the free scheme', async () => {
  jobs = [] // failed jobs are excluded by listJobsForUser's status filter
  assert.equal(await hasUsedFirstScheme('user', 'teacher'), false)
})

test('a saved scheme from before the job pipeline still counts', async () => {
  savedCount = 1
  assert.equal(await hasUsedFirstScheme('user', 'teacher'), true)
})

// ── Concurrent free-trial requests ────────────────────────────────────────────

test('of two free-trial generations started together, only the earliest proceeds', () => {
  const trial = { free_trial: true }
  const all = [job('late', 'processing', 1_000, trial), job('early', 'processing', 2_000, trial)]
  assert.equal(isWinningFreeTrial('early', all, NOW), true)
  assert.equal(isWinningFreeTrial('late', all, NOW), false)
})

test('an exact created_at tie is broken by id, so both requests agree on one winner', () => {
  const trial = { free_trial: true }
  const all = [job('b', 'processing', 1_000, trial), job('a', 'processing', 1_000, trial)]
  assert.equal(isWinningFreeTrial('a', all, NOW), true)
  assert.equal(isWinningFreeTrial('b', all, NOW), false)
})

test('confirmFreeTrialJob ignores paid generations when picking the trial winner', async () => {
  jobs = [
    job('paid-earlier', 'completed', 10_000, { total: 2 }),
    job('trial', 'processing', 1_000, { total: 2, free_trial: true }),
  ]
  assert.equal(await confirmFreeTrialJob('user', 'trial'), true)
})

test('confirmFreeTrialJob rejects the second of two concurrent trials', async () => {
  jobs = [
    job('first', 'processing', 2_000, { free_trial: true }),
    job('second', 'processing', 1_000, { free_trial: true }),
  ]
  assert.equal(await confirmFreeTrialJob('user', 'second'), false)
})
