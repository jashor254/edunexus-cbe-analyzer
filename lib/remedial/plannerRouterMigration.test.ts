// lib/remedial/plannerRouterMigration.test.ts
//
// Sprint 6B (ADR-0028 activation): proves enrichWithAI()'s behavior is
// unchanged after migrating from callDeepSeek() directly to
// routedCompletion() (lib/ai-orchestration/router.ts) — same output shape,
// same graceful-null fallback on any failure, same prompt/options passed
// through. routedCompletion is mocked once for the whole file (same
// constraint noted in lib/kiswahili/inshaEvaluator.test.ts: node:test's
// experimental mock.module is unreliable across repeated mock/restore
// cycles in one process) — each test switches a shared mutable behavior
// flag before calling enrichWithAI. No real AI calls, no tokens spent.
//
// Run with: npx tsx --experimental-test-module-mocks --env-file=.env.local --test lib/remedial/plannerRouterMigration.test.ts
import { test, before, mock } from 'node:test'
import assert from 'node:assert/strict'
import type { RemedialGroup, TeacherAllocation } from './types'

type RouterBehavior = 'success-plain-list' | 'success-too-short' | 'reject'
let routerBehavior: RouterBehavior = 'success-plain-list'

let capturedRequest: Record<string, unknown> | null = null

const VALID_WEEK_PLAN = [
  '1. Week 4: Re-teach fractions basics with Group A using manipulatives.',
  '2. Week 5: Focused worked-example lesson for Group B on adding fractions.',
  '3. Week 6: Re-assessment — measure recovery across all groups.',
].join('\n')

mock.module('@/lib/ai-orchestration/router', {
  namedExports: {
    routedCompletion: async (request: Record<string, unknown>) => {
      capturedRequest = request
      if (routerBehavior === 'reject') throw new Error('All AI providers failed. Last error: timeout')
      if (routerBehavior === 'success-too-short') {
        return { text: 'ok', provider: 'deepseek', model: 'deepseek-chat', prompt_tokens: 10, completion_tokens: 2, total_tokens: 12, latency_ms: 5, cost_units: 0.00001, fallback_used: false }
      }
      return { text: VALID_WEEK_PLAN, provider: 'deepseek', model: 'deepseek-chat', prompt_tokens: 120, completion_tokens: 60, total_tokens: 180, latency_ms: 400, cost_units: 0.00005, fallback_used: false }
    },
  },
})

let enrichWithAI: typeof import('./planner').enrichWithAI

before(async () => {
  ;({ enrichWithAI } = await import('./planner'))
})

function fixtureGroups(): RemedialGroup[] {
  return [
    { type: 'prerequisite_gap', label: 'Group A — Prerequisite Gap (2 students)', students: [], teaching_action: 'Re-teach first', lessons_needed: 2, suggested_activity: 'Practical activity on fractions.' },
    { type: 'concept_confusion', label: 'Group B — Concept Confusion (1 students)', students: [], teaching_action: 'Focused lesson', lessons_needed: 1, suggested_activity: 'Worked examples.' },
  ]
}

function fixtureAllocation(): TeacherAllocation {
  return { total_remedial_weeks: 2, week_by_week: ['fallback week plan'], compass_assignments: 3, check_in_week: 6 }
}

test('enrichWithAI: on success, returns the parsed week plan (unchanged output shape)', async () => {
  routerBehavior = 'success-plain-list'
  const result = await enrichWithAI(fixtureGroups(), fixtureAllocation(), {
    sowId: 's1', teacherId: 't1', classId: 'c1', strand: 'Numbers', subStrand: 'Fractions',
    subject: 'mathematics', term: 2, year: 2026, currentWeek: 4, weeksRemaining: 6,
  }, ['prior concept'])

  assert.ok(result)
  assert.equal(result!.weekPlan.length, 3)
  assert.match(result!.weekPlan[0], /Re-teach fractions basics/)
})

test('enrichWithAI: routedCompletion failure (both providers down) falls back to null, exactly like a direct callDeepSeek failure did', async () => {
  routerBehavior = 'reject'
  const result = await enrichWithAI(fixtureGroups(), fixtureAllocation(), {
    sowId: 's1', teacherId: 't1', classId: 'c1', strand: 'Numbers', subStrand: 'Fractions',
    subject: 'mathematics', term: 2, year: 2026, currentWeek: 4, weeksRemaining: 6,
  }, [])
  assert.equal(result, null)
})

test('enrichWithAI: a too-short/malformed response (parses to <2 lines) falls back to null', async () => {
  routerBehavior = 'success-too-short'
  const result = await enrichWithAI(fixtureGroups(), fixtureAllocation(), {
    sowId: 's1', teacherId: 't1', classId: 'c1', strand: 'Numbers', subStrand: 'Fractions',
    subject: 'mathematics', term: 2, year: 2026, currentWeek: 4, weeksRemaining: 6,
  }, [])
  assert.equal(result, null)
})

test('enrichWithAI: calls routedCompletion with mode "quality" and no system prompt — matches the pre-migration call exactly', async () => {
  routerBehavior = 'success-plain-list'
  capturedRequest = null
  await enrichWithAI(fixtureGroups(), fixtureAllocation(), {
    sowId: 's1', teacherId: 't1', classId: 'c1', strand: 'Numbers', subStrand: 'Fractions',
    subject: 'mathematics', term: 2, year: 2026, currentWeek: 4, weeksRemaining: 6,
  }, [])

  assert.ok(capturedRequest)
  assert.equal(capturedRequest!.mode, 'quality')
  assert.equal(capturedRequest!.system, undefined)
  assert.equal(capturedRequest!.max_tokens, 400)
  assert.equal(capturedRequest!.temperature, 0.3)
  assert.equal(capturedRequest!.feature, 'remedial.enrich')
  assert.match(capturedRequest!.prompt as string, /Kenyan CBC teacher/)
})
