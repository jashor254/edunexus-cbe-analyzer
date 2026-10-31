// lib/compass/compassTurnBounds.test.ts
//
// A Compass tutoring turn is operationally bounded WITHOUT limiting how long
// a learner's conversation may run (product decision: no conversation-length
// cap). Proven at the transport boundary through the real streamDeepSeek():
//
//   - an ordinary turn streams in one provider request;
//   - one turn makes at most 3 provider requests (Gemini 1 + DeepSeek ≤2);
//   - output is capped at 1000 tokens on both providers;
//   - context is trimmed to the last 20 messages whatever the caller passes;
//   - a stream that stalls after its first byte is aborted at the whole-
//     stream deadline instead of holding the request open.
// Plus static checks that the route caps conversation STARTS only.
//
// Run: npx tsx --experimental-test-module-mocks --test lib/compass/compassTurnBounds.test.ts
import { test, before, after, mock } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

mock.module('@/lib/observability/logger', {
  namedExports: { logger: { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} } },
})
mock.module('@/lib/repositories', {
  namedExports: { repos: { developers: { insertAICostEvent: async () => {} } } },
})

let streamDeepSeek: typeof import('@/lib/ai/deepseek').streamDeepSeek
let registry: typeof import('@/lib/ai-orchestration/registry')

before(async () => {
  process.env.DEEPSEEK_AI_API_KEY = 'sk-fixture'
  process.env.GOOGLE_GEMINI_API_KEY = 'gemini-fixture'
  ;({ streamDeepSeek } = await import('@/lib/ai/deepseek'))
  registry = await import('@/lib/ai-orchestration/registry')
})
const originalFetch = globalThis.fetch
after(() => { globalThis.fetch = originalFetch })

const isGemini = (url: unknown): boolean => new URL(String(url)).hostname === 'generativelanguage.googleapis.com'
const geminiSse = (text: string) => new Response(
  `data: ${JSON.stringify({ candidates: [{ content: { parts: [{ text }], role: 'model' }, finishReason: 'STOP', index: 0 }], usageMetadata: { totalTokenCount: 9 } })}\r\n\r\n`,
  { status: 200, headers: { 'Content-Type': 'text/event-stream' } },
)
const history = (n: number) => Array.from({ length: n }, (_, i) => ({ role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant', content: `m${i}` }))

test('an ordinary turn streams the reply in exactly one provider request', async () => {
  registry.recordSuccess('gemini', 1)
  let requests = 0
  globalThis.fetch = (async () => { requests++; return geminiSse('Hello {{LEARNER}}!') }) as typeof fetch
  const text = await new Response(await streamDeepSeek('system', 'hi', history(2), { feature: 'learning_compass' })).text()
  assert.match(text, /Hello \{\{LEARNER\}\}!/)
  assert.equal(requests, 1)
})

test('one turn makes at most 3 provider requests even when every provider fails', async () => {
  let gemini = 0
  let deepseek = 0
  globalThis.fetch = (async (url: string) => {
    if (isGemini(url)) { gemini++; return new Response('{"error":{"message":"down"}}', { status: 503 }) }
    deepseek++
    throw new Error('fetch failed')
  }) as typeof fetch
  await assert.rejects(() => streamDeepSeek('system', 'hi', history(2), { feature: 'learning_compass' }))
  assert.equal(gemini, 1)
  assert.equal(deepseek, 2)
})

test('output is capped at 1000 tokens on both providers, and context is trimmed to 20 messages', async () => {
  const bodies: { gemini?: string; deepseek?: string } = {}
  globalThis.fetch = (async (url: string, opts?: RequestInit) => {
    if (isGemini(url)) { bodies.gemini = String(opts?.body); return new Response('{"error":{"message":"down"}}', { status: 503 }) }
    bodies.deepseek = String(opts?.body)
    return new Response('data: {"choices":[{"delta":{"content":"ok"}}]}\n\ndata: [DONE]\n\n', { status: 200 })
  }) as typeof fetch

  await new Response(await streamDeepSeek('system', 'latest', history(50), { feature: 'learning_compass' })).text()

  const ds = JSON.parse(bodies.deepseek!) as { max_tokens: number; messages: unknown[] }
  assert.equal(ds.max_tokens, 1000)
  assert.equal(ds.messages.length, 1 + 20 + 1, 'system + last 20 history + the new message')
  const gm = JSON.parse(bodies.gemini!) as { generationConfig: { maxOutputTokens: number }; contents: unknown[] }
  assert.equal(gm.generationConfig.maxOutputTokens, 1000)
  assert.equal(gm.contents.length, 20 + 1)
})

test('a stream that stalls after its first byte is aborted at the whole-stream deadline', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  globalThis.fetch = (async (url: string, opts?: RequestInit) => {
    if (isGemini(url)) return new Response('{"error":{"message":"down"}}', { status: 503 })
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('data: {"choices":[{"delta":{"content":"partial"}}]}\n\n'))
        opts?.signal?.addEventListener('abort', () => {
          const err = new Error('The operation was aborted'); err.name = 'AbortError'; controller.error(err)
        })
        // …and then nothing more, ever: a stalled upstream.
      },
    })
    return new Response(body, { status: 200 })
  }) as typeof fetch

  const stream = await streamDeepSeek('system', 'hi', [], { feature: 'learning_compass' })
  const reader = stream.getReader()
  const first = await reader.read()
  assert.match(new TextDecoder().decode(first.value), /partial/, 'the learner gets what arrived')
  const pending = reader.read()
  t.mock.timers.tick(90_000)
  await assert.rejects(pending, /aborted/i, 'the stalled stream ends at the deadline instead of hanging')
})

// ── Route-level guarantees (static) ──────────────────────────────────────────

const route = readFileSync('app/api/learn/route.ts', 'utf8')

test('the daily cap is reserved only for a conversation START — turns inside a conversation are never counted', () => {
  const reserve = route.indexOf('reserveDailyCall(access.userId, FEATURE)')
  assert.ok(reserve > 0)
  const guard = route.lastIndexOf('if (!sessionId) {', reserve)
  assert.ok(guard > 0 && reserve - guard < 200, 'the reservation sits inside `if (!sessionId)`')
  assert.equal(route.match(/reserveDailyCall\(/g)?.length, 1, 'no second, per-turn reservation')
})

test('no conversation-length limit exists in the route (product decision)', () => {
  assert.doesNotMatch(route, /exchange_count\s*[><]=?|MAX_(TURNS|EXCHANGES)|turn(s)?Limit/i)
})

test('message size and server-side history are bounded', () => {
  assert.match(route, /const MAX_MESSAGE_CHARS = 4000/)
  const session = readFileSync('lib/compass/session.ts', 'utf8')
  assert.match(session, /COMPASS_HISTORY_MESSAGES = 20/)
  assert.match(session, /COMPASS_HISTORY_MESSAGE_CHARS = 4000/)
})
