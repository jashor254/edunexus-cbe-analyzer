// lib/career/knowledgeRequests.test.ts
//
// Phase 9.1 — proves requestCareerKnowledge()'s new branches: exact-identity
// pre-LLM dedup (no second generation call for an already-queued pending
// slug), the daily rate limit on the AI-generation path only (never on
// canonical slug/title hits or on the dedup-reuse path), and that both a
// successful and a failed generation call get logged (so the rate limit has
// real data to count against — see lib/ai/rateLimit.ts's comment on how it
// reads ai_call_logs). No real DB, no real AI call — everything below the
// module boundary is mocked.
//
// Run with: npx tsx --experimental-test-module-mocks --test lib/career/knowledgeRequests.test.ts
import { test, before, mock } from 'node:test'
import assert from 'node:assert/strict'
import type { Career } from './types'

type GeneratedProfile = Omit<Career, 'id' | 'created_at' | 'updated_at'>

const GENERATED: GeneratedProfile = {
  slug: 'generated-career', title: 'Generated Career', category: 'business',
  description: 'A generated profile', ai_impact: null, ai_impact_level: 'medium',
  kenya_market_outlook: 'x', salary_range_kes: null, pathway: 'Social Sciences',
  required_subjects: [], subject_importance: {}, skill_timeline: [], future_skills: [],
  kenya_examples: null, disclaimer: 'd',
} as unknown as GeneratedProfile

let bySlug: Career | null = null
let byTitle: Career | null = null
let pendingReview: { id: string; request_count: number; payload: Record<string, unknown> | null } | null = null
let generateCalls = 0
let generateShouldThrow = false
let enqueueCalls: unknown[] = []
let incrementCalls: { id: string; count: number }[] = []
let rateLimitAllowed = true
let logCalls: { feature: string; success: boolean }[] = []

mock.module('./careerEngine', {
  namedExports: {
    slugify: (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-'),
    getCareerBySlug: async (_slug: string) => bySlug,
    generateCareerProfile: async (_query: string) => {
      generateCalls++
      if (generateShouldThrow) throw new Error('DeepSeek timeout after 25s')
      return GENERATED
    },
  },
})

mock.module('@/lib/repositories', {
  namedExports: {
    repos: {
      careers: {
        findCareerByTitleLike: async (_q: string) => byTitle,
        findPendingCareerReviewBySlug: async (_slug: string) => pendingReview,
        incrementCareerReviewDemand: async (id: string, count: number) => {
          incrementCalls.push({ id, count })
          return count + 1
        },
        enqueueCareerReview: async (row: unknown) => {
          enqueueCalls.push(row)
          return { queued: true, requestCount: 1 }
        },
      },
    },
  },
})

mock.module('@/lib/ai/rateLimit', {
  namedExports: {
    checkDailyCallLimit: async (_userId: string, _feature: string) =>
      rateLimitAllowed
        ? { allowed: true, callsToday: 0, limit: 5 }
        : { allowed: false, callsToday: 5, limit: 5, resetAt: '2026-01-01T00:00:00.000Z' },
  },
})

mock.module('@/lib/ai/logger', {
  namedExports: {
    logAICall: async (log: { feature: string; success: boolean }) => { logCalls.push(log) },
  },
})

let requestCareerKnowledge: typeof import('./knowledgeRequests').requestCareerKnowledge
before(async () => {
  ;({ requestCareerKnowledge } = await import('./knowledgeRequests'))
})

function resetState() {
  bySlug = null
  byTitle = null
  pendingReview = null
  generateCalls = 0
  generateShouldThrow = false
  enqueueCalls = []
  incrementCalls = []
  rateLimitAllowed = true
  logCalls = []
}

test('a known slug never calls generation, never rate-limits', async () => {
  resetState()
  bySlug = { slug: 'existing-career' } as Career
  const result = await requestCareerKnowledge('existing career', 'user-1')
  assert.equal(result.status, 'known')
  assert.equal(generateCalls, 0)
  assert.equal(enqueueCalls.length, 0)
})

test('a known title never calls generation', async () => {
  resetState()
  byTitle = { slug: 'existing-by-title' } as Career
  const result = await requestCareerKnowledge('Some Existing Title', 'user-1')
  assert.equal(result.status, 'known')
  assert.equal(generateCalls, 0)
})

test('an existing PENDING review is reused — no second LLM call, demand incremented', async () => {
  resetState()
  pendingReview = { id: 'review-1', request_count: 3, payload: GENERATED as unknown as Record<string, unknown> }
  const result = await requestCareerKnowledge('brand new unknown career', 'user-1')
  assert.equal(result.status, 'provisional')
  if (result.status === 'provisional') {
    assert.equal(result.newlyQueued, false)
    assert.equal(result.requestCount, 4)
  }
  assert.equal(generateCalls, 0, 'must not pay for a second generation when a pending draft already exists')
  assert.deepEqual(incrementCalls, [{ id: 'review-1', count: 3 }])
  assert.equal(enqueueCalls.length, 0)
})

test('a genuinely new unknown career generates once, logs success, and enqueues', async () => {
  resetState()
  const result = await requestCareerKnowledge('genuinely novel career', 'user-1')
  assert.equal(result.status, 'provisional')
  if (result.status === 'provisional') assert.equal(result.newlyQueued, true)
  assert.equal(generateCalls, 1)
  assert.equal(enqueueCalls.length, 1)
  assert.equal(logCalls.length, 1)
  assert.equal(logCalls[0].feature, 'career_knowledge_request')
  assert.equal(logCalls[0].success, true)
})

test('rate limit blocks generation but never blocks known/dedup paths', async () => {
  resetState()
  rateLimitAllowed = false
  const result = await requestCareerKnowledge('yet another unknown career', 'user-1')
  assert.equal(result.status, 'rate_limited')
  if (result.status === 'rate_limited') assert.equal(result.resetAt, '2026-01-01T00:00:00.000Z')
  assert.equal(generateCalls, 0, 'must not generate once the daily cap is hit')
  assert.equal(enqueueCalls.length, 0)
  assert.equal(logCalls.length, 0)
})

test('rate limit is only checked once dedup has already missed', async () => {
  resetState()
  rateLimitAllowed = false
  pendingReview = { id: 'review-2', request_count: 1, payload: GENERATED as unknown as Record<string, unknown> }
  const result = await requestCareerKnowledge('unknown career with a pending draft', 'user-1')
  // Dedup reuse must win over the rate limit — reusing an existing draft costs no new AI call.
  assert.equal(result.status, 'provisional')
  assert.equal(generateCalls, 0)
})

test('a generation failure is logged as a failed call and rethrown', async () => {
  resetState()
  generateShouldThrow = true
  await assert.rejects(
    () => requestCareerKnowledge('a career that fails to generate', 'user-1'),
    /DeepSeek timeout/,
  )
  assert.equal(logCalls.length, 1)
  assert.equal(logCalls[0].success, false)
})

test('an unattributed (null) requester skips the rate-limit check but still generates', async () => {
  resetState()
  rateLimitAllowed = false // would block a real user — must not matter here
  const result = await requestCareerKnowledge('system-originated unknown career', null)
  assert.equal(result.status, 'provisional')
  assert.equal(generateCalls, 1)
})
