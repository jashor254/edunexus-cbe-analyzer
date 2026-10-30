// lib/compass/compassPrivacy.test.ts
//
// Compass learner-data minimisation (docs/audits/ai-call-efficiency-deep-audit.md
// PR-1/F-02, PR-6/F-13). Synthetic names only — nothing here reaches a real
// provider; the transport (global fetch) is mocked.
//
//  1. The system prompt cannot carry a name (no name parameter exists).
//  2. Learner message, stored history and the last-session summary are
//     pseudonymised before they are sent.
//  3. The SAME pseudonymised payload reaches the fallback provider: a real
//     streamDeepSeek() run where Gemini fails and DeepSeek answers is
//     inspected at the HTTP-body level for both providers.
//  4. The reply is restored for the learner even when the placeholder is
//     split across stream chunks.
//
// Run: npx tsx --experimental-test-module-mocks --test lib/compass/compassPrivacy.test.ts
import { test, before, after, mock } from 'node:test'
import assert from 'node:assert/strict'

mock.module('@/lib/observability/logger', {
  namedExports: { logger: { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} } },
})
mock.module('@/lib/repositories', {
  namedExports: { repos: { developers: { insertAICostEvent: async () => {} } } },
})

const NAME = 'Wanjiru'

let buildCompassPrompt: typeof import('./prompt').buildCompassPrompt
let pseudonymiseCompassProviderText: typeof import('./providerPayload').pseudonymiseCompassProviderText
let pseudo: typeof import('@/lib/ai/learnerPseudonym')
let streamDeepSeek: typeof import('@/lib/ai/deepseek').streamDeepSeek

before(async () => {
  process.env.DEEPSEEK_AI_API_KEY = 'sk-fixture'
  process.env.GOOGLE_GEMINI_API_KEY = 'gemini-fixture'
  ;({ buildCompassPrompt } = await import('./prompt'))
  ;({ pseudonymiseCompassProviderText } = await import('./providerPayload'))
  pseudo = await import('@/lib/ai/learnerPseudonym')
  ;({ streamDeepSeek } = await import('@/lib/ai/deepseek'))
})

const originalFetch = globalThis.fetch
after(() => { globalThis.fetch = originalFetch })

function promptParams(): Parameters<typeof buildCompassPrompt>[0] {
  return {
    grade: 8, level: 2, isJunior: true, subject: 'mathematics', subtopic: 'fractions',
    gradeTopics: ['Fractions'], sessionsWithoutImprovement: 0, mode: 'school',
    languageMode: 'mixed', questionMode: 'mcq-and-structured',
    teacherSuggested: true,
    knowledgeContext: {
      sessionGoal: null, guidedTopics: [], rootCauseSummary: null, subjectActionSteps: [],
      graphOpener: true, rootCauseTopic: 'Equivalent fractions', failingTopic: 'Adding fractions',
    },
    lastSessionSummary: `{{LEARNER}} practised halves and quarters.`,
  }
}

test('the Compass system prompt names the learner only by the placeholder — opener, learner line and eval template', () => {
  const prompt = buildCompassPrompt(promptParams())
  assert.ok(prompt.includes('Hey {{LEARNER}}!'), 'opener uses the placeholder')
  assert.match(prompt, /\{\{LEARNER\}\} \| Grade 8 \| Level 2\/4/)
  assert.match(prompt, /"one_line_summary":"\{\{LEARNER\}\} /)
  assert.ok(!('firstName' in promptParams()), 'there is no name parameter to pass')
})

test('message, stored history and last-session summary are pseudonymised; other text is untouched', () => {
  const out = pseudonymiseCompassProviderText({
    message: `hi, I am ${NAME}. ${NAME.toLowerCase()} needs help with 3/4`,
    history: [
      { role: 'assistant', content: `Great work, ${NAME}! What is 1/2 + 1/4?` },
      { role: 'user', content: 'is it 3/4' },
    ],
    lastSessionSummary: `${NAME} practised halves and quarters.`,
  }, NAME)

  const all = JSON.stringify(out)
  assert.ok(!all.toLowerCase().includes(NAME.toLowerCase()), 'no occurrence of the name survives, in any case')
  assert.equal(out.history[1].content, 'is it 3/4')
  assert.equal(out.message, 'hi, I am {{LEARNER}}. {{LEARNER}} needs help with 3/4')
  assert.equal(out.lastSessionSummary, '{{LEARNER}} practised halves and quarters.')
})

test('pseudonymisation is whole-word: a longer name containing it is not mangled', () => {
  assert.equal(pseudo.pseudonymiseLearnerName('Aminata and Amina', 'Amina'), 'Aminata and {{LEARNER}}')
})

test('no stored name → nothing replaced (a display fallback like "there" is never treated as a name)', () => {
  const out = pseudonymiseCompassProviderText({ message: 'over there', history: [], lastSessionSummary: undefined }, null)
  assert.equal(out.message, 'over there')
})

test('fallback provider receives the identical pseudonymised payload — no name in either HTTP body', async () => {
  const text = pseudonymiseCompassProviderText({
    message: `${NAME} here, what is a fraction?`,
    // Stored history always opens with the learner's turn (pairs are written
    // together) — Gemini's SDK rejects a history that starts with the model.
    history: [
      { role: 'user', content: `Let's begin our Mathematics session.` },
      { role: 'assistant', content: `Hello ${NAME}!` },
    ],
    lastSessionSummary: undefined,
  }, NAME)
  const system = buildCompassPrompt(promptParams())

  const bodies: { provider: string; body: string }[] = []
  globalThis.fetch = (async (url: string, opts?: RequestInit) => {
    const body = String(opts?.body ?? '')
    if (String(url).includes('generativelanguage.googleapis.com')) {
      bodies.push({ provider: 'gemini', body })
      return new Response(JSON.stringify({ error: { message: 'unavailable' } }), { status: 503 })
    }
    bodies.push({ provider: 'deepseek', body })
    const sse = 'data: {"choices":[{"delta":{"content":"Hi {{LEA"}}]}\n\ndata: {"choices":[{"delta":{"content":"RNER}}!"}}]}\n\ndata: [DONE]\n\n'
    return new Response(sse, { status: 200 })
  }) as typeof fetch

  const stream = await streamDeepSeek(system, text.message, text.history, { feature: 'learning_compass' })
  await new Response(stream).text()

  assert.deepEqual(bodies.map(b => b.provider), ['gemini', 'deepseek'], 'Gemini primary, DeepSeek fallback')
  for (const { provider, body } of bodies) {
    assert.ok(!body.includes(NAME), `${provider} request body must not contain the learner's name`)
    assert.ok(body.includes('{{LEARNER}} here, what is a fraction?'), `${provider} receives the pseudonymised message`)
    assert.ok(body.includes('Hello {{LEARNER}}!'), `${provider} receives the pseudonymised history`)
  }
})

test('the streamed reply is restored for the learner even when the placeholder is split across chunks', () => {
  const reply = 'Well done {{LEARNER}}! Try {x} next, {{LEARNER}}.'
  for (let cut1 = 1; cut1 < reply.length - 1; cut1++) {
    for (const cut2 of [cut1 + 1, Math.min(reply.length - 1, cut1 + 7)]) {
      const r = pseudo.createLearnerNameStreamRestorer(NAME)
      const out = r.push(reply.slice(0, cut1)) + r.push(reply.slice(cut1, cut2)) + r.push(reply.slice(cut2)) + r.flush()
      assert.equal(out, `Well done ${NAME}! Try {x} next, ${NAME}.`, `split at ${cut1}/${cut2}`)
    }
  }
})

test('the restorer only holds back a possible placeholder prefix — ordinary text streams immediately', () => {
  const r = pseudo.createLearnerNameStreamRestorer(NAME)
  assert.equal(r.push('Half of {x} is '), 'Half of {x} is ')
  assert.equal(r.push('a fraction {{LEA'), 'a fraction ')
  assert.equal(r.push('RNER}}'), NAME)
  assert.equal(r.flush(), '')
})
