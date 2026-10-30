// lib/ai/generationRetryBudget.test.ts
//
// Security audit 2026-10-30, F-03 — retry multiplication. callDeepSeek
// already retries a transient failure once and then falls back to Gemini, so
// a generator that ALSO re-runs the whole call after a provider failure turns
// one outage into many billed calls (up to 9 per lesson plan, 15 per SOW
// lesson). Proves, with the provider mocked and every call counted, that:
//   - a provider failure ends the generation after ONE wrapper call;
//   - a real but unusable response is re-asked only within a fixed budget;
//   - a good response is used at once.
//
// Run with: npx tsx --experimental-test-module-mocks --test lib/ai/generationRetryBudget.test.ts
import { test, before, beforeEach, mock } from 'node:test'
import assert from 'node:assert/strict'

let calls = 0
let script: Array<'throw' | 'garbage' | string> = []

mock.module('@/lib/ai/deepseek', {
  namedExports: {
    callDeepSeek: async () => {
      const next = script[Math.min(calls, script.length - 1)]
      calls++
      if (next === 'throw') throw new Error('DeepSeek timeout after 25s')
      if (next === 'garbage') return 'not json at all'
      return next
    },
  },
})

let generateLessonPlan: typeof import('@/lib/lessonPlan/generator').generateLessonPlan
let generateValidatedLesson: typeof import('@/lib/sow/aiLessonGenerator').generateValidatedLesson
before(async () => {
  ;({ generateLessonPlan } = await import('@/lib/lessonPlan/generator'))
  ;({ generateValidatedLesson } = await import('@/lib/sow/aiLessonGenerator'))
})
beforeEach(() => { calls = 0; script = [] })

const LESSON_CTX = {
  teacherName: 'T', tscNumber: '1', school: 'S', learningArea: 'Mathematics', grade: 'Grade 8',
  term: 1, year: 2026, weekNumber: 1, lessonNumber: 1, strand: 'Numbers', subStrand: 'Fractions',
  learningOutcomes: ['identify fractions', 'add fractions', 'value fractions'],
  keyInquiryQuestions: ['Why do we use fractions?'], learningResources: ['Textbook'],
  learningExperiences: [], assessmentMethods: [],
}
const VALID_PLAN = JSON.stringify({
  organisationOfLearning: 'Groups', introduction: 'Intro', step1: 'One', step2: 'Two', step3: 'Three',
  conclusion: 'Wrap', extendedActivities: 'Homework', reflection: 'Reflect',
})

test('lesson plan: a provider failure stops after one wrapper call (no re-run of the recovery chain)', async () => {
  script = ['throw']
  await assert.rejects(generateLessonPlan(LESSON_CTX), /Lesson plan generation failed/)
  assert.equal(calls, 1)
})

test('lesson plan: unusable responses are re-asked at most once (2 calls total)', async () => {
  script = ['garbage']
  await assert.rejects(generateLessonPlan(LESSON_CTX))
  assert.equal(calls, 2)
})

test('lesson plan: one bad response then a good one succeeds within the budget', async () => {
  script = ['garbage', VALID_PLAN]
  const plan = await generateLessonPlan(LESSON_CTX)
  assert.equal(plan.step1, 'One')
  assert.equal(calls, 2)
})

test('lesson plan: a good first response uses exactly one call', async () => {
  script = [VALID_PLAN]
  await generateLessonPlan(LESSON_CTX)
  assert.equal(calls, 1)
})

const SOW_CTX = {
  learningArea: 'Mathematics', grade: 'Grade 8', strand: 'Numbers', substrand: 'Fractions and decimals',
  lessonNumber: 1, totalLessons: 1, curriculumMode: 'cbc_junior' as const, subjectType: 'mathematics',
  textbook: 'Synthetic textbook',
}

test('SOW lesson: a provider failure stops after one wrapper call instead of five', async () => {
  script = ['throw']
  const result = await generateValidatedLesson(SOW_CTX)
  assert.equal(result._validated, false)
  assert.match(String(result.details), /AI request failed/)
  assert.equal(calls, 1)
})

test('SOW lesson: unparseable responses keep their bounded re-ask budget (5)', async () => {
  script = ['garbage']
  const result = await generateValidatedLesson(SOW_CTX)
  assert.equal(result._validated, false)
  assert.equal(calls, 5)
})
