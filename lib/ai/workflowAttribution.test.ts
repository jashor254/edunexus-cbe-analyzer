// lib/ai/workflowAttribution.test.ts
//
// Phase 3 (2026-11-10): the Scheme of Work and lesson-plan generators attribute
// every AI request to its workflow (a job / scheme+week id), number their own
// validation retries, and change NOTHING else about the request.
//
// Only the AI wrapper and the repositories are mocked; the real generators,
// prompts, retry loops and validators run. No network, no credentials.
//
// Run: npx tsx --experimental-test-module-mocks --test lib/ai/workflowAttribution.test.ts
import { test, before, beforeEach, mock } from 'node:test'
import assert from 'node:assert/strict'

type Call = { prompt: string; system: string | undefined; options: Record<string, unknown> | undefined }
const calls: Call[] = []
let reply = 'this is not json'

mock.module('@/lib/ai/deepseek', {
  namedExports: {
    callDeepSeek: async (prompt: string, system?: string, options?: Record<string, unknown>) => {
      calls.push({ prompt, system, options })
      return reply
    },
  },
})
mock.module('@/lib/repositories', {
  namedExports: {
    repos: {
      curriculum: {
        findSOWWithTimeline: async (id: string) => ({
          id, teacher_id: 't', school: 'S', grade: 'Grade 8', learning_area: 'Mathematics', term: '2', year: 2026,
          teacher_name: null, tsc_number: null, breaks: [],
          timeline: [{ week: 4, lesson: 1, isBreak: false }],
          lessons: [{ week: 4, lesson: 1, strand: 'N', substrand: 'S1', substrandId: null, learningOutcomes: ['a', 'b', 'c'], keyInquiryQuestions: ['q'], learningResources: ['r'], assessmentMethods: [] }],
        }),
        findLessonPlansByWeek: async () => [],
        insertLessonPlans: async () => {},
      },
    },
  },
})
mock.module('@/lib/events', { namedExports: { publishEvent: async () => {} } })

let generateValidatedLesson: typeof import('@/lib/sow/aiLessonGenerator').generateValidatedLesson
let generateLessonPlan: typeof import('@/lib/lessonPlan/generator').generateLessonPlan
let generateSpecificWeekPlans: typeof import('@/lib/lessonPlan/weeklyGenerator').generateSpecificWeekPlans

before(async () => {
  ;({ generateValidatedLesson } = await import('@/lib/sow/aiLessonGenerator'))
  ;({ generateLessonPlan } = await import('@/lib/lessonPlan/generator'))
  ;({ generateSpecificWeekPlans } = await import('@/lib/lessonPlan/weeklyGenerator'))
})
beforeEach(() => { calls.length = 0; reply = 'this is not json' })

const sowCtx = {
  learningArea: 'Mathematics', grade: 'Grade 8', strand: 'Numbers', substrand: 'Fractions',
  lessonNumber: 1, totalLessons: 2, curriculumMode: 'cbc_junior' as const, subjectType: 'mathematics', textbook: 'Class textbook',
}
const lpCtx = {
  teacherName: '', tscNumber: '', school: 'S', learningArea: 'Mathematics', grade: 'Grade 8', term: 2, year: 2026,
  weekNumber: 4, lessonNumber: 1, strand: 'N', subStrand: 'S1', learningOutcomes: ['a', 'b', 'c'],
  learningExperiences: ['x', 'y', 'z'], keyInquiryQuestions: ['q'], learningResources: ['r'], assessmentMethods: [],
}

test('ATTR-001 SOW: every validation retry carries the job id and its attempt number 1..5', async () => {
  const r = await generateValidatedLesson({ ...sowCtx, correlationId: 'job-abc' })
  assert.equal(r._validated, false)
  assert.equal(calls.length, 5, 'unchanged: MAX_RETRIES = 5 requests when every reply is invalid')
  assert.deepEqual(calls.map(c => c.options?.workflowAttempt), [1, 2, 3, 4, 5])
  for (const c of calls) {
    assert.equal(c.options?.correlationId, 'job-abc')
    assert.equal(c.options?.feature, 'sow_generate')
    assert.equal(c.options?.callSite, 'sow.lesson')
  }
})

test('ATTR-002 SOW: attribution does not change the request itself (limits, temperature, system prompt, prompt text)', async () => {
  const strip = (o: Record<string, unknown> | undefined): Record<string, unknown> => {
    const { correlationId: _c, workflowAttempt: _w, callSite: _s, ...rest } = o ?? {}
    void _c; void _w; void _s
    return rest
  }
  await generateValidatedLesson({ ...sowCtx, correlationId: 'job-abc' })
  const withIds = calls.map(c => ({ prompt: c.prompt, system: c.system, options: strip(c.options) }))
  calls.length = 0
  await generateValidatedLesson({ ...sowCtx })
  const without = calls.map(c => ({ prompt: c.prompt, system: c.system, options: strip(c.options) }))
  assert.deepEqual(withIds, without)
  assert.equal(without[0].options.maxTokens, 1200)
  assert.equal(without[0].options.temperature, 0.65)
  assert.equal(without[0].options.feature, 'sow_generate')
})

test('ATTR-003 SOW: without a correlation id the call still works and attributes nothing', async () => {
  await generateValidatedLesson({ ...sowCtx })
  assert.equal(calls[0].options?.correlationId, undefined)
})

test('ATTR-004 lesson plan: attempts are numbered 1..3 and carry the correlation id; limits unchanged', async () => {
  await assert.rejects(() => generateLessonPlan({ ...lpCtx, correlationId: 'sow-1:week:4' }), /Lesson plan generation failed/)
  assert.equal(calls.length, 3, 'unchanged: 3 attempts on malformed output')
  assert.deepEqual(calls.map(c => c.options?.workflowAttempt), [1, 2, 3])
  for (const c of calls) {
    assert.equal(c.options?.correlationId, 'sow-1:week:4')
    assert.equal(c.options?.feature, 'lesson_plan_generate')
    assert.equal(c.options?.callSite, 'lesson_plan.lesson')
    assert.equal(c.options?.maxTokens, 2000)
    assert.equal(c.options?.temperature, 0.3)
  }
})

test('ATTR-005 weekly generation attributes each lesson plan to scheme + week', async () => {
  reply = JSON.stringify({ organisationOfLearning: 'o', introduction: 'i', step1: '1', step2: '2', step3: '3', conclusion: 'c', extendedActivities: 'e' })
  const r = await generateSpecificWeekPlans('scheme-uuid-1', 'auth-user', 4)
  assert.equal(r.generated, 1)
  assert.equal(calls.length, 1)
  assert.equal(calls[0].options?.correlationId, 'scheme-uuid-1:week:4')
})

test('ATTR-006 attribution ids are workflow ids only: no teacher, user or learner value reaches the call options', async () => {
  reply = JSON.stringify({ organisationOfLearning: 'o', introduction: 'i', step1: '1', step2: '2', step3: '3', conclusion: 'c', extendedActivities: 'e' })
  await generateSpecificWeekPlans('scheme-uuid-1', 'auth-user-SECRET', 4)
  const serialised = JSON.stringify(calls.map(c => c.options))
  assert.ok(!serialised.includes('auth-user-SECRET'), 'the teacher/auth id must not be placed in telemetry attribution')
})
