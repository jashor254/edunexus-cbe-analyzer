// lib/ai/streamDeepSeek.privacy.test.ts
//
// Privacy regression at the provider boundary for Compass streaming. Builds a
// real Compass payload (buildCompassProviderPayload) from synthetic learner
// data containing the learner's name everywhere it can appear, hands it to the
// real streamDeepSeek, and captures the actual HTTP request bodies each
// provider path would transmit:
//   - Gemini (primary): built and serialised by the REAL @google/generative-ai
//     SDK — only global fetch is replaced, so this is the SDK's true wire body
//   - DeepSeek (fallback): the request body
//   - DeepSeek retry after a transient network error: the second body
// It also captures every structured log line emitted on those paths.
// No network calls leave the process. All learner data is synthetic.

import { test, mock, before, beforeEach, after } from 'node:test'
import assert from 'node:assert/strict'

const logLines: string[] = []
const capture = (level: string) => (message: string, context?: unknown, err?: unknown) => {
  logLines.push(JSON.stringify({ level, message, context, err: err instanceof Error ? err.message : err }))
}
const fakeLogger = { debug: capture('debug'), info: capture('info'), warn: capture('warn'), error: capture('error') }

mock.module('@/lib/observability/logger', { namedExports: { logger: fakeLogger, createLogger: () => fakeLogger } })
mock.module('@/lib/repositories', { namedExports: { repos: {} } })
mock.module('@/lib/ai-orchestration/registry', {
  namedExports: { recordSuccess: () => {}, recordError: () => {}, getProvider: () => null, getAllProviders: () => [], getHealthyProviders: () => [] },
})

let streamDeepSeek: typeof import('./deepseek').streamDeepSeek
let NoAllowedProviderError: typeof import('./deepseek').NoAllowedProviderError
// The historical routing (Gemini, then DeepSeek) — what these payload tests exercise.
const BOTH = ['gemini', 'deepseek'] as const
let trimHistoryForProvider: typeof import('./deepseek').trimHistoryForProvider
let buildCompassProviderPayload: typeof import('@/lib/compass/providerPayload').buildCompassProviderPayload

type Request = { host: 'gemini' | 'deepseek' | 'other'; body: string }
const requests: Request[] = []
let geminiBehavior: 'ok' | 'http-503' = 'ok'
let deepseekBehavior: 'ok' | 'fail-once' | 'http-500' = 'ok'
let deepseekCalls = 0

const GEMINI_SSE =
  'data: {"candidates":[{"content":{"parts":[{"text":"Hey {{LEARNER}}!"}],"role":"model"},"index":0}],' +
  '"usageMetadata":{"totalTokenCount":5}}\n\n'

const realFetch = globalThis.fetch
const savedEnv = { gemini: process.env.GOOGLE_GEMINI_API_KEY, deepseek: process.env.DEEPSEEK_AI_API_KEY }

before(async () => {
  process.env.GOOGLE_GEMINI_API_KEY = 'test-key' // dummy — every request is answered by the fake fetch below
  process.env.DEEPSEEK_AI_API_KEY = 'test-key'
  globalThis.fetch = (async (input: unknown, init?: { body?: unknown }) => {
    const url = String(input instanceof Request ? input.url : input)
    const host = url.includes('generativelanguage.googleapis.com') ? 'gemini' : url.includes('deepseek') ? 'deepseek' : 'other'
    requests.push({ host, body: String(init?.body ?? '') })
    if (host === 'gemini') {
      return geminiBehavior === 'ok'
        ? new Response(GEMINI_SSE, { status: 200, headers: { 'Content-Type': 'text/event-stream' } })
        : new Response('{"error":{"code":503,"message":"overloaded"}}', { status: 503 })
    }
    deepseekCalls += 1
    if (deepseekBehavior === 'fail-once' && deepseekCalls === 1) throw new TypeError('fetch failed')
    if (deepseekBehavior === 'http-500') return new Response('{"error":{"message":"upstream overloaded"}}', { status: 500 })
    return new Response('data: [DONE]\n\n', { status: 200 })
  }) as typeof fetch
  ;({ streamDeepSeek, trimHistoryForProvider, NoAllowedProviderError } = await import('./deepseek'))
  ;({ buildCompassProviderPayload } = await import('@/lib/compass/providerPayload'))
})

after(() => {
  globalThis.fetch = realFetch
  process.env.GOOGLE_GEMINI_API_KEY = savedEnv.gemini
  process.env.DEEPSEEK_AI_API_KEY = savedEnv.deepseek
})

beforeEach(() => {
  requests.length = 0
  logLines.length = 0
  geminiBehavior = 'ok'
  deepseekBehavior = 'ok'
  deepseekCalls = 0
})

const QUESTION = 'Wanjiru here — how do I solve 3x + 2 = 11?'

function namedPayload(turns = 2) {
  const history: { role: 'user' | 'assistant'; content: string }[] = []
  for (let i = 0; i < turns; i++) {
    history.push(i % 2 === 0
      ? { role: 'user', content: `turn ${i}: I am Wanjiru Fixturekamau` }
      : { role: 'assistant', content: `turn ${i}: Welcome back, Wanjirũ!` })
  }
  return buildCompassProviderPayload({
    promptParams: {
      grade: 8, level: 2, levelSource: 'projection', isJunior: true, pathway: null,
      subject: 'Mathematics', subtopic: 'Linear equations', gradeTopics: ['Linear equations'],
      lastSessionSummary: 'Wanjirũ Fixturekamau rushed the check step.',
      holidayFocus: 'Wanjirũ: fractions', mode: 'holiday', holidayWeek: 1,
      sessionsWithoutImprovement: 0, languageMode: 'mixed', questionMode: 'mcq-and-structured',
    },
    identity: { firstName: 'Wanjirũ', fullName: 'Wanjirũ Fixturekamau' },
    message: QUESTION,
    history,
  })
}

const FORBIDDEN = [/wanjir/i, /fixturekamau/i]
function assertNoName(text: string, where: string): void {
  for (const pattern of FORBIDDEN) assert.doesNotMatch(text, pattern, `${where} leaked a learner name part`)
}

async function drain(stream: ReadableStream<Uint8Array>): Promise<string> {
  const reader = stream.getReader()
  const decoder = new TextDecoder()
  let out = ''
  for (let r = await reader.read(); !r.done; r = await reader.read()) out += decoder.decode(r.value)
  return out
}

test('I: Gemini (primary) — the real SDK wire body carries the token and no name part', async () => {
  const payload = namedPayload()
  const streamed = await drain(await streamDeepSeek(payload.systemPrompt, payload.message, payload.history, { providers: BOTH, temperature: 0.3 }))

  assert.deepEqual(requests.map(r => r.host), ['gemini'], 'DeepSeek must not be called when Gemini succeeds')
  const body = requests[0].body
  assertNoName(body, 'Gemini request body')
  assert.ok(body.includes('{{LEARNER}}'), 'the token, not the name, is what the model sees')
  assert.ok(body.includes('3x + 2 = 11'), 'the learner question itself is still sent')
  assert.match(streamed, /\{\{LEARNER\}\}/, 'the token comes back for local restoration')
})

test('I: when Gemini fails, the DeepSeek fallback body is the same scrubbed payload', async () => {
  geminiBehavior = 'http-503'
  const payload = namedPayload()
  await streamDeepSeek(payload.systemPrompt, payload.message, payload.history, { providers: BOTH, temperature: 0.3 })

  const deepseek = requests.filter(r => r.host === 'deepseek')
  assert.equal(deepseek.length, 1)
  const body = JSON.parse(deepseek[0].body) as { messages: { role: string; content: string }[] }
  assert.equal(body.messages[0].content, payload.systemPrompt)
  assert.equal(body.messages.at(-1)?.content, payload.message)
  assertNoName(deepseek[0].body, 'DeepSeek request body')
})

test('J: the DeepSeek retry after a transient network error resends the same scrubbed body', async () => {
  geminiBehavior = 'http-503'
  deepseekBehavior = 'fail-once'
  const payload = namedPayload()
  await streamDeepSeek(payload.systemPrompt, payload.message, payload.history, { providers: BOTH, temperature: 0.3 })

  const deepseek = requests.filter(r => r.host === 'deepseek')
  assert.equal(deepseek.length, 2)
  assert.equal(deepseek[1].body, deepseek[0].body)
  assertNoName(deepseek[1].body, 'DeepSeek retry body')
})

test('J/K: a provider HTTP error surfaces without echoing the learner request', async () => {
  geminiBehavior = 'http-503'
  deepseekBehavior = 'http-500'
  const payload = namedPayload()
  await assert.rejects(
    streamDeepSeek(payload.systemPrompt, payload.message, payload.history, { providers: BOTH, temperature: 0.3 }),
    (err: Error) => {
      assertNoName(err.message, 'thrown provider error')
      assert.ok(!err.message.includes('3x + 2'), 'thrown error must not carry the learner message')
      return true
    },
  )
})

test('K: every log line on the Gemini, fallback and retry paths is free of names and learner text', async () => {
  const payload = namedPayload()
  await drain(await streamDeepSeek(payload.systemPrompt, payload.message, payload.history, { providers: BOTH, temperature: 0.3 }))
  geminiBehavior = 'http-503'
  deepseekBehavior = 'fail-once'
  await streamDeepSeek(payload.systemPrompt, payload.message, payload.history, { providers: BOTH, temperature: 0.3 })

  assert.ok(logLines.length > 0, 'expected the paths to log something')
  const logs = logLines.join('\n')
  assertNoName(logs, 'structured logs')
  assert.ok(!logs.includes('3x + 2'), 'logs must not carry the learner message')
  assert.ok(!logs.includes('rushed the check'), 'logs must not carry learner history/summary')
})

test('routing: a long session (history > 20 turns) still goes to Gemini, not the DeepSeek fallback', async () => {
  // Compass history is [user, assistant, …, user] (odd length). Before the fix,
  // slice(-20) began with an assistant turn and the Gemini SDK rejected it.
  const payload = namedPayload(23)
  await drain(await streamDeepSeek(payload.systemPrompt, payload.message, payload.history, { providers: BOTH, temperature: 0.3 }))
  assert.deepEqual(requests.map(r => r.host), ['gemini'])
})

test('trimHistoryForProvider bounds history and always starts with a user turn', () => {
  const turns = Array.from({ length: 23 }, (_, i) => ({ role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant', content: String(i) }))
  const trimmed = trimHistoryForProvider(turns)
  assert.ok(trimmed.length <= 20)
  assert.equal(trimmed[0].role, 'user')
  assert.equal(trimmed.at(-1)?.content, '22', 'the most recent turn is kept')
  assert.deepEqual(trimHistoryForProvider([]), [])
  assert.deepEqual(trimHistoryForProvider([{ role: 'assistant', content: 'hi' }]), [])
})

// ── Explicit, fail-closed provider routing (2026-10-22) ────────────────────
// A provider that is not in `providers` must never be contacted — not even as a
// fallback when the primary fails.

test('routing: an empty provider list throws before ANY network request', async () => {
  const payload = namedPayload()
  await assert.rejects(
    streamDeepSeek(payload.systemPrompt, payload.message, payload.history, { providers: [], temperature: 0.3 }),
    (err: Error) => err instanceof NoAllowedProviderError,
  )
  assert.equal(requests.length, 0)
})

test('routing: gemini-only — when Gemini fails, DeepSeek is NOT contacted', async () => {
  geminiBehavior = 'http-503'
  const payload = namedPayload()
  await assert.rejects(
    streamDeepSeek(payload.systemPrompt, payload.message, payload.history, { providers: ['gemini'], temperature: 0.3 }),
  )
  assert.deepEqual(requests.map(r => r.host), ['gemini'])
  assert.ok(logLines.some(l => l.includes('no further provider allowed')), 'the refusal to fall back is logged')
})

test('routing: deepseek-only — Gemini is never contacted, payload still scrubbed', async () => {
  const payload = namedPayload()
  await streamDeepSeek(payload.systemPrompt, payload.message, payload.history, { providers: ['deepseek'], temperature: 0.3 })
  assert.deepEqual(requests.map(r => r.host), ['deepseek'])
  assertNoName(requests[0].body, 'DeepSeek-only request body')
})
