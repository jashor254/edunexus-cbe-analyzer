// lib/lessonPlan/reflectionPrompt.test.ts
//
// Small prompt optimisation: the lesson-plan reflection prompt
// is fully determined by the lesson's outcomes, so the model is no longer asked
// to echo it. These tests pin that (1) the stored text is byte-identical to
// what the prompt used to demand, (2) every field that carries unique
// educational content is still requested, and (3) a model-supplied reflection
// can no longer drift from the outcomes.
//
// Real prompt builder and parser; only the AI wrapper is mocked (it captures
// the prompt and returns canned JSON). No network.
//
// Run: npx tsx --experimental-test-module-mocks --test lib/lessonPlan/reflectionPrompt.test.ts
import { test, before, beforeEach, mock } from 'node:test'
import assert from 'node:assert/strict'

const prompts: string[] = []
let reply = ''
mock.module('@/lib/ai/deepseek', {
  namedExports: { callDeepSeek: async (prompt: string) => { prompts.push(prompt); return reply } },
})

let generateLessonPlan: typeof import('./generator').generateLessonPlan
let buildReflectionPrompt: typeof import('./generator').buildReflectionPrompt
before(async () => { ({ generateLessonPlan, buildReflectionPrompt } = await import('./generator')) })
beforeEach(() => { prompts.length = 0 })

const ctx = (learningArea: string, outcomes: string[]) => ({
  teacherName: '', tscNumber: '', school: 'S', learningArea, grade: 'Grade 8', term: 2, year: 2026,
  weekNumber: 4, lessonNumber: 1, strand: 'Strand', subStrand: 'Sub', learningOutcomes: outcomes,
  learningExperiences: ['e1', 'e2', 'e3'], keyInquiryQuestions: ['q'], learningResources: ['r'], assessmentMethods: [],
})

const fullReply = (extra: Record<string, unknown> = {}): string => JSON.stringify({
  organisationOfLearning: 'Classroom — groups of 4', introduction: 'intro', step1: 's1', step2: 's2', step3: 's3',
  conclusion: 'conc', extendedActivities: '- Draw x\n- Write y\n- Ask z', ...extra,
})

test('REFL-001 English reflection text is exactly the string the prompt used to demand', () => {
  assert.equal(
    buildReflectionPrompt(ctx('Mathematics', ['add fractions', 'compare fractions', 'value sharing'])),
    'Were learners able to add fractions? Were learners able to compare fractions? Were learners able to value sharing? If not, how will you assist them in the next lesson?',
  )
})

test('REFL-002 Kiswahili reflection text is exactly the previous Kiswahili string', () => {
  assert.equal(
    buildReflectionPrompt(ctx('Kiswahili', ['kutaja', 'kueleza', 'kuthamini'])),
    'Je, wanafunzi waliweza kutaja? Je, wanafunzi waliweza kueleza? Je, wanafunzi waliweza kuthamini? Kama sivyo, utawasaidiaje katika somo lijalo?',
  )
})

test('REFL-003 missing outcomes keep the same placeholders as before', () => {
  assert.equal(
    buildReflectionPrompt(ctx('Mathematics', ['only one'])),
    'Were learners able to only one? Were learners able to [outcome b]? Were learners able to [outcome c]? If not, how will you assist them in the next lesson?',
  )
})

test('REFL-004 the prompt no longer asks the model for a reflection field (English and Kiswahili)', async () => {
  reply = fullReply()
  await generateLessonPlan(ctx('Mathematics', ['a', 'b', 'c']))
  await generateLessonPlan(ctx('Kiswahili', ['a', 'b', 'c']))
  assert.equal(prompts.length, 2)
  for (const p of prompts) {
    assert.doesNotMatch(p, /"reflection"\s*:/)
    assert.doesNotMatch(p, /reflection field must be output exactly/i)
    assert.doesNotMatch(p, /Sehemu ya tafakuri lazima itolewe/)
  }
})

test('REFL-005 every field that carries unique educational content is still requested', async () => {
  reply = fullReply()
  await generateLessonPlan(ctx('Mathematics', ['a', 'b', 'c']))
  for (const key of ['organisationOfLearning', 'introduction', 'step1', 'step2', 'step3', 'conclusion', 'extendedActivities']) {
    assert.match(prompts[0], new RegExp(`"${key}"\\s*:`), `${key} must still be requested`)
  }
  assert.match(prompts[0], /Learners are ALWAYS the subject/i, 'learner-centred rule intact')
})

test('REFL-006 the stored reflection is built by code, ignoring any model-supplied one', async () => {
  reply = fullReply({ reflection: 'MODEL PARAPHRASE THAT DRIFTED FROM THE OUTCOMES' })
  const plan = await generateLessonPlan(ctx('Mathematics', ['a', 'b', 'c']))
  assert.equal(plan.reflection, buildReflectionPrompt(ctx('Mathematics', ['a', 'b', 'c'])))
  assert.doesNotMatch(plan.reflection, /PARAPHRASE/)
})

test('REFL-007 required-field validation is unchanged: a reply missing a real field is still rejected', async () => {
  reply = JSON.stringify({ organisationOfLearning: 'o', introduction: 'i', step1: '1', step2: '2', step3: '3', conclusion: 'c' })
  await assert.rejects(() => generateLessonPlan(ctx('Mathematics', ['a', 'b', 'c'])), /Missing required fields/)
  assert.equal(prompts.length, 3, 'still 3 attempts')
})

test('REFL-008 a reply with no reflection key is accepted (it is no longer required)', async () => {
  reply = fullReply()
  const plan = await generateLessonPlan(ctx('Mathematics', ['a', 'b', 'c']))
  assert.equal(plan.step1, 's1')
  assert.ok(plan.reflection.startsWith('Were learners able to a?'))
})
