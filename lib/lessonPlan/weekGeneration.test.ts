// lib/lessonPlan/weekGeneration.test.ts
//
// Wasted lesson-plan generation (docs/audits/ai-call-efficiency-deep-audit.md F-06).
//
//   - Lessons already planned are skipped BEFORE any AI call; a fully planned
//     week makes no AI call and never runs the quota hook.
//   - One failed lesson no longer discards the week's successful plans.
//   - Every lesson failing still throws (callers treat it as failure).
//   - A concurrent duplicate (unique-constraint violation on save) is reported
//     as already generated, not as a failure.
//   - The quota hook runs once, before the first AI call, and a refusal stops
//     all AI work.
//
// Run: npx tsx --experimental-test-module-mocks --test lib/lessonPlan/weekGeneration.test.ts
import { test, before, beforeEach, mock } from 'node:test'
import assert from 'node:assert/strict'

type Lesson = { week: number; lesson: number; strand: string; substrand: string; substrandId: string | null; learningOutcomes: string[]; keyInquiryQuestions: string[]; learningResources: string[]; assessmentMethods: string[] }

let existingLessonNumbers: number[] = []
let failingLessons = new Set<number>()
let saveError: Error | null = null
let generated: number[] = []
let inserted: Array<{ lesson_number: number }> = []

const lesson = (n: number): Lesson => ({
  week: 4, lesson: n, strand: 'Numbers', substrand: `Sub ${n}`, substrandId: null,
  learningOutcomes: ['o'], keyInquiryQuestions: [], learningResources: [], assessmentMethods: [],
})

mock.module('@/lib/repositories', {
  namedExports: {
    repos: {
      curriculum: {
        findSOWWithTimeline: async (id: string) => ({
          id, teacher_id: 't', school: 'S', grade: 'Grade 8', learning_area: 'Mathematics', term: '2', year: 2026,
          teacher_name: null, tsc_number: null, breaks: [],
          timeline: [1, 2, 3].map(n => ({ week: 4, lesson: n, isBreak: false })),
          lessons: [1, 2, 3].map(lesson),
        }),
        findLessonPlansByWeek: async () => existingLessonNumbers.map(n => ({ lesson_number: n })),
        insertLessonPlans: async (rows: Array<{ lesson_number: number }>) => {
          if (saveError) throw saveError
          inserted.push(...rows)
        },
      },
    },
  },
})

mock.module('./generator', {
  namedExports: {
    generateLessonPlan: async (ctx: { lessonNumber: number }) => {
      generated.push(ctx.lessonNumber)
      if (failingLessons.has(ctx.lessonNumber)) throw new Error(`lesson ${ctx.lessonNumber} failed`)
      return {
        context: ctx, organisationOfLearning: 'o', introduction: 'i', step1: '1', step2: '2', step3: '3',
        conclusion: 'c', extendedActivities: 'e', reflection: 'r', generatedAt: '2026-10-30T00:00:00Z',
      }
    },
  },
})

mock.module('@/lib/events', { namedExports: { publishEvent: async () => {} } })

let generateSpecificWeekPlans: typeof import('./weeklyGenerator').generateSpecificWeekPlans
before(async () => { ({ generateSpecificWeekPlans } = await import('./weeklyGenerator')) })

beforeEach(() => {
  existingLessonNumbers = []
  failingLessons = new Set()
  saveError = null
  generated = []
  inserted = []
})

test('a fully planned week makes no AI call and never reserves quota', async () => {
  existingLessonNumbers = [1, 2, 3]
  let hookRuns = 0
  const r = await generateSpecificWeekPlans('sow', 'u', 4, undefined, { beforeGenerate: async () => { hookRuns++ } })
  assert.equal(r.generated, 0)
  assert.equal(r.reason, 'already_generated')
  assert.equal(generated.length, 0)
  assert.equal(hookRuns, 0)
})

test('a partially planned week generates ONLY the missing lessons', async () => {
  existingLessonNumbers = [1]
  const r = await generateSpecificWeekPlans('sow', 'u', 4)
  assert.deepEqual(generated.sort(), [2, 3])
  assert.equal(r.generated, 2)
  assert.deepEqual(inserted.map(x => x.lesson_number).sort(), [2, 3])
})

test('one failing lesson no longer discards the others — successes are saved and the failure is reported', async () => {
  failingLessons = new Set([2])
  const r = await generateSpecificWeekPlans('sow', 'u', 4)
  assert.equal(r.generated, 2)
  assert.equal(r.failed, 1)
  assert.deepEqual(r.failedLessons?.map(f => f.lessonNumber), [2])
  assert.deepEqual(inserted.map(x => x.lesson_number).sort(), [1, 3])
})

test('every lesson failing still throws — total failure is never reported as success', async () => {
  failingLessons = new Set([1, 2, 3])
  await assert.rejects(() => generateSpecificWeekPlans('sow', 'u', 4), /failed for all 3 lesson/)
  assert.equal(inserted.length, 0)
})

test('a concurrent request that saved first (unique violation) → already_generated, not an error', async () => {
  saveError = new Error('Failed to save lesson plans: duplicate key value violates unique constraint "lesson_plans_sow_week_lesson_key"')
  const r = await generateSpecificWeekPlans('sow', 'u', 4)
  assert.equal(r.generated, 0)
  assert.equal(r.reason, 'already_generated')
})

test('other save errors still propagate', async () => {
  saveError = new Error('Failed to save lesson plans: connection reset')
  await assert.rejects(() => generateSpecificWeekPlans('sow', 'u', 4), /connection reset/)
})

test('the quota hook runs exactly once before the first AI call; a refusal stops all AI work', async () => {
  const order: string[] = []
  await generateSpecificWeekPlans('sow', 'u', 4, undefined, { beforeGenerate: async () => { order.push('hook'); assert.equal(generated.length, 0) } })
  assert.equal(order.length, 1)

  generated = []
  await assert.rejects(
    () => generateSpecificWeekPlans('sow', 'u', 4, undefined, { beforeGenerate: async () => { throw new Error('daily limit') } }),
    /daily limit/,
  )
  assert.equal(generated.length, 0, 'no lesson generated after the cap refused')
})
