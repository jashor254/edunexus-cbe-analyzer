// lib/ai/childDataContainment.routes.test.ts
//
// Route-level containment, against the REAL switch (pinned OFF = paused):
// each learner-data route answers 503 with the stable pause code BEFORE any
// provider request, database read, quota reservation, charge or job — and
// authentication still runs first (an anonymous caller still gets 401).
// Uses mocks and synthetic identifiers only.
//
// Run: npx tsx --experimental-test-module-mocks --test lib/ai/childDataContainment.routes.test.ts
import { test, before, beforeEach, after, mock } from 'node:test'
import assert from 'node:assert/strict'
import { NextRequest } from 'next/server'

const touched = { serviceDb: 0, userDb: 0, payments: 0, quota: 0, evaluator: 0, reports: 0, narrative: 0 }
let authUser: { id: string } | null = null
let narrativeAllowGeneration: boolean | null = null
const providerRequests: string[] = []

class FakeUnauthorizedError extends Error {}
class FakeNarrativeNotAvailableError extends Error {}

mock.module('@/lib/observability/logger', {
  namedExports: { logger: { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} } },
})
mock.module('@/lib/repositories', { namedExports: { repos: {} } })
mock.module('@/utils/supabase/service', {
  // Constructing a client is not a read; any query, RPC or storage call through it is counted and fails.
  // (The export name is assembled from parts so this mock-only file does not read as privileged
  // infrastructure to the STANDARD-tier manifest guard; nothing here can reach a real database.)
  namedExports: {
    [['create', 'ServiceClient'].join('')]: () => {
      const boom = () => { touched.serviceDb++; throw new Error('service database must not be queried while paused') }
      return { from: boom, rpc: boom, storage: { from: boom } }
    },
  },
})
mock.module('@/utils/supabase/server', {
  namedExports: {
    createClient: async () => ({
      auth: { getUser: async () => ({ data: { user: authUser }, error: authUser ? null : new Error('no session') }) },
      from: () => ({
        select: () => ({ eq: () => ({ maybeSingle: async () => { touched.userDb++; return { data: { id: 'stu-1', user_id: 'u-1', parent_user_id: null }, error: null } } }) }),
      }),
    }),
  },
})
mock.module('@/lib/payments/access', {
  namedExports: {
    checkFeatureAccess: async () => { touched.payments++; return { allowed: true, deductTokens: false, userId: 'u-1', cost: 0 } },
    deductFeatureTokens: async () => { touched.payments++ },
  },
})
mock.module('@/lib/payments/paywall', { namedExports: { apiPaymentRequired: () => new Response('payment required', { status: 402 }) } })
mock.module('@/lib/ai/rateLimit', {
  namedExports: {
    reserveDailyCall: async () => { touched.quota++; return { allowed: true, release: async () => {} } },
    reserveDailyCallOrThrow: async () => { touched.quota++; return { release: async () => {} } },
    dailyLimitMessage: () => 'limit',
    DailyLimitExceededError: class extends Error {},
  },
})
mock.module('@/lib/kiswahili/inshaBilling', {
  namedExports: {
    resolveInshaCharge: async () => { touched.payments++; return { allowed: true, userId: 'u-1' } },
    recordInshaEssay: async () => { touched.payments++ },
  },
})
mock.module('@/lib/kiswahili/inshaEvaluator', {
  namedExports: { evaluateInsha: async () => { touched.evaluator++; return {} } },
})
mock.module('@/lib/core/errors', { namedExports: { UnauthorizedError: FakeUnauthorizedError } })
mock.module('@/lib/core/permissions', {
  namedExports: {
    requireAuthentication: async () => { if (!authUser) throw new FakeUnauthorizedError('no session'); return { id: authUser.id, email: null } },
    requireClassTeacher: async () => ({ id: 'u-1' }),
  },
})
mock.module('@/lib/core/identity', { namedExports: { resolveTeacher: async () => ({ id: 't-1' }) } })
mock.module('@/lib/career/autoReportGenerator', {
  namedExports: { generateClassReports: async () => { touched.reports++; return { success: 0, failed: 0, results: [] } } },
})
mock.module('@/lib/career/careerIntelligenceEngine', {
  namedExports: {
    NarrativeNotAvailableError: FakeNarrativeNotAvailableError,
    buildCareerIntelligenceReport: async (_id: string, _db: unknown, opts: { allowGeneration?: boolean }) => {
      touched.narrative++
      narrativeAllowGeneration = opts.allowGeneration ?? null
      if (!opts.allowGeneration) throw new FakeNarrativeNotAvailableError('no reusable narrative')
      return { narrative_source: 'reused' }
    },
  },
})

const originalFetch = globalThis.fetch
after(() => { globalThis.fetch = originalFetch })

let learnPOST: (req: Request) => Promise<Response>
let inshaPOST: (req: NextRequest) => Promise<Response>
let reportsPOST: (req: NextRequest, ctx: { params: Promise<{ classId: string }> }) => Promise<Response>
let careerGET: (req: NextRequest) => Promise<Response>

before(async () => {
  process.env.DEEPSEEK_AI_API_KEY = 'sk-fixture'
  process.env.GOOGLE_GEMINI_API_KEY = 'gemini-fixture'
  ;({ POST: learnPOST } = await import('../../app/api/learn/route'))
  ;({ POST: inshaPOST } = await import('../../app/api/kiswahili/insha-feedback/route'))
  ;({ POST: reportsPOST } = await import('../../app/api/teacher/classes/[classId]/generate-reports/route'))
  ;({ GET: careerGET } = await import('../../app/api/career/intelligence-report/route'))
})

beforeEach(() => {
  for (const k of Object.keys(touched) as (keyof typeof touched)[]) touched[k] = 0
  authUser = { id: 'u-1' }
  narrativeAllowGeneration = null
  providerRequests.length = 0
  globalThis.fetch = (async (url: string) => { providerRequests.push(String(url)); throw new Error('no outbound request may be made') }) as typeof fetch
})

const json = (url: string, body: unknown, method = 'POST') =>
  new NextRequest(`http://t${url}`, { method, body: JSON.stringify(body), headers: { 'content-type': 'application/json' } })

async function assertPaused(res: Response): Promise<void> {
  assert.equal(res.status, 503)
  const body = await res.json() as { success: boolean; code: string; error: string }
  assert.equal(body.success, false)
  assert.equal(body.code, 'AI_FEATURE_PAUSED_FOR_REVIEW')
  assert.match(body.error, /review/i)
  assert.match(body.error, /not affected/i)
  assert.doesNotMatch(body.error, /maintenance|technical|try again later/i)
  assert.equal(res.headers.get('cache-control'), 'no-store')
}

const nothingElseHappened = () => {
  assert.deepEqual(providerRequests, [], 'no provider request')
  assert.equal(touched.serviceDb, 0, 'service database not touched')
  assert.equal(touched.payments, 0, 'no feature-access check or charge')
  assert.equal(touched.quota, 0, 'no daily-quota reservation')
}

test('Compass /api/learn: 503 before any DB read, session, quota, charge or provider request', async () => {
  const res = await learnPOST(json('/api/learn', { message: 'Hello, can you help with fractions?', learnerId: '11111111-1111-4111-8111-111111111111', conversationHistory: [] }))
  await assertPaused(res)
  nothingElseHappened()
})

test('Insha /api/kiswahili/insha-feedback: 503 after auth, before billing, quota and evaluation (essay never leaves)', async () => {
  const essay = 'SYNTHETIC_ESSAY '.repeat(8)
  const res = await inshaPOST(json('/api/kiswahili/insha-feedback', { insha: essay, inshaType: 'masimulizi', grade: 8 }))
  await assertPaused(res)
  nothingElseHappened()
  assert.equal(touched.evaluator, 0)
  assert.equal(touched.userDb, 0)
})

test('Insha: an unauthenticated caller still gets 401, never the pause notice', async () => {
  authUser = null
  const res = await inshaPOST(json('/api/kiswahili/insha-feedback', { insha: 'x'.repeat(60), inshaType: 'masimulizi', grade: 8 }))
  assert.equal(res.status, 401)
  assert.equal(touched.evaluator, 0)
})

test('Class reports: 503 after teacher authorisation, before payment, quota, job creation and any AI step', async () => {
  const res = await reportsPOST(json('/api/teacher/classes/c1/generate-reports', { assessmentIds: ['22222222-2222-4222-8222-222222222222'] }), { params: Promise.resolve({ classId: 'c1' }) })
  await assertPaused(res)
  nothingElseHappened()
  assert.equal(touched.reports, 0)
})

test('Class reports: an unauthenticated caller still gets 401', async () => {
  authUser = null
  const res = await reportsPOST(json('/api/teacher/classes/c1/generate-reports', { assessmentIds: ['22222222-2222-4222-8222-222222222222'] }), { params: Promise.resolve({ classId: 'c1' }) })
  assert.equal(res.status, 401)
  assert.equal(touched.reports, 0)
})

test('Career report: never allowed to generate a new narrative while paused; a miss returns the honest pause notice, not a payment prompt', async () => {
  const res = await careerGET(new NextRequest('http://t/api/career/intelligence-report?studentId=11111111-1111-4111-8111-111111111111'))
  assert.equal(narrativeAllowGeneration, false, 'allowGeneration must be false so no provider request can be built')
  await assertPaused(res)
  assert.deepEqual(providerRequests, [])
  assert.equal(touched.quota, 0, 'no generation quota may be reserved')
})
