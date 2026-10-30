// lib/compass/compassNameLeak.test.ts
//
// R-1 (docs/audits/ai-call-efficiency-remediation.md phase 3→4): the class-
// report AI path restores a learner's real first name into persisted
// student_learning_context fields (session_goal, guided_topics,
// subject_action_steps, the compass_bridge strand/concept). Compass later
// interpolates those into its system prompt, so the name could reach Gemini
// or DeepSeek even though buildCompassPrompt() takes no name parameter.
//
// The fix pseudonymises the ASSEMBLED system prompt at the provider boundary
// (pseudonymiseCompassSystemPrompt), so it does not matter which field, or
// how, a name got in. These tests pack a real name into EVERY such field,
// prove the raw prompt leaks it, prove the boundary removes it, and prove
// both providers' real HTTP bodies are clean — while the learner still sees
// the correct name locally.
//
// Synthetic names only; the transport (global fetch) is mocked. No provider
// is contacted.
//
// Run: npx tsx --experimental-test-module-mocks --test lib/compass/compassNameLeak.test.ts
import { test, before, after, mock } from 'node:test'
import assert from 'node:assert/strict'

mock.module('@/lib/observability/logger', {
  namedExports: { logger: { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} } },
})
mock.module('@/lib/repositories', {
  namedExports: { repos: { developers: { insertAICostEvent: async () => {} } } },
})

const NAME = 'Wanjiru'          // the learner whose session this is
const FULL = 'Wanjiru Kamau'

let buildCompassPrompt: typeof import('./prompt').buildCompassPrompt
let pseudonymiseCompassSystemPrompt: typeof import('./providerPayload').pseudonymiseCompassSystemPrompt
let createLearnerNameStreamRestorer: typeof import('@/lib/ai/learnerPseudonym').createLearnerNameStreamRestorer
let streamDeepSeek: typeof import('@/lib/ai/deepseek').streamDeepSeek

before(async () => {
  process.env.DEEPSEEK_AI_API_KEY = 'sk-fixture'
  process.env.GOOGLE_GEMINI_API_KEY = 'gemini-fixture'
  ;({ buildCompassPrompt } = await import('./prompt'))
  ;({ pseudonymiseCompassSystemPrompt } = await import('./providerPayload'))
  ;({ createLearnerNameStreamRestorer } = await import('@/lib/ai/learnerPseudonym'))
  ;({ streamDeepSeek } = await import('@/lib/ai/deepseek'))
})

const originalFetch = globalThis.fetch
after(() => { globalThis.fetch = originalFetch })

// Every persisted field the class-report path can seed with a restored name,
// each carrying NAME, rendered into the prompt (holiday mode so holidayFocus
// renders; a knowledge block so Goal/Probe/Action render).
function nameBearingParams(name = NAME): Parameters<typeof buildCompassPrompt>[0] {
  return {
    grade: 8, level: 2, isJunior: true, subject: 'mathematics',
    subtopic: `${name}'s weak area: fractions`,
    gradeTopics: ['Fractions'], sessionsWithoutImprovement: 0,
    mode: 'holiday', holidayWeek: 2,
    holidayFocus: `Close ${name}'s fractions gap this holiday`,
    languageMode: 'mixed', questionMode: 'mcq-and-structured',
    teacherSuggested: true,
    teacherRecommendation: `${name} should revise fractions first`,
    knowledgeContext: {
      sessionGoal: `Help ${name} master adding fractions`,
      guidedTopics: [`where ${name} struggles`, 'equivalent fractions'],
      rootCauseSummary: `Adding fractions blocked for ${name} by place value`,
      subjectActionSteps: [`Practise daily with ${name}`],
      graphOpener: false, rootCauseTopic: 'place value', failingTopic: 'adding fractions',
    },
    lastSessionSummary: `${name} practised halves last time`,
  }
}

test('the raw assembled prompt DOES leak the name through persisted fields (the real vulnerability)', () => {
  const raw = buildCompassPrompt(nameBearingParams())
  assert.ok(raw.includes(NAME), 'sanity: these fields really do reach the prompt un-pseudonymised')
  // and through every distinct line we rely on below
  assert.match(raw, /Focus: Close Wanjiru/)        // holidayFocus
  assert.match(raw, /Goal: Help Wanjiru/)           // knowledgeContext.sessionGoal
  assert.match(raw, /Probe first: where Wanjiru/)   // guidedTopics
  assert.match(raw, /Action: Practise daily with Wanjiru/) // subjectActionSteps
  assert.match(raw, /Root cause: Adding fractions blocked for Wanjiru/) // rootCauseSummary
  assert.match(raw, /Teacher instruction: Wanjiru should revise/)       // teacherRecommendation
})

test('1 & 2: the boundary removes the name from every persisted field (first name and full name)', () => {
  const firstNameOnly = pseudonymiseCompassSystemPrompt(buildCompassPrompt(nameBearingParams()), NAME)
  assert.ok(!firstNameOnly.includes(NAME), 'no first-name occurrence survives in the assembled prompt')
  assert.match(firstNameOnly, /Focus: Close \{\{LEARNER\}\}'s fractions gap/)
  assert.match(firstNameOnly, /Goal: Help \{\{LEARNER\}\} master/)
  assert.match(firstNameOnly, /Teacher instruction: \{\{LEARNER\}\} should revise/)

  // A full name in a field: the first name is what we hold, and it is scrubbed;
  // the surname, which we do not hold, remains — documented limitation (§F).
  const full = pseudonymiseCompassSystemPrompt(buildCompassPrompt(nameBearingParams(FULL)), NAME)
  assert.ok(!/\bWanjiru\b/.test(full), 'the first name is gone even when it appeared as part of a full name')
})

test('3: case variations are pseudonymised', () => {
  const p = { ...nameBearingParams(), holidayFocus: `help WANJIRU and wanjiru and Wanjiru` }
  const out = pseudonymiseCompassSystemPrompt(buildCompassPrompt(p), NAME)
  assert.ok(!/wanjiru/i.test(out), 'every case folding of the name is removed')
})

test('4: repeated occurrences are all replaced consistently', () => {
  const out = pseudonymiseCompassSystemPrompt(`Goal: ${NAME}, ${NAME}, then ${NAME} again`, NAME)
  assert.equal(out, 'Goal: {{LEARNER}}, {{LEARNER}}, then {{LEARNER}} again')
})

test('5: ordinary words that merely contain the name as a substring are not corrupted', () => {
  // "Ada" inside "Canada"/"gradable" must survive; a standalone "Ada" is replaced.
  const out = pseudonymiseCompassSystemPrompt('Canada has a gradable scale; Ada did well', 'Ada')
  assert.equal(out, 'Canada has a gradable scale; {{LEARNER}} did well')
})

test('6 & 7: both Gemini (primary) and DeepSeek (fallback) receive a prompt with no learner name', async () => {
  const system = pseudonymiseCompassSystemPrompt(buildCompassPrompt(nameBearingParams()), NAME)

  const bodies: { provider: string; body: string }[] = []
  globalThis.fetch = (async (url: string, opts?: RequestInit) => {
    const body = String(opts?.body ?? '')
    if (String(url).includes('generativelanguage.googleapis.com')) {
      bodies.push({ provider: 'gemini', body })
      return new Response(JSON.stringify({ error: { message: 'unavailable' } }), { status: 503 })
    }
    bodies.push({ provider: 'deepseek', body })
    return new Response('data: {"choices":[{"delta":{"content":"ok"}}]}\n\ndata: [DONE]\n\n', { status: 200 })
  }) as typeof fetch

  const stream = await streamDeepSeek(system, 'what is 1/2 + 1/4?', [], { feature: 'learning_compass' })
  await new Response(stream).text()

  assert.deepEqual(bodies.map(b => b.provider), ['gemini', 'deepseek'], 'Gemini primary, then DeepSeek fallback')
  for (const { provider, body } of bodies) {
    assert.ok(!body.includes(NAME), `${provider} request body must not contain the learner's name`)
    assert.ok(body.includes('{{LEARNER}}'), `${provider} receives the placeholder form`)
  }
})

test('8: a learner with no stored name is unaffected (null name replaces nothing, no crash)', () => {
  const out = pseudonymiseCompassSystemPrompt('Goal: close the fractions gap', null)
  assert.equal(out, 'Goal: close the fractions gap')
})

test('9: local display still restores the correct name (the fix is outbound-only)', () => {
  // The model echoes {{LEARNER}} (we told it to); the learner sees their real name.
  const r = createLearnerNameStreamRestorer(NAME)
  const shown = r.push('Well done {{LEARNER}}, 1/2 + 1/4 = 3/4') + r.flush()
  assert.equal(shown, `Well done ${NAME}, 1/2 + 1/4 = 3/4`)
})

test('scoping: the boundary scrubs against THIS session\'s learner name only', () => {
  // The name used is the current learner's own first name (route derives it
  // from the authenticated student record). A field scrubbed against NAME is
  // not affected by some other learner's name — there is no cross-learner
  // substitution, and nothing here can pull another learner's name in.
  const prompt = buildCompassPrompt({ ...nameBearingParams(), holidayFocus: 'Close Mwangi\'s gap' })
  const out = pseudonymiseCompassSystemPrompt(prompt, NAME)
  assert.ok(out.includes('Mwangi'), 'a different name in the field is not this learner\'s, so it is left as-is (and this learner\'s own name is still removed)')
  assert.ok(!out.includes(NAME))
})
