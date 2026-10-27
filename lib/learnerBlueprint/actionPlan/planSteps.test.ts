// lib/learnerBlueprint/actionPlan/planSteps.test.ts
//
// The plan steps the Learner Progress Report receives (projections.ts
// `toApprovedPlanStep` / `listActiveApprovedPlanForLearner`). Repositories
// are mocked — no database. Synthetic rows only.

import { test, before, beforeEach, mock } from 'node:test'
import assert from 'node:assert/strict'

type Row = Record<string, unknown>

let approvedRows: Row[] = []
let latestDecisions: Record<string, string> = {}
let decisionQueries: string[][] = []

mock.module('@/lib/repositories', {
  namedExports: {
    repos: {
      blueprintActionItems: { listApprovedForLearner: async () => approvedRows },
      blueprintActionReviews: {
        findLatestDecisionsForActionItems: async (ids: string[]) => {
          decisionQueries.push(ids)
          return latestDecisions
        },
      },
    },
  },
})

let listActiveApprovedPlanForLearner: typeof import('./projections').listActiveApprovedPlanForLearner

before(async () => {
  ;({ listActiveApprovedPlanForLearner } = await import('./projections'))
})

beforeEach(() => {
  approvedRows = []
  latestDecisions = {}
  decisionQueries = []
})

function row(id: string, visibility: string, overrides: Row = {}): Row {
  return {
    id, learner_id: 'learner-1', school_id: 'school-1', academic_year_id: null, term_id: null, blueprint_snapshot_id: null,
    context: 'current_term', priority: 'medium', status: 'approved', visibility,
    title: `Step ${id}`, rationale: `Why ${id}`, intended_outcome: `Goal ${id}`,
    learner_action: `Learner does ${id}`, teacher_action: `Teacher does ${id}`, parent_support: `Home does ${id}`, school_support: null,
    success_indicator: `Success ${id}`, target_capability: null, sub_strand_id: null, review_date: '2026-11-15',
    teacher_notes: 'PRIVATE TEACHER NOTE', proposal_source: 'teacher', source_generator: null,
    evidence_basis: { private: 'EVIDENCE BASIS' }, proposed_by: null, reviewed_by: null, reviewed_at: null, decision_reason: null,
    created_at: '2026-10-01T09:00:00.000Z', updated_at: '2026-10-01T09:00:00.000Z',
    ...overrides,
  }
}

test('teacher_only items never reach the report; each audience view carries only its projected fields', async () => {
  approvedRows = [row('a', 'teacher_only'), row('b', 'learner_visible'), row('c', 'parent_visible'), row('d', 'shared')]
  const steps = await listActiveApprovedPlanForLearner('learner-1', 'school-1')

  assert.deepEqual(steps.map(s => s.id), ['b', 'c', 'd'])
  const byId = Object.fromEntries(steps.map(s => [s.id, s]))
  assert.equal(byId.b.parentView, null)
  assert.equal(byId.b.learnerView?.assignedActivity, 'Learner does b')
  assert.equal(byId.c.learnerView, null)
  assert.equal(byId.c.parentView?.homeSupport, 'Home does c')
  assert.equal(byId.c.parentView?.whatTheSchoolWillDo, 'Teacher does c')
  assert.ok(byId.d.learnerView && byId.d.parentView)

  const serialized = JSON.stringify(steps)
  assert.doesNotMatch(serialized, /PRIVATE TEACHER NOTE/)
  assert.doesNotMatch(serialized, /EVIDENCE BASIS/)
})

test('a step already reviewed as complete is no longer presented; other review decisions keep it active', async () => {
  approvedRows = [row('done', 'shared'), row('revise', 'shared'), row('fresh', 'shared')]
  latestDecisions = { done: 'complete', revise: 'needs_revision' }
  const steps = await listActiveApprovedPlanForLearner('learner-1', 'school-1')
  assert.deepEqual(steps.map(s => s.id), ['revise', 'fresh'])
})

test('review decisions are fetched once, batched, never per item — and not at all when nothing is visible', async () => {
  approvedRows = [row('x', 'shared'), row('y', 'parent_visible'), row('z', 'teacher_only')]
  await listActiveApprovedPlanForLearner('learner-1', 'school-1')
  assert.deepEqual(decisionQueries, [['x', 'y']])

  decisionQueries = []
  approvedRows = [row('only-teacher', 'teacher_only')]
  assert.deepEqual(await listActiveApprovedPlanForLearner('learner-1', 'school-1'), [])
  assert.deepEqual(decisionQueries, [])
})
