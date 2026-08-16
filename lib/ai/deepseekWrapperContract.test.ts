// lib/ai/deepseekWrapperContract.test.ts
//
// H2B / AI-CONTRACT — every existing consumer test (aiJudge.test.ts,
// inshaEvaluator.test.ts, plannerRouterMigration.test.ts, ...) mocks
// `callDeepSeek` itself away via mock.module('@/lib/ai/deepseek', ...), so
// none of the wrapper's own logic — timeout/abort, bounded retry, the
// Gemini fallback trigger, or usage logging — has ever actually executed
// in a test run (H2A finding). This file exercises the real, unmodified
// `callDeepSeek()` in lib/ai/deepseek.ts, mocking only the transport
// boundary (global fetch) and the two side-effect modules it touches
// (`repos`, for the eager-singleton import-time construction problem
// documented in scripts/excluded-tests.json, and `logger`, the one
// unconditional observable side effect of recordUsage() — see
// lib/ai/deepseek.ts:152-168). Retry/timeout/fallback/parsing logic is
// entirely real.
//
// AI-CONTRACT-001 (bounded timeout): a hung transport is aborted at the
//   real 25s bound (proven with mocked timers, not a real 25s wait) and
//   converted to the documented retryable error.
// AI-CONTRACT-002 (bounded retry): exactly one retry on a retryable
//   failure, never more; a non-retryable failure (HTTP error, malformed
//   body) is never retried at all.
// AI-CONTRACT-004 (usage logging, exactly once): recordUsage's log fires
//   exactly once per call outcome — never once per attempt (H0 flagged
//   this as "claimed tested, never actually was").
//
// Gemini-fallback-path logging is NOT covered here (see closeout report —
// named residual gap, not silently claimed).
//
// Run: npx tsx --experimental-test-module-mocks --test lib/ai/deepseekWrapperContract.test.ts
import { test, before, after, mock } from 'node:test'
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

// deepseek.ts imports the eager-singleton `repos` object purely at module
// import time (same defect class as scripts/excluded-tests.json's entries)
// — mocked here, not touched, so this file needs zero real Supabase
// credentials and stays STANDARD-eligible.
mock.module('@/lib/repositories', {
  namedExports: {
    repos: { developers: { insertAICostEvent: async () => {} } },
  },
})

let callDeepSeek: typeof import('./deepseek').callDeepSeek

before(async () => {
  process.env.DEEPSEEK_AI_API_KEY = 'sk-fixture'
  ;({ callDeepSeek } = await import('./deepseek'))
})

const originalFetch = globalThis.fetch
after(() => { globalThis.fetch = originalFetch })

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

function chatCompletion(content: string, totalTokens = 42): unknown {
  return { choices: [{ message: { content } }], usage: { total_tokens: totalTokens } }
}

test('AI-CONTRACT: a clean success calls fetch exactly once and logs usage exactly once', async () => {
  logCalls.length = 0
  let fetchCalls = 0
  globalThis.fetch = (async () => { fetchCalls++; return jsonResponse(chatCompletion('hello learner')) }) as typeof fetch

  const content = await callDeepSeek('prompt', 'system')

  assert.equal(content, 'hello learner')
  assert.equal(fetchCalls, 1)
  const usageLogs = logCalls.filter(c => c.message === 'AI call completed')
  assert.equal(usageLogs.length, 1, 'recordUsage must log exactly once for a single successful attempt')
  assert.equal(usageLogs[0].context.usage_tokens, 42)
  assert.equal(usageLogs[0].context.provider, 'deepseek')
})

test('AI-CONTRACT-002: a retryable transport failure is retried exactly once, then succeeds — one usage log, not two', async () => {
  logCalls.length = 0
  let fetchCalls = 0
  globalThis.fetch = (async () => {
    fetchCalls++
    if (fetchCalls === 1) throw new Error('fetch failed') // real undici's network-failure message — the exact string callDeepSeek's isRetryable check matches
    return jsonResponse(chatCompletion('recovered after retry'))
  }) as typeof fetch

  const content = await callDeepSeek('prompt', 'system')

  assert.equal(content, 'recovered after retry')
  assert.equal(fetchCalls, 2, 'exactly one retry — not zero, not unbounded')
  const usageLogs = logCalls.filter(c => c.message === 'AI call completed')
  assert.equal(usageLogs.length, 1, 'a retried-then-successful call must log usage exactly once, not once per attempt')
})

test('AI-CONTRACT-002: two consecutive retryable failures exhaust the DeepSeek retry budget (exactly 2 attempts) before falling through', async () => {
  let fetchCalls = 0
  globalThis.fetch = (async () => { fetchCalls++; throw new Error('fetch failed') }) as typeof fetch

  await assert.rejects(() => callDeepSeek('prompt', 'system'))
  // No GOOGLE_GEMINI_API_KEY is configured in this test environment, so the
  // fallback itself fails fast — what matters here is the DeepSeek leg's
  // own attempt count, proven regardless of what the fallback does.
  assert.equal(fetchCalls, 2, 'DeepSeek is attempted exactly twice (first + one retry), never a third time')
})

test('AI-CONTRACT-002: a non-retryable HTTP error (4xx) is never retried — exactly one attempt', async () => {
  let fetchCalls = 0
  globalThis.fetch = (async () => { fetchCalls++; return jsonResponse({ error: 'bad request' }, 400) }) as typeof fetch

  await assert.rejects(() => callDeepSeek('prompt', 'system'), /DeepSeek API error 400/)
  assert.equal(fetchCalls, 1, 'an HTTP error status is not a retryable condition — must not trigger the retry path')
})

test('AI-CONTRACT-002: a malformed-but-200 response (missing choices) is never retried — exactly one attempt, no silent retry storm', async () => {
  let fetchCalls = 0
  globalThis.fetch = (async () => { fetchCalls++; return jsonResponse({ usage: { total_tokens: 1 } }) }) as typeof fetch

  await assert.rejects(() => callDeepSeek('prompt', 'system'))
  assert.equal(fetchCalls, 1, 'documents the real (unvalidated) contract: a malformed 200 body throws a raw TypeError, which is not string-matched by isRetryable, so it is never retried')
})

test('AI-CONTRACT-001: a hung transport is aborted at the real 25s bound, converted to the documented timeout error, and triggers exactly one retry', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  let fetchCalls = 0

  globalThis.fetch = ((_url: string, opts: RequestInit) => {
    fetchCalls++
    if (fetchCalls === 1) {
      // Simulates a genuinely hung transport: never resolves on its own,
      // only reacts to the AbortSignal — exactly like a real stalled
      // connection. The 25s bound comes from the real, unmodified
      // setTimeout(() => controller.abort(), TIMEOUT_MS) in callOnce();
      // only the passage of time is faked here (t.mock.timers), not the
      // abort mechanism itself.
      return new Promise((_resolve, reject) => {
        opts.signal!.addEventListener('abort', () => {
          const err = new Error('The operation was aborted')
          err.name = 'AbortError'
          reject(err)
        })
      })
    }
    return Promise.resolve(jsonResponse(chatCompletion('recovered after timeout')))
  }) as typeof fetch

  const pending = callDeepSeek('prompt', 'system')
  await t.mock.timers.tick(25_000)
  const content = await pending

  assert.equal(content, 'recovered after timeout')
  assert.equal(fetchCalls, 2, 'the aborted first attempt counts as the retryable failure, triggering exactly one retry')
})
