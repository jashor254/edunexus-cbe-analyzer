// lib/ai/deepseekUsageLogging.test.ts
//
// Verifies callDeepSeek() persists exactly one metadata ai_call_logs row per
// call outcome via logAICall() — the fix for "ai_call_logs empty in prod
// despite live AI traffic" (the central generation helper logged only to the
// console, never to the table). logAICall is mocked to a capture array; the
// persistence + content-stripping of the row itself is covered separately by
// analytics.aiCallLog.privacy.test.ts. Here we assert the wrapper CALLS it
// with the right metadata on success and on total failure, and that the
// feature label resolves (explicit > costContext > default).
//
// Run: npm test -- lib/ai/deepseekUsageLogging.test.ts
import { test, before, after, mock } from 'node:test'
import assert from 'node:assert/strict'

type AICallLog = {
  feature: string; model: string; prompt: string; response?: string
  latencyMs: number; tokenCount?: number; success: boolean; error?: string
  userId?: string
}
const aiLogCalls: AICallLog[] = []

mock.module('@/lib/ai/logger', {
  namedExports: { logAICall: async (log: AICallLog) => { aiLogCalls.push(log) } },
})

mock.module('@/lib/observability/logger', {
  namedExports: {
    logger: { debug() {}, info() {}, warn() {}, error() {} },
  },
})

// Eager-singleton repos is constructed at import time; mocked so the file
// needs no Supabase credentials (same pattern as deepseekWrapperContract.test.ts).
mock.module('@/lib/repositories', {
  namedExports: {
    repos: { developers: { insertAICostEvent: async () => {} } },
  },
})

let callDeepSeek: typeof import('./deepseek').callDeepSeek

before(async () => {
  process.env.DEEPSEEK_AI_API_KEY = 'sk-fixture'
  process.env.GOOGLE_GEMINI_API_KEY = 'gemini-fixture'
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

test('a successful DeepSeek call logs exactly one ai_call_logs row: success=true, real token count, prompt forwarded', async () => {
  aiLogCalls.length = 0
  globalThis.fetch = (async () => jsonResponse(chatCompletion('hello learner', 123))) as typeof fetch

  await callDeepSeek('explain fractions', 'system')

  assert.equal(aiLogCalls.length, 1, 'exactly one row per successful call — never once per attempt')
  assert.equal(aiLogCalls[0].success, true)
  assert.equal(aiLogCalls[0].tokenCount, 123, 'the real DeepSeek usage.total_tokens must reach the log')
  assert.equal(aiLogCalls[0].prompt, 'explain fractions', 'prompt is forwarded (stripped at persistence by buildAICallLogRow, not here)')
  assert.notEqual(aiLogCalls[0].model, 'gemini', 'a DeepSeek success is attributed to the DeepSeek model, not the fallback')
})

test('the feature label resolves explicit > costContext > default', async () => {
  globalThis.fetch = (async () => jsonResponse(chatCompletion('ok'))) as typeof fetch

  aiLogCalls.length = 0
  await callDeepSeek('p', 's')
  assert.equal(aiLogCalls[0].feature, 'deepseek:uncategorized', 'no label supplied → safe default so the call is still counted')

  aiLogCalls.length = 0
  await callDeepSeek('p', 's', { costContext: { organizationId: 'org-1', feature: 'compass' } })
  assert.equal(aiLogCalls[0].feature, 'compass', 'costContext.feature is used when no explicit feature is given')

  aiLogCalls.length = 0
  await callDeepSeek('p', 's', { feature: 'sow:lesson', costContext: { organizationId: 'org-1', feature: 'compass' } })
  assert.equal(aiLogCalls[0].feature, 'sow:lesson', 'an explicit feature wins over costContext.feature')
})

test('when both providers fail, exactly one failure row is logged (success=false, error captured) — no fabricated success', async () => {
  aiLogCalls.length = 0
  globalThis.fetch = ((url: string) => {
    if (String(url).includes('generativelanguage.googleapis.com')) return Promise.reject(new Error('gemini network error'))
    return Promise.reject(new Error('fetch failed'))
  }) as typeof fetch

  await assert.rejects(() => callDeepSeek('prompt', 'system'))

  assert.equal(aiLogCalls.length, 1, 'a failed call is logged once, not once per attempt')
  assert.equal(aiLogCalls[0].success, false)
  assert.equal(typeof aiLogCalls[0].error, 'string', 'the terminal error message is captured for the failure row')
  assert.equal(aiLogCalls.filter(c => c.success === true).length, 0, 'a total failure must never log a success row')
})
