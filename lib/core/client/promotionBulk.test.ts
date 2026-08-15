// lib/core/client/promotionBulk.test.ts
//
// Phase 7 — pure unit tests for the promotion page's bulk-cohort logic.
// No DOM, no server, no fixture school — this is client-side state
// arithmetic, tested directly per this codebase's established pattern for
// extracted page logic (app/(auth)/signup/buildAuthCallbackUrl.test.ts).
//
// Run: npx tsx --test lib/core/client/promotionBulk.test.ts

import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  groupByCurrentClass,
  applyCohortDecision,
  summarizeDecisions,
  decisionNeedsDestination,
  type PromotionPreviewRow,
} from './promotionBulk'

function makeCohort(className: string, count: number, prefix: string): PromotionPreviewRow[] {
  return Array.from({ length: count }, (_, i) => ({ learner_id: `${prefix}-${i}`, current_class: className }))
}

// ── Task A: cohort grouping ─────────────────────────────────────────────

test('groupByCurrentClass groups by source class, preserving first-seen order', () => {
  const preview = [...makeCohort('7A', 2, 'a'), ...makeCohort('7B', 1, 'b'), ...makeCohort('7A', 1, 'a2')]
  const cohorts = groupByCurrentClass(preview)
  assert.equal(cohorts.length, 2)
  assert.equal(cohorts[0].className, '7A')
  assert.equal(cohorts[0].learnerIds.length, 3)
  assert.equal(cohorts[1].className, '7B')
  assert.equal(cohorts[1].learnerIds.length, 1)
})

// ── §22: bulk application, 30 learners ──────────────────────────────────

test('applyCohortDecision: 30 learners, Promote + 8A — all 30 become promote/8A, no backend call involved', () => {
  const cohort = makeCohort('7A', 30, 'l').map(r => r.learner_id)
  const result = applyCohortDecision({
    learnerIds: cohort,
    decision: 'promote',
    destinationClassId: '8A-class-id',
    currentDecisions: {},
    currentDestinations: {},
    overridden: {},
  })
  assert.equal(result.appliedCount, 30)
  assert.equal(result.skippedCount, 0)
  for (const id of cohort) {
    assert.equal(result.decisions[id], 'promote')
    assert.equal(result.destinations[id], '8A-class-id')
  }
})

// ── §23: individual exception after bulk apply ──────────────────────────

test('an individual override after bulk apply is preserved — 29 promote/8A, 1 repeat/7A', () => {
  const cohort = makeCohort('7A', 30, 'l').map(r => r.learner_id)
  const bulk = applyCohortDecision({
    learnerIds: cohort, decision: 'promote', destinationClassId: '8A',
    currentDecisions: {}, currentDestinations: {}, overridden: {},
  })

  // Individual edit — exactly what a per-row <select> onChange does.
  const peterId = cohort[0]
  const decisions = { ...bulk.decisions, [peterId]: 'repeat' as const }
  const destinations = { ...bulk.destinations, [peterId]: '7A' }
  const overridden = { [peterId]: true }

  const promoteCount = cohort.filter(id => decisions[id] === 'promote').length
  const repeatCount = cohort.filter(id => decisions[id] === 'repeat').length
  assert.equal(promoteCount, 29)
  assert.equal(repeatCount, 1)
  assert.equal(decisions[peterId], 'repeat')
  assert.equal(destinations[peterId], '7A')

  // The final payload shape a real submit would build from this state:
  const payload = cohort.map(id => ({
    learnerId: id,
    decision: decisions[id],
    destinationClassId: destinations[id],
  }))
  assert.equal(payload.find(p => p.learnerId === peterId)?.decision, 'repeat')
  assert.equal(payload.filter(p => p.decision === 'promote').length, 29)
  void overridden
})

// ── §24: multiple exceptions, summary + payload agree ───────────────────

test('multiple exceptions: summary counts and per-learner state agree exactly', () => {
  const cohort = makeCohort('7A', 30, 'l').map(r => r.learner_id)
  const bulk = applyCohortDecision({
    learnerIds: cohort, decision: 'promote', destinationClassId: '8A',
    currentDecisions: {}, currentDestinations: {}, overridden: {},
  })

  let decisions = bulk.decisions
  let destinations = bulk.destinations
  const overridden: Record<string, boolean> = {}

  // 1 -> 8B, 1 -> repeat 7A, 1 -> skip
  decisions = { ...decisions, [cohort[0]]: 'promote' }
  destinations = { ...destinations, [cohort[0]]: '8B' }
  overridden[cohort[0]] = true

  decisions = { ...decisions, [cohort[1]]: 'repeat' }
  destinations = { ...destinations, [cohort[1]]: '7A' }
  overridden[cohort[1]] = true

  decisions = { ...decisions, [cohort[2]]: 'skip' }
  delete destinations[cohort[2]]
  overridden[cohort[2]] = true

  const classNameById = { '8A': 'Grade 8A', '8B': 'Grade 8B', '7A': 'Grade 7A' }
  const summary = summarizeDecisions(cohort, decisions, destinations, overridden, classNameById)

  assert.equal(summary.byDecision.promote, 28) // 27 untouched (8A) + 1 exception (8B)
  assert.equal(summary.byDecision.repeat, 1)
  assert.equal(summary.byDecision.skip, 1)
  assert.equal(summary.byDecision.graduate, 0)
  assert.equal(summary.overriddenCount, 3)
  assert.equal(summary.total, 30)

  const dest8A = summary.byDestinationClass.find(d => d.classId === '8A')
  const dest8B = summary.byDestinationClass.find(d => d.classId === '8B')
  assert.equal(dest8A?.count, 27)
  assert.equal(dest8B?.count, 1)
  assert.equal(dest8B?.className, 'Grade 8B')
})

// ── §25: incomplete destination ──────────────────────────────────────────

test('decisionNeedsDestination: promote/repeat need one, graduate/skip do not', () => {
  assert.equal(decisionNeedsDestination('promote'), true)
  assert.equal(decisionNeedsDestination('repeat'), true)
  assert.equal(decisionNeedsDestination('graduate'), false)
  assert.equal(decisionNeedsDestination('skip'), false)
})

test('applying Promote with no destination leaves every learner without a destination — the page\'s existing canRun/missingDestination check must catch this before submit', () => {
  const cohort = makeCohort('7A', 5, 'l').map(r => r.learner_id)
  const result = applyCohortDecision({
    learnerIds: cohort, decision: 'promote', destinationClassId: null,
    currentDecisions: {}, currentDestinations: {}, overridden: {},
  })
  for (const id of cohort) {
    assert.equal(result.decisions[id], 'promote')
    assert.equal(result.destinations[id], undefined)
  }
  // The existing page's own `missingDestination` check
  // (decision !== 'graduate' && !destinationClassByLearner[id]) would be
  // true for every one of these — exactly the block this test proves the
  // bulk helper does not bypass.
  const missingDestination = cohort.some(id => decisionNeedsDestination(result.decisions[id]) && !result.destinations[id])
  assert.equal(missingDestination, true)
})

// ── §26: eligibility — bulk only ever operates on the supplied cohort ───

test('bulk apply never touches a learner outside the supplied cohort (e.g. a transferred/withdrawn learner excluded from the preview)', () => {
  const eligible = makeCohort('7A', 3, 'e').map(r => r.learner_id)
  const excludedTransferred = 'transferred-learner-not-in-preview'
  const result = applyCohortDecision({
    learnerIds: eligible, decision: 'promote', destinationClassId: '8A',
    currentDecisions: {}, currentDestinations: {}, overridden: {},
  })
  assert.equal(result.decisions[excludedTransferred], undefined, 'a learner never passed in must never appear in the result')
})

// ── §27/§28: Grade 9 and Grade 12 — no fabricated automatic destination ──

test('a Grade 9 (or Grade 12) cohort bulk-applies "graduate" with no destination required — the UI never fabricates a next-grade class', () => {
  const grade9Cohort = makeCohort('9A', 25, 'g9').map(r => r.learner_id)
  const result = applyCohortDecision({
    learnerIds: grade9Cohort, decision: 'graduate', destinationClassId: null,
    currentDecisions: {}, currentDestinations: {}, overridden: {},
  })
  for (const id of grade9Cohort) {
    assert.equal(result.decisions[id], 'graduate')
    assert.equal(result.destinations[id], undefined, 'graduate never carries a fabricated destination class')
  }
})

test('an admin CAN explicitly bulk-apply "promote" with a real, admin-chosen Grade 10 destination for a Grade 9 cohort — nothing prevents the deliberate case', () => {
  const grade9Cohort = makeCohort('9A', 25, 'g9').map(r => r.learner_id)
  const result = applyCohortDecision({
    learnerIds: grade9Cohort, decision: 'promote', destinationClassId: 'real-grade-10-class-id',
    currentDecisions: {}, currentDestinations: {}, overridden: {},
  })
  for (const id of grade9Cohort) {
    assert.equal(result.decisions[id], 'promote')
    assert.equal(result.destinations[id], 'real-grade-10-class-id', 'the destination is exactly the class the admin explicitly picked — never inferred')
  }
})

// ── §29: reapply / override safety ───────────────────────────────────────

test('reapplying the same bulk decision after an exception exists does NOT overwrite the exception', () => {
  const cohort = makeCohort('7A', 31, 'l').map(r => r.learner_id)
  const first = applyCohortDecision({
    learnerIds: cohort, decision: 'promote', destinationClassId: '8A',
    currentDecisions: {}, currentDestinations: {}, overridden: {},
  })

  const peterId = cohort[0]
  const afterException = { decisions: { ...first.decisions, [peterId]: 'repeat' as const }, destinations: { ...first.destinations, [peterId]: '7A' } }
  const overridden = { [peterId]: true }

  // Reapply "Promote -> 8A" to the whole cohort a second time.
  const second = applyCohortDecision({
    learnerIds: cohort, decision: 'promote', destinationClassId: '8A',
    currentDecisions: afterException.decisions, currentDestinations: afterException.destinations, overridden,
  })

  assert.equal(second.decisions[peterId], 'repeat', 'Peter\'s exception must survive a second bulk apply')
  assert.equal(second.destinations[peterId], '7A')
  assert.equal(second.skippedCount, 1)
  assert.equal(second.appliedCount, 30)
})

test('reapplying with a DIFFERENT bulk value still only touches unmodified learners', () => {
  const cohort = makeCohort('7A', 10, 'l').map(r => r.learner_id)
  const overridden = { [cohort[5]]: true }
  const currentDecisions = { [cohort[5]]: 'skip' as const }
  const currentDestinations = {}

  const result = applyCohortDecision({
    learnerIds: cohort, decision: 'repeat', destinationClassId: '7A-repeat-class',
    currentDecisions, currentDestinations, overridden,
  })
  assert.equal(result.decisions[cohort[5]], 'skip', 'the overridden learner is untouched even though the bulk decision changed')
  assert.equal(result.appliedCount, 9)
  assert.equal(result.skippedCount, 1)
})
