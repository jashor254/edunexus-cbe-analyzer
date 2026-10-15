// lib/career/careerEvolution.test.ts
//
// The Career Evolution lens: composes dated, sourced CareerSignals into an
// honest "how this role is changing" view. These lock the chronology, the
// change-type counting, the durable-vs-shifting split (only when supplied),
// the empty-signal grace, and the honesty of the narrative (direction, never
// "the job dies").

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildCareerEvolution } from './careerEvolution'
import type { CareerSignal, CareerSignalType, CareerSignalConfidence } from './careerSignals'

function sig(
  id: string,
  observedAt: string,
  signalType: CareerSignalType,
  confidence: CareerSignalConfidence = 'EMERGING',
): CareerSignal {
  return {
    id,
    title: `title-${id}`,
    summary: `summary-${id}`,
    signalType,
    geography: 'KENYA',
    confidence,
    observedAt,
    lastReviewedAt: observedAt,
    relatedCareerSlugs: ['lawyer'],
    relatedCategories: [],
    relatedPathways: [],
    relatedSkills: [],
    learnerExplanation: `why-${id}`,
    exploreNext: [],
    sources: [],
  }
}

test('trajectory is chronological, oldest → newest', () => {
  const view = buildCareerEvolution('lawyer', [
    sig('c', '2025-06-01', 'SKILL_SHIFT'),
    sig('a', '2023-01-01', 'TECHNOLOGY_SHIFT'),
    sig('b', '2024-03-01', 'NEW_WORK_PRACTICE'),
  ])
  assert.deepEqual(view.trajectory.map((s) => s.observedAt), ['2023-01-01', '2024-03-01', '2025-06-01'])
  assert.equal(view.earliest_observed, '2023-01-01')
  assert.equal(view.latest_observed, '2025-06-01')
  assert.equal(view.signal_count, 3)
})

test('change_types counted, most frequent first', () => {
  const view = buildCareerEvolution('lawyer', [
    sig('a', '2023-01-01', 'TECHNOLOGY_SHIFT'),
    sig('b', '2024-01-01', 'TECHNOLOGY_SHIFT'),
    sig('c', '2025-01-01', 'SKILL_SHIFT'),
  ])
  assert.deepEqual(view.change_types, [
    { type: 'TECHNOLOGY_SHIFT', count: 2 },
    { type: 'SKILL_SHIFT', count: 1 },
  ])
})

test('strongest_confidence is the most-established present', () => {
  const view = buildCareerEvolution('lawyer', [
    sig('a', '2023-01-01', 'TECHNOLOGY_SHIFT', 'EARLY'),
    sig('b', '2024-01-01', 'SKILL_SHIFT', 'ESTABLISHED'),
    sig('c', '2025-01-01', 'NEW_WORK_PRACTICE', 'EMERGING'),
  ])
  assert.equal(view.strongest_confidence, 'ESTABLISHED')
})

test("the lawyer: durable core vs shifting tasks appear only when supplied, and the narrative stays honest", () => {
  const signals = [
    sig('ai-contract-review', '2023-01-01', 'TECHNOLOGY_SHIFT', 'ESTABLISHED'),
    sig('e-filing', '2024-02-01', 'NEW_WORK_PRACTICE', 'EMERGING'),
    sig('legaltech-skills', '2025-03-01', 'SKILL_SHIFT', 'EMERGING'),
  ]
  const view = buildCareerEvolution('lawyer', signals, {
    durableTasks: ['judgment', 'advocacy', 'ethics'],
    shiftingTasks: ['bulk legal research', 'first-draft contracts'],
  })

  assert.deepEqual(view.durable_core, ['judgment', 'advocacy', 'ethics'])
  assert.deepEqual(view.shifting_tasks, ['bulk legal research', 'first-draft contracts'])
  assert.match(view.narrative, /how lawyer is changing/)
  assert.match(view.narrative, /durable human core — judgment, advocacy, and ethics — endures/)
  assert.match(view.narrative, /shift to tools/)
  // Honesty guardrail: direction, never "the job dies".
  assert.match(view.narrative, /not a prediction that the role disappears/)
  assert.doesNotMatch(view.narrative, /will die|replaced entirely|no longer exist/)
})

test('without ai_impact, no durable/shifting are invented', () => {
  const view = buildCareerEvolution('lawyer', [sig('a', '2024-01-01', 'TECHNOLOGY_SHIFT')])
  assert.deepEqual(view.durable_core, [])
  assert.deepEqual(view.shifting_tasks, [])
  assert.doesNotMatch(view.narrative, /durable human core/)
})

test('no signals: graceful, and absence is not treated as "static"', () => {
  const view = buildCareerEvolution('astronaut', [])
  assert.equal(view.signal_count, 0)
  assert.deepEqual(view.trajectory, [])
  assert.equal(view.strongest_confidence, null)
  assert.equal(view.earliest_observed, null)
  assert.match(view.narrative, /not yet traced/)
  assert.match(view.narrative, /not evidence the role is static/)
})

test('deterministic: identical input yields identical output', () => {
  const signals = [sig('a', '2023-01-01', 'TECHNOLOGY_SHIFT'), sig('b', '2024-01-01', 'SKILL_SHIFT')]
  const opts = { durableTasks: ['judgment'], shiftingTasks: ['research'] }
  assert.deepEqual(buildCareerEvolution('lawyer', signals, opts), buildCareerEvolution('lawyer', signals, opts))
})
