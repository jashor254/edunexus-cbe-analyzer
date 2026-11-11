// lib/ai/usageTelemetry.test.ts
//
// AI cost telemetry. Proves the usage log records the
// provider's own fields (cache hits, reasoning tokens, served model), keeps
// "not reported" (null) distinct from zero, attributes calls to a workflow
// and its retries, and never carries prompt/completion text or identifiers.
//
// Real, unmodified callDeepSeek() and usageTelemetry; only the transport
// (global fetch) and the logger/repos side effects are replaced, exactly as
// in deepseekWrapperContract.test.ts. No network, no credentials, no spend.
//
// Run: npx tsx --experimental-test-module-mocks --test lib/ai/usageTelemetry.test.ts
import { test, before, after, mock } from 'node:test'
import assert from 'node:assert/strict'

type LogCall = { level: string; message: string; context: Record<string, unknown> }
const logCalls: LogCall[] = []
const push = (level: string) => (message: string, context: Record<string, unknown> = {}) => { logCalls.push({ level, message, context }) }

mock.module('@/lib/observability/logger', {
  namedExports: { logger: { debug: push('debug'), info: push('info'), warn: push('warn'), error: push('error') } },
})
mock.module('@/lib/repositories', {
  namedExports: { repos: { developers: { insertAICostEvent: async () => {} } } },
})

let callDeepSeek: typeof import('./deepseek').callDeepSeek
let openAIUsage: typeof import('./usageTelemetry').openAIUsage
let geminiUsage: typeof import('./usageTelemetry').geminiUsage
let USAGE_UNAVAILABLE: typeof import('./usageTelemetry').USAGE_UNAVAILABLE

before(async () => {
  process.env.DEEPSEEK_AI_API_KEY = 'sk-fixture'
  process.env.GOOGLE_GEMINI_API_KEY = 'gemini-fixture'
  ;({ callDeepSeek } = await import('./deepseek'))
  ;({ openAIUsage, geminiUsage, USAGE_UNAVAILABLE } = await import('./usageTelemetry'))
})
const originalFetch = globalThis.fetch
after(() => { globalThis.fetch = originalFetch })

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

const providerLogs = (): LogCall[] => logCalls.filter(c => c.message === 'AI provider request')

// ── Extraction ────────────────────────────────────────────────────────────────

test('TEL-001 DeepSeek usage: cache hit/miss and reasoning tokens come from the provider fields', () => {
  const u = openAIUsage({
    prompt_tokens: 1000, completion_tokens: 300, total_tokens: 1300,
    prompt_cache_hit_tokens: 900, prompt_cache_miss_tokens: 100,
    completion_tokens_details: { reasoning_tokens: 250 },
  })
  assert.equal(u.source, 'provider')
  assert.equal(u.promptTokens, 1000)
  assert.equal(u.completionTokens, 300)
  assert.equal(u.cacheHitTokens, 900)
  assert.equal(u.cacheMissTokens, 100)
  assert.equal(u.reasoningTokens, 250)
  assert.equal(u.cacheWriteTokens, null, 'no supported provider reports cache writes — never invented')
})

test('TEL-002 missing optional fields are null, never 0; explicit zero stays 0', () => {
  const bare = openAIUsage({ prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 })
  assert.equal(bare.cacheHitTokens, null)
  assert.equal(bare.cacheMissTokens, null)
  assert.equal(bare.reasoningTokens, null)

  const zeros = openAIUsage({
    prompt_tokens: 10, completion_tokens: 5, total_tokens: 15,
    prompt_cache_hit_tokens: 0, prompt_cache_miss_tokens: 10,
    completion_tokens_details: { reasoning_tokens: 0 },
  })
  assert.equal(zeros.cacheHitTokens, 0)
  assert.equal(zeros.reasoningTokens, 0)
})

test('TEL-003 cached_tokens alias is used only when prompt_cache_hit_tokens is absent; malformed values are "not reported"', () => {
  assert.equal(openAIUsage({ prompt_tokens: 5, prompt_tokens_details: { cached_tokens: 4 } }).cacheHitTokens, 4)
  assert.equal(openAIUsage({ prompt_tokens: 5, prompt_cache_hit_tokens: 3, prompt_tokens_details: { cached_tokens: 4 } }).cacheHitTokens, 3)
  const bad = openAIUsage({
    prompt_tokens: 5, prompt_cache_hit_tokens: -1,
    completion_tokens_details: { reasoning_tokens: Number.NaN },
  } as never)
  assert.equal(bad.cacheHitTokens, null)
  assert.equal(bad.reasoningTokens, null)
})

test('TEL-004 no usage object at all is "unavailable" with every count null', () => {
  for (const missing of [undefined, null, {}]) {
    const u = openAIUsage(missing as never)
    assert.equal(u.source, 'unavailable')
    assert.deepEqual(u, USAGE_UNAVAILABLE)
  }
  assert.equal(USAGE_UNAVAILABLE.cacheHitTokens, null)
  assert.equal(USAGE_UNAVAILABLE.reasoningTokens, null)
})

test('TEL-005 Gemini usage maps cachedContent and thoughts counts, null when absent', () => {
  const u = geminiUsage({ promptTokenCount: 50, candidatesTokenCount: 20, totalTokenCount: 90, cachedContentTokenCount: 30, thoughtsTokenCount: 20 })
  assert.equal(u.cacheHitTokens, 30)
  assert.equal(u.reasoningTokens, 20)
  const bare = geminiUsage({ promptTokenCount: 50, candidatesTokenCount: 20, totalTokenCount: 70 })
  assert.equal(bare.cacheHitTokens, null)
  assert.equal(bare.reasoningTokens, null)
})

// ── End-to-end through the real wrapper ──────────────────────────────────────

test('TEL-006 a successful call logs one provider line with tokens, served model and attribution', async () => {
  logCalls.length = 0
  globalThis.fetch = (async () => json({
    model: 'deepseek-flash',
    choices: [{ message: { content: 'ok' } }],
    usage: { prompt_tokens: 120, completion_tokens: 30, total_tokens: 150, prompt_cache_hit_tokens: 100, prompt_cache_miss_tokens: 20, completion_tokens_details: { reasoning_tokens: 7 } },
  })) as typeof fetch

  await callDeepSeek('prompt', 'system', { feature: 'sow_generate', callSite: 'sow.lesson', correlationId: '11111111-2222-3333-4444-555555555555', workflowAttempt: 2 })

  const [line] = providerLogs()
  assert.ok(line)
  const c = line.context
  assert.equal(c.feature, 'sow_generate')
  assert.equal(c.call_site, 'sow.lesson')
  assert.equal(c.correlation_id, '11111111-2222-3333-4444-555555555555')
  assert.equal(c.workflow_attempt, 2)
  assert.equal(c.attempt, 1)
  assert.equal(c.provider, 'deepseek')
  assert.equal(typeof c.model, 'string', 'requested model recorded')
  assert.equal(c.served_model, 'deepseek-flash', 'model named in the response is recorded separately')
  assert.equal(c.outcome, 'success')
  assert.equal(c.prompt_tokens, 120)
  assert.equal(c.completion_tokens, 30)
  assert.equal(c.cache_hit_tokens, 100)
  assert.equal(c.cache_miss_tokens, 20)
  assert.equal(c.cache_write_tokens, null)
  assert.equal(c.reasoning_tokens, 7)
  assert.equal(c.usage_source, 'provider')
  assert.equal(typeof c.latency_ms, 'number')
})

test('TEL-007 a response with no usage and no model logs nulls, not zeros or guesses', async () => {
  logCalls.length = 0
  globalThis.fetch = (async () => json({ choices: [{ message: { content: 'ok' } }] })) as typeof fetch
  await callDeepSeek('p', 's', { feature: 'lesson_plan_generate' })
  const c = providerLogs()[0].context
  assert.equal(c.usage_source, 'unavailable')
  for (const k of ['prompt_tokens', 'completion_tokens', 'total_tokens', 'cache_hit_tokens', 'cache_miss_tokens', 'cache_write_tokens', 'reasoning_tokens', 'served_model']) {
    assert.equal(c[k], null, `${k} must be null when the provider reported nothing`)
  }
})

test('TEL-008 a failed request is logged as an error with its kind and no token counts', async () => {
  logCalls.length = 0
  globalThis.fetch = (async () => json({ error: 'bad' }, 400)) as typeof fetch
  await assert.rejects(() => callDeepSeek('p', 's', { feature: 'sow_generate', correlationId: 'job-1', workflowAttempt: 1 }), /400/)
  const [line] = providerLogs()
  assert.equal(line.context.outcome, 'error')
  assert.equal(line.context.error_kind, 'http')
  assert.equal(line.context.http_status, 400)
  assert.equal(line.context.correlation_id, 'job-1')
  assert.equal(line.context.prompt_tokens, null)
  assert.equal(line.context.reasoning_tokens, null)
})

test('TEL-009 a transport retry shares one logical call and numbers its provider requests', async () => {
  logCalls.length = 0
  let n = 0
  globalThis.fetch = (async () => {
    n++
    if (n === 1) throw new Error('fetch failed')
    return json({ model: 'deepseek-flash', choices: [{ message: { content: 'ok' } }], usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 } })
  }) as typeof fetch
  await callDeepSeek('p', 's', { feature: 'sow_generate', correlationId: 'job-2', workflowAttempt: 3 })
  const lines = providerLogs()
  assert.equal(lines.length, 2)
  assert.equal(lines[0].context.attempt, 1)
  assert.equal(lines[0].context.outcome, 'error')
  assert.equal(lines[1].context.attempt, 2)
  assert.equal(lines[1].context.outcome, 'success')
  assert.equal(lines[0].context.logical_call_id, lines[1].context.logical_call_id)
  assert.equal(lines[0].context.workflow_attempt, 3)
  assert.equal(lines[1].context.correlation_id, 'job-2')
})

test('TEL-010 two workflow attempts are two logical calls under one correlation id', async () => {
  logCalls.length = 0
  globalThis.fetch = (async () => json({ choices: [{ message: { content: 'x' } }], usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 } })) as typeof fetch
  await callDeepSeek('p', 's', { feature: 'sow_generate', correlationId: 'job-3', workflowAttempt: 1 })
  await callDeepSeek('p', 's', { feature: 'sow_generate', correlationId: 'job-3', workflowAttempt: 2 })
  const [a, b] = providerLogs()
  assert.notEqual(a.context.logical_call_id, b.context.logical_call_id)
  assert.equal(a.context.correlation_id, b.context.correlation_id)
  assert.deepEqual([a.context.workflow_attempt, b.context.workflow_attempt], [1, 2])
})

test('TEL-011 calls without attribution are still logged, as unattributed with null correlation', async () => {
  logCalls.length = 0
  globalThis.fetch = (async () => json({ choices: [{ message: { content: 'x' } }] })) as typeof fetch
  await callDeepSeek('p', 's')
  const c = providerLogs()[0].context
  assert.equal(c.feature, 'unattributed')
  assert.equal(c.correlation_id, null)
  assert.equal(c.workflow_attempt, null)
})

// ── Privacy ──────────────────────────────────────────────────────────────────

test('TEL-012 no log line from a call contains the prompt, the completion, the API key or the request history', async () => {
  logCalls.length = 0
  const SECRET_PROMPT = 'LEARNER-NAME-WANJIKU-SECRET-PROMPT'
  const SECRET_SYSTEM = 'SYSTEM-RULES-CONFIDENTIAL'
  const SECRET_COMPLETION = 'GENERATED-CONTENT-CONFIDENTIAL'
  const SECRET_HISTORY = 'EARLIER-TURN-CONFIDENTIAL'
  globalThis.fetch = (async () => json({ model: 'deepseek-flash', choices: [{ message: { content: SECRET_COMPLETION } }], usage: { prompt_tokens: 9, completion_tokens: 9, total_tokens: 18 } })) as typeof fetch

  await callDeepSeek(SECRET_PROMPT, SECRET_SYSTEM, { feature: 'sow_generate', correlationId: 'job-4', history: [{ role: 'user', content: SECRET_HISTORY }] })
  await assert.rejects(() => { globalThis.fetch = (async () => json({ error: 'PROVIDER-ERROR-BODY-ECHOING-PROMPT ' + SECRET_PROMPT }, 400)) as typeof fetch; return callDeepSeek(SECRET_PROMPT, SECRET_SYSTEM, { feature: 'sow_generate' }) })

  const everything = JSON.stringify(logCalls.filter(c => c.message !== 'DeepSeek retryable error — retrying once'))
  for (const secret of [SECRET_PROMPT, SECRET_SYSTEM, SECRET_COMPLETION, SECRET_HISTORY, 'sk-fixture', 'Bearer']) {
    assert.ok(!everything.includes(secret), `log must not contain ${secret}`)
  }
  // The provider-request lines specifically carry only the documented, non-content keys.
  const allowed = new Set([
    'service', 'feature', 'call_site', 'correlation_id', 'logical_call_id', 'attempt', 'workflow_attempt',
    'provider', 'model', 'served_model', 'outcome', 'error_kind', 'http_status', 'streamed', 'latency_ms',
    'prompt_tokens', 'completion_tokens', 'total_tokens', 'cache_hit_tokens', 'cache_miss_tokens',
    'cache_write_tokens', 'reasoning_tokens', 'usage_source',
  ])
  for (const line of providerLogs()) {
    for (const k of Object.keys(line.context)) assert.ok(allowed.has(k), `unexpected key in provider log: ${k}`)
  }
})

test('TEL-013 the provider line never contains a user, teacher, learner or school identifier key', () => {
  const forbidden = /^(user_id|teacher_id|learner_id|student_id|school_id|email|name|phone|api_key|authorization)$/i
  const lines = providerLogs()
  assert.ok(lines.length > 0, 'there are provider lines to inspect')
  for (const line of lines) {
    for (const k of Object.keys(line.context)) assert.doesNotMatch(k, forbidden)
  }
})
