// Run: npx tsx --test lib/growth/quickActions.test.ts

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { findQuickAction, shouldAdvanceStage, QUICK_ACTIONS } from './quickActions'

test('every quick action has a unique key and a non-empty label', () => {
  const keys = QUICK_ACTIONS.map((a) => a.key)
  assert.equal(new Set(keys).size, keys.length)
  for (const a of QUICK_ACTIONS) assert.ok(a.label.trim().length > 0)
})

test('findQuickAction resolves a known key and returns undefined for an unknown one', () => {
  assert.equal(findQuickAction('called')?.label, 'Called')
  assert.equal(findQuickAction('not-a-real-action'), undefined)
})

test('shouldAdvanceStage: a first-contact action advances research -> contacted', () => {
  const called = findQuickAction('called')!
  assert.equal(shouldAdvanceStage('research', called), true)
})

test('shouldAdvanceStage: never regresses — a school already past the target stage is not moved backward', () => {
  const called = findQuickAction('called')! // advances to 'contacted'
  assert.equal(shouldAdvanceStage('demo_scheduled', called), false)
  assert.equal(shouldAdvanceStage('contacted', called), false, 'already at the target stage — no-op, not an error')
})

test('shouldAdvanceStage: Pilot Declined forces `lost` unconditionally, even from an earlier stage', () => {
  const declined = findQuickAction('pilot_declined')!
  assert.equal(shouldAdvanceStage('research', declined), true)
  assert.equal(shouldAdvanceStage('pilot_running', declined), true)
  assert.equal(shouldAdvanceStage('lost', declined), false, 'already lost — no-op')
})

test('shouldAdvanceStage: Demo Scheduled/Completed advance in the expected order', () => {
  const scheduled = findQuickAction('demo_scheduled')!
  const completed = findQuickAction('demo_completed')!
  assert.equal(shouldAdvanceStage('discovery', scheduled), true)
  assert.equal(shouldAdvanceStage('demo_scheduled', completed), true)
  assert.equal(shouldAdvanceStage('demo_completed', scheduled), false, 'already past demo_scheduled')
})
