// lib/studentHome/nextAction.test.ts
//
// Phase 7 — Learner Home Convergence. Pure unit tests for the deterministic
// Home priority/translation rules — no DB, no network. Standard-safe.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  chooseNextAction, toNextActionCard, buildAttentionItems, trendLabel,
  deriveAssignmentState, deriveCompassDeliveryState,
} from './nextAction'
import type { NextActionCandidate } from './types'

function candidate(overrides: Partial<NextActionCandidate>): NextActionCandidate {
  return {
    kind: 'assignment',
    id: 'a1',
    title: 'Fractions practice',
    subject: 'Mathematics',
    provenance: 'class_assignment',
    state: 'ready',
    href: '/dashboard/assignments',
    dueDate: new Date(Date.now() + 3 * 86_400_000).toISOString(),
    daysLeft: 3,
    isOverdue: false,
    whyItMatters: null,
    ...overrides,
  }
}

test('chooseNextAction: empty candidates -> null', () => {
  assert.equal(chooseNextAction([]), null)
})

test('chooseNextAction: an overdue assignment always wins over everything else', () => {
  const overdue = candidate({ id: 'overdue', isOverdue: true, daysLeft: -2 })
  const approved = candidate({ id: 'approved', provenance: 'teacher_approved_action', isOverdue: false, daysLeft: 5 })
  const dueSoon = candidate({ id: 'due-soon', daysLeft: 1 })
  const chosen = chooseNextAction([dueSoon, approved, overdue])
  assert.equal(chosen?.id, 'overdue')
})

test('chooseNextAction: a teacher-approved action beats a merely due-soon assignment', () => {
  const approved = candidate({ id: 'approved', provenance: 'teacher_approved_action', daysLeft: 5 })
  const dueSoon = candidate({ id: 'due-soon', daysLeft: 1 })
  const chosen = chooseNextAction([dueSoon, approved])
  assert.equal(chosen?.id, 'approved')
})

test('chooseNextAction: with no overdue/approved work, the assignment due soonest wins', () => {
  const soon = candidate({ id: 'soon', daysLeft: 1, dueDate: new Date(Date.now() + 1 * 86_400_000).toISOString() })
  const later = candidate({ id: 'later', daysLeft: 6, dueDate: new Date(Date.now() + 6 * 86_400_000).toISOString() })
  const chosen = chooseNextAction([later, soon])
  assert.equal(chosen?.id, 'soon')
})

test('chooseNextAction: a completed candidate is never chosen', () => {
  const completed = candidate({ id: 'done', state: 'completed', provenance: 'teacher_approved_action' })
  assert.equal(chooseNextAction([completed]), null)
})

test('chooseNextAction: two overdue items resolve to the earliest due date, deterministically', () => {
  const a = candidate({ id: 'a', isOverdue: true, dueDate: '2026-01-01T00:00:00Z' })
  const b = candidate({ id: 'b', isOverdue: true, dueDate: '2026-01-03T00:00:00Z' })
  assert.equal(chooseNextAction([b, a])?.id, 'a')
})

test('toNextActionCard: teacher-approved action shows the teacher rationale, never a generic due-date string', () => {
  const c = candidate({ provenance: 'teacher_approved_action', whyItMatters: 'You showed strong fraction basics — this builds on that.' })
  const card = toNextActionCard(c)
  assert.equal(card.subtitle, 'You showed strong fraction basics — this builds on that.')
})

test('toNextActionCard: class assignment overdue subtitle is honest and non-punitive', () => {
  const c = candidate({ isOverdue: true, daysLeft: -3 })
  const card = toNextActionCard(c)
  assert.equal(card.subtitle, '3d overdue')
})

test('toNextActionCard: class assignment due today', () => {
  const c = candidate({ daysLeft: 0 })
  assert.equal(toNextActionCard(c).subtitle, 'Due today')
})

test('buildAttentionItems: overdue items appear, capped at 4 total with risk subjects', () => {
  const overdue = [candidate({ id: 'o1', isOverdue: true, title: 'Essay' })]
  const risked = [
    { subject: 'mathematics', displayName: 'Mathematics' },
    { subject: 'english', displayName: 'English' },
  ]
  const items = buildAttentionItems(overdue, risked, null, '/dashboard/assignments')
  assert.equal(items.length, 3)
  assert.match(items[0].label, /overdue/)
  assert.match(items[1].label, /Mathematics needs more practice/)
})

test('buildAttentionItems: a risked subject already shown as Next Action is excluded (no repeat)', () => {
  const risked = [{ subject: 'mathematics', displayName: 'Mathematics' }]
  const items = buildAttentionItems([], risked, 'mathematics', '/dashboard/assignments')
  assert.equal(items.length, 0)
})

test('buildAttentionItems: never renders a raw risk severity label', () => {
  const risked = [{ subject: 'mathematics', displayName: 'Mathematics' }]
  const items = buildAttentionItems([], risked, null, '/dashboard/assignments')
  for (const item of items) {
    assert.doesNotMatch(item.label, /HIGH RISK|CRITICAL|at_risk|watch/i)
  }
})

test('trendLabel: maps every canonical Trend value to learner-safe, non-clinical copy', () => {
  assert.equal(trendLabel('improving'), 'Improving')
  assert.equal(trendLabel('declining'), 'Needs practice')
  assert.equal(trendLabel('stable'), 'Steady')
  assert.equal(trendLabel('mixed'), 'Mixed')
  assert.equal(trendLabel('insufficient_data'), 'Just started')
})

test('trendLabel: declining is never rendered as the raw word "declining" or anything punitive', () => {
  const label = trendLabel('declining')
  assert.doesNotMatch(label, /declin|risk|fail|poor|weak/i)
})

test('deriveAssignmentState: marked submission is completed regardless of due date', () => {
  assert.equal(deriveAssignmentState('marked', true, -5), 'completed')
})

test('deriveAssignmentState: overdue and not yet submitted is overdue', () => {
  assert.equal(deriveAssignmentState('pending', true, -1), 'overdue')
})

test('deriveAssignmentState: submitted but not marked is waiting_for_review', () => {
  assert.equal(deriveAssignmentState('submitted', false, 3), 'waiting_for_review')
})

test('deriveAssignmentState: due within 2 days and not yet acted on is due_soon', () => {
  assert.equal(deriveAssignmentState('pending', false, 2), 'due_soon')
})

test('deriveAssignmentState: far-off and untouched is ready', () => {
  assert.equal(deriveAssignmentState('pending', false, 10), 'ready')
})

test('deriveCompassDeliveryState: maps every delivery status to a valid ActionState', () => {
  assert.equal(deriveCompassDeliveryState('available'), 'ready')
  assert.equal(deriveCompassDeliveryState('started'), 'in_progress')
  assert.equal(deriveCompassDeliveryState('completed'), 'completed')
  assert.equal(deriveCompassDeliveryState('expired'), 'completed')
})
