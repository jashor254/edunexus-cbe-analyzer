// lib/ai/childDataContainment.test.ts
//
// Provider-call interception: counts REAL outbound requests at the transport
// boundary (global fetch — the Gemini SDK uses it too) through the real,
// unmodified wrappers, router and low-level egress functions, using synthetic
// prompts only. Proves that while learner-data AI is paused:
//   * every learner-data feature makes ZERO provider requests, on every path
//     (callDeepSeek + its Gemini fallback, streaming, router chains in every
//     mode, the Gemini helpers, and the low-level functions called directly),
//   * a blocked call cannot retry or fall back to the other provider,
//   * unattributed / unclassified calls are denied,
//   * generic teacher tools still reach a provider (nothing unrelated is disabled).
//
// Run: npx tsx --experimental-test-module-mocks --test lib/ai/childDataContainment.test.ts
import { test, before, beforeEach, after, mock } from 'node:test'
import assert from 'node:assert/strict'

mock.module('@/lib/observability/logger', {
  namedExports: { logger: { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} } },
})
mock.module('@/lib/repositories', {
  namedExports: { repos: { developers: { insertAICostEvent: async () => {} } } },
})

let routedCompletion: typeof import('../ai-orchestration/router').routedCompletion
let deepseek: typeof import('./deepseek')
let gemini: typeof import('./gemini')
let usage: typeof import('./usageTelemetry')
let policy: typeof import('./childDataPolicy')
let registry: typeof import('../ai-orchestration/registry')
let GoogleGenerativeAI: typeof import('@google/generative-ai').GoogleGenerativeAI

before(async () => {
  process.env.DEEPSEEK_AI_API_KEY = 'sk-fixture'
  process.env.GOOGLE_GEMINI_API_KEY = 'gemini-fixture'
  ;({ routedCompletion } = await import('../ai-orchestration/router'))
  deepseek = await import('./deepseek')
  gemini = await import('./gemini')
  usage = await import('./usageTelemetry')
  policy = await import('./childDataPolicy')
  registry = await import('../ai-orchestration/registry')
  ;({ GoogleGenerativeAI } = await import('@google/generative-ai'))
})

const originalFetch = globalThis.fetch
after(() => { globalThis.fetch = originalFetch })

let requests: string[] = []
function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}
const deepseekOk = (content: string) => json({ choices: [{ message: { content } }], usage: { prompt_tokens: 3, completion_tokens: 2, total_tokens: 5 } })
const geminiOk = (text: string) => json({
  candidates: [{ content: { parts: [{ text }] }, finishReason: 'STOP', index: 0 }],
  usageMetadata: { promptTokenCount: 3, candidatesTokenCount: 2, totalTokenCount: 5 },
})

// Every outbound request is recorded; the response is a healthy one for whichever provider is hit.
beforeEach(() => {
  requests = []
  registry.recordSuccess('deepseek', 1)
  registry.recordSuccess('gemini', 1)
  globalThis.fetch = (async (url: string) => {
    const host = new URL(String(url)).hostname
    requests.push(host)
    return host === 'generativelanguage.googleapis.com' ? geminiOk('{"ok":true}') : deepseekOk('{"ok":true}')
  }) as typeof fetch
})

const SYNTHETIC = 'SYNTHETIC_LEARNER_TEXT: a made-up essay about the school fete'
const paused = (err: unknown): boolean => err instanceof Error && (err as { code?: string }).code === 'AI_FEATURE_PAUSED_FOR_REVIEW'

test('callDeepSeek: every learner-data feature makes zero provider requests (no DeepSeek, no Gemini fallback)', async () => {
  for (const feature of policy.CHILD_DATA_AI_FEATURES) {
    await assert.rejects(() => deepseek.callDeepSeek(SYNTHETIC, 'system', { feature }), paused, feature)
  }
  assert.deepEqual(requests, [])
})

test('callDeepSeek: an unattributed call is denied (default deny)', async () => {
  await assert.rejects(() => deepseek.callDeepSeek(SYNTHETIC, 'system', {}), paused)
  await assert.rejects(() => deepseek.callDeepSeek(SYNTHETIC, 'system', { feature: 'brand_new_unclassified_feature' }), paused)
  assert.deepEqual(requests, [])
})

test('streamDeepSeek (Compass path, Gemini-first): zero provider requests, no fallback to DeepSeek', async () => {
  await assert.rejects(
    () => deepseek.streamDeepSeek('system', SYNTHETIC, [{ role: 'user', content: SYNTHETIC }], { temperature: 0.3, feature: 'learning_compass' }),
    paused,
  )
  assert.deepEqual(requests, [])
})

test('routedCompletion: zero provider requests in every mode for every learner-data feature', async () => {
  for (const mode of ['standard', 'fast', 'quality'] as const) {
    for (const feature of policy.CHILD_DATA_AI_FEATURES) {
      await assert.rejects(() => routedCompletion({ prompt: SYNTHETIC, mode, feature }), paused, `${mode}/${feature}`)
    }
  }
  assert.deepEqual(requests, [])
})

test('Gemini helpers: callGeminiJSON and generateGeminiWithTimeout make zero requests for learner-data features', async () => {
  await assert.rejects(() => gemini.callGeminiJSON(SYNTHETIC, { feature: 'paper_intelligence_mark_script' }), paused)
  // Paper Intelligence builds its own SDK model and a LogicalCall — the multimodal path.
  const model = new GoogleGenerativeAI('gemini-fixture').getGenerativeModel({ model: 'gemini-3.5-flash-lite' })
  assert.throws(() => usage.startLogicalCall({ feature: 'paper_intelligence_mark_script' }), paused)
  const handBuilt = { id: 'x', feature: 'paper_intelligence_mark_script', callSite: null, correlationId: null, attempts: 0 }
  await assert.rejects(
    () => gemini.generateGeminiWithTimeout(model, [{ inlineData: { mimeType: 'image/jpeg', data: 'U1lOVEhFVElD' } }, SYNTHETIC], { timeoutMs: 1000, modelName: 'gemini-3.5-flash-lite', call: handBuilt as never }),
    paused,
  )
  assert.equal(handBuilt.attempts, 0, 'no attempt may be counted for a blocked call')
  assert.deepEqual(requests, [])
})

test('low-level egress functions refuse a hand-built LogicalCall (no bypass around startLogicalCall)', async () => {
  const call = { id: 'x', feature: 'learning_compass', callSite: null, correlationId: null, attempts: 0 }
  const opts = { temperature: 0.2, maxTokens: 50, history: [], feature: 'learning_compass' } as never
  await assert.rejects(() => deepseek.callDeepSeekProvider(SYNTHETIC, 'system', opts, call as never), paused)
  await assert.rejects(() => deepseek.callGeminiProvider(SYNTHETIC, 'system', opts, call as never), paused)
  assert.equal(call.attempts, 0)
  assert.deepEqual(requests, [])
})

test('a blocked call cannot retry or fall back: even when providers are failing, nothing is sent', async () => {
  globalThis.fetch = (async (url: string) => { requests.push(new URL(String(url)).hostname); return json({ error: 'x' }, 503) }) as typeof fetch
  for (const feature of policy.CHILD_DATA_AI_FEATURES) {
    await assert.rejects(() => deepseek.callDeepSeek(SYNTHETIC, 'system', { feature }), paused, feature)
  }
  assert.deepEqual(requests, [])
})

// ── Nothing unrelated is disabled ────────────────────────────────────────────

test('generic teacher tools still reach a provider (curriculum/instructional content only)', async () => {
  const out = await deepseek.callDeepSeek('Plan a Grade 8 lesson on fractions', 'system', { feature: 'sow_generate' })
  assert.equal(typeof out, 'string')
  assert.deepEqual(requests, ['api.deepseek.com'])

  requests = []
  const r = await routedCompletion({ prompt: 'Weeks plan with group sizes only', mode: 'quality', feature: 'remedial_planner' })
  assert.ok(r)
  assert.equal(requests.length >= 1, true)

  requests = []
  const g = await gemini.callGeminiJSON('Three diagnostic questions on a sub-strand', { feature: 'teaching_quick_check' })
  assert.ok(g !== undefined)
  assert.deepEqual(requests, ['generativelanguage.googleapis.com'])
})
