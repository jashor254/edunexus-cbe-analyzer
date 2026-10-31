// lib/ai/requestBudget.test.ts
//
// Provider request budgets (docs/audits/ai-call-efficiency-deep-audit.md
// F-04/F-12). Counts REAL provider requests at the transport boundary
// (global fetch — the Gemini SDK uses it too, see deepseekWrapperContract)
// through the real, unmodified wrappers and router.
//
//   routedCompletion: each chain entry is one provider → max 3 requests per
//     logical call (it was 6: both entries called the full callDeepSeek chain).
//   callDeepSeek: 429/5xx now fall back to Gemini (once), never retried.
//   Gemini: a 20s timeout really aborts the HTTP request.
//   Telemetry: one 'AI provider request' line per request, attributed to the
//     caller's feature, sharing one logical_call_id, never carrying content.
//
// Run: npx tsx --experimental-test-module-mocks --test lib/ai/requestBudget.test.ts
import { test, before, beforeEach, after, mock } from 'node:test'
import assert from 'node:assert/strict'

type LogCall = { level: string; message: string; context: Record<string, unknown> }
const logCalls: LogCall[] = []

mock.module('@/lib/observability/logger', {
  namedExports: {
    logger: {
      debug: (message: string, context: Record<string, unknown> = {}) => logCalls.push({ level: 'debug', message, context }),
      info:  (message: string, context: Record<string, unknown> = {}) => logCalls.push({ level: 'info', message, context }),
      warn:  (message: string, context: Record<string, unknown> = {}) => logCalls.push({ level: 'warn', message, context }),
      error: (message: string, context: Record<string, unknown> = {}) => logCalls.push({ level: 'error', message, context }),
    },
  },
})
mock.module('@/lib/repositories', {
  namedExports: { repos: { developers: { insertAICostEvent: async () => {} } } },
})

let routedCompletion: typeof import('../ai-orchestration/router').routedCompletion
let callDeepSeek: typeof import('./deepseek').callDeepSeek
let registry: typeof import('../ai-orchestration/registry')

before(async () => {
  process.env.DEEPSEEK_AI_API_KEY = 'sk-fixture'
  process.env.GOOGLE_GEMINI_API_KEY = 'gemini-fixture'
  ;({ routedCompletion } = await import('../ai-orchestration/router'))
  ;({ callDeepSeek } = await import('./deepseek'))
  registry = await import('../ai-orchestration/registry')
})

const originalFetch = globalThis.fetch
after(() => { globalThis.fetch = originalFetch })

// The circuit breaker is module state — reset it so one test's failures
// never mark a provider 'down' (and skipped) for the next.
beforeEach(() => {
  logCalls.length = 0
  registry.recordSuccess('deepseek', 1)
  registry.recordSuccess('gemini', 1)
})

const isGemini = (url: unknown): boolean => new URL(String(url)).hostname === 'generativelanguage.googleapis.com'

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}
const deepseekOk = (content: string) => json({ choices: [{ message: { content } }], usage: { prompt_tokens: 30, completion_tokens: 12, total_tokens: 42 } })
const geminiOk = (text: string) => json({
  candidates: [{ content: { parts: [{ text }] }, finishReason: 'STOP', index: 0 }],
  usageMetadata: { promptTokenCount: 20, candidatesTokenCount: 5, totalTokenCount: 25 },
})

function countingFetch(handler: (url: string) => Response | Promise<Response>): { ds: () => number; gm: () => number } {
  let ds = 0
  let gm = 0
  globalThis.fetch = (async (url: string) => {
    if (isGemini(url)) gm++; else ds++
    return handler(String(url))
  }) as typeof fetch
  return { ds: () => ds, gm: () => gm }
}

const requestLogs = () => logCalls.filter(c => c.message === 'AI provider request')

// ── Router budget ────────────────────────────────────────────────────────────

test('router quality mode, both providers failing: at most 3 provider requests (was 6)', async () => {
  const n = countingFetch(url => { if (isGemini(url)) throw new Error('gemini network error'); throw new Error('fetch failed') })
  await assert.rejects(() => routedCompletion({ prompt: 'p', mode: 'quality', feature: 'adaptive_variant_generate', call_site: 'generate' }), /All AI providers failed/)
  assert.equal(n.ds(), 2, 'DeepSeek: first attempt + one transport retry')
  assert.equal(n.gm(), 1, 'Gemini: exactly one request')
  assert.equal(n.ds() + n.gm(), 3)
})

test('router quality mode: DeepSeek transport failure falls through to the REAL Gemini, reporting fallback + request count', async () => {
  const n = countingFetch(url => { if (isGemini(url)) return geminiOk('from gemini'); throw new Error('fetch failed') })
  const r = await routedCompletion({ prompt: 'p', mode: 'quality', feature: 'remedial_planner', call_site: 'enrich' })
  assert.equal(r.text, 'from gemini')
  assert.equal(r.provider, 'gemini')
  assert.equal(r.fallback_used, true)
  assert.equal(r.provider_requests, 3)
  assert.equal(n.gm(), 1)
})

test('router: a DeepSeek HTTP 503 is not retried — one DeepSeek request, then Gemini', async () => {
  const n = countingFetch(url => isGemini(url) ? geminiOk('ok') : json({ error: 'unavailable' }, 503))
  await routedCompletion({ prompt: 'p', mode: 'quality' })
  assert.equal(n.ds(), 1)
  assert.equal(n.gm(), 1)
})

test('router fast mode: a healthy Gemini answers in exactly one request, DeepSeek never called', async () => {
  const n = countingFetch(url => isGemini(url) ? geminiOk('fast answer') : deepseekOk('unused'))
  const r = await routedCompletion({ prompt: 'p', mode: 'fast' })
  assert.equal(r.text, 'fast answer')
  assert.equal(n.gm(), 1)
  assert.equal(n.ds(), 0)
  assert.equal(r.usage_source, 'provider', 'real provider token counts are used, not the chars/4 estimate')
  assert.equal(r.total_tokens, 25)
})

test('router: a successful primary request makes exactly one provider request (no regression)', async () => {
  const n = countingFetch(() => deepseekOk('primary answer'))
  const r = await routedCompletion({ prompt: 'p', mode: 'quality' })
  assert.equal(r.text, 'primary answer')
  assert.equal(n.ds() + n.gm(), 1)
  assert.equal(r.fallback_used, false)
})

test('variant tier worst case is bounded: 2 attempts × (generate + verify) × ≤3 requests = ≤12', async () => {
  const n = countingFetch(url => { if (isGemini(url)) throw new Error('gemini down'); throw new Error('fetch failed') })
  const { generateWithVerification } = await import('../assignments/variantVerification')
  const { ADAPTIVE_VARIANT_MAX_GENERATION_ATTEMPTS } = await import('../config/adaptiveVariants')
  await assert.rejects(() => generateWithVerification({
    maxAttempts: ADAPTIVE_VARIANT_MAX_GENERATION_ATTEMPTS,
    generate: async () => { await routedCompletion({ prompt: 'g', mode: 'quality' }); return { draft: {} } },
    verify:   async () => { await routedCompletion({ prompt: 'v', mode: 'quality' }); return { kind: 'pass' } },
  }))
  // The provider failure aborts the very first generate — far below the bound.
  assert.ok(n.ds() + n.gm() <= 12, `got ${n.ds() + n.gm()}`)
  assert.equal(n.ds() + n.gm(), 3, 'a provider outage stops the tier after one logical call, not 2 attempts × 2 calls')
})

// ── callDeepSeek fallback eligibility ────────────────────────────────────────

test('callDeepSeek: HTTP 429 falls back to Gemini once and is never retried on DeepSeek', async () => {
  const n = countingFetch(url => isGemini(url) ? geminiOk('rate-limit fallback') : json({ error: 'rate limited' }, 429))
  assert.equal(await callDeepSeek('p', 's'), 'rate-limit fallback')
  assert.equal(n.ds(), 1)
  assert.equal(n.gm(), 1)
})

test('callDeepSeek: HTTP 500 falls back to Gemini once', async () => {
  const n = countingFetch(url => isGemini(url) ? geminiOk('ok') : json({ error: 'boom' }, 500))
  await callDeepSeek('p', 's')
  assert.equal(n.ds() + n.gm(), 2)
})

test('callDeepSeek: HTTP 401 (a request/credential problem) neither retries nor falls back', async () => {
  const n = countingFetch(() => json({ error: 'bad key' }, 401))
  await assert.rejects(() => callDeepSeek('p', 's'), /DeepSeek API error 401/)
  assert.equal(n.ds() + n.gm(), 1)
})

// ── Gemini abort ─────────────────────────────────────────────────────────────

test('Gemini fallback is really aborted at 20s — the request signal fires, not just a promise race', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  let geminiSignal: AbortSignal | undefined
  globalThis.fetch = ((url: string, opts?: RequestInit) => {
    if (!isGemini(url)) return Promise.resolve(json({ error: 'down' }, 503))
    geminiSignal = opts?.signal ?? undefined
    return new Promise((_resolve, reject) => {
      opts?.signal?.addEventListener('abort', () => {
        const err = new Error('The operation was aborted'); err.name = 'AbortError'; reject(err)
      })
    })
  }) as typeof fetch

  const pending = callDeepSeek('p', 's')
  // Let the DeepSeek 503 settle and the Gemini request start before advancing time.
  for (let i = 0; i < 20 && !geminiSignal; i++) await new Promise<void>(r => setImmediate(r))
  assert.ok(geminiSignal, 'Gemini request was issued with an AbortSignal')
  t.mock.timers.tick(20_000)
  await assert.rejects(pending, /Gemini timeout after 20s/)
  assert.equal(geminiSignal!.aborted, true, 'the underlying HTTP request was aborted')
})

// ── Usage telemetry ──────────────────────────────────────────────────────────

test('telemetry: one line per provider request, attributed to the feature, sharing one logical call id', async () => {
  countingFetch(url => { if (isGemini(url)) return geminiOk('ok'); throw new Error('fetch failed') })
  await callDeepSeek('SECRET-PROMPT-CONTENT about a learner', 'system', { feature: 'sow_generate', callSite: 'lesson', correlationId: 'job-1' })

  const lines = requestLogs()
  assert.equal(lines.length, 3, 'DeepSeek ×2 (retry) + Gemini ×1')
  assert.deepEqual(lines.map(l => l.context.attempt), [1, 2, 3])
  assert.deepEqual(lines.map(l => l.context.provider), ['deepseek', 'deepseek', 'gemini'])
  assert.deepEqual(lines.map(l => l.context.outcome), ['error', 'error', 'success'])
  assert.equal(new Set(lines.map(l => l.context.logical_call_id)).size, 1, 'one logical call')
  for (const l of lines) {
    assert.equal(l.context.feature, 'sow_generate')
    assert.equal(l.context.call_site, 'lesson')
    assert.equal(l.context.correlation_id, 'job-1')
  }
  assert.equal(lines[0].context.error_kind, 'network')
  assert.equal(lines[2].context.usage_source, 'provider')
  assert.equal(lines[2].context.total_tokens, 25)
  assert.ok(!JSON.stringify(lines).includes('SECRET-PROMPT-CONTENT'), 'telemetry never carries prompt content')
})

test('telemetry: usage the provider did not report is "unavailable" with null counts — never invented', async () => {
  countingFetch(() => json({ choices: [{ message: { content: 'no usage block' } }] }))
  await callDeepSeek('p', 's', { feature: 'slides_generate' })
  const [line] = requestLogs()
  assert.equal(line.context.usage_source, 'unavailable')
  assert.equal(line.context.total_tokens, null)
  assert.equal(line.context.prompt_tokens, null)
})

test('telemetry: a caller that names no feature is logged as "unattributed" (findable, not hidden)', async () => {
  countingFetch(() => deepseekOk('x'))
  await callDeepSeek('p', 's')
  assert.equal(requestLogs()[0].context.feature, 'unattributed')
})

test('telemetry: DeepSeek prompt/completion token split is recorded, not only the total', async () => {
  countingFetch(() => deepseekOk('x'))
  await callDeepSeek('p', 's', { feature: 'kiswahili_insha_pack' })
  const [line] = requestLogs()
  assert.equal(line.context.prompt_tokens, 30)
  assert.equal(line.context.completion_tokens, 12)
  assert.equal(line.context.total_tokens, 42)
})
